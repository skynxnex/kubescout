/**
 * Thunderstorm Animation
 * Rain streaks falling diagonally + random lightning strikes.
 *
 * Runs at ~30 fps via setInterval (33 ms tick).
 */

let stormCanvas    = null;
let stormContext   = null;
let stormAnimationId = null; // setInterval handle
let resizeHandler    = null;
let rainDrops        = [];
let stormTime        = 0;

const RAIN_COUNT = 150;

// Lightning state
let lightningTimer  = 0;   // when to trigger next lightning (ms timestamp)
let lightningBolt   = null; // current bolt data, or null
let lightningFadeEnd = 0;  // when bolt fades out
let skyFlashEnd     = 0;   // when sky-flash overlay disappears

function createRainDrops(w, h) {
  rainDrops = [];
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainDrops.push(newDrop(w, h, true));
  }
}

function newDrop(w, h, randomY) {
  return {
    x:      Math.random() * w,
    y:      randomY ? Math.random() * h : -40,
    length: 15 + Math.random() * 20,  // 15-35px
    speed:  8  + Math.random() * 10,  // 8-18px/frame
    dx:     1  + Math.random() * 2,   // 1-3 rightward drift
    width:  2  + Math.random() * 2,   // 2-4px
  };
}

/**
 * Build a jagged lightning bolt from (x, y1) downward.
 * Returns array of points.
 */
function buildBolt(x, y1, y2, segments, jitter) {
  const points = [{ x, y: y1 }];
  for (let i = 1; i < segments; i++) {
    const t  = i / segments;
    const py = y1 + (y2 - y1) * t;
    const px = x + (Math.random() - 0.5) * jitter;
    points.push({ x: px, y: py });
  }
  points.push({ x: x + (Math.random() - 0.5) * 20, y: y2 });
  return points;
}

function triggerLightning(w, h) {
  const boltX  = 80 + Math.random() * (w - 160);
  const boltY2 = h * (0.4 + Math.random() * 0.4); // 40-80% down

  // Main bolt
  const mainPoints = buildBolt(boltX, 0, boltY2, 12, 60);

  // 2-3 branches
  const branches = [];
  const branchCount = 2 + Math.floor(Math.random() * 2);
  for (let b = 0; b < branchCount; b++) {
    const branchStart = mainPoints[3 + Math.floor(Math.random() * 5)];
    const branchLen   = boltY2 * (0.2 + Math.random() * 0.3);
    const branchEnd   = branchStart.y + branchLen;
    branches.push(buildBolt(branchStart.x, branchStart.y, branchEnd, 6, 30));
  }

  lightningBolt = { mainPoints, branches, alpha: 0.9 };
  lightningFadeEnd = Date.now() + 300; // fade over 300ms
  skyFlashEnd      = Date.now() + 100; // sky flash lasts 100ms
}

/**
 * Initialize Thunderstorm animation.
 */
export function startThunderstorm() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  stormCanvas = document.getElementById('thunderstormCanvas');
  if (!stormCanvas) {
    stormCanvas = document.createElement('canvas');
    stormCanvas.id = 'thunderstormCanvas';
    stormCanvas.style.position = 'fixed';
    stormCanvas.style.top = '0';
    stormCanvas.style.left = '0';
    stormCanvas.style.width = '100%';
    stormCanvas.style.height = '100%';
    stormCanvas.style.zIndex = '-1';
    stormCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(stormCanvas);
    } else {
      document.body.insertBefore(stormCanvas, document.body.firstChild);
    }
  }

  stormContext = stormCanvas.getContext('2d');
  resizeStormCanvas();

  resizeHandler = resizeStormCanvas;
  window.addEventListener('resize', resizeHandler);

  // Schedule first lightning 3-8 seconds from start
  lightningTimer = Date.now() + 3000 + Math.random() * 5000;
  lightningBolt  = null;

  startStormLoop();
  console.log('[Thunderstorm] Animation started');
}

function resizeStormCanvas() {
  if (!stormCanvas) return;
  stormCanvas.width  = window.innerWidth;
  stormCanvas.height = window.innerHeight;
  createRainDrops(stormCanvas.width, stormCanvas.height);
}

function startStormLoop() {
  if (stormAnimationId) return;

  stormAnimationId = setInterval(() => {
    if (!stormContext || !stormCanvas) return;
    drawStormFrame();
    stormTime += 33;
  }, 33);
}

function drawStormFrame() {
  const w   = stormCanvas.width;
  const h   = stormCanvas.height;
  const ctx = stormContext;
  const now = Date.now();

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  // --- Sky flash ---
  if (now < skyFlashEnd) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, w, h);
  }

  // --- Rain ---
  ctx.strokeStyle = 'rgba(100, 150, 200, 0.4)';
  rainDrops.forEach(drop => {
    ctx.lineWidth = drop.width;
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x + drop.dx, drop.y + drop.length);
    ctx.stroke();

    drop.x += drop.dx;
    drop.y += drop.speed;

    // Respawn at top when drop exits bottom or right
    if (drop.y > h + 40 || drop.x > w + 40) {
      const reset = newDrop(w, h, false);
      drop.x      = reset.x;
      drop.y      = reset.y;
      drop.length = reset.length;
      drop.speed  = reset.speed;
      drop.dx     = reset.dx;
    }
  });

  // --- Lightning trigger ---
  if (now >= lightningTimer && !lightningBolt) {
    triggerLightning(w, h);
    // Schedule next lightning 3-8s from now
    lightningTimer = now + 3000 + Math.random() * 5000;
  }

  // --- Draw lightning bolt ---
  if (lightningBolt) {
    const elapsed  = now - (lightningFadeEnd - 300);
    const progress = Math.min(elapsed / 300, 1);
    const alpha    = lightningBolt.alpha * (1 - progress);

    if (alpha > 0.01) {
      ctx.save();
      ctx.shadowColor = 'rgba(180, 210, 255, 0.8)';
      ctx.shadowBlur  = 16;

      // Draw main bolt
      drawBoltPath(ctx, lightningBolt.mainPoints, `rgba(200, 220, 255, ${alpha})`, 2.5);

      // Draw branches (thinner, lower alpha)
      lightningBolt.branches.forEach(branch => {
        drawBoltPath(ctx, branch, `rgba(200, 220, 255, ${alpha * 0.6})`, 1.2);
      });

      ctx.restore();
    } else {
      lightningBolt = null;
    }
  }
}

function drawBoltPath(ctx, points, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineWidth;
  ctx.lineJoin    = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

/**
 * Stop the animation and clean up.
 */
export function stopThunderstorm() {
  if (stormAnimationId) {
    clearInterval(stormAnimationId);
    stormAnimationId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (stormContext && stormCanvas) {
    stormContext.clearRect(0, 0, stormCanvas.width, stormCanvas.height);
  }

  if (stormCanvas && stormCanvas.parentNode) {
    stormCanvas.remove();
    stormCanvas  = null;
    stormContext = null;
  }

  rainDrops     = [];
  lightningBolt = null;
  stormTime     = 0;

  console.log('[Thunderstorm] Animation stopped');
}

/**
 * Check if Thunderstorm animation is currently running.
 */
export function isThunderstormActive() {
  return stormAnimationId !== null;
}
