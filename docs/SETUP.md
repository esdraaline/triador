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
- Para F2, projetos Apps Script executores criados nas contas Gmail adicionais e com acesso a mesma Google Sheet.

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

### Roteador

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

### Executores F2

Crie um projeto executor por conta Gmail adicional: `esdraaline_gmail`, `conta-comercial_gmail` e `conta_familiar_gmail`.

**Importante:** o `GmailApp` dentro de um Apps Script atua na identidade de quem *possui/autoriza* aquele script — não na conta que só recebe acesso à planilha. Cada executor precisa ser criado e autorizado com login na própria conta Gmail dele, senão as ações caem na caixa errada (ou falham).

1. Rode `clasp logout` e depois `clasp login` autenticado **na conta Gmail dona do executor** (ex.: faça login como `esdraaline`, não como `josemardp`).
2. Monte um diretorio de deploy a partir de `executor/`:
   - copie `executor/src/ExecutorApp.js`;
   - copie os arquivos compartilhados de `src/` indicados em `executor/README.md`;
   - copie `executor/appsscript.json`.
3. No diretorio do executor, rode `clasp create --type standalone --title "Triador Executor <account_id>"` (ainda logado como a conta dona do executor).
4. Compartilhe a Google Sheet com essa mesma conta Gmail, para o script ter acesso de escrita à planilha compartilhada.
5. Configure as Script Properties do executor:
   - `ACCOUNT_ID=<account_id da aba Contas>`;
   - `SHEET_ID=<id da mesma planilha>`;
   - `SHARED_SECRET=<mesmo segredo do roteador>`;
   - `TELEGRAM_BOT_TOKEN=<token do bot do roteador>`;
   - `TELEGRAM_CHAT_ID=<chat do resumo>`;
   - `GEMINI_API_KEY=<chave Gemini>`.
6. Rode `clasp push`.
7. Faça deploy como Web App:
   - Executar como: você (a conta dona do executor).
   - Quem tem acesso: qualquer pessoa com o link.
8. Na primeira execução (qualquer função, ex. `setupTriadorSheet` ou o próprio deploy), autorize o consentimento OAuth do `gmail.modify` **logado como a conta dona do executor**.
9. Copie a URL `/exec` do executor e preencha `executor_url` na linha da conta em `Contas`.
10. Rode `createDailyTrigger()` dentro do executor se essa conta deve coletar diariamente. O `ACCOUNT_ID` limita a triagem a propria conta.
11. Antes de repetir o processo para a próxima conta, rode `clasp logout` de novo para não deixar login cruzado entre executores.

O webhook do Telegram continua apenas no roteador. Os executores recebem somente chamadas do roteador usando `SHARED_SECRET`.

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
2. Preencha a aba `Contas` com:
   - `josemardp_gmail`, `fase=F0`, `allow_ai_external=true`, `executor_url` vazio.
   - `esdraaline_gmail`, `fase=F2`, `allow_ai_external=true`, `executor_url` do executor.
   - `conta-comercial_gmail`, `fase=F2`, `allow_ai_external=cautela`, `executor_url` do executor.
   - `conta_familiar_gmail`, `fase=F2`, `allow_ai_external=cautela`, `executor_url` do executor.
3. Execute `executarTriagemDiaria()` manualmente no Apps Script.
4. Confira novas linhas na aba `Emails`.
5. Confirme que o resumo unico chegou no Telegram com a conta de origem em cada item.
6. Toque `[Arquivar]`.
7. Confirme que a thread saiu da Inbox, recebeu label `Triado_IA`, a linha ficou `status=executado`, o Log recebeu resultado `ok` e a mensagem foi editada com confirmação.
