# Triador — Sprints de Desenvolvimento + Prompts Agênticos para o Codex

> **Companheiro do:** `PRD-triador-triagem-email.md` (fonte da verdade)
> **Versão:** 1.0 · **Data:** 29/06/2026
> **Objetivo:** levar o Triador do zero ao produto completo com **máxima automação no desenvolvimento** — o Codex executa cada sprint de ponta a ponta; você só valida no portão entre sprints.

---

## 0. Como usar este documento

O fluxo é simples e foi desenhado para te dar o **máximo de agentificação** sem perder o controle:

1. **Faça o setup único humano** (abaixo) — as poucas coisas que exigem suas credenciais Google e não dá para automatizar.
2. **Cole o `Prompt 0` uma única vez** no Codex. Ele estabelece o acordo de trabalho: persona, convenções do repo, guardrails inegociáveis, definição de pronto e o comportamento de portão. Tudo depois fica curto porque se apoia nele.
3. **Cole um prompt de sprint por vez**, do `S0` ao `S13`. Por padrão o Codex roda o sprint inteiro sozinho (planeja internamente, implementa, escreve e roda os testes até passarem, commita) e **só para no fim**, com um relatório, aguardando seu "go".
4. Se você quiser **zero portões**, é só dizer **"modo contínuo"** no Codex — ele encadeia os sprints sem esperar.

> **Antes de tudo:** salve o PRD que te entreguei como `docs/PRD.md` na raiz do repositório. Todos os prompts assumem que ele está lá.

---

## Setup único (humano) — o que só você pode fazer

Essas etapas exigem suas credenciais e são feitas **uma vez**. Depois disso, o agente faz o resto (inclusive `clasp push` e `clasp deploy`).

```bash
# 1. Node + clasp
npm install -g @google/clasp

# 2. Login no clasp (abre o navegador — autenticação sua)
clasp login

# 3. Habilite a Apps Script API na sua conta (uma vez):
#    https://script.google.com/home/usersettings  → "API do Google Apps Script" = ON

# 4. Crie o repositório local e entre nele
mkdir triador && cd triador && git init

# 5. Crie o projeto Apps Script standalone vinculado (o agente ajusta o rootDir depois)
clasp create --type standalone --title "Triador"
#    → isso gera .clasp.json com o scriptId. Guarde-o.
```

Depois, ao longo do desenvolvimento, **só estas ações continuam suas** (o agente prepara o código, você executa uma vez):
- **Autorizar o consentimento OAuth** na primeira vez que o script tocar o Gmail (a tela de permissão do `gmail.modify`).
- **Preencher os segredos** em Script Properties (ou rodar a função `seedProperties()` lendo de um arquivo local não versionado).
- **Rodar uma vez** `setTelegramWebhook()` e `createDailyTrigger()` (funções que o agente escreve no `Admin.js`).
- Criar o **bot no @BotFather** e pegar seu `chat_id`; gerar a **chave do Gemini** no Google AI Studio.

---

## Convenções globais (resumo — detalhe no Prompt 0)

```
triador/
  .clasp.json            # rootDir: "src"
  .claspignore           # sobe só src/*.js + appsscript.json
  .gitignore             # ignora node_modules, creds do clasp, *.local
  package.json           # scripts: test, lint, push, deploy, check
  jest.config.js
  .eslintrc.json / .prettierrc
  docs/
    PRD.md               # você cola aqui
    SETUP.md             # gerado pelo agente (passos manuais Google)
  src/
    appsscript.json      # manifesto + oauthScopes
    Config.js            # acessores de Script Properties
    Planilha.js          # CRUD nas abas + setupSheet()
    Coletor.js           # GmailApp.search → normaliza → grava na fila
    Regras.js            # motor determinístico (PURO)
    Gemini.js            # UrlFetch + parse JSON + backoff
    Classificador.js     # cascata (PURO, recebe geminiFn injetada)
    Telegram.js          # sendMessage/editMessage + teclado + formatter (formatter PURO)
    Triagem.js           # job diário (orquestração — entrypoint do gatilho)
    Roteador.js          # doPost: valida SHARED_SECRET, parseia callback, despacha
    Executor.js          # ações Gmail (arquivar, lixeira, guardar, ciente, rascunho, unsubscribe)
    Admin.js             # setupSheet, seedProperties, setTelegramWebhook, createDailyTrigger, healthCheck
  test/
    helpers/gasMocks.js  # mocks de GmailApp, SpreadsheetApp, UrlFetchApp, PropertiesService, Logger
    *.test.js
```

**Padrão de export dual** (toda função pura é testável em Node sem quebrar no Apps Script):

```js
function classificar(email, ctx) { /* lógica pura */ }
// no fim do arquivo:
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { classificar /* , ... */ };
}
```

No Apps Script `module` é `undefined` → o guard é ignorado e as funções viram globais. No Node, `require()` as importa. Toda chamada a `GmailApp`/`SpreadsheetApp`/`UrlFetchApp` fica **isolada** em funções finas; a lógica de decisão vive em funções puras.

---

## Mapa de sprints

| Sprint | Fase PRD | Entrega | Testável em Node |
|---|---|---|---|
| **S0** | infra | Repo, clasp, Jest + mocks dos globais, ESLint/Prettier, npm scripts | smoke |
| **S1** | §6 | `Config` + `Planilha` (`setupSheet`) + modelo EmailItem + gerador de `id_interno` | sim |
| **S2** | §7 | `Regras` + `Gemini` + `Classificador` (cascata + privacidade) | **forte** |
| **S3** | F0 | `Coletor` + `Triagem` (orquestração, ainda sem Telegram) | sim |
| **S4** | §9 | `Telegram`: envio do resumo + formatter + teclado inline | sim |
| **S5** | **F0** | `Roteador` (doPost) + `Executor` (arquivar) → **fecha o MVP** | sim |
| **S6** | F0 deploy | `Admin` (webhook/gatilho/health) + `SETUP.md` + deploy assistido | parcial |
| **S7** | F1 | Ações seguras: lixeira, guardar importante, ciente | sim |
| **S8** | F2 | Multi-conta + malha Roteador→Executores + política por conta | sim |
| **S9** | F3 | Histórico de remetente + remetentes silenciados (mute) | sim |
| **S10** | F4 | Hotmail via Microsoft Graph (módulo separado) | sim |
| **S11** | F5 | Rascunhos de resposta | sim |
| **S12** | F6 | Descadastro seguro (RFC 8058 + cenários A/B/C) | sim |
| **S13** | hardening | Erros/backoff/auto-relatório + docs + prep graduação | sim |

---

# Prompt 0 — Acordo de trabalho (cole UMA vez)

```
Você é meu engenheiro sênior de automação, especialista em Google Apps Script, clasp, Node.js e Jest. Vamos construir um projeto chamado "Triador" (triagem unificada de email) ao longo de vários sprints. Este é nosso ACORDO DE TRABALHO permanente — vale para todos os prompts seguintes.

FONTE DA VERDADE
- O arquivo `docs/PRD.md` é a especificação oficial. Em qualquer conflito, o PRD vence.
- Se algo for ambíguo ou faltar no PRD, PERGUNTE antes de inventar. Não improvise comportamento de produto.

COMO VOCÊ TRABALHA EM CADA SPRINT (modo agêntico, máxima automação)
- Por padrão, execute o sprint INTEIRO de ponta a ponta sem pausar para confirmar passos intermediários: planeje internamente, implemente, escreva os testes, RODE os testes e itere até ficarem 100% verdes, rode o lint, e faça commit.
- Ao TERMINAR o sprint, PARE e me entregue um RELATÓRIO (formato abaixo), e aguarde meu "go" para o próximo sprint.
- Se eu disser "modo contínuo", encadeie os sprints sem esperar meu "go".
- Nunca avance de sprint por conta própria fora do modo contínuo.

CONVENÇÕES DO REPOSITÓRIO
- Estrutura e nomes de arquivo conforme PRD §20, adaptados para clasp+testes:
  src/ contém os .js do Apps Script + appsscript.json; test/ contém Jest; docs/ a documentação.
- `.clasp.json` com `rootDir: "src"`. `.claspignore` configurado para subir SOMENTE `src/*.js` e `appsscript.json` (nada de test/, node_modules/, docs/).
- PADRÃO DE EXPORT DUAL em todo arquivo com lógica pura:
  no fim do arquivo, `if (typeof module !== 'undefined' && module.exports) { module.exports = { ...funcoes }; }`
  Assim as funções são globais no Apps Script e require-áveis no Node.
- Separe SEMPRE a lógica pura (decisão, parsing, formatação) das chamadas às APIs Google (GmailApp, SpreadsheetApp, UrlFetchApp, PropertiesService). As chamadas ficam em funções finas; a lógica fica em funções puras testáveis.
- Use `package.json` com scripts: `test` (jest), `lint` (eslint), `push` (clasp push), `deploy` (clasp push && clasp deploy), `check` (lint && test).
- Commits convencionais em português curto, ex.: `feat(classificador): cascata regras→gemini` / `test(roteador): valida secret e idempotência`.

GUARDRAILS INEGOCIÁVEIS (nunca viole, em nenhum sprint)
1. NUNCA exclusão permanente de email. "Excluir" = mover para a Lixeira (trash), recuperável. Não exista botão de delete permanente.
2. Segredos (token do bot, chave Gemini, SHARED_SECRET, SHEET_ID) SOMENTE em Script Properties. Nunca no código, nunca commitados. `.gitignore` cobre creds do clasp e qualquer arquivo `*.local`.
3. Escopo Gmail = `https://www.googleapis.com/auth/gmail.modify`. NUNCA o escopo restrito `https://mail.google.com/`.
4. O Web App (`doPost`) SEMPRE valida o `SHARED_SECRET` recebido; sem o segredo correto, responde 401 e não age.
5. Nada de envio automático de email — o máximo é gerar rascunho (draft).
6. Idempotência obrigatória: coleta sempre com `is:unread -label:Triado_IA`; antes de executar uma ação, cheque o `status` na fila para não repetir.
7. Logs só com metadados. NUNCA logar corpo de email, tokens ou senhas.
8. Respeite a política por conta (`allow_ai_external`): se for `cautela` ou `false`, NÃO envie o conteúdo daquela conta ao Gemini — resolva por regra ou marque para revisão manual.

DEFINIÇÃO DE PRONTO (DoD) — todo sprint só está pronto quando:
- O código segue as convenções e os nomes do PRD.
- `npm test` está 100% verde, com testes cobrindo a lógica pura nova/alterada.
- `npm run lint` passa sem erros.
- O commit foi feito.
- Você me deu o relatório no formato abaixo, incluindo os passos manuais que sobraram para mim.

FORMATO DO RELATÓRIO (ao fim de cada sprint)
SPRINT <n> — RELATÓRIO
✔ Feito: <bullets do que foi implementado>
🧪 Testes: <N> passando — <lista curta dos casos cobertos>
🔧 Manual (você): <passos que exigem minhas credenciais/cliques, ou "nenhum">
📋 Aceite: <cada critério de aceite do sprint marcado ✔ ou ✗ com 1 linha>
🧭 Próximo: Sprint <n+1> — aguardando "go".

Responda apenas "Acordo registrado. Pronto para o Sprint 0." e aguarde.
```

---

# S0 — Fundação do repositório e do loop de testes

**Objetivo:** deixar o ambiente 100% agentificado — o agente consegue codar, testar e subir sem fricção.
**Aceite:** `npm test` verde (smoke), `npm run lint` limpo, `.claspignore` sobe só `src/`, harness de mocks dos globais Google pronto.

```
Sprint 0 — Fundação do repositório e tooling. Siga o Acordo de Trabalho.

Tarefa:
1. Inicialize o projeto Node: `package.json` com os scripts test/lint/push/deploy/check, devDependencies jest, eslint, prettier, eslint-config-prettier.
2. Configure `jest.config.js` (testEnvironment node, testMatch test/**/*.test.js), `.eslintrc.json` (env: { node: true, es2021: true } + globals do Apps Script: GmailApp, SpreadsheetApp, UrlFetchApp, PropertiesService, ScriptApp, Logger, Utilities como readonly) e `.prettierrc`.
3. Crie a estrutura de pastas do PRD §20: `src/` (com `appsscript.json`), `test/helpers/`, `docs/`.
4. `src/appsscript.json`: timeZone "America/Sao_Paulo", runtimeVersion V8, oauthScopes com EXATAMENTE: gmail.modify, script.external_request, spreadsheets, script.scriptapp. (Nunca o escopo restrito do Gmail.)
5. `.clasp.json` com `rootDir: "src"` (preserve o scriptId que já existe no .clasp.json gerado pelo `clasp create`, se houver; senão deixe um placeholder e me avise).
6. `.claspignore` que faça o clasp subir SOMENTE `src/**/*.js` e `src/appsscript.json` (ignore node_modules, test, docs, package.json, etc.).
7. `.gitignore` cobrindo node_modules, `*.local`, creds do clasp (~/.clasprc.json é global, mas ignore qualquer `.clasprc.json` local), e arquivos de segredo.
8. `test/helpers/gasMocks.js`: um helper que instala em `global` mocks configuráveis de GmailApp, SpreadsheetApp, UrlFetchApp, PropertiesService, ScriptApp, Logger e Utilities — com fábricas para simular threads/mensagens do Gmail, abas/linhas de planilha e respostas de UrlFetch. Inclua funções `installMocks(overrides)` e `resetMocks()`.
9. Um teste smoke `test/smoke.test.js` que importa o gasMocks, instala, e verifica que os mocks existem e resetam — só para provar que o harness roda verde.
10. `docs/SETUP.md` inicial (esqueleto): seções "Pré-requisitos", "Segredos (Script Properties)", "Deploy", "Webhook do Telegram", "Gatilho diário" — preencheremos nos próximos sprints.
11. README.md curto: o que é o Triador (1 parágrafo), como rodar os testes, e a referência ao docs/PRD.md.

Rode `npm install`, `npm test` (deve passar) e `npm run lint` (deve passar). Commit. Relatório.
```

---

# S1 — Núcleo de dados: Config + Planilha + modelo

**Objetivo:** os acessores de segredo, o esquema das 4 abas, o modelo normalizado de email e o gerador de `id_interno`.
**Aceite:** `setupSheet()` cria as abas com os cabeçalhos do PRD §6; mapeamento linha⇄objeto coberto por teste; `id_interno` único de 6 chars.

```
Sprint 1 — Núcleo de dados (Config + Planilha + modelo). Siga o Acordo de Trabalho. Base: PRD §6.

Tarefa:
1. `src/Config.js`: acessores de Script Properties (getGeminiKey, getTelegramToken, getTelegramChatId, getSharedSecret, getSheetId), cada um lançando erro claro se ausente. Constantes do produto (nome do label `Triado_IA`, nomes das abas, enum de categorias e de status conforme PRD §6/§7).
2. `src/Planilha.js`:
   - `setupSheet()`: cria/garante as abas `Contas`, `Emails`, `Regras`, `Log` com os cabeçalhos EXATOS das tabelas do PRD §6, e congela a linha de cabeçalho. Idempotente (não duplica abas/colunas se já existirem).
   - Helpers de leitura/escrita: appendEmail(obj), updateEmailStatus(idInterno, patch), getEmailById(idInterno), listEmailsByStatus(status), appendLog(obj), listContas(), listRegras().
   - Funções PURAS de mapeamento (com export dual): `emailToRow(obj)` e `rowToEmail(row, headers)`, `contaRowToObj`, `regraRowToObj` — separadas das chamadas SpreadsheetApp.
3. Modelo normalizado `EmailItem` (PRD §6.2) e gerador `gerarIdInterno()` PURO: 6 caracteres alfanuméricos maiúsculos, sem ambíguos (sem O/0/I/1), com verificação de colisão delegada ao chamador.
4. As chamadas SpreadsheetApp ficam isoladas; toda lógica de mapeamento é pura e testável.

Testes (em test/): emailToRow⇄rowToEmail round-trip preserva os campos; gerarIdInterno respeita formato e alfabeto; contaRowToObj/regraRowToObj parseiam tipos (bool, lista) corretamente; getEmailById/updateEmailStatus operando sobre o SpreadsheetApp mockado.

Rode check (lint+test) verde. Commit. Relatório, incluindo no item manual: "rodar setupSheet() uma vez para criar as abas" (e diga como).
```

---

# S2 — Classificador em cascata (regras → Gemini)

**Objetivo:** o coração do produto. Regras determinísticas primeiro; Gemini só nos ambíguos e só com permissão da conta.
**Aceite:** regra resolve sem chamar o LLM; `allow_ai_external != true` nunca chama o LLM; parsing do Gemini robusto com fallback; backoff no 429.

```
Sprint 2 — Classificador em cascata. Siga o Acordo de Trabalho. Base: PRD §7 (cascata, categorias, contrato do Gemini) e o guardrail 8.

Tarefa:
1. `src/Regras.js` (PURO): motor determinístico que recebe um EmailItem + a lista de regras + a conta, e retorna {categoria, acao_sugerida, confianca:"regra"} ou null se nenhuma regra casar. Suporta tipos `remetente`, `dominio`, `keyword_assunto`, escopo por account_id ou `*`, e os `always_important_keywords` da conta (forçam categoria importante).
2. `src/Gemini.js`: `classificarComGemini(emails, apiKey)` — monta o payload para `gemini-2.5-flash-lite`, chama via UrlFetchApp, exige saída SÓ JSON (array conforme PRD §7.3), faz parse seguro (try/catch; se falhar, retorna para cada email um fallback {categoria:"importante", confianca:"baixa", resumo:"(sem resumo)", acao_sugerida:"abrir"}), e implementa backoff exponencial (1s,2s,4s,8s) no HTTP 429. Mantenha a chamada UrlFetchApp fina e a montagem/parse do payload em funções PURAS (montarPayload, parseResposta) com export dual.
3. `src/Classificador.js` (orquestra a cascata, PURO no fluxo — recebe `geminiFn` INJETADA para ser testável sem rede):
   - Para cada email: tenta Regras → (histórico, deixe um gancho `historicoFn` opcional que por enquanto retorna null) → se ainda ambíguo: só chama geminiFn SE a política da conta tiver allow_ai_external === true. Se for "cautela" ou false, marca categoria "importante" com confianca "baixa" e NÃO envia ao LLM.
   - Agrupa os ambíguos permitidos em lotes de no máximo 30 e respeita um delay entre lotes (passe a função de sleep como dependência para testar).
   - Retorna a lista de EmailItem enriquecidos (categoria, confianca, resumo, acao_sugerida, acoes_disponiveis).

Testes (fortes): regra casa → não chama geminiFn (spy); conta com allow_ai_external:"cautela" → geminiFn nunca chamada, categoria importante/baixa; lote >30 é dividido; parseResposta lida com JSON válido, com cercas markdown acidentais e com lixo (fallback); backoff é acionado no 429 (mock UrlFetch retornando 429 depois 200).

Check verde. Commit. Relatório.
```

---

# S3 — Coletor + Job de triagem (espinha do F0)

**Objetivo:** ler o Gmail, normalizar, classificar e gravar a fila — o pipeline matinal, ainda sem Telegram.
**Aceite:** coleta só `is:unread -label:Triado_IA`; grava EmailItems corretos na aba `Emails` com `id_interno` único e `status=triado`.

```
Sprint 3 — Coletor + Triagem (orquestração). Siga o Acordo de Trabalho. Base: PRD §5.2, §6, §14.

Tarefa:
1. `src/Coletor.js`: `coletarConta(conta)` usa GmailApp.search com a query `is:unread -label:Triado_IA newer_than:1d`, percorre threads/mensagens, e produz EmailItems normalizados (remetente, assunto, data, snippet, thread_id, message_id, possui_anexo, list_unsubscribe e unsub_oneclick lidos dos headers quando disponíveis). Mantenha a leitura GmailApp fina; a normalização (parse de header, montagem do EmailItem) em funções PURAS com export dual.
2. `src/Triagem.js`: `executarTriagemDiaria()` — entrypoint do gatilho:
   - lê contas com status "incluida" e fase já habilitada (no F0, só josemardp);
   - para cada conta: coleta → garante id_interno único (consultando a fila) → roda o Classificador (injetando a geminiFn real do Gemini.js) → grava cada email na aba `Emails` com status "triado".
   - registra no Log um resumo da execução (metadados: conta, quantidade por categoria), sem corpo.
   - É reentrante: se rodar de novo, não reprocessa emails já gravados/triados (eles já terão o label ou já estarão na fila).
3. Garanta a injeção de dependências para teste (geminiFn, clock/sleep) — nada de chamada de rede direta no fluxo orquestrado.

Testes: dado um GmailApp mockado com 3 threads (uma já com label Triado_IA), coletarConta retorna só as 2 não rotuladas; executarTriagemDiaria grava as linhas certas na planilha mockada com status "triado" e ids únicos; parsing de header List-Unsubscribe detecta unsub_oneclick corretamente.

Check verde. Commit. Relatório.
```

---

# S4 — Telegram: envio do resumo + teclado

**Objetivo:** o resumo diário no Telegram, agrupado por categoria, com botões inline.
**Aceite:** mensagem formatada conforme PRD §9.1; `callback_data` no formato `acao:id_interno`, sempre ≤64 bytes.

```
Sprint 4 — Telegram (envio + teclado). Siga o Acordo de Trabalho. Base: PRD §9.

Tarefa:
1. `src/Telegram.js`:
   - Funções FINAS de API: `enviarMensagem(chatId, texto, teclado)` e `editarMensagem(chatId, msgId, texto, teclado)` via UrlFetchApp (Bot API sendMessage/editMessageText, parse_mode HTML).
   - Funções PURAS (export dual): `formatarResumo(emailsPorCategoria, conta, data)` que produz o texto do PRD §9.1 (agrupado por 🔴 importantes / 🟡 descadastrar / ⚪ arquivar / 🗑 lixo), e `montarTeclado(email)` que gera os InlineKeyboardButtons a partir de `acoes_disponiveis`, com `callback_data` = `<prefixo>:<id_interno>` (prefixos: arq, lix, imp, rev, dft, uns, abr).
   - `montarTeclado` deve garantir `callback_data` ≤ 64 bytes (valide e lance erro em teste se exceder).
2. Integre em `Triagem.js`: ao fim da triagem da conta, envie UMA mensagem de resumo e guarde o `telegram_msg_id` retornado em cada linha da fila (status passa a "enviado").
3. No F0, as ações no teclado se limitam a `[Arquivar]` e `[Abrir]` (o `abr` gera um link gmail para o thread). As demais entram nos sprints seguintes.

Testes: formatarResumo agrupa e ordena corretamente e escapa HTML; montarTeclado gera callback_data no formato certo e ≤64 bytes; um email "importante" recebe os botões esperados.

Check verde. Commit. Relatório.
```

---

# S5 — Roteador (doPost) + Executor (arquivar) → FECHA O MVP

**Objetivo:** o toque no botão executa a ação real. Com isso o loop F0 está completo.
**Aceite:** `doPost` valida `SHARED_SECRET`; identifica o email pelo `id_interno`; arquiva a thread real; aplica `Triado_IA`; atualiza fila + Log; edita a msg (✅); é idempotente.

```
Sprint 5 — Roteador + Executor (arquivar). Siga o Acordo de Trabalho. Base: PRD §5.2, §9.2/§9.3, §11, §14, §17. Este sprint FECHA o MVP (F0).

Tarefa:
1. `src/Roteador.js`: `doPost(e)` — entrypoint do Web App:
   - Faz parse do update do Telegram (callback_query). Valida o SHARED_SECRET recebido (via query string da URL do webhook); se inválido, responde 401 e encerra.
   - Funções PURAS (export dual): `parseCallback(data)` → {acao, idInterno}; `validarSecret(recebido, esperado)`.
   - Busca o email na fila por id_interno. CHECA o status: se já "executado", responde ao Telegram "já feito ✅" e não repete (idempotência). Senão, despacha para o Executor a ação correspondente.
   - No F0, despacha localmente (conta única). Deixe um ponto de extensão `despacharParaConta(conta, acao, email)` que na F2 chamará o executor remoto.
   - Sempre responde answerCallbackQuery ao Telegram para tirar o "loading" do botão.
2. `src/Executor.js`: `arquivar(email)` — usa GmailApp para arquivar a thread real (remover do INBOX), aplica o label `Triado_IA` (cria o label se não existir, uma vez), atualiza a linha da fila (status "executado", acao_executada, executado_em), grava no Log (metadados) e edita a mensagem do Telegram marcando ✅ no item. Mantenha a chamada GmailApp fina.
3. Garanta que NÃO existe nenhuma ação destrutiva/permanente.

Testes: validarSecret rejeita segredo errado; parseCallback parseia "arq:A7F92K" corretamente; idempotência — chamar a ação duas vezes só arquiva uma; arquivar() (com GmailApp mockado) remove do INBOX, aplica Triado_IA, atualiza status e loga.

Check verde. Commit. Relatório — e explicite no item manual: autorizar o consentimento OAuth na primeira execução, e que o deploy/webhook vêm no S6.
```

---

# S6 — Deploy do MVP + verificação assistida

**Objetivo:** colocar o F0 no ar. Aqui ficam os passos que exigem suas credenciais — o agente prepara tudo, você executa uma vez.
**Aceite:** Web App publicado; webhook registrado; gatilho diário criado; `healthCheck` responde; `SETUP.md` completo.

```
Sprint 6 — Deploy e verificação do MVP. Siga o Acordo de Trabalho. Base: PRD §20/§21/§22.

Tarefa:
1. `src/Admin.js` com funções utilitárias (cada uma logando o resultado):
   - `seedProperties()`: lê um objeto de um arquivo local NÃO versionado OU instruções para preencher Script Properties manualmente; grava GEMINI_API_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SHARED_SECRET, SHEET_ID. (Nunca embuta segredos no código.)
   - `setTelegramWebhook()`: registra o webhook do bot apontando para a URL do Web App `/exec`, INCLUINDO o SHARED_SECRET como parâmetro de query.
   - `createDailyTrigger()`: cria (de forma idempotente) um gatilho time-based diário às 07:00 chamando executarTriagemDiaria.
   - `healthCheck()` e um `doGet(e)` que retorna 200 "ok" para teste rápido no navegador.
   - `removerWebhook()` e `listarTriggers()` utilitários.
2. Configure o script `deploy` no package.json para `clasp push && clasp deploy` e documente como obter a URL `/exec` do deploy.
3. Finalize `docs/SETUP.md` com o passo a passo EXATO e na ordem certa: setupSheet → seedProperties → push/deploy → pegar URL → setTelegramWebhook → createDailyTrigger → autorizar OAuth → teste de fumaça.
4. Adicione em SETUP.md um "Teste de fumaça do MVP": rodar executarTriagemDiaria manualmente, conferir a fila na planilha, receber o resumo no Telegram, tocar [Arquivar] e confirmar o arquivamento + ✅ + linha "executado" + Log.

Faça `clasp push` (e `clasp deploy` se autenticado). Se não estiver autenticado no ambiente, gere tudo pronto e liste no relatório exatamente os comandos que EU devo rodar. Check verde. Commit. Relatório com o checklist manual completo.
```

> **Marco:** ao fim do S6 o **MVP está no ar**. Valide alguns dias antes de seguir.

---

# S7 — F1: Ações seguras

**Objetivo:** lixeira (recuperável), guardar importante, marcar ciente.
**Aceite:** cada ação reversível, idempotente e logada; nenhuma exclusão permanente.

```
Sprint 7 — F1 Ações seguras. Siga o Acordo de Trabalho. Base: PRD §8, §16-F1.

Tarefa:
1. Em `src/Executor.js`, adicione:
   - `moverParaLixeira(email)` — GmailApp moveToTrash (recuperável). NUNCA permanente.
   - `guardarImportante(email)` — aplica label `Importante` (cria se não existir) e/ou estrela.
   - `marcarCiente(email)` — aplica `Triado_IA` e deixa no lugar.
   Cada uma: atualiza status/acao_executada/Log e edita a msg no Telegram.
2. Em `src/Telegram.js` / `montarTeclado`, habilite os botões [Excluir], [Guardar], [Ciente] conforme `acoes_disponiveis` e a política da conta (allow_delete).
3. No Roteador, mapeie os prefixos lix/imp/rev para as novas ações. Mantenha a idempotência (checa status).

Testes: moverParaLixeira usa trash (e não delete permanente — afirme isso no teste); cada ação atualiza status e loga; teclado respeita allow_delete=false (sem botão Excluir).

Check verde. Commit. Relatório.
```

---

# S8 — F2: Multi-conta + malha Roteador→Executores

**Objetivo:** trazer esdraaline, conta-comercial e conta-familiar; montar a topologia router/executor com política por conta.
**Aceite:** as 4 contas num único resumo; cada ação atinge a conta certa; conta-comercial/conta-familiar com `allow_ai_external="cautela"` não vão ao LLM.

```
Sprint 8 — F2 Multi-conta + malha Roteador→Executores. Siga o Acordo de Trabalho. Base: PRD §5.3, §10, §16-F2. ATENÇÃO: é o sprint de refatoração arquitetural — proponha o plano de refactor no início e me peça "go" antes de implementar (exceção ao modo padrão, por ser estrutural).

Tarefa:
1. Refatore para o modelo do PRD §5.3:
   - Projeto ROTEADOR (conta primária josemardp): dono do bot/Telegram e da Planilha. Lê a fila, envia o resumo, recebe callbacks e DESPACHA.
   - Template de projeto EXECUTOR por conta: cada conta Gmail adicional tem (a) gatilho de coleta que escreve na MESMA Planilha (compartilhada) e (b) um Web App doPost que executa ações no contexto NATIVO daquela conta. Crie um diretório/estrutura clara para gerar executores (ex.: `executor/` com os mesmos arquivos relevantes), parametrizado por account_id.
   - Implemente `despacharParaConta(conta, acao, email)` no Roteador: se a conta-alvo for a primária, executa local; senão, chama `conta.executor_url` via UrlFetchApp passando o SHARED_SECRET e o payload da ação.
2. Carregue a política da aba `Contas` e aplique em todo o fluxo: allow_ai_external (cascata respeita "cautela"/"false"), allow_delete, executor_url.
3. Atualize o resumo do Telegram para abranger as 4 contas (deixe claro a conta de origem em cada item).
4. Atualize SETUP.md: como criar/deployar cada executor e preencher executor_url na aba Contas.

Testes: despacharParaConta roteia para local vs remoto conforme account_id (mock UrlFetch para o remoto); cascata pula o LLM para contas "cautela"; resumo multi-conta agrupa corretamente.

Check verde. Commit. Relatório com os passos manuais de deploy dos executores.
```

---

# S9 — F3: Histórico de remetente + remetentes silenciados

**Objetivo:** menos LLM, mais regra. Aprender por remetente e silenciar lixo recorrente.
**Aceite:** ≥70% resolvido por regra/histórico; remetentes silenciados são auto-arquivados na coleta.

```
Sprint 9 — F3 Classificação avançada + mute. Siga o Acordo de Trabalho. Base: PRD §7.1, §13 (filtro como alternativa ao unsubscribe), §16-F3.

Tarefa:
1. Implemente o gancho `historicoFn` real no Classificador: quando você decide sobre um remetente (via ação no Telegram), registre a preferência (categoria/ação) numa aba `Preferencias` (remetente/domínio → categoria/ação). Em coletas futuras, o histórico resolve antes do LLM.
2. "Remetentes silenciados" (substituto confiável do unsubscribe): uma lista (na aba Preferencias ou Regras) que faz o Coletor AUTO-arquivar (ou enviar à lixeira, conforme política) emails desses remetentes na própria coleta, registrando no Log, sem nem mandar pro resumo. Adicione uma ação `[Silenciar remetente]` que insere o remetente nessa lista.
3. (Opcional, se eu habilitar o Advanced Gmail Service) função para criar filtro nativo do Gmail via Gmail API — mas o caminho padrão é o mute pelo próprio Coletor.

Testes: historicoFn resolve sem LLM quando há preferência; coletor auto-arquiva remetente silenciado e não o inclui no resumo; ação Silenciar insere na lista corretamente.

Check verde. Commit. Relatório.
```

---

# S10 — F4: Hotmail via Microsoft Graph

**Objetivo:** integrar o Outlook/Hotmail como módulo separado, normalizado ao mesmo EmailItem.
**Aceite:** Hotmail aparece no mesmo resumo, com as mesmas ações; refresh token gerenciado em Properties.

```
Sprint 10 — F4 Hotmail via Microsoft Graph. Siga o Acordo de Trabalho. Base: PRD §3, §5.1, §16-F4.

Tarefa:
1. Crie um módulo `src/Graph.js` (ou um executor dedicado ao Hotmail) que fala com a Microsoft Graph API:
   - OAuth de conta pessoal (endpoint consumers/common), escopos delegados Mail.ReadWrite e Mail.Send.
   - Gerencie o refresh token em Script Properties (MS_REFRESH_TOKEN, MS_CLIENT_ID); função para trocar refresh→access token; renovação automática.
   - `coletarHotmail()`: lista mensagens não lidas recentes, normaliza para o MESMO EmailItem (mapeie campos do Graph: from, subject, receivedDateTime, bodyPreview, internetMessageHeaders para List-Unsubscribe, hasAttachments).
   - Ações: arquivar (mover para uma pasta "Arquivados" ou remover de Inbox), mover para Deleted Items (lixeira, recuperável — nunca permanente), criar rascunho.
   - Mantenha as chamadas UrlFetchApp finas; mapeamento e parsing em funções PURAS.
2. Integre ao fluxo: a conta josemar.dp entra na coleta e no resumo como provider "outlook"; o Roteador despacha as ações do Hotmail para esse módulo.
3. Atualize SETUP.md: registro de app no Microsoft Entra ID (permissões delegadas), obtenção do refresh token inicial.

Testes (mock UrlFetch): mapeamento Graph→EmailItem; renovação de token; ação de lixeira usa Deleted Items (não permanente).

Check verde. Commit. Relatório com os passos do Entra ID.
```

---

# S11 — F5: Rascunhos de resposta

**Objetivo:** botão [Responder] cria draft. Nunca envia.
**Aceite:** rascunho nasce na thread certa, para revisão; nenhum envio automático.

```
Sprint 11 — F5 Rascunhos. Siga o Acordo de Trabalho. Base: PRD §8, §16-F5, guardrail 5.

Tarefa:
1. Em `src/Executor.js`: `gerarRascunho(email)` — gera um rascunho de resposta na thread original (Gmail: thread.createDraftReply / GmailApp.createDraft; Outlook: criar message draft via Graph). O conteúdo do rascunho pode ser gerado pelo Gemini (respeitando allow_ai_external da conta; se "cautela"/"false", gere um rascunho-esqueleto neutro sem mandar o corpo ao LLM). NUNCA envie — só cria o draft.
2. Habilite o botão [Responder] (prefixo dft) no teclado para emails "importante".
3. Confirme em código e em teste que não existe caminho de envio automático.

Testes: gerarRascunho cria draft (mock) na thread certa e não chama nenhum "send"; conta "cautela" gera esqueleto sem chamar o LLM.

Check verde. Commit. Relatório.
```

---

# S12 — F6: Descadastro seguro

**Objetivo:** one-click via RFC 8058; senão abrir link; spam nunca recebe clique.
**Aceite:** só remetentes legítimos com header one-click são descadastrados ao toque; cenários B e C tratados conforme PRD §13.

```
Sprint 12 — F6 Descadastro seguro. Siga o Acordo de Trabalho. Base: PRD §13.

Tarefa:
1. Funções PURAS (export dual) em um `src/Unsubscribe.js`:
   - `parseListUnsubscribe(headers)` → extrai URL https e/ou mailto e detecta se há `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058).
   - `classificarCenarioUnsub(email)` → A (one-click), B (link sem one-click), C (spam) conforme PRD §13.
2. No Executor: `descadastrar(email)` — SÓ executa o POST one-click no cenário A. No cenário B, NÃO executa: o botão vira [Abrir link] (prefixo abr para a URL de unsubscribe, apenas abre para revisão). No cenário C (lixo), não há botão de descadastrar — vai para lixeira/spam.
3. No teclado/Roteador: rend-erize [Descadastrar] só no cenário A; [Abrir link] no B; nada no C. Mantenha a regra de segurança: nunca clicar unsubscribe de spam.

Testes: parseListUnsubscribe detecta one-click vs link vs ausência; classificarCenarioUnsub mapeia A/B/C; descadastrar só faz POST no cenário A (mock UrlFetch) e nunca no B/C.

Check verde. Commit. Relatório.
```

---

# S13 — Hardening, observabilidade e preparação de graduação

**Objetivo:** robustez de produção e a porta para a graduação opcional.
**Aceite:** erros tratados com retry/backoff; auto-relatório diário; docs finais; notas de migração para Oracle/SQLite.

```
Sprint 13 — Hardening + observabilidade + prep graduação. Siga o Acordo de Trabalho. Base: PRD §15, §16-G+, §18.

Tarefa:
1. Tratamento de erros transversal: envelope try/catch nas execuções, retry com backoff (reaproveite o do Gemini) onde fizer sentido, e registro de falhas no Log (metadados) sem vazar conteúdo.
2. Auto-relatório diário: ao fim da triagem, uma mensagem curta no Telegram com contadores (quantos por categoria, quantos resolvidos por regra vs LLM, erros) — observabilidade do próprio sistema.
3. Verificação de cotas: garanta que os lotes e delays mantêm o uso do Gemini dentro do free tier; documente os números atuais e onde checá-los.
4. `docs/` final: README completo, SETUP.md revisado, e um `docs/GRADUACAO.md` com o plano de migração Planilha→SQLite e Apps Script→backend (Oracle Cloud Free Tier), reaproveitando o esquema do PRD §6 — sem implementar, só o mapa.
5. Revisão final dos guardrails: um teste de "sanidade de segurança" que falha se aparecer qualquer escopo restrito no appsscript.json, qualquer segredo hardcoded, ou qualquer caminho de delete permanente / envio automático.

Testes: o teste de sanidade de segurança; o auto-relatório formata os contadores certos; o backoff transversal funciona.

Check verde. Commit. Relatório final do projeto.
```

---

## Apêndice A — Referência do harness de teste (mock dos globais Google)

Esqueleto que o S0 deve produzir em `test/helpers/gasMocks.js` (referência; o agente completa):

```js
function installMocks(overrides = {}) {
  global.PropertiesService = overrides.PropertiesService || makePropsMock();
  global.UrlFetchApp       = overrides.UrlFetchApp       || makeUrlFetchMock();
  global.SpreadsheetApp    = overrides.SpreadsheetApp    || makeSheetMock();
  global.GmailApp          = overrides.GmailApp          || makeGmailMock();
  global.ScriptApp         = overrides.ScriptApp         || makeScriptAppMock();
  global.Logger            = global.Logger || { log: () => {} };
  global.Utilities         = global.Utilities || { sleep: () => {} };
}
function resetMocks() {
  ['PropertiesService','UrlFetchApp','SpreadsheetApp','GmailApp','ScriptApp']
    .forEach(k => { delete global[k]; });
}
module.exports = { installMocks, resetMocks /* + fábricas */ };
```

## Apêndice B — Loop de desenvolvimento (npm)

```bash
npm run check     # lint + test (use antes de cada commit)
npm test          # só os testes (modo watch: npx jest --watch)
npm run push      # clasp push (sobe src/ para o Apps Script)
npm run deploy    # clasp push && clasp deploy (nova versão do Web App)
```

## Apêndice C — O que continua manual (e por quê)

Mesmo com automação máxima, estas ações dependem das suas credenciais e acontecem **uma vez** cada:
- `clasp login` e habilitar a Apps Script API (S6 e antes).
- Autorizar o consentimento OAuth do `gmail.modify` na primeira execução.
- Preencher segredos em Script Properties (ou via `seedProperties()` lendo um arquivo local).
- Rodar `setTelegramWebhook()` e `createDailyTrigger()` uma vez.
- Criar o bot no @BotFather, pegar o `chat_id`, gerar a chave do Gemini, registrar o app no Entra ID (S10).

Tudo o mais — escrever código, testar, lintar, commitar, `clasp push`/`deploy` — o Codex faz agenticamente.

---

*Fim do plano de sprints — Triador.*
