const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const W = 360, H = 640, wrap = document.getElementById('wrap');
function resize() {
  const s = Math.max(0.2, Math.min((wrap.clientWidth - 20) / W, (wrap.clientHeight - 20) / H)), d = Math.min(window.devicePixelRatio || 1, 3);
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
  cv.width = Math.round(W * s * d); cv.height = Math.round(H * s * d);
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
}
addEventListener('resize', resize); resize();

const PY = 590, PH = 16, R = 5;
const COLORS = ['#ff2bd6', '#b24dff', '#5b7cff', '#22d3ee', '#4ade80', '#fbbf24', '#ff4d6d'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

let level = 1, score = 0, lives = 3, state = 'ready';
let grid = [], L = {}, target = 0, balls = [];
let px = W / 2, pw = 96, keys = {};

function buildLevel(n) {
  grid = [];
  if (n % 2 === 1) {
    L = { cs: 30, cols: 12, rows: 7, ox: 0, oy: 50, gap: 1, goal: 1 };
    for (let r = 0; r < L.rows; r++)
      for (let c = 0; c < L.cols; c++)
        grid.push(r >= 4 && Math.random() < 0.25 ? null : { t: 1, col: COLORS[r] });
  } else {
    L = { cs: 10, cols: 36, rows: 37, ox: 0, oy: 50, gap: .5, goal: 3 };
    const open = new Set();
    const rect = (c0, r0, c1, r1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) open.add(r * L.cols + c); };
    rect(7, 10, 29, 12); rect(11, 13, 12, 19); rect(23, 13, 24, 19); rect(11, 20, 24, 21); rect(17, 21, 18, 36);
    for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
      const i = r * L.cols + c;
      if (open.has(i)) { grid.push(null); continue; }
      let near = r === L.rows - 1;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++)
        if (open.has((r + dr) * L.cols + c + dc) && c + dc >= 0 && c + dc < L.cols) near = true;
      grid.push(near ? { t: 2, col: '#64748b' } : { t: 1, col: '#1aa7e0' });
    }
    [[17, 9], [18, 9], [6, 11], [30, 11], [16, 13], [17, 13]].forEach(([c, r]) => grid[r * L.cols + c] = { t: 3, col: '#ff8a1f' });
  }
  target = grid.filter(k => k && k.t === L.goal).length;
  serve();
}

function serve() {
  state = 'ready';
  balls = [{ x: px, y: PY - R, vx: 0, vy: 0, tr: [] }];
}

function speed() { return Math.min(560, 360 + level * 20); }

function launch() {
  const a = Math.random() * 0.6 - 0.3, s = speed();
  balls[0].vx = s * Math.sin(a); balls[0].vy = -s * Math.cos(a);
  state = 'play';
}

function action() {
  if (state === 'ready') launch();
  else if (state === 'won') { level++; buildLevel(level); }
  else if (state === 'over') { level = 1; score = 0; lives = 3; buildLevel(1); }
}

function breakCell(i, k, b) {
  grid[i] = null;
  score += k.t === 3 ? 50 : (L.cs > 20 ? 10 : 2);
  if (k.t === 3 && balls.length < 12) {
    for (const d of [-1, 1]) {
      const a = d * (0.4 + Math.random() * 0.4), s = Math.hypot(b.vx, b.vy);
      balls.push({ x: b.x, y: b.y, vx: s * Math.sin(a), vy: -s * Math.cos(a), tr: [] });
    }
  }
  if (k.t === L.goal && --target <= 0) state = 'won';
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
    if (dx === 0 && dy === 0) b.vy = -b.vy;
    else if (Math.abs(dx) > Math.abs(dy)) { if (dx * b.vx < 0) b.vx = -b.vx; }
    else if (dy * b.vy < 0) b.vy = -b.vy;
    if (k.t !== 2) breakCell(i, k, b);
  }
}

function stepBall(b, dt) {
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); }
  if (b.x > W - R) { b.x = W - R; b.vx = -Math.abs(b.vx); }
  if (b.y < R) { b.y = R; b.vy = Math.abs(b.vy); }
  hitBricks(b);
  if (b.vy > 0 && b.y + R >= PY && b.y < PY + PH && Math.abs(b.x - px) <= pw / 2 + R) {
    const s = Math.hypot(b.vx, b.vy), rel = clamp((b.x - px) / (pw / 2), -1, 1), a = rel * 1.0;
    b.vx = s * Math.sin(a); b.vy = -s * Math.cos(a); b.y = PY - R;
  }
}

function update(dt) {
  const dir = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  if (dir) px = clamp(px + dir * 420 * dt, pw / 2, W - pw / 2);
  if (state === 'ready') { balls[0].x = px; balls[0].y = PY - R; }
  if (state !== 'play') return;
  for (const b of balls) {
    const n = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 3);
    for (let i = 0; i < n && state === 'play'; i++) stepBall(b, dt / n);
    b.tr.push({ x: b.x, y: b.y }); if (b.tr.length > 9) b.tr.shift();
  }
  balls = balls.filter(b => b.y < H + R * 2);
  if (state === 'play' && balls.length === 0) {
    if (--lives <= 0) state = 'over'; else serve();
  }
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
  ctx.font = 'bold 22px system-ui, sans-serif'; ctx.fillText(t1, W / 2, 478);
  ctx.font = '15px system-ui, sans-serif'; ctx.fillStyle = '#cfd8ff'; ctx.fillText(t2, W / 2, 506);
}

function draw() {
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0a1440'); bg.addColorStop(1, '#050a1c');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(34,211,238,.07)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let x = 0; x <= W; x += 30) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 0; y <= H; y += 30) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  const { cs, cols, ox, oy, gap } = L;
  for (let i = 0; i < grid.length; i++) {
    const k = grid[i]; if (!k) continue;
    const x = ox + (i % cols) * cs + gap, y = oy + Math.floor(i / cols) * cs + gap, s = cs - gap * 2;
    if (cs > 20 || k.t === 3) { ctx.shadowColor = k.col; ctx.shadowBlur = 9; }
    ctx.fillStyle = k.col; ctx.fillRect(x, y, s, s);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x, y, s, Math.max(1, s * .18));
    if (cs > 20) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.strokeRect(x + .5, y + .5, s - 1, s - 1); }
  }
  ctx.fillStyle = '#67e8f9'; ctx.font = '600 13px ui-monospace, Menlo, Consolas, monospace';
  ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 8;
  ctx.textAlign = 'left'; ctx.fillText('PONTOS ' + String(score).padStart(5, '0'), 12, 26);
  ctx.textAlign = 'center'; ctx.fillText('FASE ' + String(level).padStart(2, '0'), W / 2 + 30, 26);
  ctx.textAlign = 'right'; ctx.fillText('VIDAS ' + '●'.repeat(Math.max(0, lives)), W - 12, 26);
  ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(34,211,238,.35)'; ctx.fillRect(12, 36, W - 24, 1);

  for (const b of balls) {
    ctx.lineCap = 'round';
    for (let i = 1; i < b.tr.length; i++) {
      const f = i / b.tr.length;
      ctx.strokeStyle = 'rgba(34,211,238,' + (f * 0.55) + ')'; ctx.lineWidth = R * 2 * f;
      ctx.beginPath(); ctx.moveTo(b.tr[i - 1].x, b.tr[i - 1].y); ctx.lineTo(b.tr[i].x, b.tr[i].y); ctx.stroke();
    }
    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 12; ctx.fillStyle = '#f5f6ff';
    ctx.beginPath(); ctx.arc(b.x, b.y, R, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
  }
  ctx.shadowColor = L.goal === 3 ? '#ff8a1f' : '#22d3ee'; ctx.shadowBlur = 16;
  pill(px - pw / 2, PY, pw, PH, L.goal === 3 ? '#ffb48a' : '#e0faff');
  ctx.shadowBlur = 0;

  if (state === 'ready') msg('Toque para lançar', L.goal === 3 ? 'Quebre os blocos laranja!' : 'Arraste para mover a raquete');
  if (state === 'won') msg('Fase concluída!', 'Toque para continuar');
  if (state === 'over') msg('Game Over', 'Toque para reiniciar');
}

function setX(e) {
  const r = cv.getBoundingClientRect();
  px = clamp((e.clientX - r.left) / r.width * W, pw / 2, W - pw / 2);
}
cv.addEventListener('pointermove', setX);
cv.addEventListener('pointerdown', e => { setX(e); action(); });
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
