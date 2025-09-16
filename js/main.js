/**
 * This file (js/main.js) is the entry point for the application. It initializes all the necessary
 * modules and event listeners when the page is loaded.
 */
import { initializeEventListeners } from '/SatisfiedVisual/js/events/listeners.js';
import { populateLibrary, initializeFilter } from '/SatisfiedVisual/js/ui/library.js';
import { tryLoadLastSession } from '/SatisfiedVisual/js/core/io.js';
import { updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';
import { renderViewport } from '/SatisfiedVisual/js/ui/render.js';

/**
 * Main function that runs after the HTML document has been fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Set up the application components
    populateLibrary();
    initializeFilter();
    initializeEventListeners();
    
    // Load saved data and perform initial render
    tryLoadLastSession();
    updateAllCalculations();
    renderViewport();
});
