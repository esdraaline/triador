const { classificarPorRegras } = require('../src/Regras');

describe('Regras', () => {
  const email = {
    account_id: 'josemardp_gmail',
    remetente: 'News <news@example.com>',
    assunto: 'Promo da semana',
    snippet: 'Oferta especial',
  };

  test('casa regra por remetente respeitando account_id', () => {
    const result = classificarPorRegras(
      email,
      [
        {
          tipo: 'remetente',
          valor: 'news@example.com',
          account_id: 'josemardp_gmail',
          categoria: 'descadastrar',
          acao_default: 'abrir',
          ativo: true,
        },
      ],
      { account_id: 'josemardp_gmail' },
    );

    expect(result).toEqual({
      categoria: 'descadastrar',
      acao_sugerida: 'abrir',
      confianca: 'regra',
    });
  });

  test('casa regra por dominio com escopo global', () => {
    const result = classificarPorRegras(
      email,
      [
        {
          tipo: 'dominio',
          valor: '@example.com',
          account_id: '*',
          categoria: 'arquivar',
          acao_default: 'arquivar',
          ativo: true,
        },
      ],
      {},
    );

    expect(result.categoria).toBe('arquivar');
    expect(result.acao_sugerida).toBe('arquivar');
  });

  test('always_important_keywords forca importante antes das regras', () => {
    const result = classificarPorRegras(
      { ...email, assunto: 'Boleto disponivel' },
      [
        {
          tipo: 'dominio',
          valor: '@example.com',
          account_id: '*',
          categoria: 'arquivar',
          acao_default: 'arquivar',
          ativo: true,
        },
      ],
      { always_important_keywords: ['boleto'] },
    );

    expect(result).toEqual({
      categoria: 'importante',
      acao_sugerida: 'abrir',
      confianca: 'regra',
    });
  });

  test('ignora regras inativas ou de outra conta', () => {
    const result = classificarPorRegras(
      email,
      [
        {
          tipo: 'keyword_assunto',
          valor: 'promo',
          account_id: 'outra_conta',
          categoria: 'lixo',
          acao_default: 'lixeira',
          ativo: true,
        },
        {
          tipo: 'keyword_assunto',
          valor: 'promo',
          account_id: '*',
          categoria: 'lixo',
          acao_default: 'lixeira',
          ativo: false,
        },
      ],
      { account_id: 'josemardp_gmail' },
    );

    expect(result).toBeNull();
  });
});
