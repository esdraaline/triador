# Template de Executor por conta

Este diretorio e o ponto de partida para criar um projeto Apps Script executor para cada conta Gmail F2 (`esdraaline_gmail`, `conta-comercial_gmail`, `conta_familiar_gmail`).

## Arquivos do projeto executor

Crie um diretorio de deploy por conta e copie estes arquivos para a raiz configurada no `clasp`:

- `executor/src/ExecutorApp.js`
- `src/Config.js`
- `src/Planilha.js`
- `src/Coletor.js`
- `src/Regras.js`
- `src/Classificador.js`
- `src/Gemini.js`
- `src/Executor.js`
- `src/Telegram.js`
- `src/Triagem.js`
- `src/Admin.js`
- `executor/appsscript.json`

O `ExecutorApp.js` fornece o `doPost` do Web App executor. Os demais arquivos sao compartilhados com o roteador para manter coleta, classificacao, planilha e acoes Gmail iguais.

## Script Properties por executor

- `ACCOUNT_ID`: id da conta na aba `Contas`.
- `GEMINI_API_KEY`: pode ficar vazio apenas se a politica da conta nunca permitir Gemini; para Apps Script, prefira preencher.
- `TELEGRAM_BOT_TOKEN`: token do bot do roteador, usado para editar a mensagem apos a acao.
- `TELEGRAM_CHAT_ID`: chat do resumo.
- `SHARED_SECRET`: o mesmo segredo do roteador.
- `SHEET_ID`: a mesma planilha compartilhada.

## Deploy

**Importante:** `GmailApp` age na identidade de quem autoriza o script, não na conta que só tem acesso à planilha. Faça `clasp login` na conta Gmail dona deste executor ANTES de criar o projeto (`clasp logout` primeiro se já houver outra sessão ativa).

1. `clasp logout` e `clasp login` autenticado na conta Gmail dona do executor.
2. Compartilhe a Google Sheet com essa mesma conta.
3. Faça `clasp create --type standalone --title "Triador Executor <account_id>"` (ainda logado como essa conta).
4. Configure o `rootDir` do executor para o diretorio de deploy dessa conta.
5. Rode `clasp push`.
6. Faça deploy como Web App:
   - Executar como: você (a conta dona do executor).
   - Quem tem acesso: qualquer pessoa com o link.
7. Autorize o consentimento OAuth do `gmail.modify` na primeira execução, logado como essa conta.
8. Copie a URL `/exec` e preencha `executor_url` da conta correspondente na aba `Contas`.
9. Rode `createDailyTrigger()` nesse projeto executor se a conta deve coletar diariamente por conta propria.
10. Rode `clasp logout` antes de configurar o próximo executor, para não deixar login cruzado entre contas.
