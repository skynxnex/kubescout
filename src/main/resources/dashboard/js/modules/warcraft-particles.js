/**
 * Warcraft Particles Animation
 * Floating magical particles drifting upward, like the ambient particles
 * in WoW's login screen or city ambience (Stormwind, Orgrimmar).
 *
 * Runs at ~30 fps via setInterval (33 ms tick).
 * Particles use WoW's iconic item-quality colour palette with soft glow.
 * Particle types: dots, sparkles (✦), wisps (●), and rune glyphs.
 * Occasional "spell burst" — 8 particles radiate outward from a random point.
 */

let warcraftCanvas = null;
let warcraftContext = null;
let warcraftAnimationId = null; // setInterval handle
let warcraftResizeHandler = null;

const PARTICLE_COUNT = 80;

// WoW item-quality colour palette
const WOW_COLORS = [
  '#ffd100', // WoW gold
  '#ffd100', // gold (weighted higher — most common)
  '#0070dd', // Rare blue
  '#a335ee', // Epic purple
  '#1eff00', // Uncommon green
  '#ffffff', // White sparkle
];

// Particle visual type — determines how it is drawn
const PARTICLE_TYPES = ['dot', 'dot', 'dot', 'sparkle', 'wisp', 'rune'];

// Small set of runic glyphs drawn as text symbols
const RUNE_GLYPHS = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ'];

// Spell burst state
let spellBurst = null;        // null when inactive
let spellBurstTimer = 0;      // frames until next burst
let spellBurstInterval = 0;   // chosen interval for this cycle

function nextBurstInterval() {
  // 20–40 seconds at 30 fps = 600–1200 frames
  return 600 + Math.floor(Math.random() * 600);
}

let particles = [];

/**
 * Create a single particle at a random x position at the bottom of the canvas.
 * @param {number} canvasWidth
 * @param {number} canvasHeight
 * @param {boolean} randomY - if true, spawn at a random y (used for initial fill)
 */
function createParticle(canvasWidth, canvasHeight, randomY = false) {
  const type = PARTICLE_TYPES[Math.floor(Math.random() * PARTICLE_TYPES.length)];
  const isPulsing = type === 'rune' || Math.random() < 0.15;
  const color = WOW_COLORS[Math.floor(Math.random() * WOW_COLORS.length)];

  // Runes and wisps are slightly larger; sparkles are medium; dots are small
  let baseRadius;
  if (type === 'rune')    baseRadius = 3.5 + Math.random() * 0.5;
  else if (type === 'wisp') baseRadius = 2.5 + Math.random() * 1;
  else if (type === 'sparkle') baseRadius = 2 + Math.random() * 1.5;
  else                    baseRadius = 0.8 + Math.random() * 2;   // dot: 1–4px range

  return {
    x: Math.random() * canvasWidth,
    y: randomY ? Math.random() * canvasHeight : canvasHeight + Math.random() * 20,
    baseRadius,
    type,
    isPulsing,
    speed: 0.3 + Math.random() * 0.6,       // dy: -0.3 to -0.9 px/frame
    color,
    phase: Math.random() * Math.PI * 2,      // sine wave phase offset
    sineAmplitude: 0.4 + Math.random() * 0.8,
    sineFreq: 0.008 + Math.random() * 0.012,
    opacity: 0.5 + Math.random() * 0.3,
    pulsePhase: Math.random() * Math.PI * 2,
    pulseSpeed: 0.02 + Math.random() * 0.03,
    frame: 0,
    glyph: type === 'rune' ? RUNE_GLYPHS[Math.floor(Math.random() * RUNE_GLYPHS.length)] : null,
  };
}

/**
 * Initialise particle pool and burst timer.
 */
function initParticles(w, h) {
  particles = [];
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push(createParticle(w, h, true)); // randomY=true for initial fill
  }
  spellBurst = null;
  spellBurstTimer = nextBurstInterval();
  spellBurstInterval = spellBurstTimer;
}

/**
 * Draw a single sparkle shape (four-pointed star) at (x, y) with given size.
 */
function drawSparkle(ctx, x, y, size) {
  ctx.beginPath();
  const arms = 4;
  for (let a = 0; a < arms * 2; a++) {
    const angle = (a * Math.PI) / arms;
    const r = a % 2 === 0 ? size : size * 0.3;
    const px = x + Math.cos(angle) * r;
    const py = y + Math.sin(angle) * r;
    if (a === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Draw one frame of the particle animation.
 */
function drawWarcraftParticles() {
  const canvas = warcraftCanvas;
  const ctx = warcraftContext;
  if (!canvas || !ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const now = Date.now();

  ctx.clearRect(0, 0, w, h);

  // ── Spell burst tick ──────────────────────────────────────────────────
  spellBurstTimer--;
  if (spellBurstTimer <= 0 && !spellBurst) {
    // Trigger burst from a random screen position
    const bx = Math.random() * w;
    const by = 0.2 * h + Math.random() * 0.6 * h;
    spellBurst = { x: bx, y: by, particles: [] };
    const burstColor = WOW_COLORS[Math.floor(Math.random() * WOW_COLORS.length)];
    for (let b = 0; b < 8; b++) {
      const angle = (b / 8) * Math.PI * 2;
      const speed = 1.5 + Math.random() * 2;
      spellBurst.particles.push({
        x: bx, y: by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: burstColor,
        life: 1.0,
        radius: 2 + Math.random() * 2,
      });
    }
    spellBurstTimer = nextBurstInterval();
  }

  // Draw and update burst particles
  if (spellBurst) {
    let allDead = true;
    for (const bp of spellBurst.particles) {
      bp.x  += bp.vx;
      bp.y  += bp.vy;
      bp.vx *= 0.94;   // decelerate
      bp.vy *= 0.94;
      bp.life -= 0.025;
      if (bp.life <= 0) continue;
      allDead = false;
      ctx.save();
      ctx.globalAlpha = bp.life * 0.9;
      ctx.shadowBlur = 12;
      ctx.shadowColor = bp.color;
      ctx.fillStyle = bp.color;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, bp.radius * bp.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (allDead) spellBurst = null;
  }

  // ── Regular particles ─────────────────────────────────────────────────
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    // Organic drift: primary sine wave + a slow time-based wobble
    p.y -= p.speed;
    p.x += Math.sin(p.phase + p.frame * p.sineFreq) * p.sineAmplitude;
    p.x += Math.sin(now * 0.001 * p.speed) * 0.3;
    p.frame++;

    // Respawn at bottom when particle reaches top
    if (p.y < -10) {
      particles[i] = createParticle(w, h, false);
      continue;
    }

    // Fade in from bottom, fade out at top
    const fadeZone = h * 0.15;
    let alphaMod = 1;
    if (p.y > h - fadeZone) {
      alphaMod = 1 - (p.y - (h - fadeZone)) / fadeZone;
    } else if (p.y < fadeZone) {
      alphaMod = p.y / fadeZone;
    }

    const alpha = Math.max(0, Math.min(1, p.opacity * alphaMod));
    if (alpha <= 0) continue;

    // Pulsing radius
    let radius = p.baseRadius;
    if (p.isPulsing) {
      p.pulsePhase += p.pulseSpeed;
      radius = p.baseRadius + Math.sin(p.pulsePhase) * 0.8;
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = p.type === 'rune' ? 12 : 8;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color + 'cc';

    if (p.type === 'sparkle') {
      drawSparkle(ctx, p.x, p.y, Math.max(1, radius));
    } else if (p.type === 'rune') {
      ctx.font = `${Math.max(8, radius * 4)}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.glyph, p.x, p.y);
    } else {
      // dot or wisp — circle
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, radius), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

/**
 * Resize canvas to match viewport.
 */
function resizeWarcraftCanvas() {
  if (!warcraftCanvas) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  warcraftCanvas.width = w;
  warcraftCanvas.height = h;
  // Re-initialise particles so they fill the new dimensions
  initParticles(w, h);
}

/**
 * Start the Warcraft particle animation.
 * Exported as the canonical start function.
 */
export function startWarcraftParticles() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Create canvas if needed
  warcraftCanvas = document.getElementById('warcraftCanvas');
  if (!warcraftCanvas) {
    warcraftCanvas = document.createElement('canvas');
    warcraftCanvas.id = 'warcraftCanvas';
    warcraftCanvas.style.position = 'fixed';
    warcraftCanvas.style.top = '0';
    warcraftCanvas.style.left = '0';
    warcraftCanvas.style.width = '100%';
    warcraftCanvas.style.height = '100%';
    warcraftCanvas.style.zIndex = '-1';
    warcraftCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(warcraftCanvas);
    } else {
      document.body.insertBefore(warcraftCanvas, document.body.firstChild);
    }
  }

  warcraftContext = warcraftCanvas.getContext('2d');
  resizeWarcraftCanvas();

  warcraftResizeHandler = resizeWarcraftCanvas;
  window.addEventListener('resize', warcraftResizeHandler);

  if (warcraftAnimationId) return; // already running
  warcraftAnimationId = setInterval(() => {
    drawWarcraftParticles();
  }, 33); // ~30 fps

  console.log('[Warcraft] Animation started');
}

/**
 * Stop the animation and clean up.
 */
export function stopWarcraftParticles() {
  if (warcraftAnimationId) {
    clearInterval(warcraftAnimationId);
    warcraftAnimationId = null;
  }

  if (warcraftResizeHandler) {
    window.removeEventListener('resize', warcraftResizeHandler);
    warcraftResizeHandler = null;
  }

  if (warcraftContext && warcraftCanvas) {
    warcraftContext.clearRect(0, 0, warcraftCanvas.width, warcraftCanvas.height);
  }

  if (warcraftCanvas && warcraftCanvas.parentNode) {
    warcraftCanvas.remove();
    warcraftCanvas = null;
    warcraftContext = null;
  }

  particles = [];
  spellBurst = null;
  spellBurstTimer = 0;
  console.log('[Warcraft] Animation stopped');
}

/**
 * Check if the animation is currently running.
 */
export function isWarcraftParticlesActive() {
  return warcraftAnimationId !== null;
}
