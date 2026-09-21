---

description: "Tarefas executáveis para Governança de Documentos"
---

# Tasks: Governança de Documentos

**Input**: Artefatos em `specs/001-document-governance/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/openapi.md`, `contracts/processing-queue.md` e `quickstart.md`

**Tests**: Obrigatórios. A especificação define cenários de teste mandatórios; escreva os testes de cada história antes da implementação correspondente e confirme que falham de modo significativo.

**Organization**: As tarefas são agrupadas por história para que cada incremento possa ser implementado, testado e demonstrado independentemente.

## Path Conventions

- React: `web/src/`; testes em `web/src/test/`
- NestJS: `api/src/`; testes em `api/test/`
- Worker Python: `worker/app/`; testes em `worker/tests/`
- Infraestrutura: `infra/`, `.github/` e arquivos de raiz

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Criar a topologia local, os manifestos de serviço e a base de qualidade do monorepo.

- [X] T001 Criar os manifestos e a configuração TypeScript estrita do cliente React em `web/package.json` e `web/tsconfig.json`
- [X] T002 Criar o bootstrap e os manifestos do NestJS substituindo o esqueleto Fastify em `api/package.json`, `api/src/main.ts` e `api/src/app.module.ts`
- [X] T003 [P] Criar o pacote do worker FastAPI e suas configurações de teste em `worker/requirements.txt`, `worker/app/main.py` e `worker/pytest.ini`
- [X] T004 [P] Criar os esqueletos de módulos e pontos de entrada da interface em `web/src/app/App.tsx`, `web/src/app/router.tsx` e `web/src/main.tsx`
- [X] T005 [P] Criar a topologia de serviços locais (web, API, worker, PostgreSQL, Redis, MinIO, ClamAV, MailHog e Prometheus) em `docker-compose.yml`, `infra/prometheus/prometheus.yml` e `infra/compose/.gitkeep`
- [X] T006 [P] Documentar variáveis sem segredos, nomes de serviços e credenciais locais seguras em `.env.example` e `README.md`
- [X] T007 Configurar os comandos raiz de qualidade, testes e validação de contratos em `package.json` e `tools/run-worker-check.mjs`
- [X] T008 [P] Criar o workflow de CI para quality, testes unitários, integração, contratos, migrations e análise de dependências em `.github/workflows/ci.yml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Implementar segurança, isolamento multi-tenant, persistência, contratos e observabilidade que bloqueiam todas as histórias.

**⚠️ CRITICAL**: Nenhuma história deve iniciar antes de esta fase estar concluída.

- [X] T009 Criar entidades compartilhadas de `Organization`, `User`, `OrganizationMembership` e `Session` em `api/src/database/entities/organization.entity.ts`, `api/src/database/entities/user.entity.ts`, `api/src/database/entities/organization-membership.entity.ts` e `api/src/database/entities/session.entity.ts`
- [X] T010 Criar entidades append-only e transacionais de `AuditEvent`, `OutboxEvent`, `Notification` e `ProcessingRun` em `api/src/database/entities/audit-event.entity.ts`, `api/src/database/entities/outbox-event.entity.ts`, `api/src/database/entities/notification.entity.ts` e `api/src/database/entities/processing-run.entity.ts`
- [X] T011 Criar migration base com `organization_id` obrigatório, RLS, `SET LOCAL` e papéis sem superusuário, `BYPASSRLS` ou propriedade de tabelas em `api/src/database/migrations/001-base-tenancy.ts`
- [X] T012 Criar a infraestrutura TypeORM transacional que define o contexto de organização no mesmo gerenciador transacional em `api/src/database/tenant-transaction.service.ts` e `api/src/database/database.module.ts`
- [X] T013 [P] Implementar autenticação JWT de curta duração, refresh token opaco rotativo em cookie e hashing Argon2id em `api/src/modules/auth/auth.service.ts`, `api/src/modules/auth/auth.controller.ts` e `api/src/common/auth/jwt.strategy.ts`
- [X] T014 [P] Implementar guards de autenticação e autorização por permissão organizacional sem tenant fornecido pelo cliente em `api/src/common/authorization/organization-context.guard.ts`, `api/src/common/authorization/permission.guard.ts` e `api/src/common/authorization/permissions.decorator.ts`
- [X] T015 [P] Implementar validação allowlist, erros sanitizados e correlação HTTP em `api/src/common/validation/validation.pipe.ts`, `api/src/common/errors/http-exception.filter.ts` e `api/src/common/logging/correlation.middleware.ts`
- [X] T016 [P] Criar logs Pino sem conteúdo, tokens ou PII desnecessária e métricas Prometheus internas em `api/src/common/logging/logger.module.ts`, `api/src/common/metrics/metrics.service.ts` e `api/src/modules/health/health.controller.ts`
- [X] T017 Criar serviço de auditoria transacional append-only com sequência e hash encadeado por organização, vedando update/delete pelo papel da aplicação, em `api/src/modules/audit/audit.service.ts` e `api/src/database/migrations/002-audit-protection.ts`
- [X] T018 Criar contratos OpenAPI versionados, schemas de erro, paginação e autenticação em `api/src/openapi/openapi.config.ts` e `api/src/openapi/openapi.snapshot.json`
- [X] T019 Criar schemas compartilhados do envelope BullMQ v1, validando que jobs não contêm binário, texto integral, URL/caminho arbitrário, JWT, refresh token ou credenciais, em `api/src/modules/processing/processing-job.schema.ts` e `worker/app/models/processing_job.py`
- [X] T020 Criar publicação por outbox, reconciliador e consumidor de eventos BullMQ para atualizar apenas estado persistido em `api/src/modules/processing/outbox-publisher.service.ts`, `api/src/modules/processing/processing-reconciler.service.ts` e `api/src/modules/processing/queue-events.listener.ts`
- [X] T021 [P] Criar cliente privado S3/MinIO de URL pré-assinada de curta duração e restrição de zonas em `api/src/modules/storage/storage.service.ts` e `worker/app/clients/storage.py`
- [X] T022 [P] Criar cliente BullMQ Python, classificação de erros, retry de até cinco tentativas com backoff exponencial/jitter e DLQ em `worker/app/consumers/document_processing.py` e `worker/app/clients/queue.py`
- [ ] T023 Criar testes de integração da migration, RLS com duas organizações, autenticação/rotação de sessão e prevenção de vazamento cross-tenant em `api/test/integration/tenancy-auth.integration-spec.ts`
- [ ] T024 Criar testes de contrato bidirecionais do envelope `document-processing.v1` contra Redis real em `api/test/contract/processing-queue.contract-spec.ts` e `worker/tests/contract/test_processing_queue.py`
- [X] T025 Criar testes de contrato para OpenAPI, erros sanitizados e ausência de campos secretos nas respostas em `api/test/contract/openapi.contract-spec.ts`

**Checkpoint**: Banco com RLS, autenticação, auditoria, storage privado, fila idempotente e contratos estão prontos para todas as histórias.

---

## Phase 3: User Story 1 - Receber e organizar documentos (Priority: P1) 🎯 MVP

**Goal**: Um colaborador autorizado registra arquivo compatível em sua organização, acompanha o recebimento e encontra o documento na lista.

**Independent Test**: Um colaborador envia um contrato PDF de até 25 MB, confirma a versão 1 em quarentena/lista com tipo, origem e data, pesquisa-o por campos suportados e recebe erro seguro para arquivo inválido ou duplicado.

### Tests for User Story 1

- [ ] T026 [P] [US1] Criar teste de contrato de criação, confirmação de upload, listagem e busca de documentos em `api/test/contract/documents.contract-spec.ts`
- [ ] T027 [P] [US1] Criar teste de integração para upload pré-assinado, checksum, quarentena, 25 MB e PDF/PNG/JPEG em `api/test/integration/document-upload.integration-spec.ts`
- [ ] T028 [P] [US1] Criar teste de integração para busca por nome, tipo, status, responsável, período e pendências sem cruzar organizações em `api/test/integration/document-search.integration-spec.ts`
- [X] T029 [P] [US1] Criar teste E2E de envio, listagem e mensagens de rejeição de arquivo em `web/src/test/document-intake.e2e.ts`

### Implementation for User Story 1

- [X] T030 [P] [US1] Criar entidades `Document`, `DocumentVersion` e `StoredArtifact` com versões append-only em `api/src/database/entities/document.entity.ts`, `api/src/database/entities/document-version.entity.ts` e `api/src/database/entities/stored-artifact.entity.ts`
- [X] T031 [US1] Criar migration de documentos com `Document.current_version_id` apontando somente para versão do mesmo documento, unicidade documento/número e regra de hash duplicado em `api/src/database/migrations/003-documents.ts`
- [X] T032 [US1] Implementar DTOs que aceitam somente nome, tipo, origem, data de recebimento e responsável, e validam literalmente “arquivos de até 25 MB nos formatos PDF, PNG e JPEG” em `api/src/modules/documents/dto/create-document.dto.ts` e `api/src/modules/document-versions/dto/confirm-upload.dto.ts`
- [X] T033 [US1] Implementar criação de documento, versão inicial, chave aleatória em `quarantine/{organization}/...`, URL pré-assinada e evento de auditoria na mesma transação em `api/src/modules/documents/documents.service.ts`
- [X] T034 [US1] Implementar confirmação de upload que valida tamanho, hash e metadados, cria `ProcessingRun` de scan e publica intenção via outbox em `api/src/modules/document-versions/document-versions.service.ts`
- [X] T035 [US1] Implementar controladores de registro, confirmação, detalhe, listagem e busca com autorização organizacional em `api/src/modules/documents/documents.controller.ts` e `api/src/modules/document-versions/document-versions.controller.ts`
- [X] T036 [P] [US1] Implementar cliente React de documentos, tipagem gerada do OpenAPI e tratamento de erro estável em `web/src/services/documents-api.ts` e `web/src/services/api-client.ts`
- [X] T037 [P] [US1] Implementar formulário de registro com restrições de arquivo e confirmação de upload em `web/src/features/documents/DocumentUploadForm.tsx`
- [X] T038 [P] [US1] Implementar lista, filtros e estado de versão vigente/recebimento em `web/src/features/documents/DocumentsListPage.tsx` e `web/src/features/documents/document-filters.ts`
- [X] T039 [US1] Implementar rota de documentos e feedback acessível de upload/erro em `web/src/app/router.tsx` e `web/src/features/documents/document-notifications.tsx`

**Checkpoint**: Um documento aceito é registrado exclusivamente no tenant do colaborador, inicia na zona de quarentena e pode ser localizado sem expor arquivo ou metadados a outro tenant.

---

## Phase 4: User Story 2 - Extrair e revisar informações (Priority: P2)

**Goal**: Um revisor autorizado visualiza resultados rastreáveis, corrige dados, controla pendências e toma decisão justificada.

**Independent Test**: Após upload de uma nota fiscal limpa, o pipeline produz campos de identificador, emissor/origem, data e valor quando houver; o revisor corrige um campo, resolve pendência e devolve/aprova com a trilha persistida.

### Tests for User Story 2

- [ ] T040 [P] [US2] Criar teste de contrato de consulta de resultados, correção de campo, pendência e decisão de revisão em `api/test/contract/reviews.contract-spec.ts`
- [ ] T041 [P] [US2] Criar teste de integração do pipeline ClamAV, extração PDF, OCR condicional, falha segura e promoção de artefato em `worker/tests/integration/test_document_pipeline.py`
- [ ] T042 [P] [US2] Criar teste de integração de idempotência de run, retry, resultado compactado e persistência única na API em `api/test/integration/processing-results.integration-spec.ts`
- [ ] T043 [P] [US2] Criar teste E2E de revisão que corrige campo, cria/resolve pendência e aprova/devolve documento em `web/src/test/document-review.e2e.ts`

### Implementation for User Story 2

- [ ] T044 [P] [US2] Criar entidades `ExtractedField`, `Review`, `ReviewTask` e `ReviewComment` em `api/src/database/entities/extracted-field.entity.ts`, `api/src/database/entities/review.entity.ts`, `api/src/database/entities/review-task.entity.ts` e `api/src/database/entities/review-comment.entity.ts`
- [ ] T045 [US2] Criar migration que preserva valor/origem anterior na correção humana e exige justificativa para rejeição/devolução em `api/src/database/migrations/004-reviews-and-extraction.ts`
- [ ] T046 [US2] Implementar consumidor de scan que valida assinatura/formato/limites, usa ClamAV privado e mantém conteúdo inacessível em falha (`fail closed`) em `worker/app/processors/virus_scan.py`
- [ ] T047 [US2] Implementar extração local PyMuPDF, pdfplumber apenas para tabela/layout, OCR Tesseract controlado e limite Pillow de pixels em `worker/app/processors/extraction.py`, `worker/app/processors/ocr.py` e `worker/app/processors/image_safety.py`
- [ ] T048 [US2] Implementar promoção para `clean/` somente após `SCAN_PASSED`, artefatos determinísticos e resultado compacto com referências/hash/páginas em `worker/app/processors/artifact_persistence.py` e `worker/app/consumers/document_processing.py`
- [ ] T049 [US2] Implementar persistência API de `ProcessingRun`, `ExtractedField` e transições monotônicas, revalidando tenant, versão, hash e chave de idempotência em `api/src/modules/processing/processing-results.service.ts`
- [ ] T050 [US2] Implementar extração mínima de identificador, emissor/origem, data relevante e valor quando houver, marcando campos ausentes/incertos para revisão, em `api/src/modules/processing/extracted-fields.service.ts`
- [ ] T051 [US2] Implementar workflow de revisão, correção auditada, pendência com responsável/prazo opcional/resolução e decisão autorizada em `api/src/modules/reviews/reviews.service.ts` e `api/src/modules/reviews/reviews.controller.ts`
- [ ] T052 [P] [US2] Implementar consulta de status/progresso persistido e solicitação administrativa auditada de reprocessamento em `api/src/modules/processing/processing.controller.ts`
- [ ] T053 [P] [US2] Implementar página de detalhe que mostra progresso, origem/página/confiança do campo e acesso ao original somente após scan em `web/src/features/documents/DocumentDetailPage.tsx`
- [ ] T054 [P] [US2] Implementar formulário de revisão, correção com justificativa, pendências, comentários e decisões em `web/src/features/reviews/ReviewPanel.tsx` e `web/src/features/reviews/review-api.ts`

**Checkpoint**: A versão limpa progride de forma idempotente até revisão; cada correção, pendência e decisão autorizada conserva autor, data, motivo e evidência de origem.

---

## Phase 5: User Story 3 - Consultar versões e auditoria (Priority: P3)

**Goal**: Auditor ou gestor consulta versões preservadas, identifica a vigente e exporta uma linha do tempo filtrada e verificável.

**Independent Test**: Com duas versões e uma revisão, um auditor identifica a vigente, compara metadados/resultados, filtra eventos por período/documento/participante e exporta os mesmos até 1.000 eventos em até um minuto.

### Tests for User Story 3

- [ ] T055 [P] [US3] Criar teste de contrato de nova versão, comparação, linha do tempo e exportação de auditoria em `api/test/contract/audit-and-versions.contract-spec.ts`
- [ ] T056 [P] [US3] Criar teste de integração que preserva versões/revisões anteriores, inicia nova revisão após rejeição e impede alteração silenciosa em `api/test/integration/document-version-history.integration-spec.ts`
- [ ] T057 [P] [US3] Criar teste de integração de filtros, integridade hash encadeada e exportação de até 1.000 eventos em `api/test/integration/audit-export.integration-spec.ts`
- [ ] T058 [P] [US3] Criar teste E2E para comparação de versões, linha do tempo e exportação visível ao auditor em `web/src/test/document-audit.e2e.ts`

### Implementation for User Story 3

- [ ] T059 [US3] Implementar criação de nova versão que preserva arquivo/hash anterior, mantém relação documental, solicita confirmação de duplicidade e inicia revisão para versão de documento rejeitado em `api/src/modules/document-versions/document-versions.service.ts`
- [ ] T060 [US3] Implementar consulta e comparação de versões que expõe a versão vigente e impede leitura de objetos ainda em quarentena em `api/src/modules/document-versions/document-version-query.service.ts` e `api/src/modules/document-versions/document-versions.controller.ts`
- [ ] T061 [US3] Implementar timeline consultável, filtros por período/documento/participante e autorização sem revelar recursos de outro tenant em `api/src/modules/audit/audit-query.service.ts` e `api/src/modules/audit/audit.controller.ts`
- [ ] T062 [US3] Implementar exportação legível dos mesmos eventos filtrados, limitada a 1.000 eventos e com checkpoint de integridade por organização em `api/src/modules/audit/audit-export.service.ts`
- [ ] T063 [P] [US3] Implementar interface de comparação e indicação inequívoca da versão vigente em `web/src/features/documents/DocumentVersionCompare.tsx`
- [ ] T064 [P] [US3] Implementar timeline com filtros e exportação em `web/src/features/audit/AuditTimelinePage.tsx` e `web/src/features/audit/audit-api.ts`
- [ ] T065 [US3] Registrar notificações de nova versão, pendência e decisão somente a partir de eventos de negócio persistidos em `api/src/modules/notifications/notifications.service.ts`

**Checkpoint**: O auditor obtém uma visão consistente de versões e eventos, e a exportação reproduz exatamente o conjunto autorizado exibido na consulta.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validar a integração completa, segurança, operação e documentação de entrega.

- [ ] T066 [P] Criar teste E2E Docker Compose do quickstart com duas organizações, upload, pipeline, revisão, segunda versão e exportação em `api/test/e2e/document-governance.e2e-spec.ts`
- [ ] T067 [P] Criar testes de resiliência para reinício durante OCR, indisponibilidade de Redis/storage/OpenAI, retry/backoff, alerta e DLQ em `worker/tests/integration/test_processing_resilience.py` e `api/test/integration/processing-resilience.integration-spec.ts`
- [ ] T068 [P] Implementar OpenAI opt-in por organização, minimização/redação de texto, `store: false` quando compatível e resultados apenas sugestivos/revisáveis em `api/src/modules/openai/openai.service.ts` e `worker/app/processors/openai_analysis.py`
- [ ] T069 [P] Criar métricas/alertas de fila, worker e dependências, incluindo DLQ e fila envelhecida, em `infra/prometheus/alerts.yml` e `worker/app/observability/metrics.py`
- [ ] T070 Atualizar o guia operacional de ambiente, migrations, OpenAPI protegido, recuperação de job e validação de quickstart em `README.md` e `specs/001-document-governance/quickstart.md`
- [ ] T071 Executar a validação de qualidade, contratos, integração e quickstart em `package.json`, `docker-compose.yml` e `.github/workflows/ci.yml`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sem dependências; T001–T008 podem iniciar imediatamente.
- **Foundational (Phase 2)**: depende da base de setup e bloqueia todas as histórias; T009–T025 devem estar concluídas.
- **US1 (Phase 3)**: depende da fundação. Entrega o MVP de recebimento e organização.
- **US2 (Phase 4)**: depende dos documentos/versionamento da US1 e da fundação de fila; adiciona processamento e revisão.
- **US3 (Phase 5)**: depende do versionamento da US1 e dos eventos/revisões da US2; entrega comparação e auditoria.
- **Polish (Phase 6)**: depende das histórias que se pretende disponibilizar.

### User Story Dependencies

- **US1 (P1)**: inicia após a fundação e não depende de outra história.
- **US2 (P2)**: usa documentos e versões da US1; seus testes e UI podem ser preparados em paralelo depois dos contratos fundacionais.
- **US3 (P3)**: usa versões da US1 e eventos/revisões da US2 para sua demonstração completa.

### Within Each User Story

- Escreva os testes marcados da história antes das tarefas de implementação e confirme o estado de falha relevante.
- Modele/migre entidades antes de serviços; serviços antes de controladores e interface.
- Registre auditoria em cada mutação; valide escopo organizacional em cada leitura e escrita.

## Parallel Opportunities

- Setup: T003–T006 e T008 podem ocorrer em paralelo após T001/T002 conforme os manifestos estejam definidos.
- Fundação: T013–T016, T021–T022 e T023–T025 podem ser distribuídas por arquivos separados, respeitando T009–T012 e T017–T020.
- US1: T026–T029 e T036–T038 podem ocorrer em paralelo; T030 precede T031–T035.
- US2: T040–T043, T044 e T052–T054 podem ocorrer em paralelo; T045 precede os fluxos que persistem revisão.
- US3: T055–T058 e T063–T064 podem ocorrer em paralelo; T059–T062 seguem os modelos e auditoria existentes.
- Polish: T066–T069 são independentes por área e podem ser executadas em paralelo.

## Parallel Example: User Story 2

```text
Task: "Criar teste de contrato de revisão em api/test/contract/reviews.contract-spec.ts"
Task: "Criar teste de integração de pipeline em worker/tests/integration/test_document_pipeline.py"
Task: "Implementar página de detalhe em web/src/features/documents/DocumentDetailPage.tsx"
Task: "Implementar formulário de revisão em web/src/features/reviews/ReviewPanel.tsx"
```

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Concluir T001–T025 para a fundação segura e testada.
2. Concluir T026–T039 para cadastro, upload em quarentena e busca organizacional.
3. Validar o teste independente da US1 e demonstrar o fluxo de um contrato até aparecer na lista.

### Incremental Delivery

1. Entregar US1: recebimento, versionamento inicial e pesquisa.
2. Entregar US2: pipeline assíncrono, extração humana revisável e workflow de decisão.
3. Entregar US3: comparação de versões, timeline e exportação auditável.
4. Concluir os testes de resiliência, observabilidade e quickstart antes de promover o ambiente.

## Format Validation

Todos os 71 itens de trabalho usam o formato obrigatório: checkbox, ID sequencial `T001`–`T071`, marcador `[P]` apenas para atividades paralelizáveis, rótulo de história em todas as tarefas US1–US3 e ao menos um caminho exato de arquivo.
