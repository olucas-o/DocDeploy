# Implementation Plan: Governança de Documentos

**Branch**: `001-document-governance` | **Date**: 2026-09-16 | **Spec**: [spec.md](spec.md)

**Input**: Especificação de governança de documentos, complementada pela arquitetura técnica definida para React, NestJS, worker Python e processamento assíncrono.

## Summary

Construir uma aplicação multi-tenant para receber documentos, preservar versões, extrair informações, encaminhar revisões e produzir uma trilha de auditoria consultável. A interface React consome uma API NestJS; a API guarda o estado de negócio em PostgreSQL, os binários em armazenamento S3-compatível e coordena o pipeline assíncrono no Redis/BullMQ. Um worker FastAPI isolado executa antivírus, leitura de PDF, OCR e extração; a análise por OpenAI é opcional por organização e nunca determina aprovação automaticamente.

## Technical Context

**Language/Version**: TypeScript com `strict` habilitado para `web/` e `api/`; Node.js LTS atual suportado pelo NestJS; Python 3.14+ para `worker/`.

**Primary Dependencies**: React; NestJS, TypeORM, BullMQ, Swagger/OpenAPI, JWT, Argon2, Pino e cliente Prometheus na API; FastAPI, BullMQ Python, Tesseract, PyMuPDF, pdfplumber, Pillow e ClamAV no worker.

**Storage**: PostgreSQL como fonte de verdade transacional; Redis para filas BullMQ, locks, progresso e retenção operacional curta; MinIO no desenvolvimento e S3 compatível em produção para originais e derivados; SMTP/MailHog para notificações.

**Testing**: testes unitários TypeScript e Python; integração com PostgreSQL, Redis, armazenamento e ClamAV em contêineres; contratos OpenAPI e de fila; ponta a ponta em Docker Compose; testes de autorização cruzada de tenant, recuperação de jobs e auditoria.

**Target Platform**: navegadores modernos para a aplicação React; serviços Linux conteinerizados em ambientes local, CI, homologação e produção.

**Project Type**: aplicação web com API, worker assíncrono e infraestrutura conteinerizada.

**Performance Goals**: 95% dos documentos submetidos produzem extração ou indicação de revisão em até 2 minutos; 90% dos usuários localizam a versão vigente em até 3 minutos; exportação de até 1.000 eventos termina em até 1 minuto.

**Constraints**: todo conteúdo não confiável deve permanecer em quarentena até a aprovação do antivírus; processamento é *at-least-once* e deve ser idempotente; acesso, dados e objetos são isolados por organização; nenhuma credencial, JWT ou conteúdo do arquivo transita em jobs; a trilha é append-only e tamper-evident, sem prometer imutabilidade absoluta contra administradores de infraestrutura.

**Scale/Scope**: primeira versão para documentos enviados manualmente por organizações, cobrindo contrato, nota, certificado, relatório e cadastro; até 1.000 eventos por exportação. Integrações diretas com e-mail/pastas, assinatura eletrônica e automação de decisões ficam fora do escopo.

## Constitution Check

O arquivo de constituição ainda é o modelo não preenchido, portanto não define princípios ou gates aplicáveis. O plano adota, preventivamente, os controles exigidos pela especificação: testes automatizados, contratos versionados, segurança por padrão, observabilidade e decisões de complexidade justificadas.

**Resultado antes da pesquisa**: aprovado — não há gate de constituição efetivo ou esclarecimento técnico pendente.

**Resultado após o design**: aprovado — a separação em interface, API e worker é necessária para isolar a carga e o risco de documentos; todos os contratos e fluxos críticos estão documentados nos artefatos abaixo.

## Architecture Decisions

### Responsabilidades e limites

| Componente | Responsabilidade | Não deve fazer |
| --- | --- | --- |
| `web/` | Interface React para autenticação, lista e busca, envio, detalhe, revisão, linha do tempo e administração. Atualiza o usuário com estados persistidos de processamento. | Acessar Redis, storage privado ou decidir autorização por conta própria. |
| `api/` | API NestJS: autenticação, organizações, usuários, autorização, documentos, versões, workflow, revisão, auditoria, notificações, emissão de URLs temporárias e orquestração de jobs. | OCR, antivírus ou análise de arquivos no processo HTTP. |
| `worker/` | Serviço FastAPI interno e consumidores BullMQ Python: antivírus, parsing, OCR, extração e análise inteligente opt-in. Publica progresso e resultados compactos. | Expor upload público, aceitar URLs/caminhos arbitrários ou tomar decisão de aprovação. |
| PostgreSQL | Estado de negócio, regras de tenancy, resultados, outbox, `ProcessingRun` e auditoria. | Reter binários ou ser substituído pelo estado temporário do Redis. |
| Redis/BullMQ | Entrega assíncrona, retries, backoff, locks, progresso e DLQ operacional. | Ser fonte de verdade de auditoria ou reter conteúdo documental. |
| S3/MinIO | Originais em quarentena/limpos e artefatos derivados, por chave imutável e prefixo de organização. | Autorizar usuários sem decisão da API. |

### API NestJS

Organizar `api/src/` por módulos de domínio: `auth`, `organizations`, `users`, `documents`, `document-versions`, `workflows`, `reviews`, `audit`, `notifications`, `storage`, `processing`, `openai`, `health`, `common` e `database`. Cada módulo contém regras de aplicação, modelos/DTOs, adaptadores e testes correspondentes; controladores permanecem finos. `TypeORM` é responsável por entidades, migrations e transações; a API publica somente contratos OpenAPI gerados a partir de seus modelos validados.

`Pino` emite logs estruturados com `correlationId`, `traceId`, organização e identificador de recurso, sem conteúdo, tokens ou dados pessoais desnecessários. Um endpoint interno de métricas é coletado pelo Prometheus. A documentação Swagger/OpenAPI é publicada somente em ambientes autorizados e protegida fora do desenvolvimento.

### Autorização e isolamento multi-tenant

Toda tabela e chave de objeto pertencente a uma organização. A organização é resolvida exclusivamente pela sessão e vínculo do usuário, nunca por um identificador livre fornecido pelo cliente. Guards NestJS aplicam autenticação e permissão de domínio; PostgreSQL Row-Level Security adiciona a segunda barreira. Cada transação define o contexto de organização com `SET LOCAL` usando o mesmo gerenciador transacional TypeORM; a credencial de aplicação não é superusuária, não possui `BYPASSRLS` e não é dona das tabelas. Migrations usam credencial separada.

Usar access token JWT de curta duração, com emissor, audiência, expiração e algoritmo explicitamente validados. O refresh token é opaco, rotativo e guardado apenas como hash; sua família é revogada em logout, troca de senha, desativação do vínculo ou reutilização detectada. Para o cliente web, o refresh token permanece em cookie `HttpOnly`, `Secure` e `SameSite` apropriado, com proteção CSRF quando aplicável. Senhas usam Argon2id com salt único e parâmetros versionados/calibrados.

### Ingestão, armazenamento e processamento

1. A API autoriza o envio e cria `Document` e `DocumentVersion` em estado de upload, com chave aleatória sob `quarantine/{organization}/...` e URL pré-assinada de curta duração.
2. Ao confirmar o envio, a API valida tamanho, hash e metadados; grava uma intenção no outbox e cria um `ProcessingRun` de antivírus. O original não é visualizável antes de passar no scan.
3. O worker lê o objeto privado por referência, valida assinatura/formato e limites, executa ClamAV via rede privada e promove somente conteúdo limpo para `clean/`.
4. Para PDFs, tenta extrair texto nativo com PyMuPDF; usa pdfplumber apenas quando a regra requer tabelas/layout e renderiza páginas controladas para Tesseract somente quando o OCR for necessário. Pillow limita dimensões e pixels para impedir expansão maliciosa. PDF, PNG, JPEG e TIFF são aceitos inicialmente; arquivos cifrados, corrompidos, executáveis, ZIP e formatos não suportados são falhas permanentes.
5. Artefatos e resultados citam versão do processador, hash e páginas de origem. A etapa OpenAI só é criada após extração, mediante opt-in da organização; envia o menor texto redigido necessário, usa `store: false` quando compatível e trata a resposta como sugestão revisável.
6. A API persiste resultados, auditoria e notificações em transação; arquivos, dados e versões anteriores nunca são sobrescritos silenciosamente.

### Jobs e confiabilidade

A API e o worker usam BullMQ oficial, incluindo a implementação Python interoperável, sobre o mesmo Redis e prefixo isolado por ambiente. A fila de comandos é `document-processing.v1`; `QueueEvents` atualiza o estado persistido e as notificações de interface. O payload não leva bytes: inclui somente referências imutáveis ao objeto, hash, `tenantId`, identificadores de documento/versão, `correlationId`, `traceparent`, versão de schema e chave de idempotência.

O processamento assume entrega *at-least-once*. Cada estágio é pequeno e idempotente; a chave decorre de organização, versão, hash de origem, tipo de operação e versão do processador. Constraints em PostgreSQL e artefatos com nome determinístico são a garantia definitiva, enquanto deduplicação/job ID BullMQ é apenas complementar. O padrão outbox e um reconciliador periódico evitam perder jobs entre a transação e o Redis.

Falhas transitórias usam até cinco tentativas, backoff exponencial com jitter e limites de concorrência. Falhas permanentes — malware, tipo/tamanho inválido, arquivo corrompido ou incompatibilidade de contrato — não sofrem retry. Após esgotar tentativas, um supervisor cria registro de DLQ, alerta e exige reprocessamento manual autorizado com nova correlação; Redis mantém apenas retenção operacional limitada.

### Estados principais

`DocumentVersion`: `UPLOADING → QUARANTINED → SCAN_QUEUED → SCANNING → SCAN_PASSED | REJECTED_INFECTED | SECURITY_FAILED → EXTRACTION_QUEUED → EXTRACTING → OCR_QUEUED? → EXTRACTED → ANALYSIS_QUEUED? → ANALYZING? → READY_FOR_REVIEW → APPROVED | REJECTED | RETURNED_FOR_COMPLEMENT`.

`ProcessingRun`: `QUEUED → ACTIVE → COMPLETED | RETRY_SCHEDULED | FAILED | DEAD_LETTERED | CANCELLED`.

`Review`: `PENDING → IN_REVIEW → CHANGES_REQUESTED | APPROVED | REJECTED`; uma nova versão preserva a revisão anterior e inicia uma revisão apropriada para a versão vigente.

## Project Structure

### Documentation (this feature)

```text
specs/001-document-governance/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── openapi.md
│   └── processing-queue.md
├── checklists/
│   └── requirements.md
└── tasks.md                 # criado por $speckit-tasks
```

### Source Code (repository root)

```text
web/
├── src/
│   ├── app/
│   ├── features/{auth,documents,reviews,audit,organizations}/
│   ├── components/
│   ├── services/
│   └── test/
└── package.json

api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── modules/{auth,organizations,users,documents,document-versions,workflows,reviews,audit,notifications,storage,processing,openai}/
│   ├── database/{entities,migrations}/
│   └── common/{auth,authorization,logging,metrics,validation}/
├── test/{unit,integration,contract,e2e}/
└── package.json

worker/
├── app/{api,consumers,processors,clients,models,observability}/
├── tests/{unit,integration,contract}/
├── requirements.txt
└── Dockerfile

infra/
├── compose/
├── prometheus/
└── github/

docker-compose.yml
.env.example
.github/workflows/ci.yml
```

**Structure Decision**: Usar um monorepositório por serviço, com `web/`, `api/` e `worker/` como unidades implantáveis distintas. O atual esqueleto Fastify em `api/` será substituído pelo NestJS planejado; o pacote Python em `src/docdeploy/` permanece reservado para utilitários reutilizáveis e não hospeda a aplicação web.

## Environments, deployment and operations

Docker Compose local reúne web, API, worker, PostgreSQL, Redis, MinIO, ClamAV, MailHog e Prometheus. Homologação replica a topologia com credenciais e buckets separados. Produção usa serviços gerenciados ou equivalentes com TLS, backups testados, rotação de segredos e rede privada; não reutiliza dados, chaves, filas ou prefixos entre ambientes.

Variáveis ficam documentadas em `.env.example`, sem valores sensíveis. CI no GitHub Actions executa format/lint, TypeScript estrito, testes Python, testes de integração e contratos, geração/validação OpenAPI, verificação de migrations e análise de imagens/dependências. A entrega só promove imagens imutáveis após aprovação dos gates.

Prometheus acompanha disponibilidade, duração e falhas de OCR/IA, profundidade/idade/retries/stalled/DLQ das filas, saturação dos workers e erros de storage/Redis/PostgreSQL. Alertas cobrem DLQ não vazia, fila envelhecida, falhas acima do baseline, indisponibilidade de dependências e queda de verificações de segurança.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Três serviços implantáveis | UI, API transacional e processamento de arquivo têm perfis de segurança e escala distintos. | OCR e antivírus síncronos na API piorariam latência, isolamento e disponibilidade. |
| PostgreSQL + Redis + S3 | Estado auditável, execução assíncrona e binários requerem garantias diferentes. | Um único banco não atende eficientemente os três papéis nem preserva segurança do upload. |
| RLS além de guards | Falha de filtro de aplicação não pode cruzar tenants. | Autorização somente no código deixa uma camada única vulnerável a omissões. |
