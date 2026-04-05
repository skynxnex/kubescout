/**
 * Autumn Leaves Animation
 * Falling leaves using emoji
 */

let autumnContainer = null;
let autumnAnimationId = null;
let leaves = [];
let resizeHandler = null;

// Leaf emoji (much better than drawing!)
const LEAF_EMOJI = ['🍂', '🍁', '🍃'];

// Autumn color filters (to vary the leaf colors)
const AUTUMN_FILTERS = [
  'hue-rotate(0deg) saturate(1.2)', // normal orange/red
  'hue-rotate(20deg) saturate(1.3)', // more red
  'hue-rotate(-15deg) saturate(1.1)', // more yellow
  'hue-rotate(10deg) saturate(0.9)', // muted orange
  'hue-rotate(-25deg) saturate(1.4)', // golden yellow
  'hue-rotate(30deg) saturate(0.8)', // brown-red
];

class Leaf {
  constructor(containerWidth, containerHeight) {
    this.x = Math.random() * containerWidth;
    this.y = Math.random() * -containerHeight; // Start above screen
    this.size = Math.random() * 20 + 15; // 15-35px
    this.speed = Math.random() * 0.8 + 0.4; // Falling speed
    this.sway = Math.random() * 2 - 1; // Horizontal drift
    this.rotation = Math.random() * 360;
    this.rotationSpeed = Math.random() * 3 - 1.5; // Spinning speed
    this.emoji = LEAF_EMOJI[Math.floor(Math.random() * LEAF_EMOJI.length)];
    this.filter = AUTUMN_FILTERS[Math.floor(Math.random() * AUTUMN_FILTERS.length)];
    this.containerHeight = containerHeight;
    this.containerWidth = containerWidth;
    this.opacity = Math.random() * 0.3 + 0.7; // 0.7-1.0 opacity

    // Create DOM element
    this.element = document.createElement('div');
    this.element.textContent = this.emoji;
    this.element.style.position = 'absolute';
    this.element.style.fontSize = `${this.size}px`;
    this.element.style.filter = this.filter;
    this.element.style.opacity = this.opacity;
    this.element.style.pointerEvents = 'none';
    this.element.style.userSelect = 'none';
    this.updatePosition();
  }

  update() {
    this.y += this.speed;
    this.x += Math.sin(this.y * 0.01) * this.sway;
    this.rotation += this.rotationSpeed;

    // Reset when off screen
    if (this.y > this.containerHeight + 50) {
      this.y = -50;
      this.x = Math.random() * this.containerWidth;
    }

    this.updatePosition();
  }

  updatePosition() {
    this.element.style.left = `${this.x}px`;
    this.element.style.top = `${this.y}px`;
    this.element.style.transform = `rotate(${this.rotation}deg)`;
  }

  appendTo(container) {
    container.appendChild(this.element);
  }

  remove() {
    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
  }
}

/**
 * Initialize Autumn leaves animation
 */
export function initAutumnLeaves() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // Create container if it doesn't exist
  autumnContainer = document.getElementById('autumnContainer');
  if (!autumnContainer) {
    autumnContainer = document.createElement('div');
    autumnContainer.id = 'autumnContainer';
    autumnContainer.style.position = 'fixed';
    autumnContainer.style.top = '0';
    autumnContainer.style.left = '0';
    autumnContainer.style.width = '100%';
    autumnContainer.style.height = '100%';
    autumnContainer.style.zIndex = '-1';
    autumnContainer.style.pointerEvents = 'none';
    autumnContainer.style.overflow = 'hidden';

    const cyberBg = document.querySelector('.cyber-bg');
    if (cyberBg) {
      cyberBg.appendChild(autumnContainer);
    } else {
      document.body.insertBefore(autumnContainer, document.body.firstChild);
    }
  }

  // Create leaves
  const leafCount = Math.floor((window.innerWidth * window.innerHeight) / 20000); // Density
  leaves = [];
  for (let i = 0; i < leafCount; i++) {
    const leaf = new Leaf(window.innerWidth, window.innerHeight);
    leaf.appendTo(autumnContainer);
    leaves.push(leaf);
  }

  // Start animation
  startAutumnLeaves();

  // Handle window resize
  resizeHandler = resizeAutumnLeaves;
  window.addEventListener('resize', resizeHandler);
}

/**
 * Resize leaves container
 */
function resizeAutumnLeaves() {
  if (!autumnContainer) return;

  // Remove old leaves
  leaves.forEach(leaf => leaf.remove());
  leaves = [];

  // Recreate leaves with new dimensions
  const leafCount = Math.floor((window.innerWidth * window.innerHeight) / 20000);
  for (let i = 0; i < leafCount; i++) {
    const leaf = new Leaf(window.innerWidth, window.innerHeight);
    leaf.appendTo(autumnContainer);
    leaves.push(leaf);
  }
}

/**
 * Start Autumn leaves animation loop
 */
function startAutumnLeaves() {
  if (autumnAnimationId) return;

  function animate() {
    // Update each leaf
    leaves.forEach(leaf => {
      leaf.update();
    });

    autumnAnimationId = requestAnimationFrame(animate);
  }

  animate();
}

/**
 * Stop Autumn leaves animation
 */
export function stopAutumnLeaves() {
  if (autumnAnimationId) {
    cancelAnimationFrame(autumnAnimationId);
    autumnAnimationId = null;
  }

  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  // Remove all leaves
  leaves.forEach(leaf => leaf.remove());
  leaves = [];

  if (autumnContainer && autumnContainer.parentNode) {
    autumnContainer.remove();
    autumnContainer = null;
  }
}

/**
 * Check if Autumn leaves is currently running
 */
export function isAutumnLeavesActive() {
  return autumnAnimationId !== null;
}
