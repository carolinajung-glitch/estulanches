const $ = (s) => document.querySelector(s);
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  e.append(...kids.flat().filter((x) => x != null));
  return e;
};
const brl = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

let pin = sessionStorage.getItem('pin') || '';
let itens = [];
const carrinho = new Map();
const refs = new Map();
let meus = JSON.parse(localStorage.getItem('meus') || '[]');
let temporizador;

async function api(url, opt = {}) {
  const r = await fetch(url, {
    ...opt,
    headers: { 'Content-Type': 'application/json', ...(pin ? { 'x-admin-pin': pin } : {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Algo deu errado. Tente de novo.');
  return d;
}
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(() => t.classList.remove('on'), 3000);
}

/* ---------- abas ---------- */
function abrir(qual) {
  for (const [id, painel] of [['aluno', '#aluno'], ['cozinha', '#cozinha']]) {
    $(`#aba-${id}`).setAttribute('aria-selected', String(id === qual));
    $(painel).hidden = id !== qual;
  }
  clearInterval(temporizador);
  if (qual === 'aluno') { temporizador = setInterval(() => { carregarItens().catch(() => {}); atualizarMeus(); }, 5000); }
  else if (pin) { temporizador = setInterval(carregarCozinha, 5000); carregarCozinha(); }
}
$('#aba-aluno').onclick = () => abrir('aluno');
$('#aba-cozinha').onclick = () => abrir('cozinha');

/* ---------- aluno ---------- */
async function carregarItens() {
  itens = await api('/api/itens');
  if (!refs.size) montarMenu();
  sincronizar();
}
const IMG = { 'Pão de queijo': 'pao-de-queijo', 'Doguinho': 'doguinho', 'Bauru': 'bauru', 'Pastel': 'pastel',
  'Suco de laranja': 'suco-de-laranja', 'Suco de maçã': 'suco-de-maca', 'Iogurte': 'iogurte' };
function fotoDe(it) {
  const f = h('div', { class: 'foto' });
  if (!IMG[it.nome]) { f.textContent = it.emoji; return f; }
  const img = h('img', { src: `img/${IMG[it.nome]}.jpg`, alt: it.nome, loading: 'lazy' });
  img.addEventListener('error', () => { img.remove(); f.textContent = it.emoji; });
  f.append(img);
  return f;
}
function montarMenu() {
  const menu = $('#menu');
  menu.replaceChildren();
  const grupos = new Map();
  for (const it of itens) grupos.set(it.categoria, [...(grupos.get(it.categoria) || []), it]);
  for (const [cat, lista] of grupos) {
    const linhas = h('ul', { class: 'grupo-itens' });
    for (const it of lista) {
      const qtd = h('output', {}, '0');
      const menos = h('button', { type: 'button', 'aria-label': `Tirar ${it.nome}`, onclick: () => mudar(it.id, -1) }, '−');
      const mais = h('button', { type: 'button', 'aria-label': `Adicionar ${it.nome}`, onclick: () => mudar(it.id, 1) }, '+');
      const resta = h('span', { class: 'resta' });
      const card = h('li', { class: 'prato' },
        fotoDe(it),
        h('div', { class: 'info' }, h('strong', {}, it.nome), resta),
        h('span', { class: 'preco' }, h('i', {}, 'R$'), h('b', {}, it.preco.toFixed(2).replace('.', ','))),
        h('div', { class: 'passo' }, menos, qtd, mais));
      refs.set(it.id, { card, qtd, menos, mais, resta });
      linhas.append(card);
    }
    menu.append(h('section', { class: 'grupo' },
      h('h3', {}, cat === 'Salgado' ? 'Salgados' : 'Bebidas'),
      h('p', { class: 'sub' }, `Contém ${lista.length} itens`), linhas));
  }
}
function mudar(id, d) {
  const it = itens.find((x) => x.id === id);
  const novo = Math.max(0, Math.min(10, it.estoque, (carrinho.get(id) || 0) + d));
  novo ? carrinho.set(id, novo) : carrinho.delete(id);
  sincronizar();
}
function sincronizar() {
  for (const it of itens) {
    const r = refs.get(it.id);
    if (!r) continue;
    if ((carrinho.get(it.id) || 0) > it.estoque) carrinho.set(it.id, it.estoque);
    if (!carrinho.get(it.id)) carrinho.delete(it.id);
    const q = carrinho.get(it.id) || 0;
    r.qtd.textContent = q;
    r.menos.disabled = q === 0;
    r.mais.disabled = q >= Math.min(10, it.estoque);
    r.card.classList.toggle('esgotado', it.estoque === 0);
    r.resta.textContent = it.estoque === 0 ? 'Esgotado' : it.estoque <= 5 ? `Só ${it.estoque} restantes` : '';
  }
  const linhas = $('#linhas');
  linhas.replaceChildren();
  let total = 0;
  for (const [id, q] of carrinho) {
    const it = itens.find((x) => x.id === id);
    total += it.preco * q;
    linhas.append(h('li', {}, h('span', {}, `${q}× ${it.nome}`), h('span', {}, brl(it.preco * q))));
  }
  if (!carrinho.size) linhas.append(h('li', { class: 'vazio' }, 'Escolha um lanche ao lado.'));
  $('#total').textContent = brl(total);
  $('#confirmar').disabled = !carrinho.size;
}
$('#comanda').onsubmit = async (e) => {
  e.preventDefault();
  $('#aviso').textContent = '';
  try {
    const p = await api('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({
        aluno: $('#aluno-nome').value, turma: $('#aluno-turma').value,
        itens: [...carrinho].map(([id, qtd]) => ({ id, qtd })),
      }),
    });
    meus = [p.id, ...meus].slice(0, 8);
    localStorage.setItem('meus', JSON.stringify(meus));
    carrinho.clear();
    toast(`Pedido #${p.id} enviado para a cozinha!`);
    await carregarItens();
    atualizarMeus();
  } catch (err) { $('#aviso').textContent = err.message; carregarItens(); }
};
async function atualizarMeus() {
  const lista = $('#meus');
  const dados = (await Promise.all(meus.map((id) => api(`/api/pedidos/${id}`).catch(() => null)))).filter(Boolean);
  lista.replaceChildren(...(dados.length ? dados.map((p) =>
    h('li', {}, h('div', { class: 'meu-topo' }, h('span', {}, `Pedido #${p.id}`), h('span', { class: `chip ${p.status}` }, p.status)),
      h('p', { class: 'meu-itens' }, p.itens.map((i) => `${i.qtd}× ${i.nome}`).join(', ') + ` – ${brl(p.total)}`)))
    : [h('li', { class: 'vazio-col' }, 'Seus pedidos aparecem aqui.')]));
}

/* ---------- cozinha ---------- */
$('#porta').onsubmit = async (e) => {
  e.preventDefault();
  pin = $('#pin').value;
  try {
    await api('/api/admin/login', { method: 'POST' });
    sessionStorage.setItem('pin', pin);
    entrarCozinha();
  } catch (err) { pin = ''; $('#porta-erro').textContent = 'PIN incorreto. Confira com a coordenação.'; }
};
function entrarCozinha() {
  $('#porta').hidden = true; $('#painel').hidden = false;
  clearInterval(temporizador); temporizador = setInterval(carregarCozinha, 5000);
  carregarCozinha();
}
$('#sair').onclick = () => {
  pin = ''; sessionStorage.removeItem('pin'); clearInterval(temporizador);
  $('#pin').value = ''; $('#porta').hidden = false; $('#painel').hidden = true;
};
const COLUNAS = [['PENDENTE', 'Novos'], ['ACEITO', 'Na chapa'], ['ENTREGUE', 'Entregues'], ['RECUSADO', 'Recusados']];
const PROXIMO = { PENDENTE: ['ACEITO', 'Aceitar'], ACEITO: ['ENTREGUE', 'Entregar'] };
async function mover(id, status) {
  try { await api(`/api/admin/pedidos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); carregarCozinha(); }
  catch (err) { toast(err.message); }
}
async function carregarCozinha() {
  try {
    const [pedidos, estoque] = await Promise.all([api('/api/admin/pedidos'), api('/api/itens')]);
    $('#estoque').replaceChildren(...estoque.map((i) =>
      h('li', { class: i.estoque <= 5 ? 'baixo' : '' }, `${i.emoji} ${i.nome}: ${i.estoque}`,
        h('button', { onclick: async () => { await api(`/api/admin/itens/${i.id}/estoque`, { method: 'POST', body: JSON.stringify({ qtd: 10 }) }); carregarCozinha(); } }, '+10'))));
    $('#quadro').replaceChildren(...COLUNAS.map(([st, nome]) => {
      const doStatus = pedidos.filter((p) => p.status === st);
      return h('section', { class: 'coluna' }, h('h3', {}, nome, h('span', { class: `chip ${st}` }, String(doStatus.length))),
        h('ul', {}, doStatus.length ? doStatus.map((p) => h('li', { class: 'cartao' },
          h('div', { class: 'quem' }, `#${p.id} ${p.aluno}`), h('div', { class: 'turma' }, `Turma ${p.turma} – ${brl(p.total)}`),
          h('ul', {}, p.itens.map((i) => h('li', {}, `${i.qtd}× ${i.nome}`))),
          PROXIMO[st] ? h('div', { class: 'acoes' },
            h('button', { onclick: () => mover(p.id, PROXIMO[st][0]) }, PROXIMO[st][1]),
            h('button', { class: 'recusar', onclick: () => mover(p.id, 'RECUSADO') }, 'Recusar')) : null))
          : [h('li', { class: 'vazio-col' }, 'Nenhum pedido aqui.')]));
    }));
  } catch (err) { if (/PIN/.test(err.message)) $('#sair').click(); }
}

/* ---------- início ---------- */
function falhaCardapio(err) {
  if (refs.size) return;
  $('#menu').replaceChildren(h('section', { class: 'grupo' },
    h('h3', {}, 'Não foi possível carregar o cardápio'),
    h('p', { class: 'sub' }, `${err.message} Verifique o banco com "docker compose logs app".`),
    h('button', { class: 'btn-principal', onclick: () => carregarItens().catch(falhaCardapio) }, 'Tentar de novo')));
  sincronizar();
}
carregarItens().catch(falhaCardapio);
atualizarMeus();
if (pin) entrarCozinha();
abrir('aluno');
