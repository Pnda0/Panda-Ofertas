/**
 * Copia tudo o que aparece na tela (console.log / console.error) para data/bot.log,
 * com data e hora — assim dá para ver depois o que aconteceu, inclusive erros completos.
 */
import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';
import { DATA_DIR } from './config.js';

export const LOG_FILE = path.join(DATA_DIR, 'bot.log');
const MAX_BYTES = 2 * 1024 * 1024;

function escrever(nivel, args) {
  try {
    const texto = args.map((a) => (typeof a === 'string' ? a : util.inspect(a, { depth: 4 }))).join(' ');
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${nivel} ${texto}\n`);
  } catch {}
}

/** Erro completo (com a pilha) só no arquivo — na tela fica a mensagem curta. */
export function registrarErro(contexto, e) {
  escrever('ERRO', [`${contexto}: ${e?.stack || e}`]);
}

export function instalarLogEmArquivo(nome = 'bot') {
  try {
    if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size > MAX_BYTES) fs.renameSync(LOG_FILE, LOG_FILE + '.antigo');
  } catch {}
  escrever('----', [`início: ${nome} (node ${process.version}, ${process.platform})`]);
  for (const [metodo, nivel] of [['log', 'INFO'], ['error', 'ERRO'], ['warn', 'AVISO']]) {
    const original = console[metodo].bind(console);
    console[metodo] = (...args) => {
      escrever(nivel, args);
      original(...args);
    };
  }
  process.on('unhandledRejection', (e) => registrarErro('unhandledRejection', e));
  process.on('uncaughtException', (e) => {
    registrarErro('uncaughtException', e);
    console.error(`❌ Erro inesperado: ${e?.message || e}`);
    process.exit(1);
  });
}
