/**
 * This file (js/core/io.js) handles all data persistence (save/load) and clipboard operations.
 */
import dom from '/js/dom.js';
import state from '/js/state.js';
import { recipeData } from '/js/data/recipes.js';
import { createCard, deleteCards } from '/js/core/card.js';
import { updateAllCalculations } from '/js/core/calculations.js';
import { renderCardSelections, renderViewport } from '/js/ui/render.js';

const AUTOSAVE_KEY = 'satisfactoryPlannerAutosaveV14';

/**
 * Serializes the current state of the canvas into a blueprint object.
 * @param {boolean} isAutosave - If true, saves the state to localStorage.
 * @returns {object} The blueprint object.
 */
export function saveState(isAutosave = false) {
    const blueprint = {
        cards: Array.from(state.placedCards.values()).map(c => ({
            id: c.id, x: c.x, y: c.y, building: c.building, recipeName: c.recipe.name,
            config: { buildings: c.buildings, powerShards: c.powerShards, powerShard: c.powerShard, somersloops: c.somersloops, isFueled: c.isFueled }
        })),
        connections: Array.from(state.connections.entries()).map(([id, c]) => ({ id, from: c.from, to: c.to })),
        viewport: state.viewport, nextCardId: state.nextCardId, nextConnectionId: state.nextConnectionId,
        lineStyle: state.lineStyle
    };
    if (isAutosave) {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(blueprint));
    }
    return blueprint;
}

/**
 * Clears the canvas and loads a new state from a blueprint object.
 * @param {object} blueprint - The blueprint object to load.
 */
export function loadState(blueprint) {
    dom.canvasContent.innerHTML = ''; 
    state.placedCards.clear(); 
    state.connections.clear(); 
    state.selectedCardIds.clear();

    blueprint.cards.forEach(cardData => {
        const recipe = (recipeData.recipes[cardData.building] || []).find(r => r.name === cardData.recipeName) || (cardData.building === 'Alien Power Augmenter' ? {name: cardData.recipeName, inputs:{}, outputs:{}} : null);
        if(recipe) createCard(cardData.building, recipe, cardData.x, cardData.y, cardData.id, cardData.config);
    });
    
    if(blueprint.connections) {
        blueprint.connections.forEach(connData => { state.connections.set(connData.id, { from: connData.from, to: connData.to }); });
    }

    state.nextCardId = blueprint.nextCardId || 0;
    state.nextConnectionId = blueprint.nextConnectionId || 0;
    state.viewport = blueprint.viewport || { x: 0, y: 0, zoom: 1 };
    state.lineStyle = blueprint.lineStyle || 'curved';
    dom.lineStyleSelect.value = state.lineStyle;
    
    updateAllCalculations();
    renderViewport();
}

/**
 * Attempts to load the last autosaved state from localStorage.
 */
export function tryLoadAutosave() {
    const savedData = localStorage.getItem(AUTOSAVE_KEY);
    if (savedData) {
        try { 
            loadState(JSON.parse(savedData)); 
        } catch { 
            localStorage.removeItem(AUTOSAVE_KEY); 
        }
    }
}

/**
 * Copies the selected cards and their internal connections to the clipboard state.
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
            internalConnections.push({
                fromCardId: conn.from.cardId, fromItemName: conn.from.itemName,
                toCardId: conn.to.cardId, toItemName: conn.to.itemName
            });
        }
    });

    state.clipboard = {
        cards: cardsToCopy.map(c => ({
            id: c.id, 
            building: c.building, recipeName: c.recipe.name,
            relX: c.x - minX, relY: c.y - minY,
            config: { buildings: c.buildings, powerShards: c.powerShards, powerShard: c.powerShard, somersloops: c.somersloops, isFueled: c.isFueled }
        })),
        connections: internalConnections
    };
    // Consider adding a toast message here for user feedback
}

/**
 * Copies the selection to the clipboard and then deletes the selected cards.
 */
export function cutSelection() {
    copySelection();
    if (state.selectedCardIds.size > 0) {
        deleteCards(new Set(state.selectedCardIds));
        state.selectedCardIds.clear();
    }
}

/**
 * Handles the logic for pasting cards from the clipboard state onto the canvas.
 * @param {MouseEvent} e - The mouse event for positioning.
 * @param {boolean} finalize - If true, places the cards; otherwise, shows a preview.
 */
export function pasteSelection(e, finalize) {
    if (finalize) {
        if (!state.pastePreview) return;
        const worldPos = screenToWorld(e.clientX, e.clientY);
        
        const snappedX = Math.round(worldPos.x / state.gridSize) * state.gridSize;
        const snappedY = Math.round(worldPos.y / state.gridSize) * state.gridSize;
        const newIdMap = new Map();
        state.selectedCardIds.clear();

        state.pastePreview.cards.forEach(clipboardCard => {
            const oldId = clipboardCard.id;
            const newId = `card-${state.nextCardId++}`;
            newIdMap.set(oldId, newId);
            const recipe = (recipeData.recipes[clipboardCard.building] || []).find(r => r.name === clipboardCard.recipeName) || (clipboardCard.building === 'Alien Power Augmenter' ? {name: clipboardCard.recipeName, inputs:{}, outputs:{}} : null);
            if (recipe) {
                createCard(clipboardCard.building, recipe, snappedX + clipboardCard.relX, snappedY + clipboardCard.relY, newId, clipboardCard.config);
                state.selectedCardIds.add(newId);
            }
        });
        
        state.pastePreview.connections.forEach(conn => {
            const newFromId = newIdMap.get(conn.fromCardId);
            const newToId = newIdMap.get(conn.toCardId);
            if (newFromId && newToId) {
                const newConnId = `conn-${state.nextConnectionId++}`;
                state.connections.set(newConnId, {
                    from: { cardId: newFromId, itemName: conn.fromItemName },
                    to: { cardId: newToId, itemName: conn.toItemName }
                });
            }
        });
        
        renderCardSelections();
        updateAllCalculations();
        state.pastePreview = null;
        dom.pastePreviewContainer.innerHTML = '';
        dom.canvas.style.cursor = 'default';

    } else {
        if (!state.clipboard) return;
        state.pastePreview = JSON.parse(JSON.stringify(state.clipboard));
        dom.pastePreviewContainer.innerHTML = '';
        state.pastePreview.cards.forEach(clipboardCard => {
            const recipe = (recipeData.recipes[clipboardCard.building] || []).find(r => r.name === clipboardCard.recipeName) || (clipboardCard.building === 'Alien Power Augmenter' ? {name: clipboardCard.recipeName, inputs:{}, outputs:{}} : null);
            if(recipe) createCard(clipboardCard.building, recipe, clipboardCard.relX, clipboardCard.relY, `preview-${clipboardCard.id}`, clipboardCard.config, true);
        });
        dom.canvas.style.cursor = 'copy';
        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snappedX = Math.round(worldPos.x / state.gridSize) * state.gridSize;
        const snappedY = Math.round(worldPos.y / state.gridSize) * state.gridSize;
        dom.pastePreviewContainer.style.transform = `translate(${state.viewport.x + snappedX * state.viewport.zoom}px, ${state.viewport.y + snappedY * state.viewport.zoom}px) scale(${state.viewport.zoom})`;
    }
}

