const {
  agruparEmailsPorCategoria,
  editarMensagem,
  enviarMensagem,
  escapeHtml,
  formatarResumo,
  montarTeclado,
  montarTecladoResumo,
} = require('../src/Telegram');
const { installMocks, resetMocks, makeUrlFetchResponseMock } = require('./helpers/gasMocks');

function makeEmail(overrides = {}) {
  return {
    id_interno: 'A7F92K',
    account_id: 'josemardp_gmail',
    remetente: 'Banco & Cia <contato@banco.com>',
    assunto: 'Fatura <junho>',
    resumo: 'Vencimento dia 10.',
    categoria_sugerida: 'importante',
    acoes_disponiveis: ['arquivar', 'abrir'],
    ...overrides,
  };
}

describe('Telegram - formatter e teclado', () => {
  test('escapeHtml protege texto em parse_mode HTML', () => {
    expect(escapeHtml('A&B <tag> "x"')).toBe('A&amp;B &lt;tag&gt; &quot;x&quot;');
  });

  test('formatarResumo agrupa categorias na ordem do PRD e escapa HTML', () => {
    const emails = [
      makeEmail(),
      makeEmail({
        id_interno: 'B8G93L',
        categoria_sugerida: 'arquivar',
        remetente: 'News <news@example.com>',
        assunto: 'Newsletter',
      }),
    ];
    const texto = formatarResumo(agruparEmailsPorCategoria(emails), {
      email: 'conta-pessoal@exemplo.com',
    }, new Date('2026-06-29T10:00:00.000Z'));

    expect(texto).toContain('📬 <b>TRIAGEM</b> - 29/06/2026 - conta-pessoal@exemplo.com');
    expect(texto.indexOf('🔴 IMPORTANTES')).toBeLessThan(texto.indexOf('⚪ ARQUIVAR'));
    expect(texto).toContain('Banco &amp; Cia');
    expect(texto).toContain('Fatura &lt;junho&gt;');
  });

  test('montarTeclado gera callback_data no formato prefixo:id e ate 64 bytes', () => {
    const teclado = montarTeclado(makeEmail());

    expect(teclado).toEqual({
      inline_keyboard: [
        [{ text: 'Arquivar', callback_data: 'arq:A7F92K' }],
        [{ text: 'Abrir', callback_data: 'abr:A7F92K' }],
      ],
    });
    teclado.inline_keyboard.flat().forEach((button) => {
      expect(Buffer.byteLength(button.callback_data, 'utf8')).toBeLessThanOrEqual(64);
    });
  });

  test('montarTeclado rejeita callback_data longo', () => {
    expect(() =>
      montarTeclado(makeEmail({ id_interno: 'A'.repeat(70), acoes_disponiveis: ['arquivar'] })),
    ).toThrow('callback_data excede 64 bytes');
  });

  test('email importante recebe Arquivar e Abrir no teclado', () => {
    const teclado = montarTeclado(
      makeEmail({ categoria_sugerida: 'importante', acoes_disponiveis: ['arquivar', 'abrir'] }),
    );

    expect(teclado.inline_keyboard.flat().map((button) => button.text)).toEqual([
      'Arquivar',
      'Abrir',
    ]);
  });

  test('montarTecladoResumo concatena botoes dos itens', () => {
    const teclado = montarTecladoResumo([
      makeEmail({ id_interno: 'A7F92K' }),
      makeEmail({ id_interno: 'B8G93L', acoes_disponiveis: ['arquivar'] }),
    ]);

    expect(teclado.inline_keyboard).toHaveLength(3);
    expect(teclado.inline_keyboard[2][0].callback_data).toBe('arq:B8G93L');
  });
});

describe('Telegram - API fina', () => {
  afterEach(() => {
    resetMocks();
  });

  test('enviarMensagem chama sendMessage com parse_mode HTML', () => {
    const token = '1234567890:ABCToken';
    installMocks({
      properties: { TELEGRAM_BOT_TOKEN: token },
      urlFetch: {
        responses: [
          makeUrlFetchResponseMock({ body: { ok: true, result: { message_id: 55 } } }),
        ],
      },
    });

    const result = enviarMensagem('chat_1', '<b>Oi</b>', { inline_keyboard: [] });
    const url = global.UrlFetchApp.fetch.mock.calls[0][0];
    const payload = JSON.parse(global.UrlFetchApp.fetch.mock.calls[0][1].payload);

    expect(url).toBe('https://api.telegram.org/bot1234567890:ABCToken/sendMessage');
    expect(url).toContain(':ABCToken');
    expect(url).not.toContain('%3A');
    expect(payload).toMatchObject({
      chat_id: 'chat_1',
      text: '<b>Oi</b>',
      parse_mode: 'HTML',
    });
    expect(result.result.message_id).toBe(55);
  });

  test('editarMensagem chama editMessageText', () => {
    installMocks({
      properties: { TELEGRAM_BOT_TOKEN: 'token_123' },
      urlFetch: {
        responses: [
          makeUrlFetchResponseMock({ body: { ok: true, result: { message_id: 55 } } }),
        ],
      },
    });

    editarMensagem('chat_1', 55, '<b>Atualizado</b>', { inline_keyboard: [] });
    const payload = JSON.parse(global.UrlFetchApp.fetch.mock.calls[0][1].payload);

    expect(global.UrlFetchApp.fetch.mock.calls[0][0]).toBe(
      'https://api.telegram.org/bottoken_123/editMessageText',
    );
    expect(payload).toMatchObject({
      chat_id: 'chat_1',
      message_id: 55,
      parse_mode: 'HTML',
    });
  });
});
