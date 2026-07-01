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

1. Compartilhe a Google Sheet com a conta Gmail dona do executor.
2. Faça `clasp create --type standalone --title "Triador Executor <account_id>"`.
3. Configure o `rootDir` do executor para o diretorio de deploy dessa conta.
4. Rode `clasp push`.
5. Faça deploy como Web App:
   - Executar como: você.
   - Quem tem acesso: qualquer pessoa com o link.
6. Copie a URL `/exec` e preencha `executor_url` da conta correspondente na aba `Contas`.
7. Rode `createDailyTrigger()` nesse projeto executor se a conta deve coletar diariamente por conta propria.
