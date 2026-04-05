/**
 * Lava Lamp Animation
 * 7 drifting blobs with radial gradients, bouncing off canvas edges,
 * slowly growing and shrinking. Low opacity background effect.
 *
 * Runs at ~30 fps via setInterval (33 ms tick).
 */

let lavaCanvas    = null;
let lavaContext   = null;
let lavaAnimationId = null; // setInterval handle
let resizeHandler   = null;
let lavaBlobs       = [];
let lavaTime        = 0;

const BLOB_COLORS = ['#ff4500', '#ff6b2b', '#ff8c00', '#cc3300', '#ff2200'];
const BLOB_COUNT  = 7;

function createBlobs(w, h) {
  lavaBlobs = [];
  for (let i = 0; i < BLOB_COUNT; i++) {
    lavaBlobs.push({
      x:         Math.random() * w,
      y:         Math.random() * h,
      baseRadius: 60 + Math.random() * 60,     // 60-120px
      dx:        (Math.random() - 0.5) * 1.2,  // -0.6 to +0.6 px/frame
      dy:        (Math.random() - 0.5) * 1.2,
      phase:     Math.random() * Math.PI * 2,  // sine phase for radius oscillation
      period:    4 + Math.random() * 4,        // 4-8s oscillation period
      color:     BLOB_COLORS[Math.floor(Math.random() * BLOB_COLORS.length)],
    });
  }
}

/**
 * Initialize Lava Lamp animation.
 */
export function startLavaLamp() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  lavaCanvas = document.getElementById('lavaLampCanvas');
  if (!lavaCanvas) {
    lavaCanvas = document.createElement('canvas');
    lavaCanvas.id = 'lavaLampCanvas';
    lavaCanvas.style.position = 'fixed';
    lavaCanvas.style.top = '0';
    lavaCanvas.style.left = '0';
    lavaCanvas.style.width = '100%';
    lavaCanvas.style.height = '100%';
    lavaCanvas.style.zIndex = '-1';
    lavaCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(lavaCanvas);
    } else {
      document.body.insertBefore(lavaCanvas, document.body.firstChild);
    }
  }

  lavaContext = lavaCanvas.getContext('2d');
  resizeLavaCanvas();

  resizeHandler = resizeLavaCanvas;
  window.addEventListener('resize', resizeHandler);

  startLavaLoop();
  console.log('[Lava Lamp] Animation started');
}

function resizeLavaCanvas() {
  if (!lavaCanvas) return;
  lavaCanvas.width  = window.innerWidth;
  lavaCanvas.height = window.innerHeight;
  createBlobs(lavaCanvas.width, lavaCanvas.height);
}

function startLavaLoop() {
  if (lavaAnimationId) return;

  lavaAnimationId = setInterval(() => {
    if (!lavaContext || !lavaCanvas) return;
    drawLavaFrame();
    lavaTime += 33; // ms elapsed
  }, 33);
}

function drawLavaFrame() {
  const w   = lavaCanvas.width;
  const h   = lavaCanvas.height;
  const ctx = lavaContext;

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  lavaBlobs.forEach(blob => {
    // Drift
    blob.x += blob.dx;
    blob.y += blob.dy;

    // Bounce off edges with a slight random deflection
    if (blob.x < 0 || blob.x > w) {
      blob.dx *= -1;
      blob.dx += (Math.random() - 0.5) * 0.1;
      blob.x   = Math.max(0, Math.min(w, blob.x));
    }
    if (blob.y < 0 || blob.y > h) {
      blob.dy *= -1;
      blob.dy += (Math.random() - 0.5) * 0.1;
      blob.y   = Math.max(0, Math.min(h, blob.y));
    }

    // Radius oscillation using sine wave (period in seconds)
    const t      = lavaTime / 1000; // seconds
    const osc    = Math.sin(t * (Math.PI * 2 / blob.period) + blob.phase);
    const radius = blob.baseRadius + osc * 20;

    // Check proximity to other blobs — boost opacity when close
    let proximityBoost = 0;
    lavaBlobs.forEach(other => {
      if (other === blob) return;
      const dist = Math.hypot(blob.x - other.x, blob.y - other.y);
      const mergeThresh = (radius + other.baseRadius) * 0.8;
      if (dist < mergeThresh) {
        proximityBoost = Math.max(proximityBoost, (1 - dist / mergeThresh) * 0.15);
      }
    });

    const alpha = 0.35 + proximityBoost;

    // Draw blob with radial gradient
    const grad = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, radius);
    grad.addColorStop(0,   hexToRgba(blob.color, alpha + 0.1));
    grad.addColorStop(0.5, hexToRgba(blob.color, alpha));
    grad.addColorStop(1,   hexToRgba(blob.color, 0));

    ctx.beginPath();
    ctx.arc(blob.x, blob.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  });
}

/** Convert a 6-digit hex color to rgba() string. */
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

/**
 * Stop the animation and clean up.
 */
export function stopLavaLamp() {
  if (lavaAnimationId) {
    clearInterval(lavaAnimationId);
    lavaAnimationId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (lavaContext && lavaCanvas) {
    lavaContext.clearRect(0, 0, lavaCanvas.width, lavaCanvas.height);
  }

  if (lavaCanvas && lavaCanvas.parentNode) {
    lavaCanvas.remove();
    lavaCanvas  = null;
    lavaContext = null;
  }

  lavaBlobs = [];
  lavaTime  = 0;

  console.log('[Lava Lamp] Animation stopped');
}

/**
 * Check if Lava Lamp animation is currently running.
 */
export function isLavaLampActive() {
  return lavaAnimationId !== null;
}
