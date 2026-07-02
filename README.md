# Triador

Triador é uma automação de triagem unificada de email em Google Apps Script: coleta mensagens novas, classifica por regras e IA quando permitido, registra estado em Google Sheets e entrega ações seguras via Telegram, sempre com confirmação humana.

## Status

MVP F0 em produção desde 29/06/2026.

Sprints concluídos: S0 a S8 (F0 completo, F1 ações seguras, F2 multi-conta implementada).

Rollout F2 (executores por conta), em andamento desde 01/07/2026:
- `josemardp_gmail` (roteador): em produção.
- `esdraaline_gmail`: executor implantado e testado.
- `conta-comercial_gmail`: pendente.
- `conta_familiar_gmail`: pendente.

Próximos sprints: S9, F3 histórico de remetente + mute.

## Testes

```bash
npm test
```

## Documentação

- [PRD](docs/PRD.md)
- [Setup](docs/SETUP.md)
