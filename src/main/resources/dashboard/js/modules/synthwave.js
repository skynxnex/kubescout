/**
 * Synthwave Sunset Animation
 * Classic Outrun/retrowave scene: gradient sky, striped sun, perspective grid floor.
 * Grid horizontal lines scroll toward the viewer for a hypnotic driving effect.
 *
 * Runs at ~30 fps via setInterval (33 ms tick).
 */

let swCanvas    = null;
let swContext   = null;
let swAnimationId = null; // setInterval handle
let resizeHandler  = null;

// Scrolling grid state
let gridOffset = 0;    // pixel offset for horizontal line scroll
const GRID_SCROLL_SPEED = 1.2; // px per frame (slow, hypnotic)

// Static stars
let swStars = [];
const STAR_COUNT = 80;

function createStars(w, horizonY) {
  swStars = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    swStars.push({
      x:    Math.random() * w,
      y:    Math.random() * horizonY * 0.95,
      size: 0.5 + Math.random() * 1.5,
      alpha: 0.4 + Math.random() * 0.6,
    });
  }
}

/**
 * Initialize Synthwave animation.
 */
export function startSynthwave() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  swCanvas = document.getElementById('synthwaveCanvas');
  if (!swCanvas) {
    swCanvas = document.createElement('canvas');
    swCanvas.id = 'synthwaveCanvas';
    swCanvas.style.position = 'fixed';
    swCanvas.style.top = '0';
    swCanvas.style.left = '0';
    swCanvas.style.width = '100%';
    swCanvas.style.height = '100%';
    swCanvas.style.zIndex = '-1';
    swCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(swCanvas);
    } else {
      document.body.insertBefore(swCanvas, document.body.firstChild);
    }
  }

  swContext = swCanvas.getContext('2d');
  resizeSynthwaveCanvas();

  resizeHandler = resizeSynthwaveCanvas;
  window.addEventListener('resize', resizeHandler);

  startSynthwaveLoop();
  console.log('[Synthwave] Animation started');
}

function resizeSynthwaveCanvas() {
  if (!swCanvas) return;
  swCanvas.width  = window.innerWidth;
  swCanvas.height = window.innerHeight;
  const horizonY = swCanvas.height * 0.60;
  createStars(swCanvas.width, horizonY);
}

function startSynthwaveLoop() {
  if (swAnimationId) return;

  swAnimationId = setInterval(() => {
    if (!swContext || !swCanvas) return;
    drawSynthwaveFrame();
    gridOffset = (gridOffset + GRID_SCROLL_SPEED) % 80; // modulo a reasonable grid step
  }, 33);
}

function drawSynthwaveFrame() {
  const w         = swCanvas.width;
  const h         = swCanvas.height;
  const ctx       = swContext;
  const horizonY  = h * 0.60;
  const vanishX   = w / 2;

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  // --- Sky gradient (top 60%) ---
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0,   '#0d0015');
  skyGrad.addColorStop(0.6, '#1a0030');
  skyGrad.addColorStop(1,   '#3d0030');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, horizonY);

  // --- Stars ---
  swStars.forEach(star => {
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 200, 240, ${star.alpha})`;
    ctx.fill();
  });

  // --- Sun ---
  const sunR  = Math.min(w, h) * 0.10; // ~10% of smallest dimension
  const sunX  = vanishX;
  const sunY  = horizonY;

  const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
  sunGrad.addColorStop(0,   'rgba(255, 255, 180, 1.0)');
  sunGrad.addColorStop(0.3, 'rgba(255, 140, 40, 0.95)');
  sunGrad.addColorStop(0.7, 'rgba(255, 0, 120, 0.85)');
  sunGrad.addColorStop(1,   'rgba(140, 0, 80, 0)');

  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fillStyle = sunGrad;
  ctx.fill();

  // Horizontal stripes across sun (classic retro look)
  // Only draw stripes in the lower half of the sun circle
  const stripeCount = 6;
  const stripeArea  = sunR; // only inside the circle radius
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.clip();
  for (let s = 0; s < stripeCount; s++) {
    const stripeY = sunY - sunR * 0.05 + (s / stripeCount) * stripeArea;
    const stripeH = sunR * 0.10;
    ctx.fillStyle = 'rgba(13, 0, 21, 0.55)';
    ctx.fillRect(sunX - sunR, stripeY, sunR * 2, stripeH);
  }
  ctx.restore();

  // --- Floor (bottom 40%) ---
  ctx.fillStyle = '#0d0015';
  ctx.fillRect(0, horizonY, w, h - horizonY);

  // Perspective grid: vertical diverging lines
  const lineCount = 14;
  for (let i = 0; i <= lineCount; i++) {
    const t       = i / lineCount; // 0..1 left to right
    const floorX  = t * w;
    const deltaX  = floorX - vanishX;

    ctx.beginPath();
    ctx.moveTo(vanishX + deltaX * 0.01, horizonY);
    ctx.lineTo(floorX, h);
    ctx.strokeStyle = 'rgba(255, 0, 170, 0.45)';
    ctx.lineWidth   = 1;
    ctx.stroke();
  }

  // Perspective grid: horizontal scrolling lines
  // Lines converge at vanishing point — use a perspective projection
  // Number of horizontal lines visible at any time
  const hLineCount = 16;
  for (let j = 0; j < hLineCount; j++) {
    // t goes from 0 (horizon) to 1 (bottom of screen)
    // Apply perspective: lines bunch up near horizon
    const rawT = (j / hLineCount + gridOffset / (h * 0.4)) % 1;
    const t    = rawT * rawT; // squared to create foreshortening
    const lineY = horizonY + t * (h - horizonY);

    // Width of the grid line at this depth (narrows near horizon)
    const lineAlpha = 0.2 + t * 0.3;

    ctx.beginPath();
    // Horizontal lines span from left edge to right edge (full width)
    ctx.moveTo(0, lineY);
    ctx.lineTo(w, lineY);
    ctx.strokeStyle = `rgba(170, 0, 255, ${lineAlpha})`;
    ctx.lineWidth   = 1;
    ctx.stroke();
  }
}

/**
 * Stop the animation and clean up.
 */
export function stopSynthwave() {
  if (swAnimationId) {
    clearInterval(swAnimationId);
    swAnimationId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (swContext && swCanvas) {
    swContext.clearRect(0, 0, swCanvas.width, swCanvas.height);
  }

  if (swCanvas && swCanvas.parentNode) {
    swCanvas.remove();
    swCanvas  = null;
    swContext = null;
  }

  swStars    = [];
  gridOffset = 0;

  console.log('[Synthwave] Animation stopped');
}

/**
 * Check if Synthwave animation is currently running.
 */
export function isSynthwaveActive() {
  return swAnimationId !== null;
}
