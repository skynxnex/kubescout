/**
 * Deep Space Nebula Animation
 * 200 twinkling stars + 4 drifting nebula cloud blobs using radial gradients.
 *
 * Runs at ~30 fps via setInterval (33 ms tick).
 */

let nebulaCanvas    = null;
let nebulaContext   = null;
let nebulaAnimationId = null; // setInterval handle
let resizeHandler     = null;
let nebulaTime        = 0;

let stars       = [];
let nebulaClouds = [];

const STAR_COUNT  = 200;
const CLOUD_COUNT = 5;

// Available nebula cloud colors (r, g, b, maxAlpha)
const CLOUD_COLORS = [
  { r: 180, g: 60,  b: 255, a: 0.06 }, // purple
  { r: 255, g: 60,  b: 180, a: 0.05 }, // pink
  { r: 255, g: 140, b: 60,  a: 0.04 }, // orange
  { r: 60,  g: 200, b: 255, a: 0.05 }, // cyan
  { r: 100, g: 40,  b: 255, a: 0.06 }, // deep violet
];

function createStars(w, h) {
  stars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    stars.push({
      x:        Math.random() * w,
      y:        Math.random() * h,
      size:     0.5 + Math.random() * 1.5, // 0.5-2px
      baseAlpha: 0.4 + Math.random() * 0.6,
      phase:    Math.random() * Math.PI * 2,
      speed:    0.0003 + Math.random() * 0.0008,
    });
  }
}

function createClouds(w, h) {
  nebulaClouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const col = CLOUD_COLORS[i % CLOUD_COLORS.length];
    nebulaClouds.push({
      x:      Math.random() * w,
      y:      Math.random() * h,
      radius: 150 + Math.random() * 150,  // 150-300px
      dx:     (Math.random() - 0.5) * 0.2,
      dy:     (Math.random() - 0.5) * 0.1,
      r: col.r, g: col.g, b: col.b, maxAlpha: col.a,
    });
  }
}

/**
 * Initialize Nebula animation.
 */
export function startNebula() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  nebulaCanvas = document.getElementById('nebulaCanvas');
  if (!nebulaCanvas) {
    nebulaCanvas = document.createElement('canvas');
    nebulaCanvas.id = 'nebulaCanvas';
    nebulaCanvas.style.position = 'fixed';
    nebulaCanvas.style.top = '0';
    nebulaCanvas.style.left = '0';
    nebulaCanvas.style.width = '100%';
    nebulaCanvas.style.height = '100%';
    nebulaCanvas.style.zIndex = '-1';
    nebulaCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(nebulaCanvas);
    } else {
      document.body.insertBefore(nebulaCanvas, document.body.firstChild);
    }
  }

  nebulaContext = nebulaCanvas.getContext('2d');
  resizeNebulaCanvas();

  resizeHandler = resizeNebulaCanvas;
  window.addEventListener('resize', resizeHandler);

  startNebulaLoop();
  console.log('[Nebula] Animation started');
}

function resizeNebulaCanvas() {
  if (!nebulaCanvas) return;
  nebulaCanvas.width  = window.innerWidth;
  nebulaCanvas.height = window.innerHeight;
  createStars(nebulaCanvas.width, nebulaCanvas.height);
  createClouds(nebulaCanvas.width, nebulaCanvas.height);
}

function startNebulaLoop() {
  if (nebulaAnimationId) return;

  nebulaAnimationId = setInterval(() => {
    if (!nebulaContext || !nebulaCanvas) return;
    drawNebulaFrame();
    nebulaTime += 1;
  }, 33);
}

function drawNebulaFrame() {
  const w   = nebulaCanvas.width;
  const h   = nebulaCanvas.height;
  const ctx = nebulaContext;

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  // --- Layer 1: Nebula clouds ---
  nebulaClouds.forEach(cloud => {
    // Drift
    cloud.x += cloud.dx;
    cloud.y += cloud.dy;

    // Wrap around edges with padding
    if (cloud.x < -cloud.radius) cloud.x = w + cloud.radius;
    if (cloud.x > w + cloud.radius) cloud.x = -cloud.radius;
    if (cloud.y < -cloud.radius) cloud.y = h + cloud.radius;
    if (cloud.y > h + cloud.radius) cloud.y = -cloud.radius;

    const grad = ctx.createRadialGradient(
      cloud.x, cloud.y, 0,
      cloud.x, cloud.y, cloud.radius
    );
    grad.addColorStop(0,   `rgba(${cloud.r},${cloud.g},${cloud.b},${cloud.maxAlpha})`);
    grad.addColorStop(0.5, `rgba(${cloud.r},${cloud.g},${cloud.b},${cloud.maxAlpha * 0.5})`);
    grad.addColorStop(1,   `rgba(${cloud.r},${cloud.g},${cloud.b},0)`);

    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  });

  // --- Layer 2: Stars ---
  stars.forEach(star => {
    // Twinkle using slow sine oscillation
    const osc   = Math.sin(nebulaTime * star.speed * Math.PI * 2 + star.phase);
    const alpha = star.baseAlpha * (0.6 + 0.4 * ((osc + 1) / 2));

    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220, 210, 255, ${alpha})`;
    ctx.fill();
  });
}

/**
 * Stop the animation and clean up.
 */
export function stopNebula() {
  if (nebulaAnimationId) {
    clearInterval(nebulaAnimationId);
    nebulaAnimationId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (nebulaContext && nebulaCanvas) {
    nebulaContext.clearRect(0, 0, nebulaCanvas.width, nebulaCanvas.height);
  }

  if (nebulaCanvas && nebulaCanvas.parentNode) {
    nebulaCanvas.remove();
    nebulaCanvas  = null;
    nebulaContext = null;
  }

  stars        = [];
  nebulaClouds = [];
  nebulaTime   = 0;

  console.log('[Nebula] Animation stopped');
}

/**
 * Check if Nebula animation is currently running.
 */
export function isNebulaActive() {
  return nebulaAnimationId !== null;
}
