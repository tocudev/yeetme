const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const distanceEl = document.getElementById('distance');
const bestEl = document.getElementById('best');

const W = canvas.width;
const H = canvas.height;
const GROUND_Y = H * 0.7;
const PIXELS_PER_METER = 40;

const GRAVITY = 0.5;
const MAX_PULL = 120;
const POWER = 0.22;

let baby = { x: 150, y: GROUND_Y - 30, vx: 0, vy: 0, r: 22, rot: 0, vrot: 0 };
let dragging = false;
let dragStart = null;
let dragCurrent = null;
let thrown = false;
let landed = false;
let maxX = 150;
let best = parseFloat(localStorage.getItem('yeetBest') || '0');
bestEl.textContent = `Best: ${best.toFixed(1)} m`;

function reset() {
  baby = { x: 150, y: GROUND_Y - 30, vx: 0, vy: 0, r: 22, rot: 0, vrot: 0 };
  thrown = false;
  landed = false;
  maxX = 150;
  distanceEl.textContent = '0.0 m';
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const t = e.touches ? e.touches[0] : e;
  return {
    x: (t.clientX - rect.left) * (W / rect.width),
    y: (t.clientY - rect.top) * (H / rect.height),
  };
}

function onDown(e) {
  if (thrown) { reset(); return; }
  const p = getPos(e);
  const dx = p.x - baby.x;
  const dy = p.y - baby.y;
  if (Math.hypot(dx, dy) < baby.r * 2) {
    dragging = true;
    dragStart = { x: baby.x, y: baby.y };
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
  baby.x = dragStart.x + Math.cos(angle) * clamped;
  baby.y = dragStart.y + Math.sin(angle) * clamped;
}

function onUp() {
  if (!dragging) return;
  dragging = false;
  const dx = baby.x - dragStart.x;
  const dy = baby.y - dragStart.y;
  baby.vx = -dx * POWER;
  baby.vy = -dy * POWER;
  baby.vrot = baby.vx * 0.05;
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
    baby.vy += GRAVITY;
    baby.x += baby.vx;
    baby.y += baby.vy;
    baby.rot += baby.vrot;

    if (baby.x > maxX) maxX = baby.x;

    if (baby.y + baby.r >= GROUND_Y) {
      baby.y = GROUND_Y - baby.r;
      landed = true;
      const dist = (maxX - 150) / PIXELS_PER_METER;
      distanceEl.textContent = `${dist.toFixed(1)} m`;
      if (dist > best) {
        best = dist;
        localStorage.setItem('yeetBest', best);
        bestEl.textContent = `Best: ${best.toFixed(1)} m`;
      }
    }
  }
}

function drawBaby(x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  ctx.fillStyle = '#ffd7b5';
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffe0c2';
  ctx.beginPath();
  ctx.arc(0, -20, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(-5, -22, 2, 0, Math.PI * 2);
  ctx.arc(5, -22, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -14, 4, 0, Math.PI);
  ctx.stroke();

  ctx.fillStyle = '#66ccff';
  ctx.beginPath();
  ctx.arc(-9, -18, 2, 0, Math.PI * 2);
  ctx.arc(9, -18, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawAimLine() {
  if (!dragging || !dragCurrent) return;
  ctx.save();
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(baby.x, baby.y);
  const dx = baby.x - dragStart.x;
  const dy = baby.y - dragStart.y;
  const steps = 20;
  let px = baby.x;
  let py = baby.y;
  let vx = -dx * POWER;
  let vy = -dy * POWER;
  for (let i = 0; i < steps; i++) {
    vy += GRAVITY;
    px += vx;
    py += vy;
    ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.beginPath();
  ctx.arc(200, 80, 30, 0, Math.PI * 2);
  ctx.arc(240, 80, 40, 0, Math.PI * 2);
  ctx.arc(280, 80, 30, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.font = '12px system-ui';
  for (let m = 5; m <= 20; m += 5) {
    const x = 150 + m * PIXELS_PER_METER;
    if (x > W) break;
    ctx.fillRect(x, GROUND_Y, 2, 10);
    ctx.fillText(`${m}m`, x - 8, GROUND_Y + 24);
  }

  drawAimLine();
  drawBaby(baby.x, baby.y, baby.rot);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
