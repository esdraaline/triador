# Integração com o Central de Automações

O Triador permanece proprietário da triagem, classificação, ações e auditoria
de e-mails pessoais/comerciais. O Central de Automações permanece proprietário
de VPN, navegador, sistemas institucionais, OCR e geração de documentos.

## Integrações da Fase 5

- O Central oferece um atalho configurável para abrir a implantação do Triador.
- O atalho não chama o runtime do Triador, não recebe credenciais e não executa
  ações de Gmail.
- O contrato `novoHandoff` permite que o Triador gere uma referência auditável
  para abertura manual em outro projeto, sempre com confirmação explícita.
- Conteúdo institucional não deve ser colocado em handoffs destinados ao
  Triador. Para esse conteúdo, a sensibilidade deve ser institucional ou
  institucional sensível e o tratamento permanece local.

O contrato de divisão de responsabilidades continua em
`central_automacoes/docs/ARQUITETURA_UNIFICADA.md`.

O aceite técnico consolidado das seis fases está em
`central_automacoes/docs/UNIFICACAO_STATUS.md`.
