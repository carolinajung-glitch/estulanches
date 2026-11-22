export const STATUS = ['PENDENTE', 'ACEITO', 'ENTREGUE', 'RECUSADO'];
const TRANSICOES = { PENDENTE: ['ACEITO', 'RECUSADO'], ACEITO: ['ENTREGUE', 'RECUSADO'], ENTREGUE: [], RECUSADO: [] };

export const transicaoValida = (de, para) => (TRANSICOES[de] || []).includes(para);

export const calcularTotal = (linhas) =>
  Math.round(linhas.reduce((s, l) => s + l.preco * l.qtd, 0) * 100) / 100;

export function validarPedido(p) {
  if (!p || typeof p !== 'object') return 'Pedido inválido';
  if (typeof p.aluno !== 'string' || p.aluno.trim().length < 2 || p.aluno.length > 80) return 'Informe o nome do aluno';
  if (typeof p.turma !== 'string' || !p.turma.trim() || p.turma.length > 20) return 'Informe a turma';
  if (!Array.isArray(p.itens) || p.itens.length === 0 || p.itens.length > 20) return 'Adicione ao menos um item';
  const vistos = new Set();
  for (const i of p.itens) {
    if (!Number.isInteger(i.id) || !Number.isInteger(i.qtd) || i.qtd < 1 || i.qtd > 10) return 'Item ou quantidade inválida';
    if (vistos.has(i.id)) return 'Item repetido no pedido';
    vistos.add(i.id);
  }
  return null;
}
