const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const distanceEl = document.getElementById('distance');
const bestEl = document.getElementById('best');

let W, H, GROUND_Y;
const PIXELS_PER_METER = 40;
const GRAVITY = 0.5;
const MAX_PULL = 260;          // was 130 — now much longer
const POWER = 0.14;            // slightly lower so longer pull doesn't make it insane
const FLICK_BOOST = 0.06;
const FLICK_MAX = 0.35;
const LINE_MAX_WIDTH = 6;      // line starts this thick
const LINE_MIN_WIDTH = 0.5;    // and ends this thin

let cat = { x: 0, y: 0, vx: 0, vy: 0, r: 26, rot: 0, vrot: 0 };
let houseX = 0;

let dragging = false;
let dragStart = null;
let dragCurrent = null;
let mouseHistory = [];

let thrown = false;
let landed = false;
let maxX = 0;
let startX = 0;
let cameraX = 0;

let best = parseFloat(localStorage.getItem('yeetCatBest') || '0');
bestEl.textContent = `Best: ${best.toFixed(1)} m`;

// Cat house dimensions — tall + wide, cat sits on the roof peak
const HOUSE_W = 140;
const HOUSE_H = 150;
const ROOF_H = 70;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  GROUND_Y = H * 0.85;
  startX = W * 0.35;
  houseX = startX;
  if (!thrown && !landed) {
    cat.x = startX;
    // sit exactly on the roof peak
    cat.y = GROUND_Y - HOUSE_H - ROOF_H + 6;
  }
}

function reset() {
  cat = {
    x: startX,
    y: GROUND_Y - HOUSE_H - ROOF_H + 6,
    vx: 0, vy: 0, r: 26, rot: 0, vrot: 0
  };
  thrown = false;
  landed = false;
  maxX = startX;
  cameraX = 0;
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
  const dx = p.x - (cat.x - cameraX);
  const dy = p.y - cat.y;
  if (Math.hypot(dx, dy) < cat.r * 2.4) {
    dragging = true;
    dragStart = { x: cat.x, y: cat.y };
    dragCurrent = p;
    mouseHistory = [{ x: p.x, y: p.y, t: performance.now() }];
  }
}

function onMove(e) {
  if (!dragging) return;
  dragCurrent = getPos(e);
  mouseHistory.push({ x: dragCurrent.x, y: dragCurrent.y, t: performance.now() });
  if (mouseHistory.length > 10) mouseHistory.shift();

  // Pull is relative to the cat's ORIGINAL position so it can go way back
  const dx = dragCurrent.x - (dragStart.x - cameraX);
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
  if (Math.hypot(dx, dy) < 5) { mouseHistory = []; return; }

  let flickSpeed = 0;
  if (mouseHistory.length >= 2) {
    const now = performance.now();
    const recent = mouseHistory.filter(p => now - p.t < 80);
    if (recent.length >= 2) {
      const first = recent[0];
      const last = recent[recent.length - 1];
      const dt = Math.max(1, last.t - first.t);
      flickSpeed = Math.hypot(last.x - first.x, last.y - first.y) / dt;
    }
  }

  const flickBoost = Math.min(FLICK_MAX, flickSpeed * FLICK_BOOST);
  const totalPower = POWER + flickBoost;

  cat.vx = -dx * totalPower;
  cat.vy = -dy * totalPower;
  cat.vrot = cat.vx * 0.05;
  thrown = true;
  mouseHistory = [];
}

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('mouseup', onUp);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); onUp(e); }, { passive: false });

function update() {
  if (thrown && !landed) {
    const targetCam = Math.max(0, cat.x - W * 0.4);
    cameraX += (targetCam - cameraX) * 0.12;
  }

  if (thrown && !landed) {
    cat.vy += GRAVITY;
    cat.x += cat.vx;
    cat.y += cat.vy;
    cat.rot += cat.vrot;

    if (cat.x > maxX) maxX = cat.x;

    const dist = (maxX - startX) / PIXELS_PER_METER;
    distanceEl.textContent = `${dist.toFixed(1)} m`;

    if (cat.y + cat.r >= GROUND_Y) {
      cat.y = GROUND_Y - cat.r;
      landed = true;
      const finalDist = (maxX - startX) / PIXELS_PER_METER;
      if (finalDist > best) {
        best = finalDist;
        localStorage.setItem('yeetCatBest', best);
        bestEl.textContent = `Best: ${best.toFixed(1)} m`;
      }
    }
  }

  if (landed) {
    const targetCam = Math.max(0, cat.x - W * 0.4);
    cameraX += (targetCam - cameraX) * 0.12;
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

  ctx.beginPath();
  ctx.ellipse(0, 6, 24, 18, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(22, 4);
  ctx.quadraticCurveTo(42, -6, 36, -22);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -16, 15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-12, -26); ctx.lineTo(-16, -40); ctx.lineTo(-3, -30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, -26); ctx.lineTo(16, -40); ctx.lineTo(3, -30);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-5, -18, 1.8, 0, Math.PI * 2);
  ctx.arc(5, -18, 1.8, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-2, -12); ctx.lineTo(2, -12); ctx.lineTo(0, -9);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-8, -10); ctx.lineTo(-20, -12);
  ctx.moveTo(-8, -7);  ctx.lineTo(-20, -5);
  ctx.moveTo(8, -10);  ctx.lineTo(20, -12);
  ctx.moveTo(8, -7);   ctx.lineTo(20, -5);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-12, 22); ctx.lineTo(-12, 28);
  ctx.moveTo(12, 22);  ctx.lineTo(12, 28);
  ctx.stroke();

  ctx.restore();
}

function drawHouse(x) {
  const bx = x - HOUSE_W / 2;
  const bodyTop = GROUND_Y - HOUSE_H;
  const roofPeakY = bodyTop - ROOF_H;

  ctx.save();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // body (walls)
  ctx.strokeRect(bx, bodyTop, HOUSE_W, HOUSE_H);

  // roof
  ctx.beginPath();
  ctx.moveTo(bx - 14, bodyTop);
  ctx.lineTo(x, roofPeakY);
  ctx.lineTo(bx + HOUSE_W + 14, bodyTop);
  ctx.stroke();

  // door
  const doorW = 40;
  const doorH = 70;
  ctx.beginPath();
  ctx.rect(x - doorW / 2, GROUND_Y - doorH, doorW, doorH);
  ctx.stroke();

  // door knob
  ctx.beginPath();
  ctx.arc(x + doorW / 2 - 8, GROUND_Y - doorH / 2, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();

  // round window on roof
  ctx.beginPath();
  ctx.arc(x, bodyTop - ROOF_H * 0.45, 12, 0, Math.PI * 2);
  ctx.stroke();

  // window cross
  ctx.beginPath();
  ctx.moveTo(x - 12, bodyTop - ROOF_H * 0.45);
  ctx.lineTo(x + 12, bodyTop - ROOF_H * 0.45);
  ctx.moveTo(x, bodyTop - ROOF_H * 0.45 - 12);
  ctx.lineTo(x, bodyTop - ROOF_H * 0.45 + 12);
  ctx.stroke();

  // two square windows on the walls
  const winY = bodyTop + 25;
  ctx.strokeRect(bx + 18, winY, 26, 26);
  ctx.strokeRect(bx + HOUSE_W - 44, winY, 26, 26);

  ctx.restore();
}

function drawPullLine() {
  if (!dragging || !dragCurrent) return;

  const catScreenX = cat.x - cameraX;
  const dx = catScreenX - (dragStart.x - cameraX);
  const dy = cat.y - dragStart.y;
  const pullDist = Math.hypot(dx, dy);
  const t = Math.min(1, pullDist / MAX_PULL);

  // Line gets THINNER as you pull further
  const lineWidth = LINE_MAX_WIDTH - (LINE_MAX_WIDTH - LINE_MIN_WIDTH) * t;

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,' + (0.8 - 0.4 * t) + ')';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(catScreenX, cat.y);
  ctx.lineTo(dragCurrent.x, dragCurrent.y);
  ctx.stroke();

  // small anchor dot at the grab point
  ctx.beginPath();
  ctx.arc(dragCurrent.x, dragCurrent.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.restore();
}

function drawAimLine() {
  if (!dragging || !dragCurrent) return;
  ctx.save();
  ctx.setLineDash([5, 7]);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  const catScreenX = cat.x - cameraX;
  ctx.moveTo(catScreenX, cat.y);
  const dx = cat.x - dragStart.x;
  const dy = cat.y - dragStart.y;
  let px = catScreenX;
  let py = cat.y;
  let vx = -dx * POWER;
  let vy = -dy * POWER;
  for (let i = 0; i < 30; i++) {
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
  for (let m = 0; m <= 200; m += 5) {
    const worldX = startX + m * PIXELS_PER_METER;
    const screenX = worldX - cameraX;
    if (screenX < -20 || screenX > W + 20) continue;
    ctx.fillRect(screenX, GROUND_Y, 1, 8);
    if (m > 0) ctx.fillText(`${m}m`, screenX - 8, GROUND_Y + 22);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawGround();
  drawHouse(houseX - cameraX);
  drawPullLine();
  drawAimLine();
  drawCat(cat.x - cameraX, cat.y, cat.rot);
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
