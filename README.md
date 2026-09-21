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

Copie `.env.example` para `.env`, altere os segredos e execute:

```bash
docker compose up --build
npm run verify
```

A interface fica em `http://localhost:5173`, a API em `http://localhost:3000/api/v1`, o console MinIO em `http://localhost:9001`, MailHog em `http://localhost:8025` e Prometheus em `http://localhost:9090`.

Swagger só é publicado em desenvolvimento ou com `ENABLE_SWAGGER=true`. OpenAI permanece desativada quando `OPENAI_API_KEY` está vazia e nunca decide uma revisão automaticamente.

## Segurança

- Arquivos permanecem em `quarantine/` até o ClamAV aprová-los.
- O tenant vem da sessão autenticada; o cliente não escolhe a organização.
- Não coloque JWTs, credenciais, conteúdo integral ou URLs arbitrárias em jobs.
- Nunca faça commit de `.env`, credenciais, artefatos gerados ou ambientes virtuais.
