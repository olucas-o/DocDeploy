# Research: Governança de Documentos

## Segurança, identidade e tenancy

### Decision: access JWT curto e refresh token opaco, rotativo e armazenado como hash

**Rationale**: Validar explicitamente emissor, audiência, expiração, sujeito, organização e algoritmo do JWT. Manter refresh token em cookie `HttpOnly`, `Secure` e `SameSite` apropriado, com CSRF quando aplicável; revogar a família em reutilização, logout, troca de senha ou perda de vínculo. Isso permite revogação sem tornar o access token um estado longo. Senhas usam Argon2id, salt único e parâmetros versionados/calibrados. [RFC 8725](https://datatracker.ietf.org/doc/html/rfc8725), [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700) e [RFC 9106](https://datatracker.ietf.org/doc/html/rfc9106).

**Alternatives considered**: JWT de longa duração sem revogação e refresh em `localStorage` foram rejeitados por risco de replay e exposição a scripts maliciosos.

### Decision: defesa em profundidade por tenant, com RLS PostgreSQL e autorização de domínio no NestJS

**Rationale**: Cada entidade possui `organization_id`; chaves, índices e unicidade são compostos por organização. Guards resolvem a organização pelo vínculo autenticado, e RLS aplica `USING` e `WITH CHECK` com `SET LOCAL` dentro da transação TypeORM. A credencial de execução não pode ser superusuária, dona de tabela ou ter `BYPASSRLS`. [PostgreSQL RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), [TypeORM transactions](https://typeorm.io/docs/advanced-topics/transactions/) e [NestJS Guards](https://docs.nestjs.com/guards).

**Alternatives considered**: filtros apenas no ORM foram rejeitados porque uma omissão expõe dados. Banco/schema por tenant fica reservado a exigências enterprise que justifiquem o custo operacional.

### Decision: auditoria append-only, tamper-evident e transacional

**Rationale**: Alterações de domínio e `AuditEvent` são gravados na mesma transação; o evento inclui ator, ação, recurso, versão, resultado, motivo, data UTC e correlação, mas não conteúdo ou segredos. O papel de aplicação não pode atualizar/apagar eventos; checkpoints hash encadeados por organização são exportados a armazenamento com retenção. A garantia é evidência de adulteração e imutabilidade operacional, não uma afirmação irreal de invulnerabilidade a administradores. [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

**Alternatives considered**: logs de aplicação isolados não fornecem intenção, relações de negócio nem preservação apropriada para auditoria.

## Arquivos, OCR e análise inteligente

### Decision: storage privado por zona e upload não confiável em quarentena

**Rationale**: Usar zonas lógicas `quarantine`, `clean` e `derived`; chaves são imutáveis e incluem organização/versão. A URL pré-assinada permite somente ação e chave específicas por pouco tempo. A API confere checksum e o worker valida assinatura do arquivo, parser e limites, não somente extensão/MIME. MinIO serve no desenvolvimento e S3 compatível atende produção, com versionamento, criptografia e Object Lock quando a retenção exigir. [AWS presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), [integridade S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/checking-object-integrity.html) e [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

**Alternatives considered**: binário pelo payload da API, bucket único e banco relacional para arquivos foram rejeitados por capacidade, isolamento e governança.

### Decision: scan ClamAV obrigatório antes da promoção e pipeline local-first

**Rationale**: O worker usa `clamd` em rede privada para escanear o objeto em quarentena; timeout/erro mantém estado pendente de segurança (*fail closed*). PDF, PNG, JPEG e TIFF são aceitos inicialmente com limites de tamanho, páginas, pixels, CPU, memória e tempo. PyMuPDF extrai texto nativo primeiro; pdfplumber é usado para tabelas/layout; páginas selecionadas são renderizadas antes de Tesseract, que não aceita PDF diretamente. Pillow aplica limite de pixels para bloquear descompressão maliciosa. [ClamAV INSTREAM](https://docs.clamav.net/manual/Usage/ClamdProtocol.html), [Tesseract input](https://tesseract-ocr.github.io/tessdoc/InputFormats.html) e [Pillow security](https://pillow.readthedocs.io/en/stable/handbook/security.html).

**Alternatives considered**: OCR síncrono na API, scan após liberação e Tesseract em todos os PDFs foram rejeitados por risco, latência e custo.

### Decision: OpenAI é opt-in por organização e complemento revisável

**Rationale**: A extração local antecede a análise. O job envia somente texto/trechos necessários, redigidos quando possível; usa `store: false` quando compatível e registra consentimento, finalidade, modelo, versão do prompt e hashes, nunca prompts/respostas brutos em log. A resposta tem fonte `ai`, confiança e evidência de origem e exige revisão humana. [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data) e [segurança de chaves](https://platform.openai.com/docs/api-reference/introduction).

**Alternatives considered**: enviar PDF completo e ativar IA por padrão foram rejeitados por minimização, privacidade e custo; ZDR é uma opção contratual futura, sujeita à elegibilidade.

## Filas, consistência e observabilidade

### Decision: BullMQ oficial interoperável entre NestJS e worker Python

**Rationale**: A API publica comandos JSON versionados na fila `document-processing.v1`; o worker BullMQ Python consome o mesmo Redis e retorna resultado compacto/progresso, enquanto `QueueEvents` permite à API persistir estados e notificar a UI. O PostgreSQL, e não Redis, é a fonte de verdade. [BullMQ Python](https://docs.bullmq.io/python/introduction), [dados de jobs](https://docs.bullmq.io/guide/jobs/job-data) e [QueueEvents](https://docs.bullmq.io/guide/events/).

**Alternatives considered**: HTTP síncrono, cliente Redis artesanal e Kafka/RabbitMQ foram rejeitados para o escopo inicial por acoplamento, risco de compatibilidade ou custo operacional.

### Decision: outbox, etapas idempotentes, retries limitados e DLQ explícita

**Rationale**: A transação persiste a intenção no outbox e o reconciliador cria/recupera o job. A chave de idempotência inclui tenant, versão, hash, estágio e versão de processador; uma constraint no PostgreSQL é a garantia contra efeitos duplicados. Falhas transitórias têm até cinco tentativas com backoff exponencial e jitter; falhas determinísticas usam erro não recuperável. Depois do limite, o supervisor grava DLQ e exige reprocessamento manual autorizado. [BullMQ idempotência](https://docs.bullmq.io/patterns/idempotent-jobs), [retries](https://docs.bullmq.io/guide/retrying-failing-jobs), [deduplicação](https://docs.bullmq.io/guide/jobs/deduplication) e [stalled jobs](https://docs.bullmq.io/guide/jobs/stalled).

**Alternatives considered**: exatamente-uma-vez, retry infinito e usar somente o conjunto `failed` como DLQ foram rejeitados por não serem garantias/controles suficientes.

### Decision: status persistido e telemetria orientada a correlação

**Rationale**: `ProcessingRun` persiste estado monotônico, estágio, percentual, tentativas, `bullJobId` e erro sanitizado. O payload propaga `correlationId` e `traceparent`; Pino e logs Python são estruturados, e Prometheus mede idade/profundidade da fila, duração, retries, falhas, stalled, DLQ e dependências. Redis Streams de eventos é operacional e pode sofrer trim, por isso o reconciliador compara job e banco. [BullMQ progress](https://docs.bullmq.io/guide/workers/) e [métricas BullMQ](https://docs.bullmq.io/guide/telemetry/metrics).

**Alternatives considered**: UI consultando Redis, polling de logs e Redis como banco de status foram rejeitados por segurança, retenção e falta de auditabilidade.
