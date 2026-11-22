import express from 'express';
import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCHEMA } from './schema.js';
import { calcularTotal, validarPedido, transicaoValida } from './regras.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10 });
const PIN = process.env.ADMIN_PIN || '2026';
const app = express();

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-ancestors 'none'",
  });
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(dir, '../public')));

const admin = (req, res, next) =>
  req.get('x-admin-pin') === PIN ? next() : res.status(401).json({ erro: 'PIN inválido' });
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => { console.error(e); res.status(500).json({ erro: 'Erro interno' }); });

const PEDIDOS_SQL = `
  SELECT p.id, p.aluno, p.turma, p.total::float AS total, p.status, p.criado_em,
         COALESCE(json_agg(json_build_object('nome', i.nome, 'qtd', i.qtd) ORDER BY i.id)
                  FILTER (WHERE i.id IS NOT NULL), '[]') AS itens
  FROM pedidos p LEFT JOIN pedido_itens i ON i.pedido_id = p.id`;

app.get('/health', wrap(async (_q, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', versao: process.env.APP_VERSION || '1.0.0' });
}));

app.get('/api/itens', wrap(async (_q, res) => {
  const r = await pool.query('SELECT id, nome, categoria, emoji, preco::float AS preco, estoque FROM itens ORDER BY id');
  res.json(r.rows);
}));

app.post('/api/pedidos', wrap(async (req, res) => {
  const erro = validarPedido(req.body);
  if (erro) return res.status(400).json({ erro });
  const { aluno, turma, itens } = req.body;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const linhas = [];
    for (const it of [...itens].sort((a, b) => a.id - b.id)) {
      const r = await c.query(
        'UPDATE itens SET estoque = estoque - $2 WHERE id = $1 AND estoque >= $2 RETURNING id, nome, preco::float AS preco',
        [it.id, it.qtd]);
      if (!r.rowCount) { await c.query('ROLLBACK'); return res.status(409).json({ erro: 'Estoque insuficiente ou item inexistente' }); }
      linhas.push({ ...r.rows[0], qtd: it.qtd });
    }
    const total = calcularTotal(linhas);
    const p = await c.query('INSERT INTO pedidos (aluno, turma, total) VALUES ($1, $2, $3) RETURNING id, status, criado_em',
      [aluno.trim(), turma.trim(), total]);
    for (const l of linhas)
      await c.query('INSERT INTO pedido_itens (pedido_id, item_id, nome, preco, qtd) VALUES ($1, $2, $3, $4, $5)',
        [p.rows[0].id, l.id, l.nome, l.preco, l.qtd]);
    await c.query('COMMIT');
    res.status(201).json({ ...p.rows[0], total });
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}));

app.get('/api/pedidos/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ erro: 'Código inválido' });
  const r = await pool.query(`${PEDIDOS_SQL} WHERE p.id = $1 GROUP BY p.id`, [id]);
  if (!r.rowCount) return res.status(404).json({ erro: 'Pedido não encontrado' });
  const { aluno, turma, ...publico } = r.rows[0];
  res.json(publico);
}));

app.post('/api/admin/login', admin, (_q, res) => res.json({ ok: true }));

app.get('/api/admin/pedidos', admin, wrap(async (_q, res) => {
  const r = await pool.query(`${PEDIDOS_SQL} GROUP BY p.id ORDER BY p.id DESC LIMIT 200`);
  res.json(r.rows);
}));

app.patch('/api/admin/pedidos/:id/status', admin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const novo = req.body?.status;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await c.query('SELECT status FROM pedidos WHERE id = $1 FOR UPDATE', [id]);
    if (!r.rowCount) { await c.query('ROLLBACK'); return res.status(404).json({ erro: 'Pedido não encontrado' }); }
    if (!transicaoValida(r.rows[0].status, novo)) {
      await c.query('ROLLBACK');
      return res.status(409).json({ erro: `Não é possível mudar de ${r.rows[0].status} para ${novo}` });
    }
    await c.query('UPDATE pedidos SET status = $2 WHERE id = $1', [id, novo]);
    if (novo === 'RECUSADO')
      await c.query('UPDATE itens i SET estoque = i.estoque + pi.qtd FROM pedido_itens pi WHERE pi.pedido_id = $1 AND pi.item_id = i.id', [id]);
    await c.query('COMMIT');
    res.json({ id, status: novo });
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}));

app.post('/api/admin/itens/:id/estoque', admin, wrap(async (req, res) => {
  const qtd = Number(req.body?.qtd);
  if (!Number.isInteger(qtd) || qtd < 1 || qtd > 500) return res.status(400).json({ erro: 'Quantidade inválida' });
  const r = await pool.query('UPDATE itens SET estoque = estoque + $2 WHERE id = $1 RETURNING id, estoque', [Number(req.params.id), qtd]);
  r.rowCount ? res.json(r.rows[0]) : res.status(404).json({ erro: 'Item não encontrado' });
}));

async function iniciar() {
  for (let i = 1; i <= 10; i++) {
    try { await pool.query(SCHEMA); break; }
    catch (e) {
      console.error(`Banco indisponível (tentativa ${i}/10): ${e.message}`);
      if (i === 10) throw e;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  app.listen(3000, () => console.log('EstuLanches no ar na porta 3000'));
}
iniciar().catch((e) => { console.error('Falha ao iniciar:', e); process.exit(1); });
