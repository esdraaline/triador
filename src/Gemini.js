var GEMINI_MODEL = 'gemini-2.5-flash-lite';
var GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent';
var GEMINI_BACKOFF_MS = [1000, 2000, 4000, 8000];

function montarPromptGemini_(emails) {
  return [
    'Classifique emails em PT-BR. Responda somente JSON, sem markdown.',
    'Formato: [{"id":"A7F92K","categoria":"importante|descadastrar|arquivar|lixo","confianca":"alta|media|baixa","resumo":"1-2 linhas","acao_sugerida":"abrir|arquivar|responder|descadastrar"}].',
    'Emails:',
    JSON.stringify(
      (emails || []).map(function mapEmail(email) {
        return {
          id: email.id_interno,
          remetente: email.remetente || '',
          assunto: email.assunto || '',
          snippet: email.snippet || '',
          corpo_reduzido: email.corpo_reduzido || '',
        };
      }),
    ),
  ].join('\n');
}

function montarPayload(emails) {
  return {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: montarPromptGemini_(emails || []),
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };
}

function extrairTextoResposta_(responseText) {
  var parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (error) {
    return responseText;
  }

  if (Array.isArray(parsed)) return JSON.stringify(parsed);

  var candidate =
    parsed &&
    parsed.candidates &&
    parsed.candidates[0] &&
    parsed.candidates[0].content &&
    parsed.candidates[0].content.parts &&
    parsed.candidates[0].content.parts[0];

  if (candidate && typeof candidate.text === 'string') return candidate.text;
  return responseText;
}

function limparCercasMarkdown_(text) {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function fallbackGemini(email) {
  return {
    id: email && email.id_interno,
    categoria: 'importante',
    confianca: 'baixa',
    resumo: '(sem resumo)',
    acao_sugerida: 'abrir',
  };
}

function normalizarResultadoGemini_(resultado, email) {
  return {
    id: resultado.id || (email && email.id_interno),
    categoria: resultado.categoria || 'importante',
    confianca: resultado.confianca || 'baixa',
    resumo: resultado.resumo || '(sem resumo)',
    acao_sugerida: resultado.acao_sugerida || 'abrir',
  };
}

function parseResposta(responseText, emails) {
  var emailList = emails || [];

  try {
    var jsonText = limparCercasMarkdown_(extrairTextoResposta_(responseText));
    var parsed = JSON.parse(jsonText);
    if (!Array.isArray(parsed)) throw new Error('Resposta Gemini nao e array');

    var byId = parsed.reduce(function reduceResults(acc, item) {
      if (item && item.id) acc[item.id] = item;
      return acc;
    }, {});

    return emailList.map(function mapResult(email, index) {
      var result = byId[email.id_interno] || parsed[index];
      if (!result || typeof result !== 'object') return fallbackGemini(email);
      return normalizarResultadoGemini_(result, email);
    });
  } catch (error) {
    return emailList.map(fallbackGemini);
  }
}

function classificarComGemini(emails, apiKey, options) {
  var opts = options || {};
  var sleepFn = opts.sleepFn || (typeof Utilities !== 'undefined' ? Utilities.sleep : function noop() {});
  var url = GEMINI_ENDPOINT + '?key=' + encodeURIComponent(apiKey);
  var payload = JSON.stringify(montarPayload(emails || []));
  var fetchOptions = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: payload,
  };

  for (var attempt = 0; attempt <= GEMINI_BACKOFF_MS.length; attempt += 1) {
    var response = UrlFetchApp.fetch(url, fetchOptions);
    var status = response.getResponseCode();
    if (status !== 429) {
      if (status >= 200 && status < 300) return parseResposta(response.getContentText(), emails || []);
      return (emails || []).map(fallbackGemini);
    }

    if (attempt < GEMINI_BACKOFF_MS.length) sleepFn(GEMINI_BACKOFF_MS[attempt]);
  }

  return (emails || []).map(fallbackGemini);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    montarPayload,
    parseResposta,
    fallbackGemini,
    classificarComGemini,
  };
}
