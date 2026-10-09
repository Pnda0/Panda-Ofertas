/** Pequenas edições nos arquivos de configuração feitas pelo assistente (npm run configurar). */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './config.js';

const ENV_FILE = path.join(ROOT, '.env');
const GRUPOS_FILE = path.join(ROOT, 'config', 'grupos.json');

/** Troca (ou acrescenta) CHAVE=valor preservando o resto do texto e o tipo de quebra de linha. */
export function updateEnvText(text, key, value) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, () => `${key}=${value}`);
  return text + (text.endsWith('\n') || text === '' ? '' : eol) + `${key}=${value}${eol}`;
}

export function setEnvVar(key, value) {
  if (!fs.existsSync(ENV_FILE)) fs.copyFileSync(path.join(ROOT, '.env.example'), ENV_FILE);
  fs.writeFileSync(ENV_FILE, updateEnvText(fs.readFileSync(ENV_FILE, 'utf8'), key, value), 'utf8');
  process.env[key] = value;
}

/** Devolve o objeto de grupos.json com o JID (e ativo=true) gravado no grupo indicado. */
export function withGrupoJid(cfg, nome, jid) {
  const grupos = cfg.grupos.map((g) => (g.nome === nome ? { ...g, jid, ativo: true } : g));
  if (!grupos.some((g) => g.nome === nome)) grupos.push({ nome, jid, ativo: true, mensagemAdicional: '', filtros: {} });
  return { ...cfg, grupos };
}

/** Grava campos soltos de um grupo (ex.: mensagemAdicional) em grupos.json. */
export function setGrupoCampos(nome, campos) {
  const cfg = JSON.parse(fs.readFileSync(GRUPOS_FILE, 'utf8'));
  cfg.grupos = cfg.grupos.map((g) => (g.nome === nome ? { ...g, ...campos } : g));
  fs.writeFileSync(GRUPOS_FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
}

export function setGrupoJid(nome, jid) {
  const cfg = JSON.parse(fs.readFileSync(GRUPOS_FILE, 'utf8'));
  fs.writeFileSync(GRUPOS_FILE, JSON.stringify(withGrupoJid(cfg, nome, jid), null, 2) + '\n', 'utf8');
}

const FONTES_FILE = path.join(ROOT, 'config', 'fontes.json');
const FONTES_PADRAO = { ativo: true, destinoPadrao: 'Geral', intervaloSegundos: 60, janelaMinutos: 20, maxPorHora: 15, fontes: [] };

/** Troca a lista de grupos-fonte do espelho (config/fontes.json), preservando as outras opções. */
export function setFontes(nomes, destino) {
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(FONTES_FILE, 'utf8'));
  } catch {}
  cfg = { ...FONTES_PADRAO, ...cfg };
  cfg.fontes = [...new Set(nomes.map((n) => String(n).trim()).filter(Boolean))].map((nome) => ({ nome, destino: destino || cfg.destinoPadrao, ativo: true }));
  fs.writeFileSync(FONTES_FILE, JSON.stringify(cfg, null, 2) + '\n', 'utf8');
  return cfg;
}

export const jidConfigurado = (g) => !!g.jid && !g.jid.startsWith('COLE_AQUI');

const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * Acha o grupo pelo que a pessoa digitou: o número da lista ou (parte do) nome, sem ligar para
 * maiúsculas e acentos. Devolve { grupo } quando há um só candidato, ou { varios: [...] }.
 */
export function encontrarGrupo(lista, texto) {
  const t = String(texto || '').trim();
  if (!t) return {};
  if (/^\d+$/.test(t)) return lista[Number(t) - 1] ? { grupo: lista[Number(t) - 1] } : {};
  const alvo = semAcento(t);
  const exatos = lista.filter((g) => semAcento(g.nome) === alvo);
  if (exatos.length === 1) return { grupo: exatos[0] };
  const parciais = (exatos.length ? exatos : lista.filter((g) => semAcento(g.nome).includes(alvo)));
  if (parciais.length === 1) return { grupo: parciais[0] };
  return parciais.length ? { varios: parciais } : {};
}
