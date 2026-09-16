# Contract: API pública e OpenAPI

## Escopo

A API NestJS expõe contrato OpenAPI versionado para o cliente React e integrações futuras. A especificação gerada é a fonte pública de tipos, validação de contrato e documentação Swagger; detalhes de rotas serão definidos durante a geração de tarefas e implementação.

## Grupos funcionais

| Grupo | Capacidades públicas |
| --- | --- |
| Autenticação | iniciar/encerrar sessão, renovar sessão e consultar identidade/contexto de organização. |
| Organizações e usuários | administrar organização, membros, papéis e preferências permitidas. |
| Documentos e versões | registrar metadados, iniciar upload autorizado, consultar, pesquisar, comparar versões e acessar conteúdo liberado. |
| Processamento | consultar status/progresso persistido e solicitar reprocessamento autorizado. |
| Revisões e workflows | atribuir, comentar, resolver pendências e decidir sobre versões. |
| Auditoria e notificações | consultar/exportar eventos autorizados e visualizar notificações. |

## Regras de contrato

- A organização é inferida da sessão/vínculo; contratos não aceitam um tenant arbitrário como poder de acesso.
- DTOs aplicam allowlist, validação de tipo/tamanho e mensagens de erro estáveis. Não retornam hash de senha, refresh token, chave de storage, chave OpenAI ou detalhes internos de erro.
- Toda mutação inclui correlação, gera evento de auditoria e retorna o estado persistido relevante; uploads usam URLs temporárias, não um proxy de arquivo pela API.
- Operações de risco usam autorização por permissão, não apenas papel de interface. Respostas não revelam existência de recurso de outro tenant.
- A especificação declara esquemas de erro sanitizados, paginação/ordenação permitidas, requisitos de autenticação e modelos de recurso, mas não substitui RLS e verificações de domínio.

## Governança do contrato

Alterações compatíveis incrementam a versão menor da documentação; mudanças incompatíveis exigem versão pública nova, período de compatibilidade e teste de contrato no CI. Swagger fica aberto apenas em desenvolvimento ou protegido por controle administrativo nos demais ambientes.
