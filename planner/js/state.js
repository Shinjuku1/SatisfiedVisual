/**
 * This file (js/state.js) defines and manages the dynamic state of the application.
 * It serves as the single source of truth for all mutable data.
 */
import { recipeData } from '/js/data/recipes.js';

// --- STATE & CONFIG ---
// Create a quick-access map of building data from the recipeData array.
const buildingsMap = new Map(recipeData.buildings.map(b => [b.name, b]));

const state = {
    buildingsMap: buildingsMap,
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
        useAlternates: true,
    }
};

export default state;

