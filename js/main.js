/**
 * This file (js/main.js) is the entry point for the application. It initializes all the necessary
 * modules and event listeners when the page is loaded.
 */
import { initializeEventListeners } from '/SatisfiedVisual/js/events/listeners.js';
import { populateLibrary, initializeFilter } from '/SatisfiedVisual/js/ui/library.js';
import { tryLoadLastSession } from '/SatisfiedVisual/js/core/io.js';
import { updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';
import { renderViewport } from '/SatisfiedVisual/js/ui/render.js';
import state from '/SatisfiedVisual/js/state.js';

const USER_SETTINGS_KEY = 'satisfactoryPlannerSettingsV1';

/**
 * Loads user settings from localStorage and applies them to the state.
 */
function initializeUserSettings() {
    const savedSettings = localStorage.getItem(USER_SETTINGS_KEY);
    if (savedSettings) {
        try {
            const settings = JSON.parse(savedSettings);
            if (typeof settings.autosaveEnabled === 'boolean') {
                state.autosaveEnabled = settings.autosaveEnabled;
            }
        } catch (e) {
            console.error("Could not parse user settings.", e);
            localStorage.removeItem(USER_SETTINGS_KEY);
        }
    }
}


/**
 * Main function that runs after the HTML document has been fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    // Set up the application components
    initializeUserSettings(); // Load persistent settings first
    populateLibrary();
    initializeFilter(); 
    initializeEventListeners();
    
    // Load saved data and perform initial render
    tryLoadLastSession();
    updateAllCalculations();
    renderViewport();
});

