/**
 * Modern Dashboard - Animation Helpers
 * Utility functions for smooth animations and transitions
 */

/**
 * Animate row expansion
 * @param {HTMLElement} row - The row element to expand
 * @param {boolean} expand - true to expand, false to collapse
 */
export function animateRowExpansion(row, expand) {
  if (!row) return;

  if (expand) {
    row.style.display = '';
    row.classList.add('row-expand-enter');

    // Remove animation class after animation completes
    setTimeout(() => {
      row.classList.remove('row-expand-enter');
    }, 300);
  } else {
    row.classList.add('row-expand-exit');

    setTimeout(() => {
      row.style.display = 'none';
      row.classList.remove('row-expand-exit');
    }, 300);
  }
}

/**
 * Animate element with fade in effect
 * @param {HTMLElement} element - The element to animate
 */
export function fadeIn(element) {
  if (!element) return;
  element.classList.add('fade-in');
  setTimeout(() => element.classList.remove('fade-in'), 200);
}

/**
 * Animate element with slide down effect
 * @param {HTMLElement} element - The element to animate
 */
export function slideDown(element) {
  if (!element) return;
  element.classList.add('slide-down');
  setTimeout(() => element.classList.remove('slide-down'), 200);
}

/**
 * Stagger animation for multiple children
 * @param {HTMLElement} container - The container with children to animate
 */
export function staggerChildren(container) {
  if (!container) return;
  container.classList.add('stagger-children');

  setTimeout(() => {
    container.classList.remove('stagger-children');
  }, 500);
}

/**
 * Rotate element (useful for expand/collapse chevrons)
 * @param {HTMLElement} element - The element to rotate
 * @param {boolean} rotated - true for rotated state, false for normal
 */
export function rotateChevron(element, rotated) {
  if (!element) return;

  const svg = element.querySelector('svg');
  if (svg) {
    svg.style.transform = rotated ? 'rotate(90deg)' : 'rotate(0deg)';
  }
}

