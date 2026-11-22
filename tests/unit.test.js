import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularTotal, validarPedido, transicaoValida } from '../src/regras.js';

const ok = { aluno: 'Maria', turma: '2A', itens: [{ id: 1, qtd: 2 }] };

test('total do carrinho soma preço x quantidade com 2 casas', () => {
  assert.equal(calcularTotal([{ preco: 4.5, qtd: 2 }, { preco: 5.5, qtd: 1 }]), 14.5);
  assert.equal(calcularTotal([{ preco: 0.1, qtd: 3 }]), 0.3);
});
test('pedido válido passa na validação', () => assert.equal(validarPedido(ok), null));
test('rejeita aluno vazio, turma vazia e carrinho vazio', () => {
  assert.ok(validarPedido({ ...ok, aluno: ' ' }));
  assert.ok(validarPedido({ ...ok, turma: '' }));
  assert.ok(validarPedido({ ...ok, itens: [] }));
});
test('rejeita quantidade inválida e item repetido', () => {
  assert.ok(validarPedido({ ...ok, itens: [{ id: 1, qtd: 0 }] }));
  assert.ok(validarPedido({ ...ok, itens: [{ id: 1, qtd: 11 }] }));
  assert.ok(validarPedido({ ...ok, itens: [{ id: 1, qtd: 1 }, { id: 1, qtd: 1 }] }));
});
test('transições de status permitidas e proibidas', () => {
  assert.ok(transicaoValida('PENDENTE', 'ACEITO'));
  assert.ok(transicaoValida('ACEITO', 'ENTREGUE'));
  assert.ok(transicaoValida('ACEITO', 'RECUSADO'));
  assert.ok(!transicaoValida('ENTREGUE', 'RECUSADO'));
  assert.ok(!transicaoValida('PENDENTE', 'ENTREGUE'));
});
