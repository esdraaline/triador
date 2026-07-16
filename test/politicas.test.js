const { politicaPermiteGemini, politicaPermiteAcao } = require('../src/Politicas');

describe('Políticas de sensibilidade', () => {
  test('bloqueia IA externa em conta institucional', () => {
    expect(
      politicaPermiteGemini({ allow_ai_external: true, sensitivity: 'institutional' }),
    ).toBe(false);
  });

  test('permite IA em conta pessoal autorizada e bloqueia lixeira proibida', () => {
    expect(politicaPermiteGemini({ allow_ai_external: true, sensitivity: 'personal' })).toBe(true);
    expect(politicaPermiteAcao({ allow_delete: false }, 'lixeira')).toBe(false);
  });
});
