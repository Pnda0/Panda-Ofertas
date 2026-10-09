import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseOffersPage, parsePolyCards, parseFromState, cleanProductUrl, extractId, normalizeImageUrl } from '../src/ml/parser.js';

const fx = (f) => fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8');

test('JSON embutido: extrai todos os campos e remove duplicados', () => {
  const { produtos, fonte } = parseOffersPage(fx('ofertas-json.html'));
  assert.equal(fonte, 'json');
  assert.equal(produtos.length, 2);
  const [a, b] = produtos;
  assert.deepEqual(
    {
      id: a.id, url: a.url, precoAtual: a.precoAtual, precoOriginal: a.precoOriginal, descontoPct: a.descontoPct,
      cupom: a.cupom, frete: a.frete, full: a.full, lojaOficial: a.lojaOficial, vendedor: a.vendedor,
      nota: a.nota, vendidos: a.vendidos, precoObs: a.precoObs, fimRelampago: a.fimRelampago,
    },
    {
      id: 'MLB4049279695',
      url: 'https://produto.mercadolivre.com.br/MLB-4049279695-tnis-masculino-feminino-kappa-park-20-original-_JM',
      precoAtual: 69.34, precoOriginal: 169.99, descontoPct: 59,
      cupom: 'R$ 15 OFF com Cupom', frete: 'Frete grátis', full: true, lojaOficial: true, vendedor: 'KAPPA',
      nota: 4.7, vendidos: '+250mil vendidos', precoObs: 'no Pix', fimRelampago: '2026-10-02T03:00:00Z',
    }
  );
  assert.equal(a.imagem, 'https://http2.mlstatic.com/D_NQ_NP_2X_612669-MLB117966660109_092026-F.jpg');
  assert.equal(a.parcelamento, 'ou R$ 72,99 em outros meios');
  // produto sem preço anterior
  assert.equal(b.precoOriginal, null);
  assert.equal(b.descontoPct, null);
  assert.equal(b.url, 'https://www.mercadolivre.com.br/controle-playstation-dualshock-4-berry-blue-ps4/p/MLB15085750');
});

test('HTML poly-card (reserva): lê preço com milhar, desconto no seletor novo e cupom', () => {
  const [p] = parsePolyCards(fx('ofertas-polycard.html'));
  assert.equal(p.id, 'MLB5325422870');
  assert.equal(p.url, 'https://produto.mercadolivre.com.br/MLB-5325422870-tnis-kappa-pulse-unissex-academia-caminhada-_JM');
  assert.equal(p.precoAtual, 1116.99);
  assert.equal(p.precoOriginal, 229.99);
  assert.equal(p.descontoPct, 49);
  assert.equal(p.cupom, 'R$ 15 OFF com Cupom');
  assert.equal(p.frete, 'Frete grátis');
  assert.equal(p.nota, 4.7);
  assert.equal(p.imagem, 'https://http2.mlstatic.com/D_NQ_NP_2X_746854-MLB116590448189_082026-F.jpg');
});

test('parseOffersPage cai para o HTML quando não há JSON', () => {
  const { fonte, produtos } = parseOffersPage(fx('ofertas-polycard.html'));
  assert.equal(fonte, 'html-polycard');
  assert.equal(produtos.length, 1);
});

test('helpers de URL e ID', () => {
  assert.equal(extractId('https://produto.mercadolivre.com.br/MLB-123456-x'), 'MLB123456');
  assert.equal(extractId('https://www.mercadolivre.com.br/x/p/MLB999'), 'MLB999');
  assert.equal(cleanProductUrl('produto.mercadolivre.com.br/MLB-1-a?x=1#y'), 'https://produto.mercadolivre.com.br/MLB-1-a');
  assert.equal(
    normalizeImageUrl('https://http2.mlstatic.com/D_Q_NP_957084-MLA99987065053_112025-P.jpg'),
    'https://http2.mlstatic.com/D_NQ_NP_2X_957084-MLA99987065053_112025-F.jpg'
  );
});

test('JSON: aceita shipping_v2/promotions como objeto único e ignora card quebrado', () => {
  const card = (extra) => ({
    card: {
      metadata: { id: 'MLB77', url: 'produto.mercadolivre.com.br/MLB-77-x' },
      pictures: { pictures: [{ id: '1-MLB2_3' }] },
      components: [
        { type: 'title', title: { text: 'Produto X' } },
        { type: 'price', price: { current_price: { value: 50 }, price_labels: { values: [{ type: 'price', price: { value: 100, previous: true } }] } } },
        ...extra,
      ],
    },
  });
  const state = {
    appProps: {
      pageProps: {
        data: {
          items: [
            card([
              { type: 'shipping_v2', shipping_v2: { text: '{l}', values: [{ key: 'l', type: 'label', label: { text: 'Frete grátis' } }] } },
              { type: 'promotions', promotions: { type: 'coupon', text: '{a} OFF', values: [{ key: 'a', type: 'price', price: { value: 10 } }] } },
            ]),
            { card: { metadata: { id: 'MLB78', url: 'x.com/MLB-78' }, components: [{ type: 'title', title: { text: 'Quebrado' } }, { type: 'price', price: 7 }], get pictures() { throw new Error('boom'); } } },
          ],
        },
      },
    },
  };
  const r = parseFromState(state);
  assert.equal(r.length, 1);
  assert.equal(r[0].frete, 'Frete grátis');
  assert.equal(r[0].cupom, 'R$ 10 OFF');
  assert.equal(r[0].precoOriginal, 100);
  assert.equal(r[0].descontoPct, 50);
});
