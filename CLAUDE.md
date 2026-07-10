# CLAUDE.md — Triador

## O que é
Automação de triagem unificada de e-mail: Google Apps Script + Google Sheets (estado) + Telegram (ações com confirmação humana) + Gemini (classificação quando permitido). Multi-conta (F2): roteador em `josemardp_gmail`; executores por conta (`esdraaline_gmail` implantado; `conta-comercial_gmail` e `conta_familiar_gmail` pendentes).

## Contas e repos
- GitHub: `esdraaline/triador` (branch `main`) — **é proposital estar na conta esdraaline**.
- Executor da 2ª conta vive em repo/pasta separada: `c:\projetos\triador-executor-esdraaline`.
- Testes: `npm test` (Jest).

## Docs vivos
- `README.md` — status de rollout por conta e próximos sprints.
- `docs/PRD.md`, `docs/SETUP.md`, `docs/Sprints-Triador-prompts-codex.md`.

## Segredos
- Pasta `secrets/` (gitignorada — conferir com `git check-ignore secrets` antes de commit) + Script Properties no Apps Script.
- Chave nova: gravar direto em `secrets/chaves.json` sem ecoar o valor no chat.

## Regra de implantação manual (pedido explícito do dono)
Toda etapa de implantação (Apps Script, clasp, webhook do Telegram, planilha, ativação de API):
1. **Fazer agenticamente** quando houver ferramenta (browser/MCP/clasp CLI).
2. Se o Josemar precisar fazer à mão: guiar **UM passo por vez**, com print/descrição exata de onde clicar, e esperar confirmação.
3. **Cobrar a conclusão da implantação antes de avançar para o próximo sprint** — nunca declarar sprint fechado com implantação pendente.
4. Ao final, sempre testar de verdade (e-mail chega? Telegram responde?) antes de dar por concluído.
