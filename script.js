const cv = document.getElementById('c'); let ctx = cv.getContext('2d', { alpha: false });
const mainCtx = ctx; let bgCv = null, scaleX = 1; const spriteCache = new Map();
const W = 360, H = 640, wrap = document.getElementById('wrap');
function resize() {
  const vv = window.visualViewport, cs0 = getComputedStyle(wrap);
  const padX = (parseFloat(cs0.paddingLeft) || 0) + (parseFloat(cs0.paddingRight) || 0) + 2;
  const padY = (parseFloat(cs0.paddingTop) || 0) + (parseFloat(cs0.paddingBottom) || 0) + 2;
  const aw = Math.max(1, wrap.clientWidth - padX), ah = Math.max(1, wrap.clientHeight - padY);
  const s = Math.max(0.2, Math.min(aw / W, ah / H));
  let d = Math.min(window.devicePixelRatio || 1, 2);
  // limita o total de pixels do canvas (monitores 4K / zoom alto) para manter o desempenho
  const maxPx = 2.2e6; d = Math.min(d, Math.sqrt(maxPx / (W * s * H * s)));
  const w = Math.round(W * s), h = Math.round(H * s);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
  const bw = Math.max(1, Math.round(w * d)), bh = Math.max(1, Math.round(h * d));
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
  if (scaleX !== cv.width / W || !bgCv) { scaleX = cv.width / W; spriteCache.clear(); bgCv = makeBg(); }
}
// fundo estático pré-renderizado (evita recriar gradiente e grade a cada quadro)
function makeBg() {
  const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
  const g = c.getContext('2d'); g.setTransform(scaleX, 0, 0, scaleX, 0, 0);
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a1440'); bg.addColorStop(1, '#050a1c');
  g.fillStyle = bg; g.fillRect(-10, -10, W + 20, H + 20);
  g.strokeStyle = 'rgba(34,211,238,.07)'; g.lineWidth = 1; g.beginPath();
  for (let x = 0; x <= W; x += 30) { g.moveTo(x, 0); g.lineTo(x, H); }
  for (let y = 0; y <= H; y += 30) { g.moveTo(0, y); g.lineTo(W, y); }
  g.stroke();
  return c;
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => { resize(); setTimeout(resize, 150); setTimeout(resize, 400); });
if (window.visualViewport) visualViewport.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(wrap);
resize();

const PY = 590, PH = 16, R = 5, TOP = 50, COLS = 12, SHY = PY + PH + 8;
const COLORS = ['#ff2bd6', '#b24dff', '#5b7cff', '#22d3ee', '#4ade80', '#fbbf24', '#ff4d6d'];
const HPCOL = { 2: '#7c8cf8', 3: '#e879f9' };
const MONO = 'ui-monospace, Menlo, Consolas, monospace', SANS = 'system-ui, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rand = Math.random;

// Power-ups (cápsulas que caem dos blocos). bad = prejudicial
const POW = {
  W: { c: '#4ade80', n: 'LARGA', fx: 'wide', d: 12, w: 3 },
  S: { c: '#22d3ee', n: 'LENTA', fx: 'slow', d: 10, w: 2 },
  F: { c: '#ff8a1f', n: 'FOGO', fx: 'fire', d: 8, w: 2 },
  L: { c: '#f472b6', n: 'LASER', fx: 'laser', d: 12, w: 3 },
  C: { c: '#a78bfa', n: 'IMÃ', fx: 'catch', d: 15, w: 2 },
  '3': { c: '#fbbf24', n: 'MULTI', w: 3 },
  E: { c: '#38bdf8', n: 'ESCUDO', w: 2 },
  H: { c: '#fb7185', n: '+VIDA', w: 1 },
  N: { c: '#ef4444', n: 'ESTREITA', fx: 'narrow', d: 10, w: 2, bad: 1 },
  X: { c: '#ef4444', n: 'RÁPIDA', fx: 'fast', d: 8, w: 2, bad: 1 }
};

/* Legenda dos mapas:
   . vazio   o normal (1 golpe)   2/3 bloco de 2/3 golpes   # aço (indestrutível)
   M gera bolinhas   B bomba (explode vizinhos)   P bloco "?" (solta power-up)   T torre (atira) */
const LEVELS = [
  { name: 'Aquecimento', tip: 'Arraste · pegue as cápsulas', map: [
    'oooooooooooo', 'oooooooooooo', 'ooPooooooPoo', 'ooooMooMoooo', 'oooooooooooo'] },
  { name: 'Blocos Duros', tip: 'Números = golpes necessários', map: [
    'oooooooooooo', 'o2o2o2o2o2o2', 'oooooooooooo', '2o2o2o2o2o2o', 'ooPooooooPoo'] },
  { name: 'Pirâmide', tip: 'Bombas explodem os vizinhos', map: [
    '.....oo.....', '....oooo....', '...oooooo...', '..ooooBooo..', '.oooooooooo.', 'oooMooooMooo'] },
  { name: 'Labirinto', maze: true, goal: 'm', tip: 'Quebre os blocos laranja!' },
  { name: 'Torres', tip: 'Torres atiram: desvie!', map: [
    '#..........#', '#o2oooooo2o#', '#o2oTooTo2o#', '#o2oooooo2o#', '#o2oPooPo2o#', '#oo22BB22oo#'] },
  { name: 'Xadrez', tip: 'Laser e Fogo ajudam muito', map: [
    'o2o2o2o2o2o2', '2o2o2o2o2o2o', 'o2o2o2o2o2o2', '2o2o2o2o2o2o', 'PoooBooBoooP'] },
  { name: 'Coração', desc: 3, tip: 'Os blocos descem devagar!', map: [
    '..oo....oo..', '.oooo..oooo.', 'oooooooooooo', 'oooooMMooooo', '.ooooPPoooo.', '..oooooooo..', '...oooooo...', '....oooo....', '.....oo.....'] },
  { name: 'Fortaleza', tip: 'Abra caminho pelos blocos duros', map: [
    '3T3333333T33', '222222222222', '#oo#oooo#oo#', 'oPoooBBooPoo', '2oo2oooo2oo2'] },
  { name: 'Chuva de Bombas', desc: 4, tip: 'Reação em cadeia!', map: [
    'B.B.B.B.B.B.', 'oooooooooooo', '.B.B.B.B.B.B', 'oooooooooooo', '2222PP222222'] },
  { name: 'Chefão', desc: 3, tip: 'Torres e blocos duros!', map: [
    '.2222222222.', '22T22222T222', '3333MMMM3333', '33#3333#3333', '.BBooooooBB.', '..oo2PP2oo..'] },
  { name: 'Funil', desc: 5, tip: 'Segure a pressão!', map: [
    'oooooooooooo', '2oooooooooo2', '.2oooooooo2.', '..2oooooo2..', '...2oooo2...', '....2BB2....', '.....PP.....'] },
  { name: 'Barreira de Aço', tip: 'Procure a abertura!', map: [
    'oooooooooooo', '#########...', '............', '222222P22222', '...#########', '............', 'ooMoBooBoMoo', 'oPooooooooPo'] },
  { name: 'Invasores', desc: 4, tip: 'Cuidado com os tiros!', map: [
    '..o......o..', '...o....o...', '..ooPooPoo..', '.oo.oooo.oo.', 'oooMooooMooo', 'o.oooooooo.o', 'o.o......o.o', '...TT..TT...'] },
  { name: 'Diamante', desc: 6, tip: 'Use as bombas do centro', map: [
    'T..........T', '.....oo.....', '....o22o....', '...o2332o...', '..o23BB32o..', '...o2332o...', '....o22o....', '.....oo.....'] },
  { name: 'Chefão II', desc: 6, tip: 'Sobreviva!', map: [
    '.TTTT..TTTT.', '333333333333', '#3#3#3#3#3#3', '3B3B3B3B3B3B', '2222MMMM2222', 'oooooPPooooo'] },
  { name: 'Colmeia', desc: 6, tip: 'Mais duro a cada fase!', map: [
    '.T.o3333o.T.', '33#33BB33#33', '332222222233', '.3#2MM2M2#3.', '2222PP222222', '.33BB33BB33.'] },
  { name: 'Cidadela', desc: 7, tip: 'Quebre as muralhas!', map: [
    'T#3333333#T.', '3.33333333.3', '3.3BB33BB3.3', '3.33PP33PP3.', '3#33333333#3', '223MM22MM322'] },
  { name: 'Tempestade', desc: 7, tip: 'Torres por todo lado!', map: [
    'TT.T3333T.TT', '333#3333#333', '3B33333333B3', '33T33PP33T33', '2#22BBBB22#2', '3333MMMM3333', '.2222PP2222.'] },
  { name: 'Barreira Final', desc: 8, tip: 'Ache as aberturas rápido!', map: [
    '333333333333', '#####..#####', 'TT33BBBB33TT', '............', '3333MMMM3333', '###..#######', '3B3B3PP3B3B3', '222222222222'] },
  { name: 'Apocalipse', desc: 9, tip: 'A prova final. Boa sorte!', map: [
    'T3T3T33T3T3T', '3#3#3BB3#3#3', '3B3B3333B3B3', '33#33MM33#33', '3333PPPP3333', '#33B3333B33#', '222222222222'] }
];

// Fases infinitas após a última: geradas por número (mesma fase = mesmo desenho)
function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gen(n) {
  const r = rng(n), d = n - LEVELS.length + 5, // +5: mantém a dificuldade crescendo após as fases fixas
    rows = Math.min(10, 6 + Math.floor(d / 3));
  const dens = Math.min(.95, .7 + d * .02), p3 = Math.min(.4, .1 + d * .03), p2 = Math.min(.45, .2 + d * .02), tt = Math.min(.09, .02 + d * .008);
  const g = [];
  for (let y = 0; y < rows; y++) {
    const half = [];
    for (let c = 0; c < COLS / 2; c++) {
      if (r() > dens) { half.push('.'); continue; }
      const x = r();
      half.push(x < .04 ? 'B' : x < .07 ? 'M' : x < .11 ? 'P' : x < .11 + tt ? 'T' : x < .15 + tt ? '#' : r() < p3 ? '3' : r() < p2 ? '2' : 'o');
    }
    g.push(half.concat(half.slice().reverse()));
  }
  // aço nunca encostado em outro aço (garante que todo bloco é alcançável)
  for (let y = 0; y < rows; y++) for (let c = 0; c < COLS; c++) if (g[y][c] === '#') {
    for (let dy = -1; dy <= 1; dy++) for (let dc = -1; dc <= 1; dc++)
      if ((dy || dc) && g[y + dy] && g[y + dy][c + dc] === '#') g[y][c] = '2';
  }
  if (!g.some(row => row.includes('P'))) g[rows >> 1][5] = 'P';
  return { name: 'Infinito ' + n, desc: n % 3 === 0 ? 0 : Math.min(12, 2 + d * .7), tip: '', map: g.map(row => row.join('')) };
}

let level = 1, score = 0, lives = 3, state = 'ready', best = 0;
let retries = 0, levelScore = 0; // retries: vezes que a fase foi repetida (máx. 2) · levelScore: pontos ao iniciar a fase
try { best = +localStorage.getItem('brickSmashBest') || 0; } catch (e) {}
let grid = [], L = {}, target = 0, balls = [], turrets = [];
let caps = [], bullets = [], shots = [], parts = [], floats = [];
const noFx = () => ({ wide: 0, narrow: 0, slow: 0, fast: 0, fire: 0, laser: 0, catch: 0 });
let fx = noFx(), shield = false, combo = 0, stun = 0, shake = 0, laserT = 0;
let px = W / 2, pw = 98, keys = {};

const pwBase = () => clamp(100 - level * 1.6, 62, 100);
const speed = () => Math.min(640, 350 + level * 16);
const curSpeed = () => speed() * (fx.slow > 0 ? .72 : fx.fast > 0 ? 1.3 : 1);
const dropChance = () => Math.max(.04, .10 - level * .003);
const counts = k => L.goal === 'm' ? k.t === 'M' : k.t !== '#';

function mk(ch, r) {
  switch (ch) {
    case 'o': return { t: 'o', hp: 1, mh: 1, col: COLORS[r % COLORS.length] };
    case '2': return { t: 'o', hp: 2, mh: 2, col: HPCOL[2] };
    case '3': return { t: 'o', hp: 3, mh: 3, col: HPCOL[3] };
    case '#': return { t: '#', hp: 99, mh: 99, col: '#64748b' };
    case 'M': return { t: 'M', hp: 1, mh: 1, col: '#ff8a1f' };
    case 'B': return { t: 'B', hp: 1, mh: 1, col: '#ef4444' };
    case 'P': return { t: 'P', hp: 1, mh: 1, col: '#facc15' };
    case 'T': return { t: 'T', hp: 2, mh: 2, col: '#94a3b8', cd: 1.5 + rand() * 3 };
  }
  return null;
}

function maze() {
  Object.assign(L, { cs: 10, cols: 36, rows: 37, gap: .5 });
  const open = new Set();
  const rect = (c0, r0, c1, r1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) open.add(r * L.cols + c); };
  rect(7, 10, 29, 12); rect(11, 13, 12, 19); rect(23, 13, 24, 19); rect(11, 20, 24, 21); rect(17, 21, 18, 36);
  for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
    const i = r * L.cols + c;
    if (open.has(i)) { grid.push(null); continue; }
    let near = r === L.rows - 1;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++)
      if (open.has((r + dr) * L.cols + c + dc) && c + dc >= 0 && c + dc < L.cols) near = true;
    grid.push(near ? mk('#', 0) : { t: 'o', hp: 1, mh: 1, col: '#1aa7e0' });
  }
  [[17, 9], [18, 9], [6, 11], [30, 11], [16, 13], [17, 13]].forEach(([c, r]) => grid[r * L.cols + c] = mk('M', 0));
}

function buildLevel(n) {
  const D = n <= LEVELS.length ? LEVELS[n - 1] : gen(n);
  grid = []; turrets = []; caps = []; bullets = []; shots = []; parts = []; floats = [];
  fx = noFx(); shield = false; combo = 0; stun = 0; shake = 0;
  L = { name: D.name, tip: D.tip || '', goal: D.goal || 'all', desc: D.desc || 0, cs: 30, cols: COLS, rows: 0, ox: 0, oy: TOP, gap: 1 };
  if (D.maze) maze();
  else { L.rows = D.map.length; D.map.forEach((row, r) => { for (let c = 0; c < COLS; c++) grid.push(mk(row[c] || '.', r)); }); }
  grid.forEach((k, i) => { if (k && k.t === 'T') turrets.push(i); });
  target = grid.filter(k => k && counts(k)).length;
  levelScore = score; pw = pwBase(); serve();
}

function serve() {
  state = 'ready'; stun = 0;
  px = clamp(px, pw / 2, W - pw / 2);
  balls = [{ x: px, y: PY - R, vx: 0, vy: 0, tr: [] }];
}

function launch() {
  const a = rand() * 0.6 - 0.3, s = curSpeed();
  balls[0].vx = s * Math.sin(a); balls[0].vy = -s * Math.cos(a);
  state = 'play';
}

function releaseBall(b) {
  const rel = clamp(b.st / (pw / 2), -1, 1) * 0.9, s = curSpeed();
  b.vx = s * Math.sin(Math.abs(rel) < .05 ? rand() * .2 - .1 : rel); b.vy = -s * Math.cos(rel); b.st = null;
}

function action() {
  if (state === 'ready') launch();
  else if (state === 'play') balls.forEach(b => { if (b.st != null) releaseBall(b); });
  else if (state === 'won') { level++; buildLevel(level); }
  else if (state === 'retry') { score = levelScore; lives = 3; buildLevel(level); } // recomeça no mesmo nível
  else if (state === 'over') { level = 1; score = 0; lives = 3; retries = 0; buildLevel(1); } // 3ª vez: volta ao nível 1
}

function win() {
  state = 'won'; caps = []; bullets = []; shots = [];
  if (level % 5 === 0 && lives < 6) { lives++; float(W / 2, 420, '+1 VIDA', '#4ade80'); }
  saveBest();
}
function saveBest() { if (score > best) { best = score; try { localStorage.setItem('brickSmashBest', best); } catch (e) {} } }

function loseLife(breach) {
  lives--; combo = 0; fx = noFx(); shield = false; caps = []; bullets = []; shots = [];
  if (breach) L.oy = Math.max(TOP, L.oy - 4 * L.cs);
  if (lives <= 0) {
    if (retries < 2) { retries++; state = 'retry'; } else state = 'over';
    saveBest();
  } else serve();
}

function float(x, y, txt, col) { floats.push({ x, y, txt, col, t: 1.1 }); }
function burst(x, y, col, n) {
  for (let i = 0; i < n && parts.length < 260; i++) {
    const a = rand() * 6.28, s = 40 + rand() * 120;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30, l: .35 + rand() * .3, col });
  }
}

function pickPow() {
  const bw = 1 + level / 8; let tot = 0;
  const arr = Object.keys(POW).map(k => { const w = POW[k].bad ? POW[k].w * bw : POW[k].w; tot += w; return [k, w]; });
  let x = rand() * tot;
  for (const [k, w] of arr) if ((x -= w) <= 0) return k;
  return 'W';
}

function rot(b, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: b.x, y: b.y, vx: b.vx * c - b.vy * s, vy: b.vx * s + b.vy * c, tr: [] };
}

function apply(k) {
  const p = POW[k];
  float(px, PY - 14, p.n + (p.bad ? '!' : ''), p.c); score += p.bad ? 0 : 25;
  if (p.fx) {
    fx[p.fx] = p.d;
    if (k === 'W') fx.narrow = 0; if (k === 'N') fx.wide = 0;
    if (k === 'S') fx.fast = 0; if (k === 'X') fx.slow = 0;
  }
  if (k === '3') {
    for (const b of balls.slice()) {
      if (b.st != null) continue;
      for (const a of [-.4, .4]) if (balls.length < 14) balls.push(rot(b, a));
    }
  }
  if (k === 'E') shield = true;
  if (k === 'H') lives = Math.min(6, lives + 1);
}

function base(k) {
  if (k.t === 'o') return (L.cs > 20 ? 10 : 2) * k.mh;
  return { M: 50, B: 30, P: 25, T: 40 }[k.t] || 10;
}

function hurt(i, dmg) {
  const k = grid[i]; if (!k || k.t === '#') return;
  k.hp -= dmg; k.hit = .12;
  if (k.hp > 0) { score += 2; return; }
  kill(i, k);
}

function kill(i, k) {
  grid[i] = null;
  const { cs, cols, ox, oy } = L, cx = ox + (i % cols) * cs + cs / 2, cy = oy + Math.floor(i / cols) * cs + cs / 2;
  combo++;
  score += base(k) * (1 + Math.min(4, Math.floor(combo / 4)));
  burst(cx, cy, k.col, cs > 20 ? 9 : 2);
  if (k.t === 'M') {
    const s = curSpeed();
    for (const d of [-1, 1]) {
      if (balls.length >= 14) break;
      const a = d * (0.4 + rand() * 0.4);
      balls.push({ x: cx, y: cy, vx: s * Math.sin(a), vy: -s * Math.cos(a), tr: [] });
    }
  }
  if (k.t === 'B') explode(i, cx, cy);
  if (cs > 20 && (k.t === 'P' || rand() < dropChance())) caps.push({ x: cx, y: cy, k: pickPow() });
  if (counts(k) && --target <= 0 && state === 'play') win();
}

function explode(i, cx, cy) {
  const c0 = i % L.cols, r0 = Math.floor(i / L.cols);
  shake = .35; burst(cx, cy, '#ffb14a', 18);
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const c = c0 + dc, r = r0 + dr;
    if ((!dr && !dc) || c < 0 || c >= L.cols || r < 0 || r >= L.rows) continue;
    hurt(r * L.cols + c, 2);
  }
}

function hitBricks(b) {
  const { cs, cols, rows, ox, oy } = L;
  const c0 = Math.max(0, Math.floor((b.x - R - ox) / cs)), c1 = Math.min(cols - 1, Math.floor((b.x + R - ox) / cs));
  const r0 = Math.max(0, Math.floor((b.y - R - oy) / cs)), r1 = Math.min(rows - 1, Math.floor((b.y + R - oy) / cs));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
    const i = r * cols + c, k = grid[i];
    if (!k) continue;
    const rx = ox + c * cs, ry = oy + r * cs;
    const dx = b.x - clamp(b.x, rx, rx + cs), dy = b.y - clamp(b.y, ry, ry + cs);
    if (dx * dx + dy * dy >= R * R) continue;
    const pierce = fx.fire > 0 && k.t !== '#';
    if (!pierce) {
      if (dx === 0 && dy === 0) b.vy = -b.vy;
      else if (Math.abs(dx) > Math.abs(dy)) { if (dx * b.vx < 0) b.vx = -b.vx; }
      else if (dy * b.vy < 0) b.vy = -b.vy;
    }
    hurt(i, pierce ? 3 : 1);
  }
}

function stepBall(b, dt) {
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); }
  if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); }
  if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); }
  hitBricks(b);
  if (b.vy > 0 && b.y + R >= PY && b.y < PY + PH && Math.abs(b.x - px) <= pw / 2 + R) {
    combo = 0;
    if (fx.catch > 0) { b.st = clamp(b.x - px, -pw / 2 + 4, pw / 2 - 4); b.stT = 3; b.vx = b.vy = 0; b.y = PY - R; return; }
    const s = Math.hypot(b.vx, b.vy), rel = clamp((b.x - px) / (pw / 2), -1, 1), a = rel * 1.0;
    b.vx = s * Math.sin(a); b.vy = -s * Math.cos(a); b.y = PY - R;
  }
  if (shield && b.vy > 0 && b.y + R >= SHY) {
    b.vy = -Math.abs(b.vy); b.y = SHY - R; shield = false; burst(b.x, SHY, '#38bdf8', 12);
  }
}

function update(dt) {
  for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.l -= dt; }
  parts = parts.filter(p => p.l > 0);
  for (const f of floats) { f.y -= 28 * dt; f.t -= dt; }
  floats = floats.filter(f => f.t > 0);
  shake = Math.max(0, shake - dt); stun = Math.max(0, stun - dt);
  if (L.cs > 20) for (const k of grid) if (k && k.hit > 0) k.hit -= dt;

  const dir = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  if (dir && stun <= 0) px += dir * 420 * dt;
  const tw = pwBase() * (fx.wide > 0 ? 1.5 : fx.narrow > 0 ? .65 : 1);
  pw += (tw - pw) * Math.min(1, dt * 8);
  px = clamp(px, pw / 2, W - pw / 2);
  if (state === 'ready') { balls[0].x = px; balls[0].y = PY - R; }
  if (state !== 'play') return;

  for (const k in fx) if (fx[k] > 0) fx[k] = Math.max(0, fx[k] - dt);

  // laser da raquete
  if (fx.laser > 0) {
    laserT -= dt;
    if (laserT <= 0) { laserT = .3; for (const s of [-1, 1]) shots.push({ x: px + s * (pw / 2 - 6), y: PY - 2 }); }
  }
  for (const s of shots) {
    s.y -= 640 * dt;
    const c = Math.floor((s.x - L.ox) / L.cs), r = Math.floor((s.y - L.oy) / L.cs);
    if (c >= 0 && c < L.cols && r >= 0 && r < L.rows) { const i = r * L.cols + c; if (grid[i]) { hurt(i, 1); s.dead = true; } }
    if (s.y < 0) s.dead = true;
  }
  shots = shots.filter(s => !s.dead);

  // bolinhas
  const sp = curSpeed();
  for (const b of balls) {
    if (b.st != null) {
      b.x = px + b.st; b.y = PY - R; b.stT -= dt;
      if (b.stT <= 0 || fx.catch <= 0) releaseBall(b);
      continue;
    }
    const n = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 3);
    for (let i = 0; i < n && state === 'play'; i++) stepBall(b, dt / n);
    if (b.st == null) {
      const cur = Math.hypot(b.vx, b.vy) || 1, m = cur + (sp - cur) * Math.min(1, dt * 5), f = m / cur;
      b.vx *= f; b.vy *= f;
      if (Math.abs(b.vy) < m * .22) { b.vy = (b.vy < 0 ? -1 : 1) * m * .22; b.vx = (b.vx < 0 ? -1 : 1) * Math.sqrt(Math.max(0, m * m - b.vy * b.vy)); }
    }
    b.tr.push({ x: b.x, y: b.y }); if (b.tr.length > 9) b.tr.shift();
  }
  if (state !== 'play') return;

  // cápsulas
  for (const c of caps) {
    c.y += 120 * dt;
    if (c.y + 8 >= PY && c.y - 8 <= PY + PH && Math.abs(c.x - px) <= pw / 2 + 13) { apply(c.k); c.dead = true; }
    else if (c.y > H + 10) c.dead = true;
  }
  caps = caps.filter(c => !c.dead);

  // torres atiram quando têm espaço livre abaixo
  for (const i of turrets) {
    const k = grid[i]; if (!k || k.t !== 'T') continue;
    k.cd -= dt;
    if (k.cd <= 0) {
      if (!grid[i + L.cols]) {
        bullets.push({ x: L.ox + (i % L.cols) * L.cs + L.cs / 2, y: L.oy + (Math.floor(i / L.cols) + 1) * L.cs, vy: 150 + Math.min(150, level * 4) });
        k.cd = Math.max(1.6, 4.4 - level * .1) + rand() * 1.5;
      } else k.cd = .6;
    }
  }
  for (const b of bullets) {
    b.y += b.vy * dt;
    const c = Math.floor((b.x - L.ox) / L.cs), r = Math.floor((b.y - L.oy) / L.cs);
    if (c >= 0 && c < L.cols && r >= 0 && r < L.rows && grid[r * L.cols + c]) { b.dead = true; continue; }
    if (b.y >= PY && b.y <= PY + PH && Math.abs(b.x - px) <= pw / 2 + 2) {
      b.dead = true; stun = .9; shake = .2; float(px, PY - 14, 'ZAP!', '#ff4d4d'); burst(b.x, PY, '#ff4d4d', 10);
    } else if (b.y > H) b.dead = true;
  }
  bullets = bullets.filter(b => !b.dead);

  // blocos descendo
  if (L.desc > 0) {
    L.oy += L.desc * dt;
    let low = -1;
    for (let i = 0; i < grid.length; i++) if (grid[i]) low = Math.floor(i / L.cols);
    if (low >= 0 && L.oy + (low + 1) * L.cs >= PY - 6) { shake = .4; loseLife(true); return; }
  }

  balls = balls.filter(b => b.y < H + R * 2);
  if (state === 'play' && balls.length === 0) loseLife(false);
}

function pill(x, y, w, h, color) {
  ctx.fillStyle = color; ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h);
  ctx.fill();
}

function msg(t1, t2) {
  ctx.fillStyle = 'rgba(4,10,30,.85)'; ctx.fillRect(30, 440, W - 60, 90);
  ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.5; ctx.strokeRect(30, 440, W - 60, 90);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = 'bold 22px ' + SANS; ctx.fillText(t1, W / 2, 478);
  ctx.font = '15px ' + SANS; ctx.fillStyle = '#cfd8ff'; ctx.fillText(t2, W / 2, 506);
}

function drawBrick(k, x, y, s, cs) {
  const big = cs > 20;
  if (big || k.t === 'M') { ctx.shadowColor = k.col; ctx.shadowBlur = k.t === '#' ? 0 : 9; }
  ctx.fillStyle = k.hit > 0 ? '#ffffff' : k.col; ctx.fillRect(x, y, s, s);
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, s, Math.max(1, s * .18));
  if (!big) return;
  ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, s - 1, s - 1);
  const mx = x + s / 2, my = y + s / 2;
  if (k.t === 'o' && k.mh > 1) {
    ctx.fillStyle = '#0b1030'; ctx.font = 'bold 14px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(k.hp, mx, my + 1); ctx.textBaseline = 'alphabetic';
  } else if (k.t === '#') {
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.beginPath();
    for (let d = 6; d < s * 2; d += 8) { ctx.moveTo(x + Math.min(d, s), y + Math.max(0, d - s)); ctx.lineTo(x + Math.max(0, d - s), y + Math.min(d, s)); }
    ctx.stroke();
  } else if (k.t === 'M') {
    ctx.fillStyle = '#fff';
    for (const [a, b] of [[-5, 4], [5, 4], [0, -5]]) { ctx.beginPath(); ctx.arc(mx + a, my + b, 3, 0, 7); ctx.fill(); }
  } else if (k.t === 'B') {
    ctx.fillStyle = '#1b0b0b'; ctx.beginPath(); ctx.arc(mx, my + 1, s * .3, 0, 7); ctx.fill();
    ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(mx + 6, my - 8, 2.5, 0, 7); ctx.fill();
  } else if (k.t === 'P') {
    ctx.fillStyle = '#3b2a00'; ctx.font = 'bold 18px ' + SANS; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', mx, my + 1); ctx.textBaseline = 'alphabetic';
  } else if (k.t === 'T') {
    ctx.fillStyle = '#1e293b'; ctx.fillRect(mx - 3, my, 6, s / 2 - 2);
    ctx.fillStyle = k.cd < .7 ? '#ff4d4d' : '#475569'; ctx.beginPath(); ctx.arc(mx, my - 2, 6, 0, 7); ctx.fill();
  }
}

// blocos com brilho são desenhados uma vez em um sprite e reaproveitados (shadowBlur por bloco a cada quadro causava as travadas)
function brickSprite(k, s, cs) {
  const key = k.t + k.col + (k.mh > 1 ? k.hp : '') + (k.hit > 0 ? 'h' : '') + (k.t === 'T' && k.cd < .7 ? 'r' : '') + '|' + s + '|' + (cs > 20 ? 1 : 0);
  let sp = spriteCache.get(key);
  if (!sp) {
    const pad = 12, c = document.createElement('canvas');
    c.width = Math.ceil((s + pad * 2) * scaleX); c.height = c.width;
    const g = c.getContext('2d'); g.setTransform(scaleX, 0, 0, scaleX, pad * scaleX, pad * scaleX);
    const prev = ctx; ctx = g; drawBrick(k, 0, 0, s, cs); ctx = prev;
    sp = { c, pad }; spriteCache.set(key, sp);
    if (spriteCache.size > 400) spriteCache.clear();
  }
  return sp;
}

function draw() {
  ctx.save();
  if (shake > 0) ctx.translate((rand() - .5) * shake * 16, (rand() - .5) * shake * 16);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(bgCv, 0, 0); ctx.restore();
  const { cs, cols, ox, oy, gap } = L;
  for (let i = 0; i < grid.length; i++) {
    const k = grid[i]; if (!k) continue;
    const bx = ox + (i % cols) * cs + gap, by = oy + Math.floor(i / cols) * cs + gap, bs = cs - gap * 2;
    if (by > H || by + bs < 0) continue;
    if (cs <= 20 && k.t !== 'M') { drawBrick(k, bx, by, bs, cs); continue; } // blocos pequenos do labirinto: desenho direto (mais barato que sprite)
    const sp = brickSprite(k, bs, cs);
    ctx.drawImage(sp.c, bx - sp.pad, by - sp.pad, bs + sp.pad * 2, bs + sp.pad * 2);
  }

  // HUD
  ctx.fillStyle = '#67e8f9'; ctx.font = '600 13px ' + MONO;
  ctx.textAlign = 'left'; ctx.fillText('PONTOS ' + String(score).padStart(5, '0'), 12, 26);
  ctx.textAlign = 'center'; ctx.fillText('FASE ' + String(level).padStart(2, '0'), W / 2 + 30, 26);
  ctx.textAlign = 'right'; ctx.fillText('VIDAS ' + '●'.repeat(Math.max(0, lives)), W - 12, 26);
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(34,211,238,.35)'; ctx.fillRect(12, 36, W - 24, 1);
  ctx.font = '600 10px ' + MONO; ctx.fillStyle = '#7c8cf8'; ctx.textAlign = 'left'; ctx.fillText(L.name.toUpperCase(), 12, 47);
  ctx.fillStyle = '#fb7185'; ctx.textAlign = 'center'; ctx.fillText('EXTRA ' + '◆'.repeat(2 - retries) + '◇'.repeat(retries), W / 2 + 30, 47);
  if (combo >= 4) { ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'right'; ctx.fillText('COMBO x' + (1 + Math.min(4, Math.floor(combo / 4))), W - 12, 47); }

  // escudo
  if (shield) { ctx.shadowColor = '#38bdf8'; ctx.shadowBlur = 12; ctx.fillStyle = '#38bdf8'; ctx.fillRect(0, SHY, W, 3); ctx.shadowBlur = 0; }

  // tiros e cápsulas
  ctx.shadowColor = '#ff4d4d'; ctx.shadowBlur = 8; ctx.fillStyle = '#ff6b6b';
  for (const b of bullets) ctx.fillRect(b.x - 2, b.y - 6, 4, 12);
  ctx.shadowColor = '#f472b6'; ctx.fillStyle = '#ffd1ec';
  for (const s of shots) ctx.fillRect(s.x - 1.5, s.y - 8, 3, 12);
  ctx.shadowBlur = 0;
  for (const c of caps) {
    const p = POW[c.k];
    ctx.shadowColor = p.c; ctx.shadowBlur = 10; pill(c.x - 13, c.y - 8, 26, 16, p.c); ctx.shadowBlur = 0;
    if (p.bad) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(c.x - 13, c.y - 8, 26, 16, 8); else ctx.rect(c.x - 13, c.y - 8, 26, 16); ctx.stroke(); }
    ctx.fillStyle = p.bad ? '#fff' : '#06122e'; ctx.font = 'bold 12px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(c.k === 'H' ? '+' : c.k, c.x, c.y + 1); ctx.textBaseline = 'alphabetic';
  }

  // bolinhas
  const fire = fx.fire > 0, bc = fire ? '255,138,31' : '34,211,238';
  for (const b of balls) {
    ctx.lineCap = 'round';
    for (let i = 1; i < b.tr.length; i++) {
      const f = i / b.tr.length;
      ctx.strokeStyle = 'rgba(' + bc + ',' + (f * 0.55) + ')'; ctx.lineWidth = R * 2 * f;
      ctx.beginPath(); ctx.moveTo(b.tr[i - 1].x, b.tr[i - 1].y); ctx.lineTo(b.tr[i].x, b.tr[i].y); ctx.stroke();
    }
    if (balls.length <= 3) { ctx.shadowColor = fire ? '#ff8a1f' : '#22d3ee'; ctx.shadowBlur = 12; }
    ctx.fillStyle = fire ? '#ffe2b0' : '#f5f6ff';
    ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }

  // raquete
  const stunned = stun > 0 && Math.floor(stun * 16) % 2 === 0;
  const pc = stunned ? '#ff4d4d' : fx.laser > 0 ? '#ffc2e6' : L.goal === 'm' ? '#ffb48a' : '#e0faff';
  ctx.shadowColor = stunned ? '#ff4d4d' : fx.laser > 0 ? '#f472b6' : L.goal === 'm' ? '#ff8a1f' : '#22d3ee'; ctx.shadowBlur = 16;
  pill(px - pw / 2, PY, pw, PH, pc);
  ctx.shadowBlur = 0;
  if (fx.laser > 0) { ctx.fillStyle = '#f472b6'; ctx.fillRect(px - pw / 2 + 3, PY - 4, 6, 5); ctx.fillRect(px + pw / 2 - 9, PY - 4, 6, 5); }

  // partículas e textos
  for (const p of parts) { ctx.globalAlpha = clamp(p.l * 2.5, 0, 1); ctx.fillStyle = p.col; ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 12px ' + MONO; ctx.textAlign = 'center';
  for (const f of floats) { ctx.globalAlpha = clamp(f.t * 2, 0, 1); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y); }
  ctx.globalAlpha = 1;

  // efeitos ativos
  let cx = 8; ctx.font = '600 10px ' + MONO; ctx.textAlign = 'left';
  for (const k in POW) {
    const p = POW[k]; if (!p.fx || !(fx[p.fx] > 0)) continue;
    const t = p.n + ' ' + Math.ceil(fx[p.fx]), w = ctx.measureText(t).width + 10;
    ctx.strokeStyle = p.c; ctx.lineWidth = 1; ctx.strokeRect(cx + .5, 621.5, w, 14);
    ctx.fillStyle = p.c; ctx.fillText(t, cx + 5, 632); cx += w + 6;
  }

  if (state === 'ready') msg('Toque para lançar', L.tip || 'Boa sorte!');
  if (state === 'won') msg('Fase concluída!', 'Toque para continuar');
  if (state === 'retry') msg('Sem vidas!', 'Toque p/ repetir a fase · restam ' + (2 - retries));
  if (state === 'over') msg('Game Over', 'Toque p/ voltar à fase 1 · Recorde ' + best);
  ctx.restore();
}

function setX(e) {
  if (stun > 0) return;
  const r = cv.getBoundingClientRect();
  px = clamp((e.clientX - r.left) / r.width * W, pw / 2, W - pw / 2);
}
// Os toques/cliques valem em toda a tela (inclusive nas margens ao redor do jogo),
// o que facilita o controle em celulares em paisagem, tablets e monitores grandes.
let dragging = false;
cv.addEventListener('pointerdown', e => { dragging = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} setX(e); action(); e.preventDefault(); });
cv.addEventListener('pointermove', setX);
addEventListener('pointerdown', e => { if (e.target === cv) return; dragging = true; setX(e); action(); });
addEventListener('pointermove', e => { if (e.target !== cv && (dragging || e.pointerType === 'mouse')) setX(e); });
const endDrag = () => { dragging = false; };
addEventListener('pointerup', endDrag); addEventListener('pointercancel', endDrag);
addEventListener('contextmenu', e => e.preventDefault());
addEventListener('blur', () => { keys = {}; });
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); action(); }
});
addEventListener('keyup', e => keys[e.key] = false);

let last = performance.now();
function loop(t) {
  const dt = Math.min(0.033, (t - last) / 1000); last = t;
  update(dt); draw();
  requestAnimationFrame(loop);
}
buildLevel(1);
requestAnimationFrame(loop);
