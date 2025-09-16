/**
 * This file (js/core/io.js) handles all data persistence and clipboard operations,
 * including saving, loading, importing, exporting, and copy/paste functionality.
 * It has been updated for multi-tab support and a more robust paste/blueprint flow.
 */
import dom from '/SatisfiedVisual/js/dom.js';
import state from '/SatisfiedVisual/js/state.js';
import { recipeData } from '/SatisfiedVisual/js/data/recipes.js';
import { screenToWorld } from '/SatisfiedVisual/js/utils.js';
import { createCard, deleteCards } from '/SatisfiedVisual/js/core/card.js';
import { updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';
import { renderCardSelections, renderViewport } from '/SatisfiedVisual/js/ui/render.js';

const LAST_SESSION_KEY = 'satisfactoryPlannerLastSessionId';
const CLIPBOARD_KEY = 'satisfactoryPlannerClipboard'; // Key for cross-tab copy/paste

/**
 * Serializes the current canvas state into a blueprint object for saving or exporting.
 * @param {boolean} isAutosave - If true, saves to sessionStorage for the current tab.
 * @returns {object} The blueprint object.
 */
export function saveState(isAutosave = false) {
    const blueprint = {
        cards: Array.from(state.placedCards.values()).map(c => ({
            id: c.id, x: c.x, y: c.y, building: c.building, recipeName: c.recipe.name,
            config: { buildings: c.buildings, powerShards: c.powerShards, powerShard: c.powerShard, somersloops: c.somersloops, isFueled: c.isFueled }
        })),
        connections: Array.from(state.connections.entries()).map(([id, c]) => ({ id, from: c.from, to: c.to })),
        viewport: state.viewport,
        nextCardId: state.nextCardId,
        nextConnectionId: state.nextConnectionId,
        lineStyle: state.lineStyle,
        unlockedRecipes: Array.from(state.unlockedRecipes),
        autosaveEnabled: state.autosaveEnabled
    };
    if (isAutosave) {
        sessionStorage.setItem(`autosave_${state.sessionId}`, JSON.stringify(blueprint));
        localStorage.setItem(LAST_SESSION_KEY, state.sessionId);
    }
    return blueprint;
}

/**
 * Loads a blueprint object, completely replacing the current factory.
 * @param {object} blueprint - The blueprint object to load.
 */
export function loadState(blueprint) {
    // This function now ONLY handles replacing the state. Pasting is handled by finalizePaste.
    dom.canvasContent.innerHTML = '';
    state.placedCards.clear();
    state.connections.clear();
    state.selectedCardIds.clear();

    if (blueprint.cards) {
        blueprint.cards.forEach(cardData => {
            const recipe = (recipeData.recipes[cardData.building] || []).find(r => r.name === cardData.recipeName) || (cardData.building === 'Alien Power Augmenter' ? { name: cardData.recipeName, inputs: {}, outputs: {} } : null);
            if (recipe) {
                // When replacing, we use the absolute x and y coordinates directly from the blueprint file.
                createCard(cardData.building, recipe, cardData.x, cardData.y, cardData.id, cardData.config);
            }
        });
    }

    if (blueprint.connections) {
        blueprint.connections.forEach(connData => {
            // Since we are using the original IDs, no re-mapping is needed.
            state.connections.set(connData.id, { from: connData.from, to: connData.to });
        });
    }

    if (blueprint.unlockedRecipes) {
        state.unlockedRecipes = new Set(blueprint.unlockedRecipes);
    }
    state.autosaveEnabled = blueprint.autosaveEnabled ?? true;
    // Set the next IDs high enough to avoid collision with loaded blueprint IDs
    state.nextCardId = blueprint.nextCardId || state.placedCards.size + 100;
    state.nextConnectionId = blueprint.nextConnectionId || state.connections.size + 100;
    state.viewport = blueprint.viewport || { x: 0, y: 0, zoom: 1 };
    state.lineStyle = blueprint.lineStyle || 'curved';
    dom.lineStyleSelect.value = state.lineStyle;

    renderViewport();
    updateAllCalculations();
    renderCardSelections();
}


/**
 * Tries to load the last session from sessionStorage.
 */
export function tryLoadLastSession() {
    const lastSessionId = localStorage.getItem(LAST_SESSION_KEY);
    if (lastSessionId) {
        const savedData = sessionStorage.getItem(`autosave_${lastSessionId}`);
        if (savedData) {
            try {
                loadState(JSON.parse(savedData));
            } catch {
                sessionStorage.removeItem(`autosave_${lastSessionId}`);
            }
        }
    }
}

/**
 * Copies the selected cards and their internal connections to the clipboard and localStorage.
 */
export function copySelection() {
    if (state.selectedCardIds.size === 0) return;
    const cardsToCopy = [];
    let minX = Infinity, minY = Infinity;

    state.selectedCardIds.forEach(id => {
        const card = state.placedCards.get(id);
        if (card) {
            cardsToCopy.push(card);
            minX = Math.min(minX, card.x);
            minY = Math.min(minY, card.y);
        }
    });

    const internalConnections = [];
    state.connections.forEach(conn => {
        if (state.selectedCardIds.has(conn.from.cardId) && state.selectedCardIds.has(conn.to.cardId)) {
            internalConnections.push({ from: conn.from, to: conn.to });
        }
    });

    const clipboardData = {
        cards: cardsToCopy.map(c => ({
            id: c.id,
            building: c.building, recipeName: c.recipe.name,
            relX: c.x - minX, relY: c.y - minY,
            config: { buildings: c.buildings, powerShards: c.powerShards, powerShard: c.powerShard, somersloops: c.somersloops, isFueled: c.isFueled }
        })),
        connections: internalConnections
    };
    
    // Set both the local state and localStorage for cross-tab functionality
    state.clipboard = clipboardData;
    localStorage.setItem(CLIPBOARD_KEY, JSON.stringify(clipboardData));
}

/**
 * Cuts the selected cards (copies then deletes them).
 */
export function cutSelection() {
    copySelection();
    if (state.selectedCardIds.size > 0) {
        deleteCards(new Set(state.selectedCardIds));
        state.selectedCardIds.clear();
    }
}


// --- PASTE LOGIC ---

/**
 * Initiates a paste operation from an imported blueprint.
 * @param {object} blueprint - The blueprint data.
 */
export function startBlueprintPaste(blueprint) {
    let minX = Infinity, minY = Infinity;
    if (blueprint.cards && blueprint.cards.length > 0) {
        blueprint.cards.forEach(card => {
            minX = Math.min(minX, card.x);
            minY = Math.min(minY, card.y);
        });
        
        blueprint.cards.forEach(card => {
            card.relX = card.x - minX;
            card.relY = card.y - minY;
        });
    } else {
        // Handle empty blueprint gracefully
        blueprint.cards = [];
        blueprint.connections = [];
    }
    createPastePreview(blueprint);
}

/**
 * Initiates a paste operation from the clipboard (checking localStorage first).
 */
export function startClipboardPaste() {
    let clipboardData = null;
    try {
        const storedClipboard = localStorage.getItem(CLIPBOARD_KEY);
        if(storedClipboard) {
            clipboardData = JSON.parse(storedClipboard);
        }
    } catch (e) {
        console.error("Failed to parse clipboard from localStorage", e);
        clipboardData = state.clipboard; // Fallback to in-memory clipboard
    }
    
    if (!clipboardData) {
        clipboardData = state.clipboard; // Fallback for first copy or if localStorage is empty
    }

    if (!clipboardData) return;

    // Create a deep copy to avoid mutation issues
    const clipboardCopy = JSON.parse(JSON.stringify(clipboardData));
    createPastePreview(clipboardCopy);
}

/**
 * Creates the visual preview for a paste operation.
 * @param {object} dataToPreview - The data to create a preview for.
 */
function createPastePreview(dataToPreview) {
    state.pastePreview = dataToPreview;
    dom.pastePreviewContainer.innerHTML = '';
    
    state.pastePreview.cards.forEach(clipboardCard => {
        const recipe = (recipeData.recipes[clipboardCard.building] || []).find(r => r.name === clipboardCard.recipeName) || (clipboardCard.building === 'Alien Power Augmenter' ? { name: clipboardCard.recipeName, inputs: {}, outputs: {} } : null);
        if (recipe) {
            createCard(clipboardCard.building, recipe, clipboardCard.relX, clipboardCard.relY, `preview-${clipboardCard.id}`, clipboardCard.config, true);
        }
    });
    dom.canvas.style.cursor = 'copy';
}

/**
 * Finalizes a paste operation, placing the cards on the canvas.
 * @param {MouseEvent} e - The mouse event triggering the final placement.
 */
export function finalizePaste(e) {
    if (!state.pastePreview) return;

    const worldPos = screenToWorld(e.clientX, e.clientY);
    const snappedX = Math.round(worldPos.x / state.gridSize) * state.gridSize;
    const snappedY = Math.round(worldPos.y / state.gridSize) * state.gridSize;
    
    // Remap old IDs to new IDs to prevent duplicates
    const idMap = new Map();
    state.pastePreview.cards.forEach(card => {
        idMap.set(card.id, `card-${state.nextCardId++}`);
    });
    
    const pasteData = state.pastePreview;

    state.selectedCardIds.clear();

    pasteData.cards.forEach(clipboardCard => {
        const newId = idMap.get(clipboardCard.id);
        state.selectedCardIds.add(newId);
        const recipe = (recipeData.recipes[clipboardCard.building] || []).find(r => r.name === clipboardCard.recipeName) || (clipboardCard.building === 'Alien Power Augmenter' ? { name: clipboardCard.recipeName, inputs: {}, outputs: {} } : null);
        if (recipe) {
            createCard(clipboardCard.building, recipe, snappedX + clipboardCard.relX, snappedY + clipboardCard.relY, newId, clipboardCard.config);
        }
    });

    pasteData.connections.forEach(conn => {
        const newFromId = idMap.get(conn.from.cardId);
        const newToId = idMap.get(conn.to.cardId);
        if (newFromId && newToId) {
            const newConnId = `conn-${state.nextConnectionId++}`;
            state.connections.set(newConnId, {
                from: { cardId: newFromId, itemName: conn.from.itemName },
                to: { cardId: newToId, itemName: conn.to.itemName }
            });
        }
    });

    cancelPaste(); // Clean up the preview state
    renderCardSelections();
    updateAllCalculations();
}

/**
 * Cancels an in-progress paste operation.
 */
export function cancelPaste() {
    state.pastePreview = null;
    dom.pastePreviewContainer.innerHTML = '';
    dom.canvas.style.cursor = 'default';
}

