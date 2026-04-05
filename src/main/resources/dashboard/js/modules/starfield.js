/**
 * Star Wars Starfield Animation
 * Moving stars like traveling through space
 */

let starCanvas = null;
let starContext = null;
let starAnimationId = null;
let stars = [];
let resizeHandler = null;

class Star {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // Start from center and move outward
    this.x = Math.random() * canvasWidth;
    this.y = Math.random() * canvasHeight;

    // Distance from center (for speed calculation)
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
    const dx = this.x - centerX;
    const dy = this.y - centerY;
    this.distance = Math.sqrt(dx * dx + dy * dy);

    // Velocity based on distance from center
    this.vx = (dx / this.distance) * 0.5;
    this.vy = (dy / this.distance) * 0.5;

    this.size = Math.random() * 2 + 0.5; // 0.5-2.5px
    this.brightness = Math.random() * 0.5 + 0.5; // 0.5-1.0

    // Some stars twinkle
    this.twinkle = Math.random() > 0.7;
    this.twinkleSpeed = Math.random() * 0.05 + 0.02;
    this.twinklePhase = Math.random() * Math.PI * 2;
  }

  update() {
    // Move away from center
    this.x += this.vx;
    this.y += this.vy;

    // Gradually accelerate (hyperspace effect)
    this.vx *= 1.005;
    this.vy *= 1.005;

    // Update twinkle
    if (this.twinkle) {
      this.twinklePhase += this.twinkleSpeed;
    }

    // Reset when off screen
    if (
      this.x < -10 ||
      this.x > this.canvasWidth + 10 ||
      this.y < -10 ||
      this.y > this.canvasHeight + 10
    ) {
      this.reset();
    }
  }

  reset() {
    const centerX = this.canvasWidth / 2;
    const centerY = this.canvasHeight / 2;

    // Reset near center with random position
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 50;

    this.x = centerX + Math.cos(angle) * radius;
    this.y = centerY + Math.sin(angle) * radius;

    const dx = this.x - centerX;
    const dy = this.y - centerY;
    this.distance = Math.sqrt(dx * dx + dy * dy);

    this.vx = (dx / this.distance) * 0.5;
    this.vy = (dy / this.distance) * 0.5;
  }

  draw(ctx) {
    const alpha = this.twinkle
      ? this.brightness * (0.7 + Math.sin(this.twinklePhase) * 0.3)
      : this.brightness;

    ctx.fillStyle = `rgba(255, 232, 31, ${alpha})`; // Star Wars yellow
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();

    // Add glow for brighter stars
    if (this.brightness > 0.8) {
      ctx.fillStyle = `rgba(255, 232, 31, ${alpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Initialize Starfield animation
 */
export function initStarfield() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  starCanvas = document.getElementById('starCanvas');
  if (!starCanvas) {
    starCanvas = document.createElement('canvas');
    starCanvas.id = 'starCanvas';
    starCanvas.style.position = 'fixed';
    starCanvas.style.top = '0';
    starCanvas.style.left = '0';
    starCanvas.style.width = '100%';
    starCanvas.style.height = '100%';
    starCanvas.style.zIndex = '-1';
    starCanvas.style.pointerEvents = 'none';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(starCanvas);
    } else {
      document.body.insertBefore(starCanvas, document.body.firstChild);
    }
  }

  starContext = starCanvas.getContext('2d');

  // Set canvas size
  resizeStarCanvas();

  // Create stars
  const starCount = 200; // Number of stars
  stars = [];
  for (let i = 0; i < starCount; i++) {
    stars.push(new Star(starCanvas.width, starCanvas.height));
  }

  // Start animation
  startStarfield();

  // Handle window resize
  resizeHandler = resizeStarCanvas;
  window.addEventListener('resize', resizeHandler);
}

/**
 * Resize canvas to match window size
 */
function resizeStarCanvas() {
  if (!starCanvas) return;

  starCanvas.width = window.innerWidth;
  starCanvas.height = window.innerHeight;

  // Recreate stars with new dimensions
  stars = [];
  for (let i = 0; i < 200; i++) {
    stars.push(new Star(starCanvas.width, starCanvas.height));
  }
}

/**
 * Start Starfield animation loop
 */
function startStarfield() {
  if (starAnimationId) return;

  function draw() {
    if (!starContext || !starCanvas) return;

    // Semi-transparent black for trail effect
    starContext.fillStyle = 'rgba(10, 10, 15, 0.15)';
    starContext.fillRect(0, 0, starCanvas.width, starCanvas.height);

    // Update and draw each star
    stars.forEach(star => {
      star.update();
      star.draw(starContext);
    });

    starAnimationId = requestAnimationFrame(draw);
  }

  draw();
}

/**
 * Stop Starfield animation
 */
export function stopStarfield() {
  if (starAnimationId) {
    cancelAnimationFrame(starAnimationId);
    starAnimationId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  if (starContext && starCanvas) {
    starContext.clearRect(0, 0, starCanvas.width, starCanvas.height);
  }

  if (starCanvas && starCanvas.parentNode) {
    starCanvas.remove();
    starCanvas = null;
    starContext = null;
  }

  stars = [];
}

/**
 * Check if Starfield is currently running
 */
export function isStarfieldActive() {
  return starAnimationId !== null;
}
