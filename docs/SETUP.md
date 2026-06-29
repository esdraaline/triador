# Setup do Triador

## Pré-requisitos

- Node.js e npm instalados.
- `@google/clasp` instalado: `npm install -g @google/clasp`.
- Login no clasp: `clasp login`.
- API do Google Apps Script habilitada em `https://script.google.com/home/usersettings`.
- Projeto Apps Script standalone criado na conta `josemardp`: `clasp create --type standalone --title "Triador"`.
- `.clasp.json` com o `scriptId` real e `rootDir: "src"`.
- Google Sheet criada com acesso da conta do script.
- Bot do Telegram criado no @BotFather e `chat_id` conhecido.
- Chave Gemini criada no Google AI Studio.

## Segredos (Script Properties)

Configure em Apps Script > Project Settings > Script Properties:

- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `SHARED_SECRET`
- `SHEET_ID`
- `WEB_APP_URL` após o deploy do Web App

Também existe `seedProperties(values)` para gravar propriedades a partir de um objeto passado manualmente no editor, mas o caminho recomendado é preencher as Script Properties pela UI para não deixar segredos em arquivos locais ou no histórico do projeto.

## Deploy

1. Rode `npm run check`.
2. Confirme que `.clasp.json` tem o `scriptId` real.
3. Rode `npm run push`.
4. No Apps Script, execute `setupTriadorSheet()` uma vez para criar/garantir as abas.
5. Faça o deploy como Web App:
   - Executar como: você.
   - Quem tem acesso: qualquer pessoa com o link.
6. Copie a URL terminada em `/exec`.
7. Defina `WEB_APP_URL` nas Script Properties com essa URL.
8. Rode `setTelegramWebhook()`.
9. Rode `createDailyTrigger()`.

`npm run deploy` executa `clasp push && clasp deploy`; use quando o `scriptId` real já estiver configurado e o clasp estiver autenticado.

## Webhook do Telegram

`setTelegramWebhook()` registra a URL do Web App com o segredo no parâmetro:

```text
https://.../exec?SHARED_SECRET=<valor>
```

O `doPost` rejeita chamadas sem esse segredo e não executa ações.

## Gatilho diário

`createDailyTrigger()` cria de forma idempotente um gatilho diário às 07:00 para `executarTriagemDiaria`.

## Teste de fumaça do MVP

1. Execute `setupTriadorSheet()`.
2. Preencha a aba `Contas` com a conta F0 `josemardp_gmail`.
3. Execute `executarTriagemDiaria()` manualmente no Apps Script.
4. Confira novas linhas na aba `Emails`.
5. Confirme que o resumo chegou no Telegram.
6. Toque `[Arquivar]`.
7. Confirme que a thread saiu da Inbox, recebeu label `Triado_IA`, a linha ficou `status=executado`, o Log recebeu resultado `ok` e a mensagem foi editada com confirmação.
