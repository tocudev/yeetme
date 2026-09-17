const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const distanceEl = document.getElementById('distance');
const bestEl = document.getElementById('best');

let W, H, GROUND_Y;
const PIXELS_PER_METER = 40;
const GRAVITY = 0.5;
const MAX_PULL = 130;
const POWER = 0.22;

let cat = { x: 0, y: 0, vx: 0, vy: 0, r: 26, rot: 0, vrot: 0 };
let dragging = false;
let dragStart = null;
let dragCurrent = null;
let thrown = false;
let landed = false;
let maxX = 0;
let startX = 0;
let best = parseFloat(localStorage.getItem('yeetCatBest') || '0');
bestEl.textContent = `Best: ${best.toFixed(1)} m`;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  GROUND_Y = H * 0.78;
  startX = W * 0.25;
  if (!thrown && !landed) {
    cat.x = startX;
    cat.y = GROUND_Y - cat.r;
  }
}

function reset() {
  cat = { x: startX, y: GROUND_Y - 26, vx: 0, vy: 0, r: 26, rot: 0, vrot: 0 };
  thrown = false;
  landed = false;
  maxX = startX;
  distanceEl.textContent = '0.0 m';
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return {
    x: t.clientX - rect.left,
    y: t.clientY - rect.top,
  };
}

function onDown(e) {
  if (thrown && landed) { reset(); return; }
  if (thrown) return;
  const p = getPos(e);
  const dx = p.x - cat.x;
  const dy = p.y - cat.y;
  if (Math.hypot(dx, dy) < cat.r * 2.2) {
    dragging = true;
    dragStart = { x: cat.x, y: cat.y };
    dragCurrent = p;
  }
}

function onMove(e) {
  if (!dragging) return;
  dragCurrent = getPos(e);
  const dx = dragCurrent.x - dragStart.x;
  const dy = dragCurrent.y - dragStart.y;
  const dist = Math.hypot(dx, dy);
  const clamped = Math.min(dist, MAX_PULL);
  const angle = Math.atan2(dy, dx);
  cat.x = dragStart.x + Math.cos(angle) * clamped;
  cat.y = dragStart.y + Math.sin(angle) * clamped;
}

function onUp() {
  if (!dragging) return;
  dragging = false;
  const dx = cat.x - dragStart.x;
  const dy = cat.y - dragStart.y;
  if (Math.hypot(dx, dy) < 5) return;
  cat.vx = -dx * POWER;
  cat.vy = -dy * POWER;
  cat.vrot = cat.vx * 0.05;
  thrown = true;
}

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('mouseup', onUp);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); onUp(e); }, { passive: false });

function update() {
  if (thrown && !landed) {
    cat.vy += GRAVITY;
    cat.x += cat.vx;
    cat.y += cat.vy;
    cat.rot += cat.vrot;

    if (cat.x > maxX) maxX = cat.x;

    if (cat.y + cat.r >= GROUND_Y) {
      cat.y = GROUND_Y - cat.r;
      landed = true;
      const dist = (maxX - startX) / PIXELS_PER_METER;
      distanceEl.textContent = `${dist.toFixed(1)} m`;
      if (dist > best) {
        best = dist;
        localStorage.setItem('yeetCatBest', best);
        bestEl.textContent = `Best: ${best.toFixed(1)} m`;
      }
    }
  }
}

function drawCat(x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // body
  ctx.beginPath();
  ctx.ellipse(0, 6, 24, 18, 0, 0, Math.PI * 2);
  ctx.stroke();

  // tail
  ctx.beginPath();
  ctx.moveTo(22, 4);
  ctx.quadraticCurveTo(42, -6, 36, -22);
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(0, -16, 15, 0, Math.PI * 2);
  ctx.stroke();

  // ears
  ctx.beginPath();
  ctx.moveTo(-12, -26);
  ctx.lineTo(-16, -40);
  ctx.lineTo(-3, -30);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(12, -26);
  ctx.lineTo(16, -40);
  ctx.lineTo(3, -30);
  ctx.stroke();

  // eyes
  ctx.beginPath();
  ctx.arc(-5, -18, 1.8, 0, Math.PI * 2);
  ctx.arc(5, -18, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();

  // nose
  ctx.beginPath();
  ctx.moveTo(-2, -12);
  ctx.lineTo(2, -12);
  ctx.lineTo(0, -9);
  ctx.closePath();
  ctx.fill();

  // whiskers
  ctx.beginPath();
  ctx.moveTo(-8, -10); ctx.lineTo(-20, -12);
  ctx.moveTo(-8, -7);  ctx.lineTo(-20, -5);
  ctx.moveTo(8, -10);  ctx.lineTo(20, -12);
  ctx.moveTo(8, -7);   ctx.lineTo(20, -5);
  ctx.stroke();

  // legs
  ctx.beginPath();
  ctx.moveTo(-12, 22); ctx.lineTo(-12, 28);
  ctx.moveTo(12, 22);  ctx.lineTo(12, 28);
  ctx.stroke();

  ctx.restore();
}

function drawAimLine() {
  if (!dragging || !dragCurrent) return;
  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cat.x, cat.y);
  const dx = cat.x - dragStart.x;
  const dy = cat.y - dragStart.y;
  let px = cat.x, py = cat.y;
  let vx = -dx * POWER, vy = -dy * POWER;
  for (let i = 0; i < 26; i++) {
    vy += GRAVITY;
    px += vx;
    py += vy;
    if (py > GROUND_Y) break;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function drawGround() {
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.font = '11px "Courier New", monospace';
  for (let m = 5; m <= 40; m += 5) {
    const x = startX + m * PIXELS_PER_METER;
    if (x > W) break;
    ctx.fillRect(x, GROUND_Y, 1, 8);
    ctx.fillText(`${m}m`, x - 8, GROUND_Y + 22);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawGround();
  drawAimLine();
  drawCat(cat.x, cat.y, cat.rot);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
resize();
reset();
loop();
