# Feature Specification: Governança de Documentos

**Feature Branch**: `001-document-governance`

**Created**: 2026-09-16

**Status**: Draft

**Input**: User description: "O DocDeploy será uma plataforma para organizações receberem documentos, extraírem informações, conduzirem revisões e manterem um histórico auditável de tudo que aconteceu."

## Clarifications

### Session 2026-09-17

- Q: Quais formatos de arquivo a primeira versão deve aceitar para cadastro e extração? → A: PDF, PNG e JPEG.
- Q: A primeira versão deve conceder acesso somente pelos papéis predefinidos da organização, sem permissões individuais por documento? → A: Papéis organizacionais fixos, sem exceções por documento.
- Q: Após uma rejeição, como um documento deve voltar ao processo de revisão? → A: Enviar nova versão e iniciar nova revisão.
- Q: Qual deve ser o conjunto mínimo de informações estruturadas extraídas de todos os tipos de documento na primeira versão? → A: Identificador, emissor/origem, data relevante e valor quando houver.
- Q: Qual deve ser o tamanho máximo permitido para cada arquivo enviado? → A: 25 MB.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Receber e organizar documentos (Priority: P1)

Como responsável por documentos de uma organização, quero enviar um documento recebido e registrá-lo no espaço da minha organização para que ele deixe de depender de e-mails e pastas compartilhadas.

**Why this priority**: Centralizar o recebimento e identificar cada documento é o mínimo necessário para eliminar a incerteza sobre qual arquivo deve ser tratado.

**Independent Test**: Um usuário envia um contrato e confirma que ele aparece na lista da organização com tipo, remetente, data de recebimento e versão inicial.

**Acceptance Scenarios**:

1. **Given** que o usuário está autorizado a registrar documentos, **When** envia um arquivo compatível e informa seus dados mínimos, **Then** o documento é salvo no espaço da organização com um identificador único, status inicial e versão 1.
2. **Given** que um documento está registrado, **When** o usuário procura por seu nome, tipo, status ou período de recebimento, **Then** encontra o documento correspondente e seus dados principais.
3. **Given** que o arquivo não pode ser aceito, **When** o usuário tenta enviá-lo, **Then** recebe uma explicação clara e o documento não é registrado como recebido.

---

### User Story 2 - Extrair e revisar informações (Priority: P2)

Como revisor, quero consultar as informações extraídas de um documento, corrigir dados quando necessário e decidir se o documento está aprovado ou pendente para que a organização tenha um resultado confiável e acionável.

**Why this priority**: A centralização só gera valor operacional quando os dados relevantes podem ser conferidos e a pendência tem um responsável e uma decisão explícita.

**Independent Test**: Um revisor abre uma nota fiscal, confere os campos apresentados, corrige um valor, solicita complemento e verifica que a pendência e a decisão ficam visíveis no documento.

**Acceptance Scenarios**:

1. **Given** que há informações extraídas para um documento, **When** um revisor autorizado consulta o documento, **Then** visualiza os valores extraídos, sua origem no documento e os campos que exigem conferência.
2. **Given** que um dado extraído está incorreto ou incompleto, **When** o revisor o corrige ou solicita complemento, **Then** a alteração ou pendência registra autor, data, justificativa e estado atual.
3. **Given** que todas as pendências obrigatórias foram resolvidas, **When** o revisor aprova ou rejeita o documento, **Then** o status final, o responsável e a justificativa ficam disponíveis para consulta.

---

### User Story 3 - Consultar versões e auditoria (Priority: P3)

Como auditor ou gestor, quero comparar as versões de um documento e consultar uma linha do tempo imutável dos acontecimentos para confirmar qual versão é válida, quem tomou cada decisão e se houve alteração posterior.

**Why this priority**: A evidência de versões, revisões e decisões reduz riscos de uso de documentos desatualizados e simplifica auditorias.

**Independent Test**: Um auditor acessa um documento com duas versões e uma revisão, identifica a versão vigente, compara os dados de cada versão e exporta a linha do tempo de eventos.

**Acceptance Scenarios**:

1. **Given** que um documento recebeu uma nova versão, **When** um usuário autorizado consulta seu histórico, **Then** vê todas as versões em ordem, a versão vigente e a relação entre elas.
2. **Given** que houve ações sobre um documento, **When** um auditor consulta a linha do tempo, **Then** vê cada recebimento, extração, alteração, atribuição, comentário, decisão e mudança de versão com autor e data.
3. **Given** que um auditor aplica filtros de período, documento ou participante, **When** exporta o histórico filtrado, **Then** recebe um registro legível que contém os mesmos eventos exibidos na consulta.

### Edge Cases

- Um arquivo enviado novamente com o mesmo conteúdo deve ser identificado como duplicado e não pode criar uma nova versão sem confirmação explícita do usuário.
- Uma nova versão enviada enquanto há uma revisão em andamento deve preservar a revisão anterior no histórico e exigir uma decisão sobre a versão que será revisada.
- Quando a extração não identificar um campo esperado, o documento deve continuar acessível, com o campo marcado como não identificado e encaminhado para conferência.
- Um usuário sem permissão para consultar um documento, versão ou evento não pode visualizar seu conteúdo nem seus metadados.
- Um documento rejeitado deve manter seu histórico e ser distinguido de um documento aprovado ou pendente; seu retorno ao processo exige o envio de uma nova versão, que inicia uma nova revisão.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O sistema DEVE permitir que usuários autorizados registrem documentos em nome de sua organização, com arquivo, nome, tipo, origem, data de recebimento e responsável.
- **FR-002**: O sistema DEVE aceitar, no escopo inicial, arquivos de até 25 MB nos formatos PDF, PNG e JPEG para contratos, notas, certificados, relatórios e documentos cadastrais, permitindo classificar cada registro em um desses tipos.
- **FR-003**: O sistema DEVE atribuir a cada documento um identificador único, uma versão inicial, um status e uma indicação explícita de versão vigente.
- **FR-004**: O sistema DEVE extrair de cada documento o identificador, emissor ou origem e data relevante, além do valor quando existir, e indicar os campos ausentes, incertos ou que requerem revisão humana.
- **FR-005**: O sistema DEVE permitir que revisores autorizados consultem, confirmem ou corrijam informações extraídas, com justificativa para cada correção.
- **FR-006**: O sistema DEVE permitir a criação, atribuição e acompanhamento de pendências de revisão, incluindo responsável, prazo opcional, estado e comentário de resolução.
- **FR-007**: O sistema DEVE permitir que revisores autorizados aprovem, rejeitem ou devolvam documentos para complemento, exigindo uma justificativa nas decisões de rejeição ou devolução.
- **FR-008**: O sistema DEVE permitir o envio de uma nova versão de um documento, preservando as versões anteriores, sua relação com o mesmo documento e a versão considerada vigente; uma nova versão de documento rejeitado DEVE iniciar uma nova revisão.
- **FR-009**: O sistema DEVE impedir a alteração silenciosa de arquivos e informações de versões anteriores; qualquer correção deve gerar um evento de auditoria vinculado ao autor e à data.
- **FR-010**: O sistema DEVE manter uma linha do tempo consultável para cada documento, registrando recebimento, extração, alterações, pendências, comentários, decisões e mudanças de versão.
- **FR-011**: O sistema DEVE permitir que usuários autorizados pesquisem e filtrem documentos por nome, tipo, status, responsável, período de recebimento e presença de pendências.
- **FR-012**: O sistema DEVE permitir que usuários autorizados exportem o histórico de auditoria filtrado de documentos aos quais têm acesso.
- **FR-013**: O sistema DEVE restringir a consulta, revisão, decisão, envio de versões e exportação de histórico conforme o papel organizacional do usuário, sem permissões individuais ou exceções por documento no escopo inicial.

### Key Entities *(include if feature involves data)*

- **Organização**: Unidade que possui os documentos, seus usuários e suas regras de acesso.
- **Usuário**: Pessoa vinculada a uma organização, com um papel organizacional que define as ações permitidas; o escopo inicial não admite permissões individuais por documento.
- **Documento**: Registro de negócio que reúne classificação, origem, estado, responsável e seu conjunto de versões.
- **Versão do documento**: Arquivo recebido em determinado momento, associado a um documento, com indicação de vigência e informações extraídas.
- **Informação extraída**: Dado identificado em uma versão, incluindo identificador, emissor ou origem, data relevante e valor quando existir, além de campo de origem, grau de confiança e estado de revisão.
- **Revisão**: Atividade de conferência de uma versão, incluindo responsável, pendências, comentários e decisão.
- **Evento de auditoria**: Registro cronológico de uma ação relevante, contendo ator, data, ação, objeto afetado e contexto suficiente para reconstituição.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Em testes com documentos dos cinco tipos suportados, pelo menos 90% dos usuários autorizados registram um documento e localizam sua versão vigente em até 3 minutos, sem auxílio.
- **SC-002**: Pelo menos 95% dos documentos submetidos para revisão exibem, em até 2 minutos, um resultado de extração ou uma indicação clara de que requerem conferência manual.
- **SC-003**: Pelo menos 95% das decisões de revisão são concluídas com responsável, data, status e justificativa quando exigida, sem campos obrigatórios ausentes.
- **SC-004**: Em uma amostra de 100 documentos com múltiplas versões, auditores identificam corretamente a versão vigente e o responsável pela última decisão em 100% dos casos.
- **SC-005**: Pelo menos 90% dos auditores participantes avaliam como fácil encontrar a linha do tempo e comprovar a sequência de acontecimentos de um documento.
- **SC-006**: A exportação de um histórico filtrado de até 1.000 eventos é concluída em até 1 minuto e contém todos os eventos apresentados na consulta.

## Assumptions

- A primeira versão atende organizações que recebem arquivos manualmente; captura direta de e-mails, pastas compartilhadas e outros sistemas será tratada como evolução posterior.
- A organização já possui usuários identificados e pode atribuir, pelo menos, os papéis de administrador, colaborador, revisor e auditor.
- O produto deve sinalizar claramente quando a extração não for possível; campos específicos adicionais por tipo documental serão tratados como evolução posterior.
- A evidência de auditoria deve ser mantida enquanto o documento existir e permanecer acessível apenas a usuários autorizados da organização.
- Notificações externas, assinatura eletrônica, regras jurídicas específicas de cada país e automação de decisões estão fora do escopo desta primeira funcionalidade.
