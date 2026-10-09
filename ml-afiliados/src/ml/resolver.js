/**
 * "Espelho": descobrir QUAL produto do Mercado Livre uma mensagem de outro grupo está divulgando.
 *
 * Do outro grupo só aproveitamos o link. A partir dele:
 *   meli.la/XXXX  ──redireciona──▶  mercadolivre.com.br/social/<afiliado>?ref=...
 *   Nessa página "social" o ML mostra em destaque o produto divulgado (card "card-featured"),
 *   com título, preço, desconto, cupom, frete e foto — os mesmos dados da página de ofertas.
 * Depois o bot gera o link de afiliado do Alan para esse produto e monta a mensagem no nosso formato.
 *
 * As páginas são abertas sem cookies, como um visitante comum que clicou no link.
 */
import { extractEmbeddedState, productFromCard, cleanProductUrl, extractId, normalizeImageUrl } from './parser.js';
import { fetchPage } from './scraper.js';

const HOST_ML = /(^|\.)(mercadolivre\.com\.br|mercadolivre\.com|mercadolibre\.com|meli\.la)$/i;

/** Todos os links do Mercado Livre que aparecem num texto (sem repetir, na ordem). */
export function extrairLinksML(texto) {
  const achados = String(texto || '').match(/https?:\/\/[^\s<>"']+/gi) || [];
  const links = [];
  for (let u of achados) {
    u = u.replace(/[).,;!?\]*_~]+$/, ''); // pontuação e marcas de negrito/itálico do WhatsApp no fim
    try {
      if (HOST_ML.test(new URL(u).hostname) && !links.includes(u)) links.push(u);
    } catch {}
  }
  return links;
}

/** 'curto' | 'social' | 'produto' | 'outro' (lista, loja, página de ofertas, etc.) */
export function tipoLink(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return 'outro';
  }
  const host = u.hostname.toLowerCase();
  if (host === 'meli.la' || /^\/sec\//.test(u.pathname)) return 'curto';
  if (/^\/social\/[^/]+\/?$/.test(u.pathname)) return 'social';
  if (/^\/social\//.test(u.pathname)) return 'outro'; // listas/vitrines do afiliado
  if (/\/p\/ML[A-Z]\d+/.test(u.pathname) || /\/up\/ML[A-Z]U?\d+/.test(u.pathname) || /^\/ML[A-Z]-?\d+/.test(u.pathname)) return 'produto';
  return 'outro';
}

/** O ML respondeu com a tela de verificação ("Por segurança, complete esta etapa")? */
export const ehVerificacao = (url, html = '') => /\/captcha\/|account-verification|\/gz\/security/i.test(url) || /Por segurança, complete esta etapa/i.test(html.slice(0, 200_000));

export class ErroVerificacao extends Error {}

/** Produto em destaque da página social de um afiliado. */
export function parseSocialPage(html) {
  const data = extractEmbeddedState(html)?.appProps?.pageProps?.data;
  if (!data) return null;
  const cards = [];
  for (const c of data.components || []) {
    const pcs = c?.recommendation_data?.recommendation_info?.polycards;
    if (Array.isArray(pcs)) cards.push(...pcs.map((pc) => ({ pc, destaque: c.id === 'card-featured' })));
  }
  const idCompartilhado = data.shared_item?.id || data.shared_items?.[0]?.id;
  const escolhido =
    cards.find((x) => idCompartilhado && x.pc?.metadata?.id === idCompartilhado) || cards.find((x) => x.destaque) || null;
  if (!escolhido) return null;
  try {
    return productFromCard(escolhido.pc);
  } catch {
    return null;
  }
}

/** Página do produto (quando o link leva direto a ela): lê o JSON-LD que o ML publica. */
export function parseProductPage(html, urlFinal) {
  const blocos = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => {
      try {
        return JSON.parse(m[1]);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const url = cleanProductUrl(urlFinal);
  let item = blocos.find((b) => b['@type'] === 'Product');
  let nota = item?.aggregateRating?.ratingValue ?? null;
  const grupo = blocos.find((b) => b['@type'] === 'ProductGroup');
  if (!item && grupo) {
    const variantes = grupo.hasVariant || [];
    item = variantes.find((v) => cleanProductUrl(v.offers?.url || v.url || '') === url) || variantes[0];
    nota = grupo.aggregateRating?.ratingValue ?? null;
  }
  const preco = Number(item?.offers?.price ?? item?.offers?.lowPrice);
  const imagem = Array.isArray(item?.image) ? item.image[0] : item?.image;
  const id = extractId(url);
  if (!item?.name || !Number.isFinite(preco) || !imagem || !id) return null;
  return {
    id,
    nome: item.name,
    url,
    imagem: normalizeImageUrl(imagem),
    precoAtual: preco,
    precoOriginal: null,
    descontoPct: null,
    precoObs: null,
    parcelamento: null,
    cupom: null,
    frete: null,
    full: false,
    vendedor: null,
    lojaOficial: false,
    nota: Number.isFinite(Number(nota)) ? Number(nota) : null,
    vendidos: null,
    fimRelampago: null,
  };
}

/**
 * Do link que veio na mensagem até os dados do produto.
 * Lança ErroVerificacao se o ML pedir captcha (o bot pausa em vez de insistir).
 */
export async function resolverOferta(link, { http = fetchPage } = {}) {
  const tipo = tipoLink(link);
  if (tipo === 'outro') throw new Error('link do ML que não é de um produto (lista, loja ou página de ofertas)');

  const pagina = await http(link);
  if (ehVerificacao(pagina.url, pagina.html)) throw new ErroVerificacao('o Mercado Livre pediu verificação de segurança (captcha)');
  if (pagina.status >= 400) throw new Error(`HTTP ${pagina.status} ao abrir o link`);

  const tipoFinal = tipoLink(pagina.url);
  let produto = null;
  if (tipoFinal === 'social') produto = parseSocialPage(pagina.html);
  else if (tipoFinal === 'produto') produto = parseProductPage(pagina.html, pagina.url);
  else produto = parseSocialPage(pagina.html); // redirecionamento desconhecido: tenta o formato social

  if (!produto) throw new Error(`não consegui identificar o produto (o link levou a uma página "${tipoFinal}")`);
  if (!produto.precoAtual || !produto.imagem) throw new Error('produto sem preço ou sem foto');
  return produto;
}
