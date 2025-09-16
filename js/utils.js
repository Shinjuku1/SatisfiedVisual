/**
 * This file Contains utility and helper functions used throughout the application.
 * These functions are generally pure and don't directly modify the application state or DOM.
 */
import state from './state.js';
import dom from './dom.js';

/**
 * Converts screen coordinates (e.g., from a mouse event) to canvas world coordinates.
 * @param {number} screenX - The x-coordinate on the screen.
 * @param {number} screenY - The y-coordinate on the screen.
 * @returns {{x: number, y: number}} The corresponding coordinates in the canvas world space.
 */
export function screenToWorld(screenX, screenY) {
    const canvasRect = dom.canvas.getBoundingClientRect();
    const x = (screenX - canvasRect.left - state.viewport.x) / state.viewport.zoom;
    const y = (screenY - canvasRect.top - state.viewport.y) / state.viewport.zoom;
    return { x, y };
}

/**
 * Calculates the center position of a connector node in world coordinates.
 * @param {HTMLElement} node - The connector node element.
 * @returns {{x: number, y: number}} The world coordinates of the node's center.
 */
export function getNodeWorldPosition(node) {
    const nodeRect = node.getBoundingClientRect();
    return screenToWorld(nodeRect.left + nodeRect.width / 2, nodeRect.top + nodeRect.height / 2);
}

/**
 * Displays a short-lived notification message on the screen.
 * @param {string} message - The text to display in the toast.
 * @param {number} [duration=3000] - How long the toast should be visible in milliseconds.
 */
export function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = 'toast';
    dom.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, duration);
    }, 10);
}

/**
 * Rounds a number to a specified number of decimal places to avoid floating point inaccuracies.
 * @param {number} value - The number to round.
 * @param {number} decimals - The number of decimal places to round to.
 * @returns {number} The rounded number.
 */
export function round(value, decimals) {
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
}
