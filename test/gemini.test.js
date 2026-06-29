const {
  classificarComGemini,
  fallbackGemini,
  montarPayload,
  parseResposta,
} = require('../src/Gemini');
const { installMocks, resetMocks, makeUrlFetchResponseMock } = require('./helpers/gasMocks');

describe('Gemini - payload e parse', () => {
  const emails = [
    {
      id_interno: 'A7F92K',
      remetente: 'Cliente <cliente@example.com>',
      assunto: 'Pedido',
      snippet: 'Perguntou sobre entrega',
      corpo_reduzido: 'Quando chega?',
    },
  ];

  test('montarPayload inclui somente campos necessarios ao contrato', () => {
    const payload = montarPayload(emails);
    const text = payload.contents[0].parts[0].text;

    expect(payload.generationConfig.temperature).toBe(0.2);
    expect(payload.generationConfig.responseMimeType).toBe('application/json');
    expect(text).toContain('"id":"A7F92K"');
    expect(text).toContain('"corpo_reduzido":"Quando chega?"');
  });

  test('parseResposta lida com JSON valido', () => {
    const result = parseResposta(
      '[{"id":"A7F92K","categoria":"importante","confianca":"alta","resumo":"Cliente perguntou entrega.","acao_sugerida":"responder"}]',
      emails,
    );

    expect(result).toEqual([
      {
        id: 'A7F92K',
        categoria: 'importante',
        confianca: 'alta',
        resumo: 'Cliente perguntou entrega.',
        acao_sugerida: 'responder',
      },
    ]);
  });

  test('parseResposta tolera cercas markdown acidentais', () => {
    const result = parseResposta(
      '```json\n[{"id":"A7F92K","categoria":"arquivar","confianca":"media","resumo":"Info.","acao_sugerida":"arquivar"}]\n```',
      emails,
    );

    expect(result[0]).toMatchObject({
      id: 'A7F92K',
      categoria: 'arquivar',
      confianca: 'media',
    });
  });

  test('parseResposta usa fallback quando vier lixo', () => {
    expect(parseResposta('nao-json', emails)).toEqual([fallbackGemini(emails[0])]);
  });
});

describe('Gemini - UrlFetch e backoff', () => {
  afterEach(() => {
    resetMocks();
  });

  test('classificarComGemini faz backoff no 429 e depois parseia sucesso', () => {
    const sleepFn = jest.fn();
    installMocks({
      urlFetch: {
        responses: [
          makeUrlFetchResponseMock({ statusCode: 429, body: { error: 'rate' } }),
          makeUrlFetchResponseMock({
            statusCode: 200,
            body: {
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: '[{"id":"A7F92K","categoria":"arquivar","confianca":"alta","resumo":"Ok.","acao_sugerida":"arquivar"}]',
                      },
                    ],
                  },
                },
              ],
            },
          }),
        ],
      },
    });

    const result = classificarComGemini(
      [{ id_interno: 'A7F92K', remetente: 'a@b.com', assunto: 'Oi' }],
      'api-key',
      { sleepFn },
    );

    expect(global.UrlFetchApp.fetch).toHaveBeenCalledTimes(2);
    expect(sleepFn).toHaveBeenCalledWith(1000);
    expect(result[0]).toMatchObject({ categoria: 'arquivar', confianca: 'alta' });
  });
});
