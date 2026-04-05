/**
 * Aurora Borealis Animation
 * Soft horizontal colour bands (greens, purples, teals) that slowly
 * undulate across the top portion of the screen using layered sine waves.
 *
 * Runs at ~30 fps via setInterval (33 ms tick).
 * Very low opacity (0.15-0.25) so the UI remains readable.
 */

let auroraCanvas  = null;
let auroraContext = null;
let auroraAnimationId = null; // setInterval handle
let auroraTime    = 0;
let resizeHandler = null;

// Aurora colour bands — each entry defines one undulating ribbon
const AURORA_BANDS = [
  { hue: 160, saturation: 100, lightness: 50, alpha: 0.18, speed: 0.0008, freq: 1.2, yRatio: 0.15 },
  { hue: 270, saturation:  80, lightness: 55, alpha: 0.15, speed: 0.0006, freq: 0.9, yRatio: 0.22 },
  { hue: 190, saturation: 100, lightness: 55, alpha: 0.20, speed: 0.0010, freq: 1.5, yRatio: 0.10 },
  { hue: 140, saturation:  90, lightness: 45, alpha: 0.14, speed: 0.0007, freq: 0.7, yRatio: 0.30 },
  { hue: 290, saturation:  70, lightness: 60, alpha: 0.12, speed: 0.0005, freq: 1.1, yRatio: 0.08 },
];

/**
 * Initialize Aurora Borealis animation.
 */
export function startAurora() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  auroraCanvas = document.getElementById('auroraCanvas');
  if (!auroraCanvas) {
    auroraCanvas = document.createElement('canvas');
    auroraCanvas.id = 'auroraCanvas';
    auroraCanvas.style.position = 'fixed';
    auroraCanvas.style.top = '0';
    auroraCanvas.style.left = '0';
    auroraCanvas.style.width = '100%';
    auroraCanvas.style.height = '100%';
    auroraCanvas.style.zIndex = '-1';
    auroraCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(auroraCanvas);
    } else {
      document.body.insertBefore(auroraCanvas, document.body.firstChild);
    }
  }

  auroraContext = auroraCanvas.getContext('2d');
  resizeAuroraCanvas();

  resizeHandler = resizeAuroraCanvas;
  window.addEventListener('resize', resizeHandler);

  startAuroraLoop();
  console.log('[Aurora] Animation started');
}

/**
 * Resize canvas to match viewport.
 */
function resizeAuroraCanvas() {
  if (!auroraCanvas) return;
  auroraCanvas.width  = window.innerWidth;
  auroraCanvas.height = window.innerHeight;
}

/**
 * Start the draw loop at ~30 fps.
 */
function startAuroraLoop() {
  if (auroraAnimationId) return;

  auroraAnimationId = setInterval(() => {
    if (!auroraContext || !auroraCanvas) return;
    drawAurora();
    auroraTime += 1;
  }, 33);
}

/**
 * Draw one frame of the aurora.
 */
function drawAurora() {
  const w = auroraCanvas.width;
  const h = auroraCanvas.height;
  const ctx = auroraContext;

  // Clear with a very dark navy so bands accumulate properly
  ctx.fillStyle = 'rgba(10, 14, 26, 0.25)';
  ctx.fillRect(0, 0, w, h);

  AURORA_BANDS.forEach(band => {
    const t = auroraTime * band.speed;

    ctx.beginPath();

    // Build the wavy band top edge across the full width
    const segments = 80;
    const segW = w / segments;

    // Band centre y position — upper portion of screen only
    const bandCentreY = h * band.yRatio;
    const bandHeight  = h * 0.12;

    // Move to left edge
    const y0 = bandCentreY + Math.sin(t * band.freq * Math.PI * 2) * (bandHeight * 0.5);
    ctx.moveTo(0, y0);

    // Draw wavy top edge left to right
    for (let i = 1; i <= segments; i++) {
      const x  = i * segW;
      const phase = (i / segments) * band.freq * Math.PI * 2;
      const y  = bandCentreY
        + Math.sin(t * band.freq * Math.PI * 2 + phase)              * (bandHeight * 0.5)
        + Math.sin(t * band.freq * Math.PI * 1.3 + phase * 1.7)     * (bandHeight * 0.25)
        + Math.sin(t * band.freq * Math.PI * 0.7 + phase * 0.5)     * (bandHeight * 0.15);
      ctx.lineTo(x, y);
    }

    // Close back along bottom edge
    ctx.lineTo(w, h * (band.yRatio + 0.18));
    ctx.lineTo(0, h * (band.yRatio + 0.18));
    ctx.closePath();

    // Vertical gradient for soft fade at top and bottom
    const grad = ctx.createLinearGradient(0, bandCentreY - bandHeight, 0, bandCentreY + bandHeight * 1.5);
    grad.addColorStop(0,   `hsla(${band.hue}, ${band.saturation}%, ${band.lightness}%, 0)`);
    grad.addColorStop(0.3, `hsla(${band.hue}, ${band.saturation}%, ${band.lightness}%, ${band.alpha})`);
    grad.addColorStop(0.7, `hsla(${band.hue}, ${band.saturation}%, ${band.lightness}%, ${band.alpha * 0.7})`);
    grad.addColorStop(1,   `hsla(${band.hue}, ${band.saturation}%, ${band.lightness}%, 0)`);

    ctx.fillStyle = grad;
    ctx.fill();
  });
}

/**
 * Stop the animation and clean up.
 */
export function stopAurora() {
  if (auroraAnimationId) {
    clearInterval(auroraAnimationId);
    auroraAnimationId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (auroraContext && auroraCanvas) {
    auroraContext.clearRect(0, 0, auroraCanvas.width, auroraCanvas.height);
  }

  if (auroraCanvas && auroraCanvas.parentNode) {
    auroraCanvas.remove();
    auroraCanvas  = null;
    auroraContext = null;
  }

  auroraTime = 0;
  console.log('[Aurora] Animation stopped');
}

/**
 * Check if Aurora animation is currently running.
 */
export function isAuroraActive() {
  return auroraAnimationId !== null;
}
