/**
 * Correção do whatsapp-web.js 1.34.7 para o WhatsApp Web atual (2.3000.1047xxx em diante):
 * ao enviar mídia, o campo interno "__x_id" do objeto de mídia sobrescrevia o id da mensagem e o
 * WhatsApp respondia "Data passed to getter must include an id property (it's how we memoize)".
 * É a mesma correção proposta no projeto (issue #201922 / PR #201923), que ainda não saiu numa versão
 * do npm: apagar message.__x_id logo depois de montar a mensagem.
 *
 * Aplicada no arquivo do pacote antes de ele ser carregado; não faz nada se já estiver corrigido.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ANCORA = '...(mediaOptions.toJSON ? mediaOptions.toJSON() : {}),';
const LINHAS = [
  '',
  '        // [ml-afiliados] o id interno da mídia não pode sobrescrever o id da mensagem (wwebjs #201922)',
  '        delete message.__x_id;',
];

/** Devolve o código corrigido e o que aconteceu: 'ja-corrigido' | 'aplicado' | 'nao-encontrado'. */
export function corrigirFonte(fonte) {
  if (/delete\s+message\.__x_id/.test(fonte)) return { fonte, estado: 'ja-corrigido' };
  const i = fonte.indexOf(ANCORA);
  if (i < 0) return { fonte, estado: 'nao-encontrado' };
  const fim = fonte.indexOf('\n        };', i); // fecha o "const message = { ... };"
  if (fim < 0) return { fonte, estado: 'nao-encontrado' };
  const corte = fim + '\n        };'.length;
  const eol = fonte.includes('\r\n') ? '\r\n' : '\n';
  return { fonte: fonte.slice(0, corte) + LINHAS.join(eol) + fonte.slice(corte), estado: 'aplicado' };
}

export function localizarUtils() {
  const require = createRequire(import.meta.url);
  return path.join(path.dirname(require.resolve('whatsapp-web.js/package.json')), 'src', 'util', 'Injected', 'Utils.js');
}

export function garantirPatchWwebjs(arquivo = localizarUtils()) {
  try {
    const { fonte, estado } = corrigirFonte(fs.readFileSync(arquivo, 'utf8'));
    if (estado === 'aplicado') fs.writeFileSync(arquivo, fonte, 'utf8');
    return estado;
  } catch (e) {
    return `erro: ${e.message}`;
  }
}
