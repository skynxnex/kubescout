/**
 * Ocean Bubbles Animation
 * Bubbles rising from the bottom of the screen.
 *
 * Each bubble has a random x position, random speed (0.3–1.2 px/frame),
 * and slight horizontal drift via sine wave. Semi-transparent cyan circles.
 * Pool of ~60 bubbles, respawned at the bottom when they reach the top.
 *
 * Runs at ~30 fps via setInterval (33 ms tick).
 */

let oceanCanvas    = null;
let oceanContext   = null;
let oceanAnimId    = null; // setInterval handle
let oceanBubbles   = [];
let resizeHandler  = null;

const BUBBLE_COUNT = 60;

// ---------------------------------------------------------------------------
// Bubble class
// ---------------------------------------------------------------------------

class Bubble {
  constructor() {
    this.reset(true);
  }

  /**
   * Place the bubble at a random starting position.
   * @param {boolean} initialScatter - if true, start at random y across screen
   */
  reset(initialScatter = false) {
    const w = oceanCanvas ? oceanCanvas.width  : window.innerWidth;
    const h = oceanCanvas ? oceanCanvas.height : window.innerHeight;

    this.x      = Math.random() * w;
    this.y      = initialScatter ? Math.random() * h : h + Math.random() * 40;
    this.radius = 2 + Math.random() * 6;              // 2–8 px
    this.speed  = 0.3 + Math.random() * 0.9;          // 0.3–1.2 px per frame
    this.drift  = Math.random() * 2 - 1;              // sine drift amplitude
    this.phase  = Math.random() * Math.PI * 2;        // sine offset
    this.alpha  = 0.15 + Math.random() * 0.2;         // 0.15–0.35
    this.canvasH = h;
  }

  update() {
    this.y     -= this.speed;
    this.x     += Math.sin(this.phase + this.y * 0.03) * this.drift * 0.5;
    if (this.y + this.radius < 0) {
      this.reset(false);
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(72, 202, 228, ${this.alpha})`;
    ctx.fill();

    // Subtle highlight at top-left of bubble
    ctx.beginPath();
    ctx.arc(
      this.x - this.radius * 0.3,
      this.y - this.radius * 0.3,
      this.radius * 0.35,
      0, Math.PI * 2
    );
    ctx.fillStyle = `rgba(200, 240, 255, ${this.alpha * 0.6})`;
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize Ocean Bubbles animation.
 */
export function startOceanBubbles() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  oceanCanvas = document.getElementById('oceanCanvas');
  if (!oceanCanvas) {
    oceanCanvas = document.createElement('canvas');
    oceanCanvas.id = 'oceanCanvas';
    oceanCanvas.style.position = 'fixed';
    oceanCanvas.style.top = '0';
    oceanCanvas.style.left = '0';
    oceanCanvas.style.width = '100%';
    oceanCanvas.style.height = '100%';
    oceanCanvas.style.zIndex = '-1';
    oceanCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(oceanCanvas);
    } else {
      document.body.insertBefore(oceanCanvas, document.body.firstChild);
    }
  }

  oceanContext = oceanCanvas.getContext('2d');
  resizeOceanCanvas();

  // Spawn bubbles
  oceanBubbles = [];
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    oceanBubbles.push(new Bubble());
  }

  resizeHandler = resizeOceanCanvas;
  window.addEventListener('resize', resizeHandler);

  startOceanLoop();
  console.log('[Ocean Bubbles] Animation started');
}

/**
 * Resize canvas and redistribute bubbles.
 */
function resizeOceanCanvas() {
  if (!oceanCanvas) return;
  oceanCanvas.width  = window.innerWidth;
  oceanCanvas.height = window.innerHeight;

  // Reset all bubbles to new dimensions
  oceanBubbles.forEach(b => b.reset(true));
}

/**
 * Start the draw loop at ~30 fps.
 */
function startOceanLoop() {
  if (oceanAnimId) return;

  oceanAnimId = setInterval(() => {
    if (!oceanContext || !oceanCanvas) return;

    // Clear canvas — ocean background is CSS, so we clear to transparent
    oceanContext.clearRect(0, 0, oceanCanvas.width, oceanCanvas.height);

    // Draw a very subtle dark gradient at the bottom to add depth
    const grad = oceanContext.createLinearGradient(0, oceanCanvas.height * 0.7, 0, oceanCanvas.height);
    grad.addColorStop(0, 'rgba(2, 11, 24, 0)');
    grad.addColorStop(1, 'rgba(2, 11, 24, 0.3)');
    oceanContext.fillStyle = grad;
    oceanContext.fillRect(0, 0, oceanCanvas.width, oceanCanvas.height);

    // Update and draw each bubble
    oceanBubbles.forEach(bubble => {
      bubble.update();
      bubble.draw(oceanContext);
    });
  }, 33);
}

/**
 * Stop the animation and clean up.
 */
export function stopOceanBubbles() {
  if (oceanAnimId) {
    clearInterval(oceanAnimId);
    oceanAnimId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (oceanContext && oceanCanvas) {
    oceanContext.clearRect(0, 0, oceanCanvas.width, oceanCanvas.height);
  }

  if (oceanCanvas && oceanCanvas.parentNode) {
    oceanCanvas.remove();
    oceanCanvas  = null;
    oceanContext = null;
  }

  oceanBubbles = [];
  console.log('[Ocean Bubbles] Animation stopped');
}

/**
 * Check if Ocean Bubbles animation is currently running.
 */
export function isOceanBubblesActive() {
  return oceanAnimId !== null;
}
