/**
 * This file (js/main.js) is the entry point for the application. It initializes all the necessary
 * modules and event listeners when the page is loaded.
 */
import { initializeEventListeners } from '/js/events/listeners.js';
import { populateLibrary, initializeFilter } from '/js/ui/library.js'; // <-- Import initializeFilter
import { tryLoadAutosave } from '/js/core/io.js';
import { updateAllCalculations } from '/js/core/calculations.js';
import { renderViewport } from '/js/ui/render.js';

/**
 * Main function that runs after the HTML document has been fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Set up the application components
    populateLibrary();
    initializeFilter(); // <-- Add this line to activate the search filter
    initializeEventListeners();
    
    // Load saved data and perform initial render
    tryLoadAutosave();
    updateAllCalculations();
    renderViewport();
});

