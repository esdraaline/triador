const { classificarEmails } = require('../src/Classificador');

function makeEmail(id, overrides = {}) {
  return {
    id_interno: id,
    account_id: 'josemardp_gmail',
    remetente: 'Pessoa <pessoa@example.com>',
    assunto: 'Assunto',
    snippet: 'Trecho',
    ...overrides,
  };
}

describe('Classificador em cascata', () => {
  test('regra resolve sem chamar geminiFn', () => {
    const geminiFn = jest.fn();
    const result = classificarEmails([makeEmail('A7F92K', { assunto: 'Boleto recebido' })], {
      conta: { account_id: 'josemardp_gmail', allow_ai_external: true },
      regras: [
        {
          tipo: 'keyword_assunto',
          valor: 'boleto',
          account_id: '*',
          categoria: 'importante',
          acao_default: 'abrir',
          ativo: true,
        },
      ],
      geminiFn,
    });

    expect(geminiFn).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      categoria_sugerida: 'importante',
      confianca: 'regra',
    });
  });

  test('allow_ai_external cautela nunca chama Gemini e marca revisao manual', () => {
    const geminiFn = jest.fn();
    const result = classificarEmails([makeEmail('A7F92K')], {
      conta: { account_id: 'conta-comercial_gmail', allow_ai_external: 'cautela' },
      regras: [],
      geminiFn,
    });

    expect(geminiFn).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({
      categoria_sugerida: 'importante',
      confianca: 'baixa',
      acao_sugerida: 'abrir',
    });
  });

  test('allow_ai_external false nunca chama Gemini', () => {
    const geminiFn = jest.fn();
    const result = classificarEmails([makeEmail('A7F92K')], {
      conta: { account_id: 'univesp', allow_ai_external: false },
      regras: [],
      geminiFn,
    });

    expect(geminiFn).not.toHaveBeenCalled();
    expect(result[0].confianca).toBe('baixa');
  });

  test('divide lotes maiores que 30 e aplica delay entre lotes', () => {
    const emails = Array.from({ length: 31 }, (_, index) =>
      makeEmail(`ID${String(index).padStart(4, '0')}`),
    );
    const geminiFn = jest.fn((batch) =>
      batch.map((email) => ({
        id: email.id_interno,
        categoria: 'arquivar',
        confianca: 'alta',
        resumo: 'Resumo.',
        acao_sugerida: 'arquivar',
      })),
    );
    const sleepFn = jest.fn();

    const result = classificarEmails(emails, {
      conta: { account_id: 'josemardp_gmail', allow_ai_external: true },
      regras: [],
      geminiFn,
      sleepFn,
      delayEntreLotesMs: 1500,
    });

    expect(geminiFn).toHaveBeenCalledTimes(2);
    expect(geminiFn.mock.calls[0][0]).toHaveLength(30);
    expect(geminiFn.mock.calls[1][0]).toHaveLength(1);
    expect(sleepFn).toHaveBeenCalledWith(1500);
    expect(result).toHaveLength(31);
    expect(result[30]).toMatchObject({
      categoria_sugerida: 'arquivar',
      acoes_disponiveis: ['arquivar'],
    });
  });

  test('historico resolve antes do Gemini', () => {
    const geminiFn = jest.fn();
    const historicoFn = jest.fn(() => ({
      categoria: 'arquivar',
      confianca: 'alta',
      resumo: 'Remetente ja conhecido.',
      acao_sugerida: 'arquivar',
    }));

    const result = classificarEmails([makeEmail('A7F92K')], {
      conta: { account_id: 'josemardp_gmail', allow_ai_external: true },
      regras: [],
      historicoFn,
      geminiFn,
    });

    expect(historicoFn).toHaveBeenCalled();
    expect(geminiFn).not.toHaveBeenCalled();
    expect(result[0].categoria_sugerida).toBe('arquivar');
  });

  test('preserva a ordem original mesmo misturando regra e Gemini', () => {
    const emails = [
      makeEmail('A7F92K', { assunto: 'Boleto' }),
      makeEmail('B8G93L', { assunto: 'Mensagem ambigua' }),
    ];
    const geminiFn = jest.fn(() => [
      {
        id: 'B8G93L',
        categoria: 'arquivar',
        confianca: 'alta',
        resumo: 'Pode arquivar.',
        acao_sugerida: 'arquivar',
      },
    ]);

    const result = classificarEmails(emails, {
      conta: { account_id: 'josemardp_gmail', allow_ai_external: true },
      regras: [
        {
          tipo: 'keyword_assunto',
          valor: 'boleto',
          account_id: '*',
          categoria: 'importante',
          acao_default: 'abrir',
          ativo: true,
        },
      ],
      geminiFn,
    });

    expect(result.map((email) => email.id_interno)).toEqual(['A7F92K', 'B8G93L']);
  });
});
