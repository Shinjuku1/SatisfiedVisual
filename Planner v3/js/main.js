/**
 * @file Main entry point for the Satisfactory Planner application.
 */

import { recipeData } from '/js/data/recipes.js';
import { initializeEventListeners } from '/js/events/listeners.js';
import { populateLibrary } from '/js/ui/library.js';
import { tryLoadAutosave } from '/js/core/io.js';
import { updateAllCalculations } from '/js/core/calculations.js';
import { renderViewport } from '/js/ui/render.js';

/**
 * Initializes the entire application.
 */
function init() {
    // Ensure recipe data is available before doing anything else.
    if (typeof recipeData === 'undefined') {
        console.error('Recipe data is missing. Halting application initialization.');
        return;
    }

    // Populate the UI with recipes
    populateLibrary();

    // Set up all user interaction listeners
    initializeEventListeners();

    // Try to load a previous session
    tryLoadAutosave();

    // Perform initial calculations and rendering
    updateAllCalculations();
    renderViewport();

    console.log('Satisfactory Planner Initialized.');
}

// Wait for the DOM to be fully loaded before initializing.
document.addEventListener('DOMContentLoaded', init);

