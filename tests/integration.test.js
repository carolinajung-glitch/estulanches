import test from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PIN = process.env.ADMIN_PIN || '2026';
const req = (p, o = {}) => fetch(BASE + p, { ...o, headers: { 'Content-Type': 'application/json', ...o.headers } });
const adm = { 'x-admin-pin': PIN };

test('GET /health responde ok com o banco conectado', async () => {
  const r = await req('/health');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, 'ok');
});
test('cardápio tem exatamente os 7 itens', async () => {
  const itens = await (await req('/api/itens')).json();
  assert.deepEqual(itens.map((i) => i.nome),
    ['Pão de queijo', 'Doguinho', 'Bauru', 'Pastel', 'Suco de laranja', 'Suco de maçã', 'Iogurte']);
});
test('rotas da cozinha exigem PIN', async () => {
  assert.equal((await req('/api/admin/pedidos')).status, 401);
  assert.equal((await req('/api/admin/pedidos', { headers: adm })).status, 200);
});
test('pedido inválido retorna 400', async () => {
  const r = await req('/api/pedidos', { method: 'POST', body: JSON.stringify({ aluno: '', turma: '', itens: [] }) });
  assert.equal(r.status, 400);
});
test('pedido baixa estoque e recusar devolve estoque', async () => {
  const antes = (await (await req('/api/itens')).json())[0].estoque;
  const r = await req('/api/pedidos', { method: 'POST', body: JSON.stringify({ aluno: 'Teste Integração', turma: 'TST', itens: [{ id: 1, qtd: 2 }] }) });
  assert.equal(r.status, 201);
  const ped = await r.json();
  assert.equal(ped.status, 'PENDENTE');
  assert.equal((await (await req('/api/itens')).json())[0].estoque, antes - 2);
  const rec = await req(`/api/admin/pedidos/${ped.id}/status`, { method: 'PATCH', headers: adm, body: JSON.stringify({ status: 'RECUSADO' }) });
  assert.equal(rec.status, 200);
  assert.equal((await (await req('/api/itens')).json())[0].estoque, antes);
});
test('pular etapa de status retorna 409', async () => {
  const ped = await (await req('/api/pedidos', { method: 'POST', body: JSON.stringify({ aluno: 'Teste Fluxo', turma: 'TST', itens: [{ id: 7, qtd: 1 }] }) })).json();
  const r = await req(`/api/admin/pedidos/${ped.id}/status`, { method: 'PATCH', headers: adm, body: JSON.stringify({ status: 'ENTREGUE' }) });
  assert.equal(r.status, 409);
});
