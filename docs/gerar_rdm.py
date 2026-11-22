from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, white

W, H = A4
NAVY, BLUE, SUN, PAPER, LINE = HexColor('#3E3E3E'), HexColor('#EA1D2C'), HexColor('#EA1D2C'), HexColor('#F7F7F7'), HexColor('#E6E6E6')
c = canvas.Canvas('Ficha_RDM_EstuLanches.pdf', pagesize=A4)
c.setTitle('RDM - EstuLanches v1.0.0'); c.setAuthor('Carolina')

# faixa lateral
c.setFillColor(NAVY); c.rect(0, 0, 58, H, fill=1, stroke=0)
c.saveState(); c.translate(38, 40); c.rotate(90)
c.setFillColor(SUN); c.setFont('Helvetica-Bold', 30); c.drawString(0, 0, 'RDM')
c.setFillColor(white); c.setFont('Helvetica', 10); c.drawString(92, 2, 'Registro de Mudança  |  EstuLanches')
c.restoreState()

X0, X1 = 82, W - 34
def rotulo(x, y, t):
    c.setFillColor(BLUE); c.setFont('Helvetica-Bold', 8.5); c.drawString(x, y, t)
def campo(x, y, w, titulo, valor='', h=26):
    c.setFillColor(PAPER); c.setStrokeColor(NAVY); c.setLineWidth(1.2); c.rect(x, y - h, w, h, fill=1, stroke=1)
    rotulo(x + 6, y - 10, titulo)
    c.setFillColor(NAVY); c.setFont('Helvetica', 10); c.drawString(x + 6, y - h + 5, valor)
def caixa(x, y, marcado=False):
    c.setStrokeColor(NAVY); c.setLineWidth(1.2); c.setFillColor(white); c.rect(x, y, 9, 9, fill=1, stroke=1)
def titulo(y, t):
    c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 12); c.drawString(X0, y, t)
    c.setStrokeColor(SUN); c.setLineWidth(3); c.line(X0, y - 4, X0 + c.stringWidth(t, 'Helvetica-Bold', 12), y - 4)

# cabeçalho
c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 22); c.drawString(X0, H - 54, 'Ficha Simplificada de Registro de Mudança')
c.setFont('Helvetica', 10.5); c.drawString(X0, H - 70, 'Implantação em produção do sistema de cardápio e pedidos da cantina escolar')

# identificação
y = H - 92; mid = (X1 - X0 - 8) / 2
campo(X0, y, mid, 'SISTEMA', 'EstuLanches'); campo(X0 + mid + 8, y, mid, 'VERSÃO IMPLANTADA', 'v1.0.0')
y -= 34
campo(X0, y, mid, 'DATA DA IMPLANTAÇÃO', ''); campo(X0 + mid + 8, y, mid, 'HORÁRIO (INÍCIO - FIM)', '')
y -= 34
campo(X0, y, mid, 'RESPONSÁVEL', 'Carolina'); campo(X0 + mid + 8, y, mid, 'AMBIENTE', 'Produção (Docker Compose)')
y -= 34
campo(X0, y, X1 - X0, 'REPOSITÓRIO', 'https://github.com/carolinajung-glitch/estulanches.git')

# parâmetros alterados
y -= 46; titulo(y, 'Parâmetros alterados')
y -= 12
cols = [X0, X0 + 135, X0 + 245]
c.setFillColor(NAVY); c.rect(X0, y - 16, X1 - X0, 16, fill=1, stroke=0)
c.setFillColor(white); c.setFont('Helvetica-Bold', 8.5)
for x, t in zip(cols, ['PARÂMETRO', 'VALOR ANTERIOR', 'VALOR IMPLANTADO']): c.drawString(x + 6, y - 11, t)
linhas = [
  ('Porta do PostgreSQL (compose)', '5432 (aberta à rede)', '127.0.0.1:5433 (só local)'),
  ('Cardápio inicial (db/init.sql)', 'itens anteriores', '7 itens (salgados e bebidas)'),
  ('Interface web (public/)', 'tema anterior', 'novo tema; abas Aluno e Cozinha'),
  ('Variáveis do .env', '-', 'POSTGRES_*, DATABASE_URL, ADMIN_PIN'),
  ('Cabeçalhos de segurança (API)', 'padrão do Express', 'CSP, nosniff, X-Frame-Options'),
]
y -= 16
for i, (a, b, d) in enumerate(linhas):
    c.setFillColor(PAPER if i % 2 == 0 else white); c.rect(X0, y - 20, X1 - X0, 20, fill=1, stroke=0)
    c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 8.5); c.drawString(cols[0] + 6, y - 13, a)
    c.setFont('Helvetica', 8.2); c.drawString(cols[1] + 6, y - 13, b)
    c.drawString(cols[2] + 6, y - 13, d); y -= 20
c.setStrokeColor(NAVY); c.setLineWidth(1.2); c.rect(X0, y, X1 - X0, 16 + 20 * len(linhas), fill=0, stroke=1)

# validação
y -= 30; titulo(y, 'Resultado dos testes de validação')
y -= 14
testes = [
  ('docker compose ps: app e db Up / healthy', ''),
  ('docker compose logs db e app: sem erros críticos', ''),
  ('npm run test:unit (regras de total, carrinho e status)', 'ok:__  falhas:__'),
  ('npm run test:integration (HTTP, PIN da cozinha, estoque)', 'ok:__  falhas:__'),
  ('Fluxo manual: pedido do aluno aparece na cozinha', ''),
]
for t, extra in testes:
    c.setFillColor(NAVY); c.setFont('Helvetica', 9.5); c.drawString(X0, y, t)
    caixa(X1 - 175, y - 1); c.setFillColor(NAVY); c.setFont('Helvetica', 8.5); c.drawString(X1 - 162, y, 'Aprovado')
    caixa(X1 - 100, y - 1); c.setFillColor(NAVY); c.drawString(X1 - 87, y, 'Reprovado')
    if extra: c.setFont('Helvetica', 7.5); c.drawString(X1 - 175, y - 11, extra)
    y -= 30

# status final
y -= 6; titulo(y, 'Status final da implantação')
y -= 20
for i, t in enumerate(['Concluída com sucesso', 'Concluída com ressalvas', 'Revertida (rollback)']):
    x = X0 + i * 165; caixa(x, y); c.setFillColor(NAVY); c.setFont('Helvetica-Bold', 10); c.drawString(x + 14, y + 1, t)

# observações
y -= 36; rotulo(X0, y, 'OBSERVAÇÕES')
c.setStrokeColor(LINE); c.setLineWidth(1)
for k in range(5):
    c.line(X0, y - 20 - k * 22, X1, y - 20 - k * 22)

# assinaturas
y = 62
for i, n in enumerate(['Carolina']):
    x = X0 + i * ((X1 - X0) / 3); c.setStrokeColor(NAVY); c.setLineWidth(1); c.line(x, y, x + 125, y)
    c.setFillColor(NAVY); c.setFont('Helvetica', 9); c.drawString(x, y - 12, n)
c.setFont('Helvetica', 7.5); c.drawString(X0, 30, 'Gerado com docs/gerar_rdm.py - preencher data, horário e resultados após executar os testes.')
c.save()
