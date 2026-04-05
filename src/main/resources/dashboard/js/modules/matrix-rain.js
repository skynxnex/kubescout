/**
 * Matrix Digital Rain Animation
 * Classic falling green characters effect from The Matrix.
 *
 * Each column gets its own random fall speed so drops are naturally
 * desynchronised — no lockstep jumping. The draw loop runs on setInterval
 * at 50 ms (20 fps). Characters are drawn only when a drop crosses into a
 * new row to prevent brightness saturation at slow speeds.
 */

let matrixCanvas   = null;
let matrixContext  = null;
let matrixAnimationId = null; // setInterval handle
let matrixDrops    = [];      // current row position (fractional) per column
let matrixSpeeds   = [];      // rows-per-tick speed per column
let matrixPrevRows = [];      // last integer row drawn per column
let resizeHandler  = null;

// Matrix characters - mix of Katakana, Latin, and numbers
const MATRIX_CHARS = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Speed range in rows/tick (tick = 50 ms).
// 0.06 rows/tick × 20 ticks/s = 1.2 rows/s  (slowest)
// 0.18 rows/tick × 20 ticks/s = 3.6 rows/s  (fastest)
const SPEED_MIN = 0.06;
const SPEED_MAX = 0.18;

function randomSpeed() {
  return SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
}

function initDrops(columns) {
  matrixDrops    = [];
  matrixSpeeds   = [];
  matrixPrevRows = [];
  for (let i = 0; i < columns; i++) {
    matrixDrops[i]    = Math.random() * -100; // staggered start above viewport
    matrixSpeeds[i]   = randomSpeed();
    matrixPrevRows[i] = -Infinity;
  }
}

/**
 * Initialize Matrix rain animation
 */
export function initMatrixRain() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  matrixCanvas = document.getElementById('matrixCanvas');
  if (!matrixCanvas) {
    matrixCanvas = document.createElement('canvas');
    matrixCanvas.id = 'matrixCanvas';
    matrixCanvas.style.position = 'fixed';
    matrixCanvas.style.top = '0';
    matrixCanvas.style.left = '0';
    matrixCanvas.style.width = '100%';
    matrixCanvas.style.height = '100%';
    matrixCanvas.style.zIndex = '-1';
    matrixCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(matrixCanvas);
    } else {
      document.body.insertBefore(matrixCanvas, document.body.firstChild);
    }
  }

  matrixContext = matrixCanvas.getContext('2d');
  resizeMatrixCanvas();
  startMatrixRain();

  resizeHandler = resizeMatrixCanvas;
  window.addEventListener('resize', resizeHandler);
}

/**
 * Resize canvas to match window size and reinitialise drops.
 */
function resizeMatrixCanvas() {
  if (!matrixCanvas) return;
  matrixCanvas.width  = window.innerWidth;
  matrixCanvas.height = window.innerHeight;
  initDrops(Math.floor(matrixCanvas.width / 20));
}

/**
 * Start the animation loop (setInterval, 50 ms = 20 fps).
 */
function startMatrixRain() {
  if (matrixAnimationId) return;

  matrixAnimationId = setInterval(() => {
    if (!matrixContext || !matrixCanvas) return;

    // Fade the whole canvas slightly each tick to create the trailing glow.
    matrixContext.fillStyle = 'rgba(0, 0, 0, 0.05)';
    matrixContext.fillRect(0, 0, matrixCanvas.width, matrixCanvas.height);

    matrixContext.font = '16px monospace';

    const columns = Math.floor(matrixCanvas.width / 20);

    for (let i = 0; i < columns; i++) {
      matrixDrops[i] += matrixSpeeds[i];

      const row = Math.floor(matrixDrops[i]);

      // Draw a character only when the drop enters a new row — prevents
      // painting the same pixel repeatedly and saturating to solid green.
      if (row !== matrixPrevRows[i] && row >= 0) {
        const char    = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        const isFront = Math.random() > 0.975;
        matrixContext.fillStyle = isFront ? '#ffffff' : '#00ff00';
        matrixContext.fillText(char, i * 20, row * 20);
        matrixPrevRows[i] = row;
      }

      // Reset drop to just above the top once it leaves the canvas.
      if (matrixDrops[i] * 20 > matrixCanvas.height && Math.random() > 0.975) {
        matrixDrops[i]    = Math.random() * -20;
        matrixSpeeds[i]   = randomSpeed(); // new speed on each pass
        matrixPrevRows[i] = -Infinity;
      }
    }
  }, 50);
}

/**
 * Stop the animation and remove the canvas from the DOM.
 */
export function stopMatrixRain() {
  if (matrixAnimationId) {
    clearInterval(matrixAnimationId);
    matrixAnimationId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (matrixContext && matrixCanvas) {
    matrixContext.clearRect(0, 0, matrixCanvas.width, matrixCanvas.height);
  }

  if (matrixCanvas && matrixCanvas.parentNode) {
    matrixCanvas.remove();
    matrixCanvas  = null;
    matrixContext = null;
  }
}

/**
 * Check if Matrix rain is currently running.
 */
export function isMatrixRainActive() {
  return matrixAnimationId !== null;
}
