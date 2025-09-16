/**
 * This file (js/ui/render.js) contains all functions that directly manipulate the DOM
 * to reflect the current state of the application. The logic for calculating raw inputs
 * has been updated to show gross consumption of extracted materials.
 */
import dom from '/SatisfiedVisual/js/dom.js';
import state from '/SatisfiedVisual/js/state.js';
import { recipeData } from '/SatisfiedVisual/js/data/recipes.js';
import { getNodeWorldPosition } from '/SatisfiedVisual/js/utils.js';

// Helper to identify all possible raw resources from extractor buildings.
const RAW_RESOURCES = new Set();
recipeData.buildings.forEach(building => {
    if (building.category === 'Extraction') {
        const recipes = recipeData.recipes[building.name] || [];
        recipes.forEach(recipe => {
            Object.keys(recipe.outputs).forEach(outputName => {
                RAW_RESOURCES.add(outputName);
            });
        });
    }
});

/**
 * Renders the totals in the header and updates the demand display on extractor cards.
 */
export function renderGlobalTotals() {
    const balance = {};
    const totalConsumption = {}; // Track gross consumption for all items
    let baseGridPower = 0;
    const alienAugmenters = [];

    // First pass: calculate the balance and total consumption of all items.
    state.placedCards.forEach(card => {
        if (card.building === 'Alien Power Augmenter') {
            alienAugmenters.push(card); return;
        }
        if (card.buildings > 0) {
            Object.entries(card.outputs).forEach(([name, val]) => balance[name] = (balance[name] || 0) + val);
            Object.entries(card.inputs).forEach(([name, val]) => {
                balance[name] = (balance[name] || 0) - val;
                totalConsumption[name] = (totalConsumption[name] || 0) + val;
            });
            baseGridPower += card.power || 0;
        }
    });

    // Update the UI for extractor cards with the total factory demand.
    state.placedCards.forEach(card => {
        const buildingInfo = state.buildingsMap.get(card.building);
        if (buildingInfo && buildingInfo.category === 'Extraction') {
            const outputName = Object.keys(card.recipe.outputs)[0];
            if (outputName) {
                const totalDemand = totalConsumption[outputName] || 0;
                const demandEl = card.element.querySelector('[data-value="total-demand"]');
                if (demandEl) {
                    demandEl.textContent = totalDemand.toFixed(2);
                }
            }
        }
    });

    let flatPowerAdded = 0; let boostMultiplier = 0;
    alienAugmenters.forEach(augmenter => {
        flatPowerAdded += 500 * augmenter.buildings;
        boostMultiplier += (augmenter.isFueled ? 0.3 : 0.1) * augmenter.buildings;
    });
    const totalPower = (baseGridPower + flatPowerAdded) * (1 + boostMultiplier);

    // MODIFIED: Raw inputs are now the total consumption of items defined as raw resources.
    const rawInputs = Object.entries(totalConsumption)
        .filter(([name]) => RAW_RESOURCES.has(name) && totalConsumption[name] > 0.001)
        .sort();

    const finalOutputs = Object.entries(balance).filter(([, val]) => val > 0.001).sort();

    dom.totalInputs.innerHTML = rawInputs.length ? rawInputs.map(([name, val]) => `<div class="flex justify-between"><span class="text-gray-400 truncate">${name}</span><span class="font-bold">${Math.abs(val).toFixed(2)}</span></div>`).join('') : '<p class="text-gray-500 col-span-full">No raw inputs required.</p>';
    dom.totalOutputs.innerHTML = finalOutputs.length ? finalOutputs.map(([name, val]) => `<div class="flex justify-between"><span class="text-gray-400 truncate">${name}</span><span class="font-bold">${val.toFixed(2)}</span></div>`).join('') : '<p class="text-gray-500 col-span-full">All outputs consumed.</p>';
    dom.totalPower.innerHTML = `${totalPower.toFixed(2)} <span class="text-base text-cyan-400">MW</span>`;
}

/**
 * Renders the summary of the currently selected cards in the sidebar.
 */
export function renderSelectionSummary() {
    if (state.selectedCardIds.size === 0) {
        dom.selectionSummary.classList.add('hidden');
        return;
    }
    
    const balance = {}; let power = 0; let buildingCount = 0;
    state.selectedCardIds.forEach(id => {
        const card = state.placedCards.get(id);
        if (card) {
            buildingCount += card.buildings;
            power += card.power || 0;
            Object.entries(card.outputs).forEach(([name, val]) => balance[name] = (balance[name] || 0) + val);
            Object.entries(card.inputs).forEach(([name, val]) => balance[name] = (balance[name] || 0) - val);
        }
    });
    
    const inputs = Object.entries(balance).filter(([, val]) => val < -0.001).sort();
    const outputs = Object.entries(balance).filter(([, val]) => val > 0.001).sort();

    dom.selectionSummary.innerHTML = `
        <h3 class="text-sm font-bold text-cyan-400 mb-2">Selection Summary (${state.selectedCardIds.size} cards, ${buildingCount} buildings)</h3>
        <div class="text-xs space-y-2 max-h-48 overflow-y-auto">
            <p class="font-bold">Power: <span class="text-white">${power.toFixed(2)} MW</span></p>
            <div><h4 class="font-bold text-orange-400">Inputs</h4>${inputs.map(([name, val]) => `<div class="flex justify-between pl-2"><span class="text-gray-400">${name}</span><span>${Math.abs(val).toFixed(2)}</span></div>`).join('') || '<p class="text-gray-500 pl-2">None</p>'}</div>
            <div><h4 class="font-bold text-green-400">Outputs</h4>${outputs.map(([name, val]) => `<div class="flex justify-between pl-2"><span class="text-gray-400">${name}</span><span>${val.toFixed(2)}</span></div>`).join('') || '<p class="text-gray-500 pl-2">None</p>'}</div>
        </div>`;
    dom.selectionSummary.classList.remove('hidden');
}

/**
 * Redraws all SVG connection lines on the canvas.
 */
export function renderConnections() {
    dom.svgGroup.innerHTML = '';
    state.connections.forEach((conn, connId) => {
        const fromNode = document.querySelector(`#${conn.from.cardId} [data-item-name="${conn.from.itemName}"][data-type="output"]`);
        const toNode = document.querySelector(`#${conn.to.cardId} [data-item-name="${conn.to.itemName}"][data-type="input"]`);
        if (!fromNode || !toNode) return;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let lineClasses = 'connection-line';
        if (state.selectedConnectionIds.has(connId)) lineClasses += ' selected';
        if (state.lineStyle === 'circuit') lineClasses += ' circuit';
        if (conn.isDeficit) lineClasses += ' deficit';
        if (conn.isHighlighted) lineClasses += ' highlighted';
        if (state.selectedCardIds.has(conn.from.cardId) || state.selectedCardIds.has(conn.to.cardId)) {
            lineClasses += ' part-of-selection';
        }
        
        line.setAttribute('class', lineClasses);
        line.dataset.connId = connId;
        
        const p1 = getNodeWorldPosition(fromNode);
        const p2 = getNodeWorldPosition(toNode);

        let d;
        if (state.lineStyle === 'straight') {
            d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
        } else if (state.lineStyle === 'circuit') {
            const midX = p1.x + Math.max(30, (p2.x - p1.x)/2);
            d = `M ${p1.x} ${p1.y} H ${midX} V ${p2.y} H ${p2.x}`;
        } else { // curved
            const dx = Math.abs(p2.x - p1.x) * 0.6;
            const isHorizontal = Math.abs(p1.y - p2.y) < 1;
            const c1y = isHorizontal ? p1.y + 0.1 : p1.y;
            const c2y = isHorizontal ? p2.y + 0.1 : p2.y;
            d = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${c1y}, ${p2.x - dx} ${c2y}, ${p2.x} ${p2.y}`;
        }
        line.setAttribute('d', d);
        dom.svgGroup.appendChild(line);
    });
}

/**
 * Updates the viewport's pan and zoom.
 */
export function renderViewport() {
    const { x, y, zoom } = state.viewport;
    dom.canvasContent.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    dom.pastePreviewContainer.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    dom.svgGroup.setAttribute('transform', `translate(${x} ${y}) scale(${zoom})`);
    dom.canvasGrid.style.backgroundPosition = `${x}px ${y}px`;
    dom.canvasGrid.style.backgroundSize = `${state.gridSize * zoom}px ${state.gridSize * zoom}px`;
}

/**
 * Toggles the 'selected' class on cards based on the current selection state.
 */
export function renderCardSelections() {
    state.placedCards.forEach((card, id) => {
        card.element.classList.toggle('selected', state.selectedCardIds.has(id));
        card.element.querySelectorAll('.io-name').forEach(nameEl => {
            const wrapper = nameEl.parentElement;
            if (state.selectedCardIds.has(id) && wrapper.scrollWidth > wrapper.clientWidth) {
                nameEl.classList.add('scrolling-ticker');
            } else {
                nameEl.classList.remove('scrolling-ticker');
            }
        });
    });
}

/**
 * Applies or clears highlights on cards and connections based on the state.
 */
export function renderHighlights() {
    const { highlightedRecipeKey } = state;
    const highlightedCardIds = new Set();

    state.placedCards.forEach(card => card.element.classList.remove('highlighted'));
    state.connections.forEach(conn => conn.isHighlighted = false);

    if (highlightedRecipeKey) {
        state.placedCards.forEach(card => {
            if (card.recipe && card.recipe.outputs && Object.keys(card.recipe.outputs).includes(highlightedRecipeKey)) {
                card.element.classList.add('highlighted');
                highlightedCardIds.add(card.id);
            }
        });

        state.connections.forEach(conn => {
            if (highlightedCardIds.has(conn.from.cardId) || highlightedCardIds.has(conn.to.cardId)) {
                conn.isHighlighted = true;
            }
        });
    }
    renderConnections();
}
