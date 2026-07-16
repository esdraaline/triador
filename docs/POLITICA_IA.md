# Política comum de IA e sensibilidade

A política canônica está em `central_automacoes/docs/POLITICA_IA.md` e nos
schemas de `central_automacoes/contratos/`.

No Triador:

- contas `institutional` e `institutional_sensitive` nunca vão ao Gemini;
- contas com `allow_ai_external=cautela` permanecem em revisão manual;
- o botão de lixeira respeita `allow_delete`;
- auditoria não contém corpo de mensagem nem segredos.
