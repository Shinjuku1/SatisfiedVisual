/**
 * This file Handles all direct DOM manipulation for rendering application state to the screen.
 * This includes updating the canvas viewport, drawing connection lines, and updating summary panels.
 */
import dom from '../dom.js';
import state from '../state.js';
import { getNodeWorldPosition } from '../utils.js';

/**
 * Updates the canvas transform to reflect the current viewport pan and zoom.
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
 * Renders the connection lines between cards as SVG paths.
 */
export function renderConnections() {
    dom.svgGroup.innerHTML = '';
    state.connections.forEach((conn, connId) => {
        const fromNode = document.querySelector(`#${conn.from.cardId} [data-item-name="${conn.from.itemName}"][data-type="output"]`);
        const toNode = document.querySelector(`#${conn.to.cardId} [data-item-name="${conn.to.itemName}"][data-type="input"]`);
        if (!fromNode || !toNode) return;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        let lineClasses = `connection-line ${state.selectedConnectionIds.has(connId) ? 'selected' : ''}`;
        if(state.lineStyle === 'circuit') lineClasses += ' circuit';
        if(conn.isDeficit) lineClasses += ' deficit';
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
 * Updates the visual selection state of cards on the canvas.
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
 * Updates the global summary totals in the header.
 */
export function renderGlobalTotals() {
    const balance = {};
    let baseGridPower = 0;
    const alienAugmenters = [];

    state.placedCards.forEach(card => {
        if (card.building === 'Alien Power Augmenter') {
            alienAugmenters.push(card); return;
        }
        if (card.buildings > 0) {
            Object.entries(card.outputs).forEach(([name, val]) => balance[name] = (balance[name] || 0) + val);
            Object.entries(card.inputs).forEach(([name, val]) => balance[name] = (balance[name] || 0) - val);
            baseGridPower += card.power || 0;
        }
    });

    let flatPowerAdded = 0; let boostMultiplier = 0;
    alienAugmenters.forEach(augmenter => {
        flatPowerAdded += 500 * augmenter.buildings;
        boostMultiplier += (augmenter.isFueled ? 0.3 : 0.1) * augmenter.buildings;
    });
    const totalPower = (baseGridPower + flatPowerAdded) * (1 + boostMultiplier);

    const rawInputs = Object.entries(balance).filter(([, val]) => val < -0.001).sort();
    const finalOutputs = Object.entries(balance).filter(([, val]) => val > 0.001).sort();

    dom.totalInputs.innerHTML = rawInputs.length ? rawInputs.map(([name, val]) => `<div class="flex justify-between"><span class="text-gray-400 truncate">${name}</span><span class="font-bold">${Math.abs(val).toFixed(2)}</span></div>`).join('') : '<p class="text-gray-500 col-span-full">All inputs satisfied.</p>';
    dom.totalOutputs.innerHTML = finalOutputs.length ? finalOutputs.map(([name, val]) => `<div class="flex justify-between"><span class="text-gray-400 truncate">${name}</span><span class="font-bold">${val.toFixed(2)}</span></div>`).join('') : '<p class="text-gray-500 col-span-full">All outputs consumed.</p>';
    dom.totalPower.innerHTML = `${totalPower.toFixed(2)} <span class="text-base text-cyan-400">MW</span>`;
}

/**
 * Updates the selection summary panel in the sidebar.
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
