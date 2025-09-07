/**
 * This file (js/core/card.js) handles the lifecycle of a card: creating its HTML,
 * adding its event listeners, and removing it from the DOM and state. It now includes
 * special logic for dynamic fuel switching on power plant cards and correct power display.
 */
import dom from '/SatisfiedVisual/js/dom.js';
import state from '/SatisfiedVisual/js/state.js';
import { recipeData } from '/SatisfiedVisual/js/data/recipes.js';
import { SOMERSLOOP_SLOTS } from '/SatisfiedVisual/js/constants.js';
import { updateCardCalculations, updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';
import { showModal } from '/SatisfiedVisual/js/ui/modals.js';
import { showContextMenu } from '/SatisfiedVisual/js/ui/contextMenu.js';
import { renderCardSelections, renderSelectionSummary, renderConnections, renderHighlights } from '/SatisfiedVisual/js/ui/render.js';

/**
 * Creates a new card element and its associated data object.
 * @param {string} buildingName - The name of the building for the recipe.
 * @param {object} recipe - The recipe data object.
 * @param {number} worldX - The initial X coordinate on the canvas.
 * @param {number} worldY - The initial Y coordinate on the canvas.
 * @param {string|null} id - A specific ID to assign, or null to generate one.
 * @param {object|null} config - Pre-defined configuration for buildings, clock speed, etc.
 * @param {boolean} isPreview - If true, adds to the preview container instead of the main canvas.
 */
export function createCard(buildingName, recipe, worldX, worldY, id = null, config = null, isPreview = false) {
    const cardId = id || `card-${state.nextCardId++}`;
    const card = document.createElement('div');
    card.id = cardId;
    card.className = 'placed-card bg-gray-900/80 backdrop-blur-sm rounded-lg shadow-lg flex flex-col';
    
    const snappedX = Math.round(worldX / state.gridSize) * state.gridSize;
    const snappedY = Math.round(worldY / state.gridSize) * state.gridSize;
    card.style.transform = `translate(${snappedX}px, ${snappedY}px)`;
    
    const cardData = {
        id: cardId, element: card, building: buildingName, recipe: recipe, x: snappedX, y: snappedY,
        buildings: config?.buildings ?? 1,
        powerShards: config?.powerShards ?? 0,
        powerShard: config?.powerShard ?? 100,
        somersloops: config?.somersloops ?? 0,
        isFueled: config?.isFueled ?? false,
        inputs: {}, outputs: {}, power: 0, inputDeficits: new Set()
    };

    const gearSVG = `<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734-2.106-2.106a1.533 1.533 0 01-.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" /></svg>`;
    const xSVG = `<svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>`;
    
    const buildingInfo = state.buildingsMap.get(buildingName);
    const isPowerGenerator = buildingInfo && buildingInfo.category === 'Power';
    const isExtractor = buildingInfo && buildingInfo.category === 'Extraction';

    if (buildingName === 'Alien Power Augmenter') {
        card.innerHTML = `
            <div class="p-3 relative">
                <div class="absolute top-2 right-2 flex gap-1">
                    <button data-action="configure" title="Configure" class="text-gray-400 hover:text-white">${gearSVG}</button>
                    <button data-action="delete" title="Delete Card" class="text-gray-400 hover:text-red-500">${xSVG}</button>
                </div>
                <h2 class="text-base font-bold text-white">Alien Power Augmenter</h2>
                <p class="text-xs font-medium text-purple-400">Special</p>
            </div>
            <div class="px-3 pb-3 text-center flex-1 flex flex-col justify-center">
                <p class="text-sm">Provides <span class="font-bold text-white">500 MW</span> flat power and a grid boost.</p>
                <p data-stat="fuel-status" class="text-sm font-bold ${cardData.isFueled ? 'text-green-400' : 'text-gray-500'}">${cardData.isFueled ? 'FUELED (+30% Boost)' : 'UNFUELED (+10% Boost)'}</p>
            </div>
        `;
    } else if (isPowerGenerator) {
        const powerTextColor = 'text-green-400';
        const powerPrefix = '+';
        const availableFuels = recipeData.recipes[buildingName] || [];
        card.innerHTML = `
            <div class="relative flex-1 flex flex-col">
                <div class="p-3">
                    <div class="absolute top-2 right-2 flex gap-1">
                        <button data-action="configure" title="Configure" class="text-gray-400 hover:text-white">${gearSVG}</button>
                        <button data-action="delete" title="Delete Card" class="text-gray-400 hover:text-red-500">${xSVG}</button>
                    </div>
                    <h2 class="text-base font-bold text-white leading-tight pr-12">${buildingName}</h2>
                    <p class="text-xs font-medium text-indigo-400" data-recipe-name-display>${recipe.name}</p>
                </div>
                <div class="grid grid-cols-2 gap-3 text-xs px-3 card-io-section">
                    <div>
                        <h4 class="font-bold text-orange-400 mb-1">Fuel Type</h4>
                        <select data-control="fuel-selector" class="w-full bg-gray-700 border border-gray-600 rounded p-1 text-xs text-white">
                            ${availableFuels.map(fuelRecipe => `<option value="${fuelRecipe.name}" ${fuelRecipe.name === recipe.name ? 'selected' : ''}>${fuelRecipe.name}</option>`).join('')}
                        </select>
                        <div class="mt-2 space-y-1" data-container="inputs"></div>
                    </div>
                    <div>
                        <h4 class="font-bold text-green-400 mb-1">Outputs</h4>
                        <div class="space-y-1" data-container="outputs"></div>
                    </div>
                </div>
                <div class="grid grid-cols-4 text-center border-t border-gray-700 mt-2 p-2 text-xs">
                    <div><span class="font-bold text-white" data-stat="buildings">1</span><span class="text-gray-400">x</span></div>
                    <div class="text-yellow-400"><span class="font-bold" data-stat="shards"></span></div>
                    <div><span class="font-bold text-yellow-400" data-stat="clock">100.00</span><span class="text-gray-400">%</span></div>
                    <div></div>
                </div>
                 <div class="text-center bg-gray-900/50 ${powerTextColor} text-xs py-1">
                    Power: <span class="font-bold text-white">${powerPrefix}<span data-value="power">0.00</span></span> MW
                 </div>
            </div>
        `;
    } else if (isExtractor) {
        const powerTextColor = 'text-cyan-400';
        card.innerHTML = `
            <div class="relative flex-1 flex flex-col">
                <div class="p-3">
                    <div class="absolute top-2 right-2 flex gap-1">
                        <button data-action="configure" title="Configure" class="text-gray-400 hover:text-white">${gearSVG}</button>
                        <button data-action="delete" title="Delete Card" class="text-gray-400 hover:text-red-500">${xSVG}</button>
                    </div>
                    <h2 class="text-base font-bold text-white leading-tight pr-12">${recipe.name}</h2>
                    <p class="text-xs font-medium text-indigo-400">${buildingName}</p>
                </div>
                <div class="grid grid-cols-2 gap-3 text-xs px-3 card-io-section">
                    <div>
                        <h4 class="font-bold text-orange-400 mb-1">Total Factory Demand</h4>
                        <div class="flex items-center justify-center h-full">
                            <span class="text-2xl font-bold text-orange-300" data-value="total-demand">0.00</span>
                        </div>
                    </div>
                    <div>
                        <h4 class="font-bold text-green-400 mb-1">Outputs</h4>
                        <div class="space-y-1">${Object.entries(recipe.outputs).map(([name]) => `
                            <div class="io-item relative flex justify-between items-center bg-gray-700/50 p-1 rounded-sm" data-output-name="${name}">
                                <div class="io-name-wrapper flex-1"><span class="io-name">${name}</span></div>
                                <span class="io-rate font-bold text-green-300 ml-2">0.00</span>
                                <div class="connector-node output" data-type="output" data-item-name="${name}" title="${name}"></div>
                            </div>`).join('')}
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-4 text-center border-t border-gray-700 mt-2 p-2 text-xs">
                    <div><span class="font-bold text-white" data-stat="buildings">1</span><span class="text-gray-400">x</span></div>
                    <div class="text-yellow-400"><span class="font-bold" data-stat="shards"></span></div>
                    <div><span class="font-bold text-yellow-400" data-stat="clock">100.00</span><span class="text-gray-400">%</span></div>
                    <div></div>
                </div>
                 <div class="text-center bg-gray-900/50 ${powerTextColor} text-xs py-1">
                    Power: <span class="font-bold text-white"><span data-value="power">0.00</span></span> MW
                 </div>
            </div>
        `;
    } else {
        const powerTextColor = 'text-cyan-400';
        card.innerHTML = `
            <div class="relative flex-1 flex flex-col">
                <div class="p-3">
                    <div class="absolute top-2 right-2 flex gap-1">
                        <button data-action="configure" title="Configure" class="text-gray-400 hover:text-white">${gearSVG}</button>
                        <button data-action="delete" title="Delete Card" class="text-gray-400 hover:text-red-500">${xSVG}</button>
                    </div>
                    <h2 class="text-base font-bold text-white leading-tight pr-12">${recipe.name}</h2>
                    <p class="text-xs font-medium text-indigo-400">${buildingName}</p>
                </div>
                <div class="grid grid-cols-2 gap-3 text-xs px-3 card-io-section">
                    <div>
                        <h4 class="font-bold text-orange-400 mb-1">Inputs</h4>
                        <div class="space-y-1">${Object.entries(recipe.inputs).map(([name]) => `
                            <div class="io-item relative flex justify-between items-center bg-gray-700/50 p-1 rounded-sm" data-input-name="${name}">
                                <div class="connector-node input" data-type="input" data-item-name="${name}" title="${name}"></div>
                                <div class="io-name-wrapper flex-1 pl-1"><span class="io-name">${name}</span></div>
                                <span class="io-rate font-bold text-orange-300 ml-2">0.00</span>
                            </div>`).join('') || '<p class="text-gray-500 text-xs">None</p>'}
                        </div>
                    </div>
                    <div>
                        <h4 class="font-bold text-green-400 mb-1">Outputs</h4>
                        <div class="space-y-1">${Object.entries(recipe.outputs).map(([name]) => `
                            <div class="io-item relative flex justify-between items-center bg-gray-700/50 p-1 rounded-sm" data-output-name="${name}">
                                <div class="io-name-wrapper flex-1"><span class="io-name">${name}</span></div>
                                <span class="io-rate font-bold text-green-300 ml-2">0.00</span>
                                <div class="connector-node output" data-type="output" data-item-name="${name}" title="${name}"></div>
                            </div>`).join('') || '<p class="text-gray-500 text-xs">None</p>'}
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-4 text-center border-t border-gray-700 mt-2 p-2 text-xs">
                    <div><span class="font-bold text-white" data-stat="buildings">1</span><span class="text-gray-400">x</span></div>
                    <div class="text-yellow-400"><span class="font-bold" data-stat="shards"></span></div>
                    <div><span class="font-bold text-yellow-400" data-stat="clock">100.00</span><span class="text-gray-400">%</span></div>
                    <div class="${(SOMERSLOOP_SLOTS[buildingName] || 0) > 0 ? '' : 'invisible'}"><span class="font-bold text-purple-400" data-stat="somersloops">0/${SOMERSLOOP_SLOTS[buildingName] || 0}</span><span class="text-gray-400">Loops</span></div>
                </div>
                 <div class="text-center bg-gray-900/50 ${powerTextColor} text-xs py-1">
                    Power: <span class="font-bold text-white"><span data-value="power">0.00</span></span> MW
                 </div>
            </div>
        `;
    }

    if (isPreview) {
        dom.pastePreviewContainer.appendChild(card);
    } else {
        dom.canvasContent.appendChild(card);
        state.placedCards.set(cardId, cardData);
        addCardEventListeners(cardData);
    }
    
    if(isPowerGenerator) renderPowerCardIO(cardData);
    updateCardCalculations(cardData);
}

/**
 * Removes a set of cards from the state and DOM.
 */
export function deleteCards(cardIds) {
    cardIds.forEach(cardId => {
        state.placedCards.get(cardId)?.element.remove();
        state.placedCards.delete(cardId);
        const connectionsToRemove = [];
        state.connections.forEach((conn, id) => {
            if (conn.from.cardId === cardId || conn.to.cardId === cardId) {
                connectionsToRemove.push(id);
            }
        });
        connectionsToRemove.forEach(id => state.connections.delete(id));
    });
    updateAllCalculations();
}

/**
 * Attaches event listeners to a card.
 */
function addCardEventListeners(cardData) {
    const { element, id } = cardData;
    element.addEventListener('contextmenu', (e) => showContextMenu(e, cardData));
    
    const fuelSelector = element.querySelector('[data-control="fuel-selector"]');
    if (fuelSelector) {
        fuelSelector.addEventListener('change', (e) => {
            const newRecipeName = e.target.value;
            const newRecipe = recipeData.recipes[cardData.building].find(r => r.name === newRecipeName);
            if (newRecipe) {
                cardData.recipe = newRecipe;
                element.querySelector('[data-recipe-name-display]').textContent = newRecipe.name;
                renderPowerCardIO(cardData);
                updateAllCalculations();
            }
        });
    }

    element.addEventListener('mousedown', (e) => {
        const button = e.target.closest('button');
        if (button) {
            const action = button.dataset.action;
            if (action === 'delete') { deleteCards(new Set([id])); return; }
            if (action === 'configure') { showModal(cardData); return; }
        }
        
        if (e.target.classList.contains('connector-node')) {
            state.isDrawingConnection = true;
            state.connectionStartNode = e.target;
            return;
        }

        if (e.button === 0 && !e.target.closest('input, button, select, select option')) {
            state.selectedConnectionIds.clear();
            if (e.shiftKey || e.ctrlKey) {
                if (state.selectedCardIds.has(id)) {
                    state.selectedCardIds.delete(id);
                } else {
                    state.selectedCardIds.add(id);
                }
            } else {
                if (!state.selectedCardIds.has(id)) {
                    state.selectedCardIds.clear();
                    state.selectedCardIds.add(id);
                }
            }
            renderCardSelections();
            renderSelectionSummary();
            renderConnections();
            state.dragInfo = {
                isRendering: false,
                dragThreshold: false,
                dragStartPos: { x: e.clientX, y: e.clientY },
                cardsToDrag: []
            };
            state.placedCards.forEach(card => {
                if (state.selectedCardIds.has(card.id)) {
                    card.element.classList.add('no-transition');
                    state.dragInfo.cardsToDrag.push({ card, startX: card.x, startY: card.y });
                }
            });
        }
    });
}

/**
 * Renders the input and output sections of a power plant card.
 */
export function renderPowerCardIO(cardData) {
    const { element, recipe } = cardData;
    const inputsContainer = element.querySelector('[data-container="inputs"]');
    const outputsContainer = element.querySelector('[data-container="outputs"]');
    if (!inputsContainer || !outputsContainer) return;

    // --- RENDER INPUTS ---
    let inputsHTML = '';
    if (Object.keys(recipe.inputs).length > 0) {
        inputsHTML = Object.entries(recipe.inputs).map(([name]) => `
            <div class="io-item relative flex justify-between items-center bg-gray-700/50 p-1 rounded-sm" data-input-name="${name}">
                <div class="connector-node input" data-type="input" data-item-name="${name}" title="${name}"></div>
                <div class="io-name-wrapper flex-1 pl-1"><span class="io-name">${name}</span></div>
                <span class="io-rate font-bold text-orange-300 ml-2">0.00</span>
            </div>`).join('');
         inputsContainer.innerHTML = inputsHTML;
    } else {
        inputsContainer.innerHTML = '<p class="text-gray-500 text-xs text-center p-1">No Fuel Required</p>';
    }
    
    // --- RENDER OUTPUTS ---
    let outputsHTML = '';
    if (Object.keys(recipe.outputs).length > 0) {
        outputsHTML = Object.entries(recipe.outputs).map(([name]) => `
            <div class="io-item relative flex justify-between items-center bg-gray-700/50 p-1 rounded-sm" data-output-name="${name}">
                <div class="io-name-wrapper flex-1"><span class="io-name">${name}</span></div>
                <span class="io-rate font-bold text-green-300 ml-2">0.00</span>
                <div class="connector-node output" data-type="output" data-item-name="${name}" title="${name}"></div>
            </div>`).join('');
    } else {
        outputsHTML = '<p class="text-gray-500 text-xs text-center p-1">None</p>';
    }
    outputsContainer.innerHTML = outputsHTML;

}
