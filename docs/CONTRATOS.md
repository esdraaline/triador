# Contratos compartilhados

Os schemas oficiais de execução, auditoria, ações e políticas ficam em
`central_automacoes/contratos/` na versão `1.0.0`.

Este projeto possui o adaptador JavaScript em `src/Contratos.js`. Ele mantém o
formato histórico da planilha e dos callbacks, adicionando o envelope comum:

- `contract_version`;
- `execution_id`;
- `automation_id`;
- `status`;
- `sensitivity`;
- `idempotency_key`.

O adaptador não envia corpo de e-mail, token ou segredo para eventos de
auditoria.
