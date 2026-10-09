import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Avisos, montarResumo } from '../src/avisos.js';
import { Store } from '../src/store.js';
import { diaLocal } from '../src/util.js';

const novoStore = () => new Store(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'avisos-')), 'db.json'));

function senderFalso({ grupos = [], numero = null, falhar = false } = {}) {
  return {
    enviados: [],
    async listGroups() {
      return grupos;
    },
    async jidDoNumero(n) {
      return numero ? `${n}@lid` : null;
    },
    async sendText(jid, texto) {
      if (falhar) throw new Error('sem conexão');
      this.enviados.push({ jid, texto });
    },
  };
}

test('Avisos: acha o grupo de avisos pelo nome (sem diferenciar maiúsculas)', async () => {
  const sender = senderFalso({ grupos: [{ nome: 'Ofertas', jid: '1@g.us' }, { nome: 'Avisos do Bot', jid: '2@g.us' }] });
  const a = new Avisos({ sender, destino: 'avisos do bot' });
  assert.equal(await a.iniciar(), '2@g.us');
  assert.equal(await a.avisar('x', 'teste'), true);
  assert.deepEqual(sender.enviados, [{ jid: '2@g.us', texto: '🤖 teste' }]);
});

test('Avisos: número de telefone vira JID; grupo inexistente ou vazio = só log', async () => {
  const comNumero = new Avisos({ sender: senderFalso({ numero: true }), destino: '+55 (79) 99999-8888' });
  assert.equal(await comNumero.iniciar(), '5579999998888@lid');
  const semRetorno = new Avisos({ sender: senderFalso(), destino: '5579999998888' });
  assert.equal(await semRetorno.iniciar(), '5579999998888@c.us');
  const sender = senderFalso({ grupos: [{ nome: 'Ofertas', jid: '1@g.us' }] });
  const inexistente = new Avisos({ sender, destino: 'Avisos do bot' });
  assert.equal(await inexistente.iniciar(), null);
  assert.equal(await inexistente.avisar('x', 'oi'), false);
  assert.equal(sender.enviados.length, 0);
  assert.equal(await new Avisos({ sender, destino: '' }).iniciar(), null);
});

test('Avisos: o mesmo tipo de alerta não se repete dentro do intervalo; falha de envio não derruba', async () => {
  let agora = 0;
  const sender = senderFalso();
  const a = new Avisos({ sender, destino: '9@g.us', intervaloHoras: 3, agora: () => agora });
  await a.iniciar();
  await a.filaVazia('Fitness');
  agora += 3_600_000; // +1h
  await a.filaVazia('Fitness');
  await a.coletaVazia(); // outro tipo sai normalmente
  agora += 3 * 3_600_000; // +3h
  await a.filaVazia('Fitness');
  assert.equal(sender.enviados.length, 3);
  assert.match(sender.enviados[0].texto, /Acabaram as ofertas do grupo Fitness/);

  const quebrado = new Avisos({ sender: senderFalso({ falhar: true }), destino: '9@g.us' });
  await quebrado.iniciar();
  assert.equal(await quebrado.avisar('y', 'oi'), false);
});

test('Avisos: sessão do ML expirada gera o alerta com o passo a passo', async () => {
  const sender = senderFalso();
  const a = new Avisos({ sender, destino: '9@g.us' });
  await a.iniciar();
  await a.erroTarefa('coleta', new Error('Sessão do Mercado Livre expirada (HTTP 401). Faça login de novo.'));
  await a.erroTarefa('envio', new Error('Protocol error\nstack...'));
  assert.match(sender.enviados[0].texto, /Sessão do Mercado Livre expirou/);
  assert.match(sender.enviados[0].texto, /cookies\.txt/);
  assert.equal(sender.enviados[1].texto, '🤖 *Erro na envio* ❌\nProtocol error');
});

test('Store.registrarColeta soma as coletas do dia e guarda só 14 dias', () => {
  const s = novoStore();
  s.registrarColeta({ encontrados: 100, novos: 5, recusas: { 'fora do nicho': 80 }, categorias: { Saúde: { encontrados: 60, aceitos: 4 } } }, '2026-10-08');
  s.registrarColeta({ encontrados: 50, novos: 2, recusas: { 'fora do nicho': 30, 'desconto baixo': 5 }, categorias: { Saúde: { encontrados: 50, aceitos: 2 } } }, '2026-10-08');
  assert.deepEqual(s.statsDoDia('2026-10-08'), {
    coletas: 2,
    encontrados: 150,
    novos: 7,
    recusas: { 'fora do nicho': 110, 'desconto baixo': 5 },
    categorias: { Saúde: { encontrados: 110, aceitos: 6 } },
  });
  for (let d = 1; d <= 20; d++) s.registrarColeta({}, `2026-09-${String(d).padStart(2, '0')}`);
  assert.equal(Object.keys(s.data.stats).length, 14);
  assert.ok(s.statsDoDia('2026-10-08'), 'o dia mais recente fica');
});

test('montarResumo: postadas por categoria, maior desconto, buscas e recusas', () => {
  const s = novoStore();
  const dia = diaLocal();
  const agoraIso = new Date().toISOString();
  const base = { grupo: 'Fitness', url: 'u', linkAfiliado: 'https://meli.la/x', precoAtual: 100 };
  s.data.produtos = {
    'Fitness:1': { ...base, id: '1', nome: 'Creatina 300g', categoria: 'Saúde (suplementos)', descontoPct: 40, status: 'ENVIADO', enviadoEm: agoraIso },
    'Fitness:2': { ...base, id: '2', nome: 'Whey 900g', categoria: 'Saúde (suplementos)', descontoPct: 20, status: 'ENVIADO', enviadoEm: agoraIso, semImagem: true },
    'Fitness:3': { ...base, id: '3', nome: 'Legging', categoria: 'Calçados, Roupas e Bolsas', descontoPct: 30, status: 'ENVIADO', enviadoEm: agoraIso },
    'Fitness:4': { ...base, id: '4', nome: 'Top', categoria: 'Calçados, Roupas e Bolsas', descontoPct: 30, status: 'PRONTO' },
    'Fitness:5': { ...base, id: '5', nome: 'Tênis', categoria: 'Calçados, Roupas e Bolsas', descontoPct: 30, status: 'ERRO', erro: 'x' },
    'Geral:6': { ...base, grupo: 'Geral', id: '6', nome: 'Nobreak', status: 'PRONTO' },
  };
  s.registrarColeta({ encontrados: 300, novos: 12, recusas: { 'fora do nicho': 250, 'desconto baixo': 38 }, categorias: { 'Saúde (suplementos)': { encontrados: 100, aceitos: 8 } } }, dia);
  const txt = montarResumo(s, { dia, grupos: [{ nome: 'Fitness', ativo: true }, { nome: 'Geral', ativo: false }] });
  assert.match(txt, /Ofertas postadas: \*3\*/);
  assert.match(txt, /• Saúde \(suplementos\): 2/);
  assert.match(txt, /• Calçados, Roupas e Bolsas: 1/);
  assert.match(txt, /Foram sem imagem: 1/);
  assert.match(txt, /Falharam no envio: 1/);
  assert.match(txt, /Maior desconto: Creatina 300g — R\$\s?100(,00)? \(40% OFF\)/);
  assert.match(txt, /Buscas no ML: 1 — 300 produtos vistos, 12 aprovados/);
  assert.match(txt, /Recusados: fora do nicho 250, desconto baixo 38/);
  assert.match(txt, /Sobraram na fila: 1 /); // só o PRONTO do grupo ativo

  const vazio = montarResumo(novoStore(), { dia, grupos: [] });
  assert.match(vazio, /Ofertas postadas: \*0\*/);
  assert.match(vazio, /Nenhuma busca no ML registrada hoje/);
});
