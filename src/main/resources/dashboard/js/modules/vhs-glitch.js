/**
 * VHS Glitch Animation
 * Three layered effects: RGB channel shift, glitch bars, and tracking lines.
 *
 * Runs at ~30 fps via setInterval (33 ms tick).
 */

let vhsCanvas    = null;
let vhsContext   = null;
let vhsAnimationId = null; // setInterval handle
let resizeHandler  = null;
let vhsVideo       = null;

// Tracking lines — slow-drifting dark horizontal bands
const TRACKING_LINES = [
  { y: 0.15, height: 40, speed: 0.18 },
  { y: 0.55, height: 30, speed: 0.12 },
  { y: 0.80, height: 50, speed: 0.22 },
];

// Timers for scheduled effects (in ms)
let glitchBarTimer = 0;
let glitchBarActive = false;
let glitchBarEnd = 0;
let glitchBarRects = [];

let rgbShiftTimer = 0;
let rgbShiftActive = false;
let rgbShiftEnd = 0;

// Film scratches — occasional vertical bright lines
let scratchTimer = 0;
let scratchActive = false;
let scratchEnd = 0;
let scratchLines = [];

/**
 * Initialize VHS Glitch animation.
 */
export function startVhsGlitch() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Create video background
  vhsVideo = document.getElementById('vhsFilmBg');
  if (!vhsVideo) {
    vhsVideo = document.createElement('video');
    vhsVideo.id = 'vhsFilmBg';
    vhsVideo.src = '/dashboard/video/vhs-film.mp4';
    vhsVideo.autoplay = true;
    vhsVideo.loop = true;
    vhsVideo.muted = true;
    vhsVideo.playsInline = true;
    vhsVideo.style.position = 'fixed';
    vhsVideo.style.top = '0';
    vhsVideo.style.left = '0';
    vhsVideo.style.width = '100%';
    vhsVideo.style.height = '100%';
    vhsVideo.style.objectFit = 'cover';
    vhsVideo.style.zIndex = '-2';
    vhsVideo.style.pointerEvents = 'none';
    vhsVideo.style.filter = 'grayscale(1) contrast(1.15) brightness(0.5) blur(0.5px)';
    document.body.appendChild(vhsVideo);
    vhsVideo.play().catch(() => {});
  }

  vhsCanvas = document.getElementById('vhsCanvas');
  if (!vhsCanvas) {
    vhsCanvas = document.createElement('canvas');
    vhsCanvas.id = 'vhsCanvas';
    vhsCanvas.style.position = 'fixed';
    vhsCanvas.style.top = '0';
    vhsCanvas.style.left = '0';
    vhsCanvas.style.width = '100%';
    vhsCanvas.style.height = '100%';
    vhsCanvas.style.zIndex = '-1';
    vhsCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(vhsCanvas);
    } else {
      document.body.insertBefore(vhsCanvas, document.body.firstChild);
    }
  }

  vhsContext = vhsCanvas.getContext('2d');
  resizeVhsCanvas();

  resizeHandler = resizeVhsCanvas;
  window.addEventListener('resize', resizeHandler);

  // Randomise initial tracking line positions
  TRACKING_LINES.forEach(line => {
    line.yPx = line.y * window.innerHeight;
  });

  scheduleGlitchBar();
  scheduleRgbShift();
  scheduleFilmScratch();

  startVhsLoop();
  console.log('[VHS Glitch] Animation started');
}

function resizeVhsCanvas() {
  if (!vhsCanvas) return;
  vhsCanvas.width  = window.innerWidth;
  vhsCanvas.height = window.innerHeight;
  // Reset tracking line pixel positions on resize
  TRACKING_LINES.forEach(line => {
    line.yPx = line.y * vhsCanvas.height;
  });
}

function scheduleGlitchBar() {
  // Fire next glitch bar in 1-4 seconds
  glitchBarTimer = Date.now() + 1000 + Math.random() * 3000;
}

function scheduleRgbShift() {
  // Fire next RGB shift in 2-5 seconds
  rgbShiftTimer = Date.now() + 2000 + Math.random() * 3000;
}

function scheduleFilmScratch() {
  // Fire next scratch in 4-7 seconds
  scratchTimer = Date.now() + 4000 + Math.random() * 3000;
}

function drawFilmGrain(ctx, canvas) {
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;
  // Base background colour: #080603 (R=8, G=6, B=3) + random grain on top
  // Fully opaque so the canvas IS the background — CSS bg-color hidden behind it
  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() * 55) | 0; // 0-55 brightness noise
    data[i]     = 8  + grain;                         // R
    data[i + 1] = 6  + Math.floor(grain * 0.85);      // G (slightly less — warm tint)
    data[i + 2] = 3  + Math.floor(grain * 0.65);      // B (even less — warm sepia)
    data[i + 3] = 160;                                 // Semi-transparent — video film shows through
  }
  ctx.putImageData(imageData, 0, 0);
}

function startVhsLoop() {
  if (vhsAnimationId) return;

  vhsAnimationId = setInterval(() => {
    if (!vhsContext || !vhsCanvas) return;
    drawVhsFrame();
  }, 33);
}

function drawVhsFrame() {
  const w = vhsCanvas.width;
  const h = vhsCanvas.height;
  const ctx = vhsContext;
  const now = Date.now();

  // --- 0. Film grain — replaces clearRect; drawn first so all effects render on top ---
  drawFilmGrain(ctx, vhsCanvas);

  // Tracking lines removed — film video background looks better without them

  // --- 2. RGB channel shift ---
  if (!rgbShiftActive && now >= rgbShiftTimer) {
    rgbShiftActive = true;
    rgbShiftEnd = now + 80 + Math.random() * 120; // 80-200ms
  }
  if (rgbShiftActive) {
    if (now < rgbShiftEnd) {
      // Simulate R/B channel shift with horizontal colored bands at random Y
      const numBands = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < numBands; i++) {
        const bandY = Math.random() * h;
        const bandH = 4 + Math.random() * 20;
        // Red channel shifted right
        ctx.fillStyle = 'rgba(255, 0, 60, 0.12)';
        ctx.fillRect(3, bandY, w, bandH);
        // Blue channel shifted left
        ctx.fillStyle = 'rgba(0, 180, 255, 0.12)';
        ctx.fillRect(-3, bandY, w, bandH);
        // Green tint overlay
        ctx.fillStyle = 'rgba(0, 255, 120, 0.05)';
        ctx.fillRect(0, bandY, w, bandH);
      }
    } else {
      rgbShiftActive = false;
      scheduleRgbShift();
    }
  }

  // --- 3. Glitch bars ---
  if (!glitchBarActive && now >= glitchBarTimer) {
    glitchBarActive = true;
    const count = 1 + Math.floor(Math.random() * 3); // 1-3 bars
    glitchBarRects = [];
    for (let i = 0; i < count; i++) {
      glitchBarRects.push({
        y:      Math.random() * h,
        height: 2 + Math.random() * 6,  // 2-8px
        alpha:  0.6 + Math.random() * 0.2,
        color:  Math.random() < 0.5 ? 'rgba(255,255,255,' : 'rgba(0,234,255,',
      });
    }
    glitchBarEnd = now + 60 + Math.random() * 60; // 60-120ms
  }
  if (glitchBarActive) {
    if (now < glitchBarEnd) {
      glitchBarRects.forEach(bar => {
        ctx.fillStyle = bar.color + bar.alpha + ')';
        ctx.fillRect(0, bar.y, w, bar.height);
      });
    } else {
      glitchBarActive = false;
      scheduleGlitchBar();
    }
  }

  // --- 4. Film scratches — thin vertical bright lines ---
  if (!scratchActive && now >= scratchTimer) {
    scratchActive = true;
    const count = 1 + (Math.random() < 0.4 ? 1 : 0); // 1 line, occasionally 2
    scratchLines = [];
    for (let i = 0; i < count; i++) {
      scratchLines.push({ x: Math.floor(Math.random() * w) });
    }
    scratchEnd = now + 80 + Math.random() * 70; // 80-150ms
  }
  if (scratchActive) {
    if (now < scratchEnd) {
      ctx.strokeStyle = 'rgba(240, 220, 180, 0.7)';
      ctx.lineWidth = 1;
      scratchLines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.x, 0);
        ctx.lineTo(line.x, h);
        ctx.stroke();
      });
    } else {
      scratchActive = false;
      scheduleFilmScratch();
    }
  }
}

/**
 * Stop the animation and clean up.
 */
export function stopVhsGlitch() {
  if (vhsAnimationId) {
    clearInterval(vhsAnimationId);
    vhsAnimationId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (vhsContext && vhsCanvas) {
    vhsContext.clearRect(0, 0, vhsCanvas.width, vhsCanvas.height);
  }

  if (vhsCanvas && vhsCanvas.parentNode) {
    vhsCanvas.remove();
    vhsCanvas  = null;
    vhsContext = null;
  }

  if (vhsVideo && vhsVideo.parentNode) {
    vhsVideo.pause();
    vhsVideo.src = '';
    vhsVideo.parentNode.removeChild(vhsVideo);
    vhsVideo = null;
  }

  // Reset timers and state so next start is clean
  glitchBarActive = false;
  glitchBarEnd    = 0;
  glitchBarTimer  = 0;
  glitchBarRects  = [];
  rgbShiftActive  = false;
  rgbShiftEnd     = 0;
  rgbShiftTimer   = 0;
  scratchActive   = false;
  scratchEnd      = 0;
  scratchTimer    = 0;
  scratchLines    = [];
  TRACKING_LINES.forEach(line => { line.yPx = undefined; });

  console.log('[VHS Glitch] Animation stopped');
}

/**
 * Check if VHS Glitch animation is currently running.
 */
export function isVhsGlitchActive() {
  return vhsAnimationId !== null;
}
