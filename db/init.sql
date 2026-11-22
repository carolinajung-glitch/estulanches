CREATE TABLE IF NOT EXISTS itens (
  id        SERIAL PRIMARY KEY,
  nome      TEXT NOT NULL UNIQUE,
  categoria TEXT NOT NULL,
  emoji     TEXT NOT NULL,
  preco     NUMERIC(8,2) NOT NULL CHECK (preco > 0),
  estoque   INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0)
);
CREATE TABLE IF NOT EXISTS pedidos (
  id        SERIAL PRIMARY KEY,
  aluno     TEXT NOT NULL,
  turma     TEXT NOT NULL,
  total     NUMERIC(8,2) NOT NULL,
  status    TEXT NOT NULL DEFAULT 'PENDENTE'
            CHECK (status IN ('PENDENTE','ACEITO','ENTREGUE','RECUSADO')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS pedido_itens (
  id        SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  item_id   INTEGER NOT NULL REFERENCES itens(id),
  nome      TEXT NOT NULL,
  preco     NUMERIC(8,2) NOT NULL,
  qtd       INTEGER NOT NULL CHECK (qtd > 0)
);
INSERT INTO itens (nome, categoria, emoji, preco, estoque) VALUES
  ('Pão de queijo',   'Salgado', '🧀', 4.50, 30),
  ('Doguinho',        'Salgado', '🌭', 6.00, 30),
  ('Bauru',           'Salgado', '🥪', 9.00, 30),
  ('Pastel',          'Salgado', '🥟', 7.50, 30),
  ('Suco de laranja', 'Bebida',  '🍊', 5.50, 30),
  ('Suco de maçã',    'Bebida',  '🍎', 5.50, 30),
  ('Iogurte',         'Bebida',  '🥛', 4.00, 30)
ON CONFLICT (nome) DO NOTHING;
