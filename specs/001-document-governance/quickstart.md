# Quickstart: Validação do Plano DocDeploy

Este guia descreve a validação esperada após implementação. Ele não substitui os detalhes das filas em [processing-queue.md](contracts/processing-queue.md), o contrato público em [openapi.md](contracts/openapi.md) ou o modelo de dados em [data-model.md](data-model.md).

## Pré-requisitos

- Docker e Docker Compose.
- Node.js LTS e gerenciador de pacotes do repositório.
- Python 3.14+ e `uv` para o worker.
- Arquivo `.env` criado a partir de `.env.example`, com segredos locais distintos e OpenAI desativada por padrão.

## Subir o ambiente local

1. Copiar `.env.example` para `.env` e substituir os valores locais se necessário.
2. Executar `docker compose up --build --wait` na raiz. O Compose executa migrations no serviço `migrate` e cria `docdeploy-private` via `minio-init`.
3. Confirmar saúde de API e worker com `docker compose ps`; PostgreSQL, Redis, MinIO e ClamAV devem estar saudáveis. MailHog e Prometheus ficam disponíveis em `localhost:8025` e `localhost:9090`.
4. Criar uma conta administrativa local, se necessário, definindo `BOOTSTRAP_DEV_ALLOWED=true`, `MIGRATIONS_DATABASE_URL`, `BOOTSTRAP_ORG_NAME`, `BOOTSTRAP_USER_EMAIL` e `BOOTSTRAP_USER_PASSWORD` (mínimo 16 caracteres) e executando `npm --prefix api run seed:dev`. O comando exige opt-in explícito, nunca aceita execução com `NODE_ENV=production` e não altera credenciais existentes; não há credenciais de demonstração comitadas.
5. Abrir `http://localhost:5173`, Swagger em `http://localhost:3000/api/docs` (somente `NODE_ENV=development` ou `ENABLE_SWAGGER=true`) e MailHog quando necessário.
6. Entrar em `/login`. OpenAI fica desativada por padrão; para habilitá-la, configure `OPENAI_API_KEY` e use a sessão de administrador para chamar `PATCH /api/v1/organization/settings/ai-opt-in` com `{ "aiOptIn": true }`. A alteração é auditada e pode ser revertida com `false`.

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
- `npm run verify` cobre typecheck, testes disponíveis de API/web/worker e contratos. Os testes atuais de integração usam sobretudo funções de domínio e doubles; validação real com PostgreSQL/Redis/Docker Compose ainda requer executar o cenário de integração provisionado.
- Os schemas compartilhados validam o envelope BullMQ no API e worker; os testes de contrato locais não iniciam Redis real.
- O cenário Docker ponta a ponta com duas organizações e resiliência a indisponibilidade deve ser executado em ambiente com Docker e credenciais de teste antes de promoção.
- Prometheus apresenta métricas de filas, workers e dependências; Pino permite correlacionar uma requisição ao job sem expor conteúdo ou segredos.
