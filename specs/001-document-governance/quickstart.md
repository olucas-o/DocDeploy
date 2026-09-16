# Quickstart: Validação do Plano DocDeploy

Este guia descreve a validação esperada após implementação. Ele não substitui os detalhes das filas em [processing-queue.md](contracts/processing-queue.md), o contrato público em [openapi.md](contracts/openapi.md) ou o modelo de dados em [data-model.md](data-model.md).

## Pré-requisitos

- Docker e Docker Compose.
- Node.js LTS e gerenciador de pacotes do repositório.
- Python 3.14+ e `uv` para o worker.
- Arquivo `.env` criado a partir de `.env.example`, com segredos locais distintos e OpenAI desativada por padrão.

## Subir o ambiente local

1. Preparar dependências de web, API e worker conforme seus manifestos.
2. Executar `docker compose up --build` na raiz.
3. Confirmar saúde de web, API, worker, PostgreSQL, Redis, MinIO, ClamAV, MailHog e Prometheus.
4. Aplicar migrations pelo comando versionado da API e carregar somente dados de demonstração não sensíveis.
5. Abrir a interface, a documentação OpenAPI protegida e o painel de e-mail de desenvolvimento, se habilitados.

## Cenário principal ponta a ponta

1. Criar duas organizações de teste e usuários com papéis de colaborador, revisor e auditor.
2. Como colaborador da primeira organização, enviar um PDF limpo e confirmar que a versão inicia em quarentena, passa por scan, extração e fica pronta para revisão.
3. Confirmar no detalhe que o progresso é visível, que os campos extraídos mostram origem e que o original só fica acessível após `SCAN_PASSED`.
4. Como revisor, corrigir um campo, criar/resolver pendência e aprovar a versão; confirmar responsável, data e justificativa quando aplicável.
5. Enviar uma segunda versão, verificar que a primeira é preservada e que a versão vigente e o vínculo entre versões estão corretos.
6. Como auditor, filtrar/exportar a linha do tempo e conferir recebimento, processamento, correção, decisão e mudança de versão com a mesma correlação.

**Resultado esperado**: o estado persistido, a versão vigente e a exportação concordam; nenhum arquivo ou decisão é sobrescrito silenciosamente.

## Cenários de segurança e resiliência

- Tentar acessar documento, URL de objeto, revisão e auditoria da primeira organização autenticado na segunda; todos devem negar acesso sem revelar conteúdo ou metadados.
- Enviar arquivo com extensão/MIME enganoso, arquivo de tamanho excessivo, PDF protegido por senha e amostra de malware autorizada para teste; todos devem permanecer inacessíveis e receber estado/falha seguros.
- Interromper o worker durante OCR e reiniciá-lo; confirmar retry, ausência de artefato duplicado e uma única conclusão persistida pela chave idempotente.
- Tornar Redis, storage ou OpenAI temporariamente indisponível; confirmar retry/backoff para falha transitória, alerta/métrica e DLQ somente após esgotamento.
- Reenviar o mesmo arquivo e repetir um resultado de fila; confirmar detecção de duplicidade e preservação de auditoria, sem criar versão ou campo duplicado.

## Quality gates esperados

- O comando de verificação do repositório passa, incluindo TypeScript estrito, testes Python e testes existentes.
- Testes de integração cobrem migrations, RLS com duas organizações, rotação/revogação de refresh token, pipeline ClamAV/OCR e recuperação de outbox/fila.
- Testes de contrato validam OpenAPI e os dois sentidos do envelope BullMQ contra Redis real.
- Testes ponta a ponta reproduzem o cenário principal e os controles de segurança acima.
- Prometheus apresenta métricas de filas, workers e dependências; Pino permite correlacionar uma requisição ao job sem expor conteúdo ou segredos.
