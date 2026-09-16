# Data Model: Governança de Documentos

## Convenções transversais

- Todas as tabelas de negócio têm identificador imutável, `created_at`, `updated_at` quando aplicável e `organization_id` obrigatório.
- RLS restringe cada operação pela organização definida na transação. Identificadores externos não concedem acesso.
- Datas usam UTC; valores extraídos guardam tipo e representação original quando necessário para revisão.
- Eventos de auditoria e versões são append-only. Exclusão lógica e retenção seguem política administrativa, sem apagar a evidência de uma decisão.

## Entidades

| Entidade | Campos e regras centrais | Relações |
| --- | --- | --- |
| `Organization` | `id`, nome, status, políticas de retenção e opt-in de IA. | Possui membros, documentos e configurações. |
| `User` | `id`, e-mail normalizado, nome, estado, hash Argon2 de senha quando autenticação local é usada. | Participa de organizações por `OrganizationMembership`. |
| `OrganizationMembership` | `organization_id`, `user_id`, papel e permissões de domínio, estado e datas. Unicidade por organização/usuário. | Define a organização e permissões efetivas da sessão. |
| `Session` | usuário, organização, hash de refresh token, família, expiração, revogação e metadados mínimos de dispositivo. | Suporta rotação e revogação de sessão. |
| `Document` | `id`, organização, nome, tipo, origem, responsável, estado de negócio e `current_version_id`. | Possui muitas versões, revisões e eventos. |
| `DocumentVersion` | `id`, documento, número sequencial, hash, tamanho, tipo detectado, chave/versão de objeto, estado de processamento, criador e motivo de substituição. Unicidade por documento/número e por documento/hash conforme regra de duplicação. | Tem artefatos, campos extraídos, runs e revisões. |
| `StoredArtifact` | organização, versão documental, zona (`quarantine`, `clean`, `derived`), chave imutável, hash, tamanho, tipo, origem e retenção. | Referência segura ao original ou derivado; nunca guarda binário no banco. |
| `ExtractedField` | versão, chave de campo, valor tipado, representação original, fonte, página/trecho, confiança, estado de revisão e revisor. | Pertence a versão e pode gerar correção auditada. |
| `Review` | organização, versão, estado, responsável, decisão, justificativa e datas. | Possui pendências, comentários e decisão final. |
| `ReviewTask` | revisão, título, responsável, prazo opcional, estado e resolução. | Permite pendências múltiplas por revisão. |
| `ReviewComment` | revisão/tarefa, autor, mensagem, data e vínculo opcional com campo extraído. | Mantém colaboração contextual. |
| `ProcessingRun` | organização, versão, operação, versão de processador, chave de idempotência, `bull_job_id`, estado, estágio, progresso, tentativas, correlação, erro sanitizado e tempos. Unicidade por organização/versão/operação/versão de processador. | Materializa o estado durável de fila e resultado. |
| `OutboxEvent` | organização, tipo/versão de evento, payload mínimo, chave de idempotência, criado/publicado/falha. | Publica trabalho sem transação distribuída. |
| `AuditEvent` | organização, sequência, hash anterior/atual, ator humano ou serviço, ação, recurso, versão, resultado, motivo, correlação, data e metadados sanitizados. Não admite update/delete pelo papel da aplicação. | Forma a linha do tempo e pode ser exportado. |
| `Notification` | organização, destinatário, canal, tipo, estado, referência de recurso e tentativas. | É gerada por eventos de negócio, não pelo worker diretamente. |

## Relacionamentos e integridade

```text
Organization ──< OrganizationMembership >── User
Organization ──< Document ──< DocumentVersion ──< {StoredArtifact, ExtractedField, ProcessingRun, Review}
Review ──< {ReviewTask, ReviewComment}
Document/DocumentVersion/Review/ProcessingRun ──< AuditEvent
DocumentVersion ──< OutboxEvent ──> BullMQ job
```

- `Document.current_version_id` deve apontar para uma versão do mesmo documento, aprovada pelas regras de estado.
- A substituição cria `DocumentVersion` nova; nunca atualiza o arquivo ou hash de uma versão existente.
- A correção humana de `ExtractedField` preserva valor anterior/origem e registra `AuditEvent` na mesma transação.
- A promoção de artefato de quarentena só é permitida após `SCAN_PASSED`; um artefato infectado não tem URL de leitura para usuários.
- Operações no mesmo job repetidas retornam resultado previamente persistido se a chave de idempotência e o hash coincidirem.

## Transições validadas

| Domínio | Transições permitidas | Regra |
| --- | --- | --- |
| Versão | upload → quarentena → scan → extração/OCR/análise → pronta para revisão | Cada avanço exige resultado do estágio anterior e auditoria. |
| Versão | scan → rejeitada por malware ou falha de segurança | Não libera conteúdo; só usuário autorizado pode iniciar nova versão. |
| Revisão | pendente → em revisão → aprovada/rejeitada/devolvida | Decisão exige permissão; rejeição/devolução exige justificativa. |
| Pendência | aberta → resolvida/cancelada | Resolução registra responsável, comentário e data. |
| Run | fila → ativa → concluída/falhou/retry/DLQ/cancelada | Transições são monotônicas e idempotentes; a API revalida eventos atrasados. |

## Índices e retenção de domínio

- Índices compostos incluem `organization_id` para documentos por status/tipo/responsável/data, eventos por recurso/data e runs por estado/data.
- Campos pesquisáveis recebem índice adequado à consulta; conteúdo completo extraído só é indexado após avaliação de privacidade e política da organização.
- Objetos e dados derivados adotam a retenção da versão. Eventos permanecem enquanto a versão existir, sujeitos à retenção de auditoria e obrigações legais configuradas.
