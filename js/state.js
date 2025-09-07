/**
 * This file (js/state.js) defines the central state object that holds all the dynamic
 * data for the application. It has been updated to unlock all alternate recipes by default.
 */
import { recipeData } from '/js/data/recipes.js';

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
    autoBuildOptions: {
        useSAM: true,
    },
    // Initialize with all alternate recipes unlocked by default.
    unlockedRecipes: getDefaultUnlockedRecipes(),
    highlightedRecipeKey: null,
};

export default state;