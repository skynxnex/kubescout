/**
 * Windows 95 Screensaver Animation
 *
 * The iconic bouncing DVD-logo effect, Win95 edition.
 * A Windows logo (four coloured squares in a 2x2 grid) drifts slowly
 * across the teal desktop. When it hits an edge it bounces — and if it
 * hits a CORNER, the canvas flashes briefly, exactly like the real DVD
 * screensaver moment everyone waited for.
 *
 * Runs at ~60 fps via requestAnimationFrame.
 * Canvas is z-index -1 (background) with pointer-events: none.
 *
 * Exported API:
 *   startWin95Screensaver()
 *   stopWin95Screensaver()
 *   isWin95ScreensaverActive() -> boolean
 */

const MODULE = '[Win95Screensaver]';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let canvas = null;
let ctx = null;
let animFrameId = null;
let resizeHandler = null;
let active = false;

// Logo position and velocity
let logoX = 0;
let logoY = 0;
let velX = 1.2;
let velY = 0.9;

// Corner flash state
let flashAlpha = 0;          // 0 = no flash, 1 = full flash
const FLASH_DECAY = 0.04;    // how fast the flash fades per frame

// Logo dimensions
const LOGO_SIZE = 36;        // total logo square size (px) — 2x2 grid of four coloured squares
const LOGO_GAP  = 2;         // gap between the four squares
const QUAD_SIZE = (LOGO_SIZE - LOGO_GAP) / 2;  // each coloured quadrant

// Classic Windows logo four-colour palette (Win95 era)
const WIN_COLORS = [
  '#ff0000', // top-left    — red
  '#00b050', // top-right   — green
  '#0070c0', // bottom-left — blue
  '#ffff00', // bottom-right — yellow
];

// Slight transparency so it feels like a background effect
const LOGO_ALPHA = 0.22;

// ---------------------------------------------------------------------------
// Canvas setup
// ---------------------------------------------------------------------------

function createCanvas() {
  canvas = document.createElement('canvas');
  canvas.id = 'win95ScreensaverCanvas';
  canvas.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 100%',
    'height: 100%',
    'z-index: -1',
    'pointer-events: none',
  ].join(';');
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  resizeToWindow();
}

function resizeToWindow() {
  if (!canvas) return;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  // Keep logo inside bounds after resize
  logoX = Math.min(logoX, canvas.width  - LOGO_SIZE);
  logoY = Math.min(logoY, canvas.height - LOGO_SIZE);
}

// ---------------------------------------------------------------------------
// Initial position — random spot away from edges
// ---------------------------------------------------------------------------

function randomiseStartPosition() {
  const margin = LOGO_SIZE * 2;
  const w = canvas.width;
  const h = canvas.height;
  logoX = margin + Math.random() * (w - margin * 2);
  logoY = margin + Math.random() * (h - margin * 2);
  // Random direction, always moving
  velX = (Math.random() < 0.5 ? 1 : -1) * (0.8 + Math.random() * 0.7);
  velY = (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.6);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function drawLogo(x, y) {
  ctx.save();
  ctx.globalAlpha = LOGO_ALPHA;

  // top-left — red
  ctx.fillStyle = WIN_COLORS[0];
  ctx.fillRect(x, y, QUAD_SIZE, QUAD_SIZE);

  // top-right — green
  ctx.fillStyle = WIN_COLORS[1];
  ctx.fillRect(x + QUAD_SIZE + LOGO_GAP, y, QUAD_SIZE, QUAD_SIZE);

  // bottom-left — blue
  ctx.fillStyle = WIN_COLORS[2];
  ctx.fillRect(x, y + QUAD_SIZE + LOGO_GAP, QUAD_SIZE, QUAD_SIZE);

  // bottom-right — yellow
  ctx.fillStyle = WIN_COLORS[3];
  ctx.fillRect(x + QUAD_SIZE + LOGO_GAP, y + QUAD_SIZE + LOGO_GAP, QUAD_SIZE, QUAD_SIZE);

  ctx.restore();
}

function drawCornerFlash() {
  if (flashAlpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = flashAlpha * 0.35;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  flashAlpha = Math.max(0, flashAlpha - FLASH_DECAY);
}

// ---------------------------------------------------------------------------
// Animation loop
// ---------------------------------------------------------------------------

function tick() {
  if (!active) return;

  const w = canvas.width;
  const h = canvas.height;

  // Clear — transparent so the teal desktop shows through
  ctx.clearRect(0, 0, w, h);

  // Update position
  logoX += velX;
  logoY += velY;

  // Track which walls were hit this frame
  let hitX = false;
  let hitY = false;

  // Bounce off right/left
  if (logoX + LOGO_SIZE >= w) {
    logoX = w - LOGO_SIZE;
    velX  = -Math.abs(velX);
    hitX  = true;
  } else if (logoX <= 0) {
    logoX = 0;
    velX  = Math.abs(velX);
    hitX  = true;
  }

  // Bounce off bottom/top
  if (logoY + LOGO_SIZE >= h) {
    logoY = h - LOGO_SIZE;
    velY  = -Math.abs(velY);
    hitY  = true;
  } else if (logoY <= 0) {
    logoY = 0;
    velY  = Math.abs(velY);
    hitY  = true;
  }

  // Corner hit — THAT moment
  if (hitX && hitY) {
    flashAlpha = 1;
    console.log(`${MODULE} Corner hit! The crowd goes wild.`);
  }

  // Draw corner flash (fades over time)
  drawCornerFlash();

  // Draw the Windows logo
  drawLogo(logoX, logoY);

  animFrameId = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Start the Win95 screensaver bouncing logo animation.
 * Respects prefers-reduced-motion — will skip if user prefers reduced motion.
 */
export function startWin95Screensaver() {
  if (active) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    console.log(`${MODULE} Skipping animation — prefers-reduced-motion is set.`);
    return;
  }

  console.log(`${MODULE} Starting Win95 screensaver.`);

  createCanvas();
  randomiseStartPosition();
  active = true;

  resizeHandler = () => resizeToWindow();
  window.addEventListener('resize', resizeHandler);

  animFrameId = requestAnimationFrame(tick);
}

/**
 * Stop the animation and remove the canvas from the DOM.
 */
export function stopWin95Screensaver() {
  if (!active) return;

  console.log(`${MODULE} Stopping Win95 screensaver.`);
  active = false;

  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (canvas && canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }
  canvas = null;
  ctx    = null;
}

/**
 * Returns true if the screensaver is currently running.
 */
export function isWin95ScreensaverActive() {
  return active;
}
