# PRD — Triador · Triagem Unificada de Email

> **Codinome:** Triador *(provisório — renomeie à vontade)*
> **Versão:** 1.0
> **Data:** 29/06/2026
> **Autor da decisão:** Josemar
> **Status:** Aprovado para implementação — começar pela Fase F0
> **Princípio inegociável:** a IA sugere, o usuário confirma, o sistema executa.

---

## 0. Como ler este documento

Este PRD descreve o **produto inteiro**, mas a entrega é **faseada**. A única fase que deve ser construída agora é a **F0 (MVP)** — uma conta, uma ação, ciclo completo. Tudo o que vem depois está especificado para dar direção, mas **não deve ser antecipado**. Cada fase só abre quando a anterior passa no seu critério de saída (gate).

Seções 1–4 = visão e escopo. Seções 5–15 = especificação técnica. Seções 16–18 = entrega, aceite e riscos. Seção 19 = decisões de arquitetura (o porquê). Seções 20–22 = projeto, setup e checklist.

---

## 1. Resumo executivo

Josemar gerencia 7 contas de email diariamente. O custo não é o volume, e sim a **microdecisão repetida** centenas de vezes por semana, espalhada em 7 contextos: *isso é importante? é lixo? descadastro? só arquivo?*

O Triador é uma **camada de triagem semi-automática acima das contas**. Toda manhã ele lê o que chegou, classifica por regras determinísticas (e por IA só nos casos ambíguos), resume em 1–2 linhas e entrega no Telegram com **botões de ação rápida**. Um toque no botão **executa a ação de verdade** na conta de origem — arquivar, mover para lixeira, gerar rascunho, descadastrar — sempre com confirmação humana e nunca de forma destrutiva.

**Stack:** Google Apps Script (orquestração + ação nativa no Gmail) · Gemini API free tier (resumo/classificação) · Telegram Bot (interface) · Google Sheet (estado, fila, log e painel).
**Custo:** R$ 0. Sem servidor para manter.

---

## 2. Objetivos e não-objetivos

### 2.1. Objetivos

- Reduzir a carga decisória diária de email a **um resumo único no Telegram**, agindo com poucos toques.
- Classificar cada email em categorias acionáveis e propor a ação certa.
- Executar a ação **na conta real** (Gmail / Outlook), não só sinalizar.
- Manter o humano no controle: **nada destrutivo sem confirmação**, nada permanente.
- Custo zero recorrente. Sem VPS, sem assinatura nova.
- Ser **expansível**: adicionar/remover conta sem redesenhar o sistema.
- Ser **auditável**: todo email triado e toda ação executada ficam registrados.

### 2.2. Não-objetivos (fora de escopo, explicitamente)

- **Não** processar as contas institucionais `@policiamilitar.sp.gov.br` e `@aluno.univesp.br` na automação (ver §12).
- **Não** enviar resposta de email automaticamente — o máximo é **gerar rascunho**.
- **Não** excluir nada permanentemente — "Excluir" significa **mover para lixeira** (recuperável).
- **Não** automatizar descadastro de remetente sem cabeçalho `List-Unsubscribe` confiável (ver §13).
- **Não** rodar IA local nem servidor próprio no MVP. (Opção de graduação, §16-G.)
- **Não** construir app/PWA novo. É uma automação.

---

## 3. Contexto de uso

- **Usuário único:** Josemar. Todas as contas são dele (ou da família/loja sob sua gestão).
- **Momento:** manhã (gatilho padrão **07:00**, configurável).
- **Dispositivo de interação:** celular, via Telegram.
- **As 7 contas e seu destino no produto:**

| Conta | Tipo | Destino |
|---|---|---|
| `conta-pessoal@exemplo.com` | pessoal | **Incluída — F0** |
| `conta-secundaria@exemplo.com` | pessoal | Incluída — F2 |
| `conta-comercial@exemplo.com` | comercial | Incluída — F2 (cautela IA externa) |
| `conta-familiar@exemplo.com` | familiar | Incluída — F2 (cautela IA externa) |
| `conta-outlook@exemplo.com` | pessoal (Outlook) | Incluída — F4 (via Microsoft Graph) |
| `conta-corporativa@exemplo.gov.br` | corporativa PMESP | **Fora** — lembrete manual |
| `conta-academica@exemplo.edu.br` | acadêmica Univesp | **Fora** — opcional reencaminho só-leitura |

---

## 4. Métricas de sucesso

**Do MVP (F0):**
- O resumo matinal chega no Telegram todo dia, sem intervenção.
- Tocar "Arquivar" arquiva **o email certo**, na conta real, em < 5 s.
- Zero reprocessamento de emails já triados; zero ação dobrada.

**Do produto (após F2+):**
- Tempo diário gasto com email cai de "abrir 5 caixas" para "1 resumo + alguns toques".
- ≥ 70% dos emails resolvidos por **regra determinística** (sem ir ao LLM) → custo, privacidade e qualidade controlados de uma vez.
- Zero exclusão indevida (nada permanente; tudo reversível e logado).

---

## 5. Arquitetura técnica

### 5.1. Stack e papéis

| Componente | Ferramenta | Papel |
|---|---|---|
| Orquestração + gatilho | **Google Apps Script** | Roda nos servidores da Google, gatilho temporal nativo, acesso nativo ao Gmail (`GmailApp`), sem token externo |
| Cérebro / IA | **Gemini API (free tier, AI Studio)** | Resumo e classificação dos emails **ambíguos**. Modelo `gemini-2.5-flash-lite` |
| Interface | **Telegram Bot API** | Resumo diário com botões inline; recebe os toques (callbacks) |
| Estado / fila / log / painel | **Google Sheet** | Fila de triagem, mapeamento botão→email, política por conta, log de auditoria |
| Email (Gmail) | `GmailApp` nativo + escopo `gmail.modify` | Ler, arquivar, lixeira, label, rascunho |
| Email (Outlook, F4) | **Microsoft Graph API** | Hotmail pessoal, módulo separado |

### 5.2. Fluxo diário (visão geral)

```
07:00 · gatilho temporal nativo
   │
   ▼
[Coletor]  lê emails novos:  is:unread -label:Triado_IA  (últimas 24h)
   │
   ▼
[Classificador em cascata]
   1. Regras determinísticas (remetente/domínio/keyword)  ── resolve o óbvio
   2. Histórico de remetente
   3. Gemini Flash-Lite  ── SÓ os ambíguos E SÓ se allow_ai_external = true
   │
   ▼
[Planilha]  grava: id_interno (ID curto do botão), categoria, resumo, ações, status=triado
   │
   ▼
[Telegram]  envia 1 resumo agrupado por categoria, com botões inline
   │
   ▼   (você toca um botão)
[Roteador / Web App doPost]  valida SHARED_SECRET → lê id_interno na Planilha → identifica a conta
   │
   ▼
[Executor]  executa na conta real (arquivar / lixeira / rascunho / unsubscribe one-click)
   │
   ▼
aplica label Triado_IA (idempotência) · atualiza status=executado · grava no Log · edita a msg do Telegram (✅)
```

### 5.3. Topologia multi-conta (a partir da F2)

O bot do Telegram tem **um único webhook** (um endpoint), mas as ações precisam rodar em **contas Gmail diferentes**. Solução:

- **Projeto Roteador** (vinculado à conta primária, ex.: `josemardp`): dono do bot do Telegram e da Planilha. Lê a fila, envia o resumo, recebe os callbacks e **despacha** cada ação para a conta certa.
- **Projeto Executor por conta**: cada conta Gmail adicional tem seu próprio Apps Script, com (a) um gatilho de coleta que escreve na Planilha compartilhada e (b) um **Web App `doPost`** que executa ações **no contexto nativo daquela conta** (sem token, sem OAuth de terceiros).
- O Roteador chama o Executor da conta-alvo via `UrlFetchApp`, passando o `SHARED_SECRET`.
- A **Planilha compartilhada** (com acesso de todas as contas dele) é o barramento de integração.

> **No F0 isso colapsa:** uma única conta → um único projeto que é coletor + classificador + roteador + executor ao mesmo tempo. A malha só nasce na F2.

---

## 6. Modelo de dados (Google Sheet)

A Planilha tem 4 abas. Migra para SQLite **se** houver graduação para backend (§16-G); o esquema abaixo já está desenhado para essa troca.

### 6.1. Aba `Contas` (config + política por conta)

| Coluna | Tipo | Descrição |
|---|---|---|
| `account_id` | texto | id interno, ex.: `josemardp_gmail` |
| `email` | texto | endereço |
| `provider` | enum | `gmail` \| `outlook` |
| `status` | enum | `incluida` \| `fora` |
| `fase` | texto | fase em que entra (F0/F2/F4) |
| `risk_level` | enum | `low` \| `medium` \| `high` |
| `delete_mode` | enum | `trash_only` (sempre) |
| `allow_delete` | bool | permite botão de lixeira |
| `allow_unsubscribe` | bool | permite descadastro |
| `allow_ai_external` | enum | `true` \| `cautela` \| `false` — controla envio ao Gemini |
| `executor_url` | url | URL do Web App executor (vazio no F0) |
| `always_important_keywords` | lista | termos que forçam categoria Importante |

### 6.2. Aba `Emails` (fila de triagem + estado)

| Coluna | Tipo | Descrição |
|---|---|---|
| `id_interno` | texto(6) | ID curto, ex.: `A7F92K` — é o que vai no `callback_data` |
| `account_id` | texto | conta de origem |
| `provider` | enum | `gmail` \| `outlook` |
| `message_id` | texto | id da mensagem no provedor |
| `thread_id` | texto | id da thread |
| `remetente` | texto | from |
| `assunto` | texto | subject |
| `data` | datetime | data do email |
| `snippet` | texto | trecho curto |
| `corpo_reduzido` | texto | corpo truncado (só se for ao LLM) |
| `possui_anexo` | bool | — |
| `list_unsubscribe` | texto | conteúdo do cabeçalho, se houver |
| `unsub_oneclick` | bool | tem `List-Unsubscribe-Post` (RFC 8058) |
| `categoria_sugerida` | enum | ver §7.2 |
| `confianca` | enum | `regra` \| `alta` \| `media` \| `baixa` |
| `resumo` | texto | 1–2 linhas em PT-BR |
| `acoes_disponiveis` | lista | botões a renderizar |
| `status` | enum | `novo` \| `triado` \| `enviado` \| `executado` \| `erro` |
| `acao_executada` | texto | última ação aplicada |
| `executado_em` | datetime | — |
| `telegram_msg_id` | texto | id da msg para editar (✅) |

### 6.3. Aba `Regras` (camada determinística)

| Coluna | Tipo | Descrição |
|---|---|---|
| `tipo` | enum | `remetente` \| `dominio` \| `keyword_assunto` |
| `valor` | texto | ex.: `@mailchimp.com`, `boleto`, `noreply@banco...` |
| `account_id` | texto | conta ou `*` (todas) |
| `categoria` | enum | categoria a aplicar |
| `acao_default` | texto | ação sugerida |
| `ativo` | bool | — |

### 6.4. Aba `Log` (auditoria — **só metadados**)

| Coluna | Tipo |
|---|---|
| `timestamp` | datetime |
| `account_id` | texto |
| `id_interno` | texto |
| `acao_sugerida` | texto |
| `acao_executada` | texto |
| `resultado` | enum `ok` \| `erro` |
| `erro` | texto |

> **Nunca** logar corpo de email, tokens ou senhas.

---

## 7. Classificador

### 7.1. Cascata (regra de ouro do produto)

A classificação acontece em camadas, **nessa ordem**, parando na primeira que resolve com confiança:

1. **Regras determinísticas** (aba `Regras`) — remetente, domínio, keyword. Resolve o óbvio.
2. **Histórico de remetente** — se você já decidiu sobre esse remetente antes, repete.
3. **Gemini Flash-Lite** — **somente** para o que sobrou ambíguo **e somente** se a política da conta permitir (`allow_ai_external = true`).

**Consequência de design (por que a cascata é central):** emails resolvidos por regra **nunca saem para o LLM**. Isso, de um movimento só:
- reduz chamadas → folga confortável no free tier do Gemini;
- reduz exposição de dados → privacidade (especialmente loja e família);
- melhora qualidade → o LLM lida só com o que é realmente ambíguo.

Se `allow_ai_external = cautela` e o caso é ambíguo, **não** chama o LLM: aplica categoria conservadora `Importante — revisar` e deixa para o humano.

### 7.2. Categorias

| Categoria | Significado |
|---|---|
| 🔴 `importante` | precisa de atenção ou resposta |
| 🟡 `descadastrar` | newsletter / promoção recorrente, candidato a sair da lista |
| ⚪ `arquivar` | info para guardar, sem agir agora |
| 🗑 `lixo` | spam / descartável |

### 7.3. Contrato do Gemini (saída estruturada)

- **Modelo:** `gemini-2.5-flash-lite` (free tier).
- **Entrada:** lote de até **~30 emails** (campos: remetente, assunto, snippet, corpo_reduzido). Acima disso, dividir em lotes com delay de 1–2 s.
- **Saída:** **somente JSON**, sem cercas markdown, no formato:

```json
[
  {
    "id": "A7F92K",
    "categoria": "importante",
    "confianca": "alta",
    "resumo": "Cliente perguntou disponibilidade e forma de entrega do kit.",
    "acao_sugerida": "responder"
  }
]
```

- **Parâmetros:** `temperature` baixa (0–0.3). Parse com try/catch e fallback (se o parse falhar, marca `confianca=baixa`, categoria `importante`, sem deletar nada).

---

## 8. Categorias × ações

| Ação | O que faz | Reversível? | Botão |
|---|---|---|---|
| **Arquivar** | remove da Inbox (mantém na conta) | sim | `[Arquivar]` |
| **Excluir → lixeira** | move para a Lixeira (`trash`) | sim (lixeira) | `[Excluir]` |
| **Guardar importante** | aplica label `Importante` / estrela | sim | `[Guardar]` |
| **Marcar revisado** | aplica `Triado_IA`, deixa no lugar | sim | `[Ciente]` |
| **Gerar rascunho** | cria draft de resposta (nunca envia) | n/a (não envia) | `[Responder]` |
| **Descadastrar** | one-click via header; senão abre link | — | `[Descadastrar]` / `[Abrir link]` |

**Proibido:** botão de exclusão permanente. **Não existe.**

---

## 9. Interface Telegram

### 9.1. Formato do resumo diário

```
📬 TRIAGEM — 29/06/2026 · josemardp

🔴 IMPORTANTES — 3
1. Banco do Brasil — Fatura disponível
   Resumo: fatura de junho fechou; vencimento dia 10.
   [Guardar] [Arquivar] [Abrir]

🟡 DESCADASTRAR — 6
1. Loja X — Promoção da semana
   Resumo: promoção recorrente, sem ação necessária.
   [Descadastrar] [Excluir] [Manter]

⚪ ARQUIVAR — 9
   [Arquivar todos sugeridos]
```

### 9.2. Botões e `callback_data`

- `callback_data` carrega **só** `<acao>:<id_interno>`, ex.: `arq:A7F92K`. **Limite do Telegram: 64 bytes** — esse formato fica muito abaixo.
- Prefixos: `arq` (arquivar), `lix` (lixeira), `imp` (guardar), `rev` (ciente), `dft` (rascunho), `uns` (descadastrar), `abr` (abrir link).
- O Roteador parseia `acao` + `id_interno`, busca a linha na aba `Emails`, valida `status` (idempotência) e despacha.

### 9.3. Modelo de confirmação

- **Toque único = confirmação** para ações reversíveis (arquivar, lixeira, guardar, ciente, rascunho).
- Após executar, o bot **edita a mensagem** marcando ✅ ou ❌ com o resultado.
- **Descadastrar:** toque executa **somente** se for one-click (header RFC 8058). Caso contrário o botão é `[Abrir link]`, que **abre para revisão e não executa**.

---

## 10. Políticas por conta

Cada conta carrega política própria na aba `Contas`. Exemplo (F0):

```json
{
  "account_id": "josemardp_gmail",
  "email": "conta-pessoal@exemplo.com",
  "provider": "gmail",
  "status": "incluida",
  "fase": "F0",
  "risk_level": "low",
  "delete_mode": "trash_only",
  "allow_delete": true,
  "allow_unsubscribe": false,
  "allow_ai_external": true,
  "executor_url": "",
  "always_important_keywords": ["banco","boleto","pagamento","univesp","escola","governo"]
}
```

Diretrizes por conta:

| Conta | `allow_ai_external` | Excluir auto | Observação |
|---|---|---|---|
| josemardp | `true` | nunca auto | conta de validação |
| esdraaline | `true` | nunca auto | — |
| conta-comercial | `cautela` | nunca auto | dados de cliente → preferir regras |
| conta-familiar | `cautela` | nunca auto | familiar → preferir regras |
| josemar.dp (hotmail) | `true` | nunca auto | via Graph (F4) |
| PMESP | `false` | — | **não conectar** |
| Univesp | `false` | — | reencaminho só-leitura opcional |

---

## 11. Segurança e privacidade

- **Segredos** (token do bot, chave Gemini, `SHARED_SECRET`, `SHEET_ID`) **somente em Script Properties**. Nunca no código, nunca no Git.
- **Web App protegido:** o deploy `doPost` roda como você, mas com acesso "qualquer pessoa com o link". Por isso **toda chamada exige `SHARED_SECRET`** na requisição; sem o segredo, retorna 401. Sem isso, qualquer um que descobrisse a URL dispararia ações na sua caixa.
- **Menor privilégio:** escopo `gmail.modify` (ler, arquivar, lixeira, label, rascunho). **Nunca** o escopo restrito de exclusão permanente (`https://mail.google.com/`) — ele dispara verificação de segurança anual (CASA) e não é necessário.
- **Sem exclusão permanente.** `trash_only` sempre. Tudo reversível.
- **Logs só de metadados.** Nunca corpo de email.
- **LGPD / dados de terceiros:** loja e família têm `allow_ai_external = cautela` — emails ambíguos dessas contas **não** vão ao Gemini (a cascata resolve por regra ou marca para revisão manual).
- **Caveat do free tier do Gemini:** no tier gratuito, o conteúdo enviado **pode ser usado para treino**. Por isso conteúdo sensível não trafega para o LLM, e **PMESP nunca** (ver §12).

---

## 12. Contas institucionais (PMESP e Univesp)

**Premissa:** assuma que `@policiamilitar.sp.gov.br` bloqueia app OAuth de terceiros (Workspace/M365 com controle de admin) e que IMAP/senha-de-app estão desativados com MFA.

- **PMESP — fora, em definitivo.** Razões somadas: bloqueio técnico provável **e** sigilo institucional (conteúdo reservado não pode trafegar para IA externa, e usar credencial corporativa em sistema externo é risco de conformidade). Tratamento: **lembrete diário no resumo** — `⚠️ Verificar manualmente: PMESP`.
- **Univesp — fora da automação de ação.** Baixo risco e baixo volume. Opção: se a TI permitir, configurar **reencaminho automático** para um alias do Gmail pessoal (`josemardp+univesp@gmail.com`) e processar **só em modo leitura/alerta** — o botão entrega um **link para abrir no app oficial**, sem ação via API. Se o reencaminho for vedado, fica 100% manual.

---

## 13. Descadastro (unsubscribe)

Três cenários, três comportamentos:

| Cenário | Detecção | Comportamento |
|---|---|---|
| **A — One-click confiável** | header `List-Unsubscribe` + `List-Unsubscribe-Post` (RFC 8058) | botão `[Descadastrar]` → executa POST após o toque |
| **B — Link no corpo / sem one-click** | só URL/mailto, sem RFC 8058 | botão `[Abrir link]` → abre para revisão, **não executa** |
| **C — Spam real** | classificado `lixo` | **sem botão de descadastrar.** Vai para lixeira/spam |

**Regra de segurança:** clicar unsubscribe em spam confirma que o endereço é vivo → mais spam. Para lixo recorrente legítimo, a alternativa mais confiável que o unsubscribe é um **filtro do Gmail** que arquiva/deleta o remetente automaticamente (F3).

---

## 14. Idempotência e estado

- **Coleta:** o gatilho lê sempre com `is:unread -label:Triado_IA`. Emails já triados carregam o label `Triado_IA` e **não** reentram.
- **Execução:** antes de agir, o Roteador checa `status` na aba `Emails`. Se já for `executado`, **não repete** (responde "já feito ✅"). Protege contra toque duplo e contra reprocessamento.
- **Label de controle:** `Triado_IA` (criado uma vez via `GmailApp.createLabel`).

---

## 15. Limites, cotas e desempenho

| Recurso | Limite (verificar no painel) | Tratamento |
|---|---|---|
| **Gemini free tier** | ~15 RPM / ~1.500 RPD (Flash) | cascata mantém o volume baixo; lotes de ~30; backoff exponencial no 429 (1s,2s,4s,8s) |
| **Apps Script** | UrlFetch ~20k/dia · 6 min/execução · 90 min/dia de gatilho | processar em lotes; se a fila for grande, paginar entre execuções |
| **Gmail API / GmailApp** | folgado para volume pessoal | não é o gargalo |
| **Telegram** | folgado | — |

> O gargalo real é o **LLM**, não o email. A cascata é o que mantém o sistema dentro do free tier.

---

## 16. Plano de implementação em fases

Cada fase só abre após o **gate** da anterior.

### F0 — Loop mínimo *(MVP — construir agora)*
- **Escopo:** 1 conta (`josemardp`), 1 ação (**arquivar**).
- **Entrega:** gatilho 07:00 → coleta (`is:unread -label:Triado_IA`) → cascata (regras → Gemini) → grava na Planilha → resumo no Telegram com botão `[Arquivar]` e `[Abrir]` → toque executa o arquivamento real → aplica `Triado_IA` → atualiza Planilha + Log → edita msg (✅).
- **Gate:** tocar "Arquivar" arquiva o email certo, sem duplicar, e o ciclo roda sozinho de manhã.

### F1 — Ações seguras
- **Escopo:** adicionar **lixeira** (`trash_only`), **guardar importante**, **marcar ciente**.
- **Gate:** toda ação é reversível e fica registrada no Log.

### F2 — Multi-conta Gmail + políticas
- **Escopo:** `esdraaline`, `conta-comercial`, `conta-familiar`. Montar a malha **Roteador → Executores**. Política por conta ativa (incl. `allow_ai_external = cautela`).
- **Gate:** as 4 contas Gmail aparecem num **único** resumo do Telegram, cada ação atinge a conta certa.

### F3 — Classificação + filtros-mata-remetente
- **Escopo:** regras por remetente robustas; cascata afinada; para lixo recorrente, criar **filtro do Gmail** (mais confiável que unsubscribe).
- **Gate:** ≥ 70% dos emails resolvidos por regra, sem LLM.

### F4 — Hotmail via Microsoft Graph
- **Escopo:** módulo separado. Registro de app no **Microsoft Entra ID** (grátis), permissões delegadas `Mail.ReadWrite` + `Mail.Send`, refresh token (~90 dias) gerenciado em Script Properties do executor do Hotmail.
- **Gate:** Hotmail no mesmo resumo, com as mesmas ações.

### F5 — Rascunhos de resposta
- **Escopo:** botão `[Responder]` → cria draft no Gmail/Outlook. **Nunca** envia.
- **Gate:** o rascunho nasce na thread certa, para revisão.

### F6 — Descadastro seguro
- **Escopo:** one-click via header; senão `[Abrir link]`; spam nunca recebe clique.
- **Gate:** só remetentes legítimos com header são descadastrados automaticamente.

### G+ — Graduação *(opcional, só se necessário)*
- **Quando:** se precisar de 24/7 independente do PC, lógica pesada ou IA local.
- **Para onde:** backend Python/Node + SQLite em **Oracle Cloud Free Tier**. A migração Planilha → SQLite usa o esquema já desenhado na §6.

---

## 17. Critérios de aceite do MVP (F0)

- [ ] Existe um gatilho temporal diário (07:00, configurável) que dispara o job sem intervenção.
- [ ] O coletor lê apenas emails **não lidos e sem o label `Triado_IA`** da conta `josemardp`, das últimas 24h.
- [ ] Cada email passa pela cascata: regras primeiro; Gemini só nos ambíguos e só com `allow_ai_external = true`.
- [ ] Cada email triado é gravado na aba `Emails` com `id_interno`, `categoria_sugerida`, `resumo`, `acoes_disponiveis`, `status=triado`.
- [ ] O bot envia **uma** mensagem de resumo, agrupada por categoria, com botões `[Arquivar]` e `[Abrir]` nos itens aplicáveis.
- [ ] Tocar `[Arquivar]` chama o Web App, que **valida o `SHARED_SECRET`**, identifica o email pelo `id_interno`, e **arquiva a thread real** no Gmail.
- [ ] Após arquivar: aplica `Triado_IA`, atualiza `status=executado` + `Log`, e **edita a mensagem do Telegram** com ✅.
- [ ] **Idempotência:** rodar o gatilho de novo não reprocessa emails com `Triado_IA`; tocar `[Arquivar]` duas vezes não arquiva duas vezes (checa `status`).
- [ ] **Segurança:** todos os segredos em Script Properties; chamada ao Web App sem o segredo retorna 401.
- [ ] **Nenhuma** ação destrutiva ou permanente disponível.

---

## 18. Riscos e mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Assinatura ≠ API (sem inferência grátis) | bloqueia a premissa de custo | usar **Gemini free tier** (única inferência R$ 0) |
| OAuth em "Testing" → token de 7 dias | reautenticação semanal | **Apps Script** (auth nativa, sem token externo) |
| Escopo restrito → verificação CASA | atraso/custo | usar `gmail.modify` + `trash_only`, **sem** exclusão permanente |
| Web App aberto a qualquer um | ação na sua caixa por terceiros | `SHARED_SECRET` obrigatório em toda chamada |
| Exposição de dados de terceiros ao LLM | LGPD / privacidade | `allow_ai_external=cautela` + cascata por regra |
| Estouro de RPM/RPD do Gemini | triagem incompleta | lotes + backoff + cascata (menos chamadas) |
| Reprocessamento / ação dobrada | inconsistência | label `Triado_IA` + checagem de `status` |
| Conteúdo PMESP em IA externa | risco institucional | PMESP **fora**, lembrete manual |
| n8n "grátis" exigiria servidor | custo/manutenção oculta | **não usar n8n** no MVP; Apps Script é serverless |

---

## 19. Decisões de arquitetura (ADR)

- **D-01 — Apps Script, não n8n.** O free tier do n8n Cloud acabou; "grátis" = self-hosted = servidor a manter. Apps Script é serverless, gratuito, com gatilho nativo e acesso nativo ao Gmail.
- **D-02 — Google Sheet como estado, não SQLite/banco.** Zero hospedagem, vira painel/auditoria, combina com o fluxo do usuário. Migra para SQLite só na graduação.
- **D-03 — `gmail.modify` + `trash_only`, não escopo restrito.** Evita a verificação CASA e cobre 100% das ações do produto. "Excluir" = lixeira (recuperável).
- **D-04 — Classificador em cascata.** Regras antes do LLM. Une custo, privacidade e qualidade num movimento só. É a decisão central do produto.
- **D-05 — Telegram com Roteador → Executores.** Um bot = um webhook, mas ações em N contas. O Roteador despacha; cada Executor age no contexto nativo da sua conta. Sem token cross-account.
- **D-06 — Institucionais fora.** PMESP por sigilo e bloqueio; Univesp por baixo valor/risco. Não brigar com a TI institucional.
- **D-07 — Entrega faseada com gate.** F0 valida o loop inteiro com a menor superfície possível antes de qualquer escala.

---

## 20. Estrutura do projeto (Apps Script)

**Projeto único no F0** (vira Roteador + 1 Executor por conta na F2):

```
triador/
  appsscript.json        # manifesto: timezone, oauthScopes (gmail.modify, script.external_request)
  Config.gs              # lê Script Properties; constantes; categorias
  Planilha.gs            # helpers de leitura/escrita nas abas (Contas, Emails, Regras, Log)
  Coletor.gs             # GmailApp.search(is:unread -label:Triado_IA), normaliza, grava status=novo
  Regras.gs              # motor determinístico (aba Regras + always_important_keywords)
  Gemini.gs              # UrlFetchApp para a API do Gemini; parse de JSON; backoff
  Classificador.gs       # cascata: Regras → histórico → Gemini (respeita allow_ai_external)
  Telegram.gs            # sendMessage, editMessageText, montagem do inline keyboard
  Triagem.gs             # job diário (entrypoint do gatilho): orquestra coleta→cascata→Planilha→Telegram
  Roteador.gs            # doPost: valida SHARED_SECRET, parseia callback, despacha
  Executor.gs            # ações Gmail: arquivar, lixeira, guardar, ciente, rascunho, unsubscribe one-click
```

**Script Properties necessárias:** `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SHARED_SECRET`, `SHEET_ID`.

---

## 21. Configuração necessária (setup)

1. **Planilha:** criar a Google Sheet com as abas `Contas`, `Emails`, `Regras`, `Log`; preencher a linha de `josemardp` em `Contas`.
2. **Apps Script:** criar projeto vinculado à conta `josemardp` (ou standalone com acesso à Planilha).
3. **Gemini:** gerar chave da API no **Google AI Studio** (free tier, sem cartão).
4. **Telegram:** criar bot via **@BotFather** → obter `TELEGRAM_BOT_TOKEN`; obter o seu `TELEGRAM_CHAT_ID`.
5. **Script Properties:** preencher `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `SHARED_SECRET` (string aleatória), `SHEET_ID`.
6. **Deploy do Web App:** "Executar como **eu**", acesso "**qualquer pessoa com o link**"; copiar a URL `/exec`.
7. **Webhook do Telegram:** registrar a URL do Web App via `setWebhook` (incluindo o `SHARED_SECRET` como parâmetro).
8. **Gatilho temporal:** criar trigger diário (07:00) chamando `Triagem.gs`.

---

## 22. Checklist de implementação

### Preparação
- [ ] Criar Planilha e abas
- [ ] Preencher `Contas` (josemardp)
- [ ] Criar projeto Apps Script + `appsscript.json` com escopos
- [ ] Chave Gemini (AI Studio)
- [ ] Bot Telegram (@BotFather) + chat_id
- [ ] Definir Script Properties (incl. `SHARED_SECRET`)

### F0 (MVP)
- [ ] `Coletor.gs`: buscar e normalizar (`is:unread -label:Triado_IA`)
- [ ] `Regras.gs` + `Gemini.gs` + `Classificador.gs`: cascata
- [ ] `Planilha.gs`: gravar fila com `id_interno`
- [ ] `Telegram.gs`: enviar resumo com `[Arquivar]` e `[Abrir]`
- [ ] `Roteador.gs`: `doPost` validando `SHARED_SECRET`
- [ ] `Executor.gs`: arquivar real + label `Triado_IA`
- [ ] Editar msg do Telegram (✅) + gravar `Log`
- [ ] Testar idempotência (rerun + toque duplo)
- [ ] Deploy Web App + `setWebhook` + gatilho 07:00

### Expansão (depois dos gates)
- [ ] F1 ações seguras → F2 multi-conta + malha → F3 regras/filtros → F4 Hotmail → F5 rascunhos → F6 descadastro

---

## 23. Próximo passo

Com o PRD aprovado, o próximo artefato é o **prompt de abertura da F0 para o Claude Code / Codex**, no seu padrão *entender → planejar → confirmar → executar, sem commit autônomo*. É só pedir que eu monto.

---

*Fim do PRD — Triador v1.0.*
