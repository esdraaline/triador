# Setup do Triador

## Pré-requisitos

- Node.js e npm instalados.
- `@google/clasp` instalado e autenticado na conta Google que hospedará o Apps Script.
- API do Google Apps Script habilitada na conta.

## Segredos (Script Properties)

Os segredos serão configurados em Script Properties, nunca no código. As chaves previstas são:

- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SHARED_SECRET`
- `SHEET_ID`

## Deploy

O deploy será detalhado nos próximos sprints. A base do projeto já usa `src/` como `rootDir` do clasp.

## Webhook do Telegram

O webhook será configurado após a criação do Web App e sempre incluirá validação por `SHARED_SECRET`.

## Gatilho diário

O gatilho diário será criado para rodar a triagem pela manhã no fuso `America/Sao_Paulo`.
