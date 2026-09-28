# DocDeploy

DocDeploy é uma aplicação multi-tenant para receber documentos, preservar versões, extrair dados, conduzir revisões e manter uma trilha de auditoria verificável.

## Serviços

| Serviço | Stack | Responsabilidade |
| --- | --- | --- |
| `web` | React + Vite | Upload, pesquisa, revisão e auditoria |
| `api` | NestJS + TypeORM | Autenticação, regras de domínio e contratos OpenAPI |
| `worker` | FastAPI + BullMQ Python | Antivírus, parsing, OCR e extração |
| PostgreSQL | PostgreSQL 17 | Fonte transacional de verdade e RLS |
| Redis | Redis 8 | BullMQ, locks e progresso operacional |
| MinIO | S3 compatível | Objetos privados em quarentena, limpos e derivados |

## Desenvolvimento local

Pré-requisitos: Docker Desktop com Compose, Node.js 20+ e Python 3.14+ para verificações locais. Copie `.env.example` para `.env` e substitua os valores locais antes de qualquer ambiente compartilhado. As credenciais do exemplo são somente para desenvolvimento.

```bash
docker compose up --build --wait
npm run verify
```

O serviço `migrate` aplica migrations antes da API; `minio-init` cria o bucket privado de forma idempotente. Para criar a primeira organização/conta local (sem credenciais embutidas no repositório), defina `BOOTSTRAP_DEV_ALLOWED=true`, `MIGRATIONS_DATABASE_URL`, `BOOTSTRAP_ORG_NAME`, `BOOTSTRAP_USER_EMAIL` e `BOOTSTRAP_USER_PASSWORD` no terminal e execute `npm --prefix api run seed:dev`. A senha de bootstrap precisa ter pelo menos 16 caracteres; o comando exige opt-in explícito, é recusado em `NODE_ENV=production` e não altera usuários existentes. A interface fica em `http://localhost:5173`, a API em `http://localhost:3000/api/v1`, o Swagger em `http://localhost:3000/api/docs` no perfil de desenvolvimento, o console MinIO em `http://localhost:9001`, MailHog em `http://localhost:8025` e Prometheus em `http://localhost:9090`.

Para parar sem remover dados persistidos, use `docker compose down`. Para acompanhar recuperação do processamento, consulte os logs de `api`/`worker` e as métricas/alertas no Prometheus. O reconciliador retenta publicação de jobs ausentes e recupera conclusões BullMQ persistidas sem resultado na API. O export de auditoria inclui os mesmos eventos filtrados (máximo 1.000) e um hash do conjunto exportado.

Swagger só é publicado em desenvolvimento ou com `ENABLE_SWAGGER=true`. Entre pela tela `/login`; access tokens ficam em memória no cliente e a renovação usa cookie HttpOnly. OpenAI só recebe texto quando há chave configurada e um administrador autorizado habilita o opt-in da organização (`PATCH /api/v1/organization/settings/ai-opt-in` com `{ "aiOptIn": true }`); sugestões são sempre revisáveis e nunca decidem uma revisão automaticamente.

## Segurança

- Arquivos permanecem em `quarantine/` até o ClamAV aprová-los.
- O tenant vem da sessão autenticada; o cliente não escolhe a organização.
- Não coloque JWTs, credenciais, conteúdo integral ou URLs arbitrárias em jobs.
- Nunca faça commit de `.env`, credenciais, artefatos gerados ou ambientes virtuais.

## Fluxos da aplicação

Após autenticar-se, use `/documents` para pesquisar documentos, `/documents/new` para cadastrar, `/documents/:id` para acompanhar processamento e revisão, `/documents/:id/versions` para enviar/comparar versões e `/audit` para consultar/exportar eventos conforme as permissões da organização. Uma nova versão só passa a ser vigente depois que o upload assinado é confirmado; a versão anterior permanece utilizável enquanto isso.
