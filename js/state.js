/**
 * This file (js/state.js) defines the central state object that holds all the dynamic
 * data for the application. It has been updated to unlock all alternate recipes by default
 * and to manage session-specific data and user settings.
 */
import { recipeData } from '/SatisfiedVisual/js/data/recipes.js';
import { v4 as uuidv4 } from 'https://cdn.jsdelivr.net/npm/uuid@9.0.1/+esm'

/**
 * Scans the recipe data and returns a Set containing the keys for all alternate recipes.
 * @returns {Set<string>} A set of all alternate recipe keys.
 */
function getDefaultUnlockedRecipes() {
    const unlocked = new Set();
    Object.entries(recipeData.recipes).forEach(([buildingName, recipes]) => {
        recipes.forEach(recipe => {
            if (recipe.isAlternate) {
                const recipeKey = `${buildingName}|${recipe.name}`;
                unlocked.add(recipeKey);
            }
        });
    });
    return unlocked;
}

// The single source of truth for the application's state.
const state = {
    buildingsMap: new Map(recipeData.buildings.map(b => [b.name, b])),
    placedCards: new Map(),
    connections: new Map(),
    viewport: { x: 0, y: 0, zoom: 1 },
    panning: false,
    dragInfo: null,
    isDrawingConnection: false,
    isSelecting: false,
    pastePreview: null,
    selectionBoxStart: {x: 0, y: 0},
    connectionStartNode: null,
    selectedConnectionIds: new Set(),
    selectedCardIds: new Set(),
    clipboard: null,
    nextCardId: 0,
    nextConnectionId: 0,
    gridSize: 40,
    lineStyle: 'curved',
    // --- User Settings & Session ---
    sessionId: uuidv4(), // Unique ID for this browser tab
    autosaveEnabled: true, // User preference for autosaving
    autoBuildOptions: {
        useSAM: true,
        buildStrategy: 'simple', // 'simple' or 'resourceSaver'
    },
    // Initialize with all alternate recipes unlocked by default.
    unlockedRecipes: getDefaultUnlockedRecipes(),
    highlightedRecipeKey: null,
};


export default state;
