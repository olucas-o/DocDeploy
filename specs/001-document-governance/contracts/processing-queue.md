# Contract: Fila de Processamento Documental

## Objetivo e propriedade

`document-processing.v1` é uma fila BullMQ privada. A API NestJS publica comandos; o worker Python os consome; a API é a única autoridade para persistir estado de negócio, auditoria e notificações. O contrato é JSON versionado e não é uma API pública.

## Envelope de comando

```json
{
  "schemaVersion": 1,
  "jobKind": "document.virus_scan | document.extract | document.ocr | document.analyze",
  "correlationId": "uuid",
  "traceparent": "w3c-trace-context",
  "idempotencyKey": "opaque-deterministic-key",
  "tenantId": "organization-id",
  "documentId": "document-id",
  "documentVersionId": "document-version-id",
  "source": {
    "bucket": "private-zone",
    "key": "immutable-object-key",
    "versionId": "storage-version-if-available",
    "sha256": "hex",
    "contentType": "detected-or-expected-type"
  },
  "processing": {
    "processorVersion": "versioned-identifier",
    "ocrLanguages": ["configured-language"]
  },
  "requestedAt": "UTC timestamp"
}
```

O payload é validado por schema nos dois serviços. Não pode conter binário, texto integral, URL arbitrária, caminho local, JWT, refresh token, credencial de storage ou chave OpenAI. O consumidor revalida organização, versão, chave de objeto e hash antes de agir.

## Progresso e resultado

O worker atualiza progresso por estágio (`virus_scan`, `pdf_parse`, `ocr`, `extract`, `analyze`, `persist_artifacts`) e percentual. O resultado de conclusão contém somente referências e metadados compactos:

```json
{
  "schemaVersion": 1,
  "correlationId": "uuid",
  "tenantId": "organization-id",
  "documentVersionId": "document-version-id",
  "outcome": "completed | rejected",
  "artifactRefs": ["artifact-id"],
  "extractedDataRef": "artifact-or-result-id",
  "checksum": "hex",
  "processorVersion": "versioned-identifier",
  "durationMs": 0
}
```

Erros são classificados como `retryable` ou permanentes e expõem apenas `code`, `category` e mensagem sanitizada. Stack traces, conteúdo e PII não passam pela fila. A API aceita resultados apenas uma vez por chave idempotente, transição de estado e organização corretas.

## Entrega e recuperação

- Entrega é *at-least-once*; produtor e consumidor devem ser idempotentes.
- Jobs transitórios usam cinco tentativas, backoff exponencial com jitter e concorrência limitada.
- Malware, formato inválido, corrupção, violação de tenant e schema desconhecido são irrecuperáveis.
- Falhas esgotadas geram registro `DEAD_LETTERED`, auditoria e alerta; reprocessamento é uma ação administrativa auditada que cria nova correlação.
- `QueueEvents` é usado para atualizar `ProcessingRun`, mas um reconciliador corrige divergências por retenção/trim de eventos Redis.

## Compatibilidade

Alterações incompatíveis criam nova fila ou novo `schemaVersion`; produtores mantêm compatibilidade durante a migração. CI testa a matriz de versões fixadas de BullMQ Node e BullMQ Python contra Redis real.
