const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const distanceEl = document.getElementById('distance');
const bestEl = document.getElementById('best');

let W, H, GROUND_Y;
const PIXELS_PER_METER = 40;
const GRAVITY = 0.5;
const MAX_PULL = 260;
const POWER = 0.14;
const FLICK_BOOST = 0.06;
const FLICK_MAX = 0.35;
const LINE_MAX_WIDTH = 6;
const LINE_MIN_WIDTH = 0.5;

const CAT_START_HEIGHT = 220;

let cat = { x: 0, y: 0, vx: 0, vy: 0, r: 26, rot: 0, vrot: 0 };
let startX = 0;

let dragging = false;
let dragStart = null;
let dragCurrent = null;
let mouseHistory = [];

let thrown = false;
let landed = false;
let maxX = 0;
let cameraX = 0;

let wingsAttached = true;
let fallingWings = null;

// emoji popup state
let emoji = null; // { text, bornAt, duration, offsetY, rot }

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
  GROUND_Y = H * 0.85;
  startX = W * 0.35;
  if (!thrown && !landed) {
    cat.x = startX;
    cat.y = GROUND_Y - CAT_START_HEIGHT;
  }
}

function reset() {
  cat = {
    x: startX,
    y: GROUND_Y - CAT_START_HEIGHT,
    vx: 0, vy: 0, r: 26, rot: 0, vrot: 0
  };
  thrown = false;
  landed = false;
  maxX = startX;
  cameraX = 0;
  wingsAttached = true;
  fallingWings = null;
  emoji = null;
  distanceEl.textContent = '0.0 m';
}

function spawnEmoji(text) {
  emoji = {
    text,
    bornAt: performance.now(),
    duration: 900,
    offsetY: 0,
    rot: (Math.random() - 0.5) * 0.15,
  };
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
  const catScreenX = cat.x - cameraX;
  const dx = p.x - catScreenX;
  const dy = p.y - cat.y;
  if (Math.hypot(dx, dy) < cat.r * 2.4) {
    dragging = true;
    dragStart = { x: cat.x, y: cat.y };
    dragCurrent = p;
    mouseHistory = [{ x: p.x, y: p.y, t: performance.now() }];

    if (wingsAttached) {
      wingsAttached = false;
      fallingWings = {
        x: cat.x - cameraX,
        y: cat.y - 6,
        vx: (Math.random() - 0.5) * 2,
        vy: -1.5,
        rot: 0,
        vrot: (Math.random() - 0.5) * 0.2,
        _lastCam: cameraX,
      };
    }
  }
}

function onMove(e) {
  if (!dragging) return;
  dragCurrent = getPos(e);
  mouseHistory.push({ x: dragCurrent.x, y: dragCurrent.y, t: performance.now() });
  if (mouseHistory.length > 10) mouseHistory.shift();

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

  // 😱 shocked emoji the moment it's thrown
  spawnEmoji('😱');
}

canvas.addEventListener('mousedown', onDown);
canvas.addEventListener('mousemove', onMove);
canvas.addEventListener('mouseup', onUp);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
canvas.addEventListener('touchend', (e) => { e.preventDefault(); onUp(e); }, { passive: false });

function update() {
  // Faster camera that keeps up with the cat
  const targetCam = Math.max(0, cat.x - W * 0.5);
  cameraX += (targetCam - cameraX) * 0.35;

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

      // 😡 angry emoji on impact
      spawnEmoji('😡');
    }
  }

  if (fallingWings) {
    fallingWings.vy += 0.4;
    fallingWings.x += fallingWings.vx;
    fallingWings.y += fallingWings.vy;
    fallingWings.rot += fallingWings.vrot;

    fallingWings.x -= (cameraX - (fallingWings._lastCam || cameraX));
    fallingWings._lastCam = cameraX;

    if (fallingWings.y > GROUND_Y - 4) {
      fallingWings.y = GROUND_Y - 4;
      fallingWings.vy = 0;
      fallingWings.vx *= 0.6;
      fallingWings.vrot *= 0.5;
      if (Math.abs(fallingWings.vx) < 0.05 && Math.abs(fallingWings.vrot) < 0.01) {
        fallingWings.vx = 0;
        fallingWings.vrot = 0;
      }
    }
  }

  // emoji lifecycle
  if (emoji) {
    const age = performance.now() - emoji.bornAt;
    if (age > emoji.duration) emoji = null;
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

  if (wingsAttached) {
    drawWings(0, -6, 0);
  }

  ctx.restore();
}

function drawWings(cx, cy, rot) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(-10, -4);
  ctx.quadraticCurveTo(-34, -22, -40, -2);
  ctx.quadraticCurveTo(-32, 2, -10, 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-20, -12);
  ctx.quadraticCurveTo(-26, -6, -24, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(10, -4);
  ctx.quadraticCurveTo(34, -22, 40, -2);
  ctx.quadraticCurveTo(32, 2, 10, 4);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(20, -12);
  ctx.quadraticCurveTo(26, -6, 24, 0);
  ctx.stroke();

  ctx.restore();
}

function drawFallingWings(w) {
  ctx.save();
  ctx.translate(w.x, w.y);
  ctx.rotate(w.rot);
  drawWings(0, 0, 0);
  ctx.restore();
}

function drawEmoji() {
  if (!emoji) return;
  const age = performance.now() - emoji.bornAt;
  const t = age / emoji.duration; // 0 → 1

  // fade in fast, then out
  let alpha;
  if (t < 0.15) alpha = t / 0.15;
  else alpha = 1 - (t - 0.15) / 0.85;

  // drift upward slightly + scale pop
  const offsetY = -t * 30;
  const scale = 1 + Math.sin(Math.min(t, 0.3) / 0.3 * Math.PI) * 0.25;

  const screenX = cat.x - cameraX;
  const screenY = cat.y - 55 + offsetY;

  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.translate(screenX, screenY);
  ctx.rotate(emoji.rot);
  ctx.scale(scale, scale);
  ctx.font = '40px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji.text, 0, 0);
  ctx.restore();
}

function drawPullLine() {
  if (!dragging || !dragCurrent) return;

  const catScreenX = cat.x - cameraX;

  const anchorX = dragStart.x - cameraX;
  const anchorY = dragStart.y;
  const dx = dragCurrent.x - anchorX;
  const dy = dragCurrent.y - anchorY;
  const dist = Math.hypot(dx, dy);
  const clampedDist = Math.min(dist, MAX_PULL);
  const angle = Math.atan2(dy, dx);
  const endX = anchorX + Math.cos(angle) * clampedDist;
  const endY = anchorY + Math.sin(angle) * clampedDist;

  const t = clampedDist / MAX_PULL;
  const lineWidth = LINE_MAX_WIDTH - (LINE_MAX_WIDTH - LINE_MIN_WIDTH) * t;

  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,' + (0.8 - 0.4 * t) + ')';
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(catScreenX, cat.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(endX, endY, 3, 0, Math.PI * 2);
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
  for (let m = 0; m <= 500; m += 5) {
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
  if (fallingWings) drawFallingWings(fallingWings);
  drawPullLine();
  drawAimLine();
  drawCat(cat.x - cameraX, cat.y, cat.rot);
  drawEmoji();
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
