import { settings } from '../config.js';
import { parseOffersPage } from './parser.js';
import { loadCookies } from './affiliate.js';
import { findBrowserPath, sessaoNavegador } from '../browser.js';
import { log, randomDelay } from '../util.js';

/** Monta a URL da página N de uma listagem de ofertas. */
export function pageUrl(url, page) {
  if (page <= 1) return url;
  const u = new URL(url);
  u.hash = '';
  u.searchParams.set('page', String(page));
  return u.toString();
}

/** Como fetchHtml, mas devolve também a URL final (depois dos redirecionamentos). */
export async function fetchPage(url, { cookies } = {}) {
  const res = await fetch(url, {
    headers: {
      'user-agent': settings.userAgent,
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
      accept: 'text/html,application/xhtml+xml',
      ...(cookies ? { cookie: cookies } : {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45_000),
  });
  return { status: res.status, url: res.url, html: await res.text() };
}

export async function fetchHtml(url, { cookies } = {}) {
  const res = await fetch(url, {
    headers: {
      'user-agent': settings.userAgent,
      'accept-language': 'pt-BR,pt;q=0.9,en;q=0.8',
      accept: 'text/html,application/xhtml+xml',
      ...(cookies ? { cookie: cookies } : {}),
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao abrir ${url}`);
  return res.text();
}

/**
 * Baixa e interpreta uma página de ofertas.
 * 1ª tentativa: HTTP direto (rápido, como o nó "CARREGA HTML" do curso, que também manda os cookies).
 * Plano B: se o ML bloquear ou devolver uma página sem produtos, abre no Chrome/Edge do bot.
 */
export async function obterProdutos(url, { http = fetchHtml, navegador = sessaoNavegador, temNavegador = !!findBrowserPath() } = {}) {
  let motivo;
  try {
    const r = parseOffersPage(await http(url, { cookies: loadCookies() }));
    if (r.produtos.length) return r;
    motivo = 'página sem produtos via HTTP';
  } catch (e) {
    motivo = e.message;
  }
  if (!temNavegador) throw new Error(motivo);
  log(`  ↪ ${motivo} — tentando pelo navegador...`);
  const r = parseOffersPage(await navegador.html(url));
  return { ...r, fonte: `${r.fonte}, navegador` };
}

/** Coleta os produtos de uma categoria (todas as páginas configuradas). */
export async function scrapeCategoria(cat) {
  const paginas = Math.max(1, cat.paginas || 1);
  const todos = [];
  for (let p = 1; p <= paginas; p++) {
    const url = pageUrl(cat.url, p);
    try {
      const { produtos, fonte } = await obterProdutos(url);
      log(`  ${cat.nome} p.${p}: ${produtos.length} produtos (via ${fonte})`);
      todos.push(...produtos.map((x) => ({ ...x, grupo: cat.grupo, categoria: cat.nome })));
      if (!produtos.length) break;
    } catch (e) {
      log(`  ⚠️  ${cat.nome} p.${p}: ${e.message}`);
      break;
    }
    if (p < paginas) await randomDelay(3, 8);
  }
  return todos;
}
