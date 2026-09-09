const $ = s => document.querySelector(s);
const LS = 'recipes_access_v1';
let D, R, G, sel = new Set(), cat = null, guides = false, res = [], shown = 0, cur = -1;

const norm = s => s.toLowerCase().replace(/ё/g, 'е');
const ENDS = ['иями','ями','ами','ого','его','ому','ему','ыми','ими','ешь','ишь','ете','ите','ует','ают','яют','ов','ев','ей','ой','ый','ий','ая','яя','ое','ее','ые','ие','ах','ях','ом','ем','ам','ям','ть','ся','ы','и','а','я','у','ю','е','о','ь'];

function stem(w) {
  for (const e of ENDS) {
    if (w.length - e.length >= 3 && w.endsWith(e)) return w.slice(0, -e.length);
  }
  return w;
}
function hit(q, pool) {
  if (pool.has(q)) return true;
  const s = stem(q);
  for (const l of pool) {
    if (l.startsWith(q) && q.length >= 3) return true;
    if (s.length >= 4 && (l.startsWith(s) || (s.startsWith(l) && l.length >= 4))) return true;
  }
  return false;
}
function canonical(raw) {
  let s = (raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.startsWith('RCPT')) s = s.slice(4);
  if (s.length !== 12) return null;
  return 'RCPT-' + s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8, 12);
}
function hexToBytes(h) {
  const o = new Uint8Array(h.length / 2);
  for (let i = 0; i < o.length; i++) o[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return o;
}
async function shaBytes(buf) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
}
async function shaHex(text) {
  const h = await shaBytes(new TextEncoder().encode(text));
  return [...h].map(x => x.toString(16).padStart(2, '0')).join('');
}
function xorBytes(a, b) {
  const o = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] ^ b[i];
  return o;
}
async function keystream(key, nonce, n) {
  const out = new Uint8Array(n);
  let off = 0, i = 0;
  while (off < n) {
    const block = new Uint8Array(key.length + nonce.length + 4);
    block.set(key, 0);
    block.set(nonce, key.length);
    block[key.length + nonce.length] = (i >>> 24) & 255;
    block[key.length + nonce.length + 1] = (i >>> 16) & 255;
    block[key.length + nonce.length + 2] = (i >>> 8) & 255;
    block[key.length + nonce.length + 3] = i & 255;
    const h = await shaBytes(block);
    const take = Math.min(32, n - off);
    out.set(h.subarray(0, take), off);
    off += take;
    i++;
  }
  return out;
}
async function unwrapMaster(key, blob) {
  const [nh, ch] = blob.split(':');
  const wrapKey = await shaBytes(new TextEncoder().encode('wrap|' + key));
  const nonce = hexToBytes(nh), ct = hexToBytes(ch);
  return xorBytes(ct, await keystream(wrapKey, nonce, ct.length));
}
async function decryptData(master, bin) {
  const nonce = bin.subarray(0, 16), ct = bin.subarray(16);
  const pt = xorBytes(ct, await keystream(master, nonce, ct.length));
  return JSON.parse(new TextDecoder().decode(pt));
}

function search() {
  const q = norm($('#q').value).match(/[а-яa-z0-9]+/g) || [];
  const mt = +$('#time').value || null;
  const pool = guides ? G : R;
  const prods = sel.size ? sel : null;
  const out = [];
  for (const e of pool) {
    if (cat && e.c !== cat) continue;
    if (mt && !(e.t && e.t <= mt)) continue;
    let sc = 0, ok = true;
    for (const w of q) {
      if (w.length < 2) continue;
      if (hit(w, e.T)) sc += 30;
      else if (hit(w, e.I)) sc += 10;
      else if (hit(w, e.B)) sc += 2;
      else { ok = false; break; }
    }
    if (!ok) continue;
    if (prods) {
      let m = 0;
      for (const p of prods) if (e.P.has(p)) m++;
      if (!m) continue;
      e.m = m;
      sc += m * 100 + (m === prods.size ? 50 : 0);
    } else e.m = 0;
    out.push([sc, e]);
  }
  out.sort((a, b) => b[0] - a[0] || a[1].n.localeCompare(b[1].n, 'ru'));
  res = out.map(x => x[1]);
  const parts = [];
  if (guides) parts.push('Справочник');
  else if (cat) parts.push(cat);
  if (q.length) parts.push('поиск «' + $('#q').value.trim() + '»');
  if (prods) parts.push('продукты: ' + [...prods].map(k => D.plabel[k]).join(', '));
  $('#status').textContent = 'Найдено ' + res.length + (guides ? ' материалов' : ' рецептов') + (parts.length ? ' · ' + parts.join(' · ') : '');
  $('#grid').innerHTML = '';
  shown = 0;
  more();
}
function more() {
  const g = $('#grid');
  if (!res.length) g.innerHTML = '<div class="empty">Ничего не нашлось.<br>Попробуйте другое слово или уберите фильтры.</div>';
  const end = Math.min(res.length, shown + 30);
  for (let i = shown; i < end; i++) {
    const e = res[i], d = document.createElement('div');
    d.className = 'card';
    const s = [];
    if (e.t) s.push(e.t + ' мин');
    if (!cat) s.push(e.c);
    if (e.m) s.push('совпало ' + e.m + ' из ' + sel.size);
    d.innerHTML = '<img loading="lazy" src="data/' + e.th + '"><div class="t">' + e.n + '</div><div class="s">' + s.join(' · ') + '</div>';
    d.onclick = () => open(i);
    g.appendChild(d);
  }
  shown = end;
  $('#more').style.display = shown < res.length ? 'block' : 'none';
}
function open(i) {
  cur = i;
  const e = res[i];
  $('#vt').textContent = e.n;
  const inf = [];
  if (e.t) inf.push('Активное время: ' + e.t + ' мин');
  inf.push('Раздел: ' + e.c);
  inf.push('Файл: ' + e.f);
  $('#vi').textContent = inf.join(' · ');
  $('#pages').innerHTML = e.pg.map(p => '<img src="data/' + p + '">').join('');
  $('#pages').scrollTop = 0;
  $('#view').classList.add('open');
  history.pushState({ v: 1 }, '');
}
function close() { $('#view').classList.remove('open'); }
function setCat(c) {
  cat = c === 'Справочник' ? null : c;
  guides = c === 'Справочник';
  document.querySelectorAll('#cats button').forEach(b => b.classList.toggle('on', b.dataset.c === String(c)));
  search();
}
function boot(d) {
  D = d;
  for (const e of d.e) {
    e.T = new Set(e.T);
    e.I = new Set(e.I);
    e.B = new Set(e.B);
    e.P = new Set(e.P);
  }
  R = d.e.filter(e => e.k === 'r');
  G = d.e.filter(e => e.k === 'g');
  const cs = $('#cats'), mk = (c, l, n) => {
    const b = document.createElement('button');
    b.dataset.c = String(c);
    b.textContent = l + (n ? ' (' + n + ')' : '');
    b.onclick = () => setCat(c);
    cs.appendChild(b);
  };
  mk(null, 'Все рецепты', R.length);
  for (const c of d.cats) mk(c, c, d.cnt[c] || 0);
  mk('Справочник', 'Справочник', G.length);
  const fb = $('#fbody');
  D.plabel = {};
  for (const g of d.groups) {
    const ps = d.products.filter(p => p.group === g);
    if (!ps.length) continue;
    fb.insertAdjacentHTML('beforeend', '<h3>' + g + '</h3>');
    for (const p of ps) {
      D.plabel[p.key] = p.label;
      const l = document.createElement('label');
      l.innerHTML = '<input type="checkbox" value="' + p.key + '"> ' + p.label + ' <span style="color:#999">(' + p.count + ')</span>';
      l.querySelector('input').onchange = ev => { ev.target.checked ? sel.add(p.key) : sel.delete(p.key); };
      fb.appendChild(l);
    }
  }
  $('#gate').style.display = 'none';
  $('#app').classList.add('ready');
  setCat(null);
}

async function unlock(raw) {
  const key = canonical(raw);
  if (!key) throw new Error('Ключ похож на RCPT-XXXX-XXXX-XXXX');
  const hashes = await fetch('keys.json').then(r => r.json());
  const h = await shaHex(key);
  const wrap = hashes[h];
  if (!wrap) throw new Error('Такого ключа нет. Проверьте буквы и цифры.');
  $('#gerr').textContent = 'Открываем рецепты…';
  const master = await unwrapMaster(key, wrap);
  const bin = new Uint8Array(await fetch('data.enc').then(r => r.arrayBuffer()));
  const data = await decryptData(master, bin);
  localStorage.setItem(LS, key);
  boot(data);
}

async function start() {
  const saved = localStorage.getItem(LS);
  if (saved) {
    try { await unlock(saved); return; } catch (e) { localStorage.removeItem(LS); }
  }
  $('#go').onclick = async () => {
    $('#gerr').textContent = '';
    $('#go').disabled = true;
    try { await unlock($('#key').value); }
    catch (e) { $('#gerr').textContent = e.message || 'Не удалось войти'; }
    $('#go').disabled = false;
  };
  $('#key').onkeydown = ev => { if (ev.key === 'Enter') $('#go').click(); };
}

let tm;
$('#q').oninput = () => { clearTimeout(tm); tm = setTimeout(search, 250); };
$('#clr').onclick = () => { $('#q').value = ''; search(); };
$('#time').onchange = search;
$('#more').onclick = more;
$('#fbtn').onclick = () => $('#fridge').classList.add('open');
$('#fclose').onclick = () => { $('#fridge').classList.remove('open'); $('#fbtn').classList.toggle('on', sel.size > 0); search(); };
$('#freset').onclick = () => { sel.clear(); document.querySelectorAll('#fbody input').forEach(i => i.checked = false); };
$('#rnd').onclick = () => { const p = res.length && !guides ? res : R; const e = p[Math.floor(Math.random() * p.length)]; res = p; open(p.indexOf(e)); };
$('#back').onclick = () => history.back();
$('#prev').onclick = () => { if (cur > 0) open(cur - 1); };
$('#next').onclick = () => { if (cur < res.length - 1) open(cur + 1); };
window.onpopstate = () => close();
document.onkeydown = e => { if (e.key === 'Escape') close(); };
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
start();
