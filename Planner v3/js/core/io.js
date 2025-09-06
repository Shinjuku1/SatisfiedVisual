/**
 * This file (js/ui/modals.js) handles the creation and management of all modal dialogs,
 * such as the card configuration panel and the overall factory summary.
 */
import dom from '/js/dom.js';
import state from '/js/state.js';
import { SOMERSLOOP_SLOTS } from '/js/constants.js';
import { updateAllCalculations } from '/js/core/calculations.js';
import { autoBuildInputsForCard } from '/js/core/autoBuild.js';

/**
 * Displays the main configuration modal for a given card.
 * @param {object} cardData - The state object for the card to configure.
 */
export function showModal(cardData) {
    dom.modalContainer.innerHTML = ''; // Clear previous modals
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    if (cardData.building === 'Alien Power Augmenter') {
        showAugmenterModal(modal, cardData);
    } else {
        showStandardConfigModal(modal, cardData);
    }
    
    dom.modalContainer.appendChild(modal);
    
    // Add event listeners to close the modal
    const closeModal = () => dom.modalContainer.innerHTML = '';
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    modal.querySelector('#close-modal').addEventListener('click', closeModal);
}

/**
 * Creates and displays the configuration modal for a standard production card.
 * @param {HTMLElement} modal - The modal backdrop element.
 * @param {object} cardData - The card's state object.
 */
function showStandardConfigModal(modal, cardData) {
    const totalSlots = SOMERSLOOP_SLOTS[cardData.building] || 0;
    const outputOptions = Object.keys(cardData.recipe.outputs);
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
            <h2 class="text-xl font-bold mb-4 text-white">Configure: ${cardData.recipe.name}</h2>
            <div class="space-y-6 text-sm">
                <!-- Buildings & Shards -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="font-medium text-gray-300">Buildings</label>
                        <input type="number" value="${cardData.buildings}" min="0" step="1" class="w-full mt-1 bg-gray-700 p-2 rounded text-center border border-gray-600" data-control="buildings">
                    </div>
                    <div>
                        <label class="font-medium text-gray-300">Power Shards</label>
                        <input type="number" value="${cardData.powerShards}" min="0" max="3" step="1" class="w-full mt-1 bg-gray-700 p-2 rounded text-center border border-gray-600" data-control="shards">
                    </div>
                </div>
                <!-- Clock Speed -->
                <div class="bg-gray-900/50 p-4 rounded-md">
                    <div class="flex justify-between items-center mb-2">
                        <label class="font-medium text-gray-300">Clock Speed</label>
                        <div class="flex items-center gap-2">
                            <input type="number" value="${cardData.powerShard.toFixed(2)}" step="0.01" class="w-24 bg-gray-700 p-1 rounded text-center border border-gray-600" data-control="clock">
                            <span class="text-gray-400" data-value="max-clock">% (Max: 250%)</span>
                        </div>
                    </div>
                    <input type="range" min="0.1" max="250" value="${cardData.powerShard}" step="0.01" data-control="clock-slider">
                </div>
                <!-- Desired Output -->
                <div class="bg-gray-900/50 p-4 rounded-md ${outputOptions.length > 0 ? '' : 'hidden'}">
                    <label class="font-medium text-gray-300">Target Production Rate</label>
                    <div class="flex items-center gap-2 mt-2">
                        <select data-control="target-item" class="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-white">
                            ${outputOptions.map(name => `<option value="${name}">${name}</option>`).join('')}
                        </select>
                        <input type="number" placeholder="Items/min" min="0" step="0.01" class="w-32 bg-gray-700 p-2 rounded text-center border border-gray-600" data-control="target-rate">
                    </div>
                </div>
                <!-- Somersloops -->
                <div class="pt-4 ${totalSlots > 0 ? '' : 'hidden'}">
                    <label class="flex justify-between text-purple-400"><span>Somersloops Inserted</span><span data-value="ss">${cardData.somersloops} / ${totalSlots}</span></label>
                    <input type="range" min="0" max="${totalSlots}" value="${cardData.somersloops}" step="1" class="w-full h-2 mt-2" data-control="ss">
                </div>
            </div>
            <button id="close-modal" class="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Done</button>
        </div>
    `;

    // Logic for updating the card when modal controls are changed
    const controls = {
        buildings: modal.querySelector('[data-control="buildings"]'),
        shards: modal.querySelector('[data-control="shards"]'),
        clock: modal.querySelector('[data-control="clock"]'),
        clockSlider: modal.querySelector('[data-control="clock-slider"]'),
        maxClockLabel: modal.querySelector('[data-value="max-clock"]'),
        targetItem: modal.querySelector('[data-control="target-item"]'),
        targetRate: modal.querySelector('[data-control="target-rate"]'),
        ssSlider: modal.querySelector('[data-control="ss"]'),
        ssLabel: modal.querySelector('[data-value="ss"]')
    };

    let isUpdating = false;

    const updateFromClock = () => {
        if (isUpdating) return;
        isUpdating = true;
        
        cardData.buildings = Math.max(0, parseInt(controls.buildings.value, 10) || 1);
        cardData.powerShards = Math.max(0, Math.min(3, parseInt(controls.shards.value, 10) || 0));
        
        const maxClock = 100 + 50 * cardData.powerShards;
        controls.maxClockLabel.textContent = `% (Max: ${maxClock}%)`;
        controls.clockSlider.max = maxClock;

        let newClock = parseFloat(controls.clock.value);
        newClock = Math.max(0.1, Math.min(maxClock, newClock));
        cardData.powerShard = newClock;
        controls.clock.value = newClock.toFixed(2);
        controls.clockSlider.value = newClock;

        if (controls.ssSlider) {
            cardData.somersloops = parseInt(controls.ssSlider.value, 10);
            controls.ssLabel.textContent = `${cardData.somersloops} / ${totalSlots}`;
        }
        
        if(controls.targetItem && controls.targetItem.value) {
            const targetName = controls.targetItem.value;
            const baseRate = cardData.recipe.outputs[targetName] || 0;
            const currentSSSlots = SOMERSLOOP_SLOTS[cardData.building] || 0;
            const currentSSMultiplier = currentSSSlots > 0 ? (1 + (cardData.somersloops / currentSSSlots)) : 1;
            const newTargetRate = baseRate * cardData.buildings * (cardData.powerShard / 100) * currentSSMultiplier;
            controls.targetRate.value = newTargetRate.toFixed(2);
        }

        updateAllCalculations();
        isUpdating = false;
    };
    
    const updateFromTargetRate = () => {
        if (isUpdating || !controls.targetItem || !controls.targetItem.value) return;
        isUpdating = true;

        cardData.buildings = Math.max(0, parseInt(controls.buildings.value, 10) || 1);
        cardData.powerShards = Math.max(0, Math.min(3, parseInt(controls.shards.value, 10) || 0));
        if (controls.ssSlider) cardData.somersloops = parseInt(controls.ssSlider.value, 10);

        const targetName = controls.targetItem.value;
        const desiredRate = parseFloat(controls.targetRate.value) || 0;
        const baseRate = cardData.recipe.outputs[targetName] || 0;

        if (baseRate > 0 && cardData.buildings > 0) {
            const currentSSSlots = SOMERSLOOP_SLOTS[cardData.building] || 0;
            const currentSSMultiplier = currentSSSlots > 0 ? (1 + (cardData.somersloops / currentSSSlots)) : 1;
            const requiredClockMultiplier = desiredRate / (baseRate * cardData.buildings * currentSSMultiplier);
            let requiredClock = requiredClockMultiplier * 100;
            
            const maxClock = 100 + 50 * cardData.powerShards;
            controls.maxClockLabel.textContent = `% (Max: ${maxClock}%)`;
            controls.clockSlider.max = maxClock;
            
            requiredClock = Math.max(0.1, Math.min(maxClock, requiredClock));
            cardData.powerShard = requiredClock;
            controls.clock.value = requiredClock.toFixed(2);
            controls.clockSlider.value = requiredClock;
        }
        updateAllCalculations();
        isUpdating = false;
    };

    controls.clock.addEventListener('input', () => { controls.clockSlider.value = controls.clock.value; updateFromClock(); });
    controls.clockSlider.addEventListener('input', () => { controls.clock.value = controls.clockSlider.value; updateFromClock(); });
    controls.buildings.addEventListener('input', updateFromClock);
    controls.shards.addEventListener('input', updateFromClock);
    if(controls.ssSlider) controls.ssSlider.addEventListener('input', updateFromClock);
    if(controls.targetRate) controls.targetRate.addEventListener('input', updateFromTargetRate);
    if(controls.targetItem) controls.targetItem.addEventListener('change', updateFromClock);

    updateFromClock(); // Initial sync
}

/**
 * Creates and displays the configuration modal for the Alien Power Augmenter.
 * @param {HTMLElement} modal - The modal backdrop element.
 * @param {object} cardData - The card's state object.
 */
function showAugmenterModal(modal, cardData) {
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 class="text-xl font-bold mb-4">Configure: Alien Power Augmenter</h2>
            <div class="space-y-4">
                <div class="flex items-center gap-4">
                    <label class="font-bold text-white w-28">Augmenters:</label>
                    <input type="number" value="${cardData.buildings}" min="0" max="10" class="w-full bg-gray-700 p-2 rounded text-center border border-gray-600" data-control="buildings">
                </div>
                <div class="flex items-center justify-center p-3 rounded-md bg-gray-900/50">
                    <input type="checkbox" id="fuel-toggle-${cardData.id}" data-control="fueled" class="h-5 w-5 rounded text-green-500 focus:ring-green-600" ${cardData.isFueled ? 'checked' : ''}>
                    <label for="fuel-toggle-${cardData.id}" class="ml-3 text-sm font-medium text-green-400">Fuel with Alien Power Matrix</label>
                </div>
            </div>
            <button id="close-modal" class="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Done</button>
        </div>`;
    
    const buildingsInput = modal.querySelector('[data-control="buildings"]');
    const fueledCheckbox = modal.querySelector('[data-control="fueled"]');
    
    const update = () => {
        cardData.buildings = Math.min(10, Math.max(0, parseInt(buildingsInput.value, 10) || 0));
        cardData.isFueled = fueledCheckbox.checked;
        buildingsInput.value = cardData.buildings;
        
        const statusText = cardData.isFueled ? 'FUELED (+30% Boost)' : 'UNFUELED (+10% Boost)';
        const statusColor = cardData.isFueled ? 'text-green-400' : 'text-gray-500';
        const statusEl = cardData.element.querySelector('[data-stat="fuel-status"]');
        if (statusEl) {
            statusEl.textContent = statusText;
            statusEl.className = `text-sm font-bold ${statusColor}`;
        }
        updateAllCalculations(); // Augmenter affects global totals
    };

    buildingsInput.addEventListener('input', update);
    fueledCheckbox.addEventListener('change', update);
}

/**
 * Displays a modal with a detailed summary of the entire factory.
 */
export function showSummaryModal() {
    // ... (logic from original file) ...
    // Note: This logic depends on a full state calculation
    const balance = {};
    const production = {};
    const consumption = {};
    let powerConsumption = 0;
    let powerProduction = 0;
    const alienAugmenters = [];
    const buildingCounts = {};
    let totalShards = 0, totalLoops = 0;

    state.placedCards.forEach(card => {
        buildingCounts[card.building] = (buildingCounts[card.building] || 0) + card.buildings;
        totalShards += (card.powerShards || 0) * card.buildings;
        totalLoops += (card.somersloops || 0) * card.buildings;
        if (card.building === 'Alien Power Augmenter') {
            alienAugmenters.push(card); return;
        }
        if (card.buildings > 0) {
            Object.entries(card.outputs).forEach(([name, val]) => {
                balance[name] = (balance[name] || 0) + val;
                production[name] = (production[name] || 0) + val;
            });
            Object.entries(card.inputs).forEach(([name, val]) => {
                balance[name] = (balance[name] || 0) - val;
                consumption[name] = (consumption[name] || 0) + val;
            });
            if (card.power < 0) powerConsumption -= card.power;
            else powerProduction += card.power;
        }
    });
    
    let flatPowerAdded = 0; let boostMultiplier = 0;
    alienAugmenters.forEach(augmenter => {
        flatPowerAdded += 500 * augmenter.buildings;
        boostMultiplier += (augmenter.isFueled ? 0.3 : 0.1) * augmenter.buildings;
    });
    powerProduction = (powerProduction + flatPowerAdded) * (1 + boostMultiplier);

    const allItems = new Set([...Object.keys(production), ...Object.keys(consumption)]);
    const rawInputs = [], finalOutputs = [];

    allItems.forEach(item => {
        const p = production[item] || 0;
        const c = consumption[item] || 0;
        if (p === 0 && c > 0) rawInputs.push({name: item, c});
        else if (c === 0 && p > 0) finalOutputs.push({name: item, p});
    });

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl p-6 h-5/6 flex flex-col">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-white">Factory Summary</h2>
                <button id="close-modal" class="text-gray-400 hover:text-white text-3xl">&times;</button>
            </div>
            <div class="flex-1 overflow-y-auto pr-4 text-sm grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- Left Column -->
                <div class="space-y-6">
                    <div class="bg-gray-900/50 p-4 rounded">
                        <h3 class="font-bold text-lg text-cyan-400 mb-2">Power Overview</h3>
                        <p>Consumption: <span class="font-bold text-white float-right">${powerConsumption.toFixed(2)} MW</span></p>
                        <p>Production: <span class="font-bold text-white float-right">${powerProduction.toFixed(2)} MW</span></p>
                        <p class="border-t border-gray-600 mt-1 pt-1">Net: <span class="font-bold float-right ${powerProduction - powerConsumption >= 0 ? 'text-green-400' : 'text-red-400'}">${(powerProduction - powerConsumption).toFixed(2)} MW</span></p>
                    </div>
                    <div class="bg-gray-900/50 p-4 rounded">
                        <h3 class="font-bold text-lg text-yellow-400 mb-2">Buildings & Upgrades</h3>
                        <div class="grid grid-cols-2 gap-x-4">
                            <div>
                                <p>Power Shards Used: <span class="font-bold text-white float-right">${totalShards}</span></p>
                                <p>Somersloops Used: <span class="font-bold text-white float-right">${totalLoops}</span></p>
                            </div>
                            <div>
                                ${Object.entries(buildingCounts).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => `<p>${name}:<span class="font-bold text-white float-right">${count}</span></p>`).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                <!-- Right Column -->
                <div class="space-y-6">
                    <div><h3 class="font-bold text-lg text-orange-400 mb-2">Raw Inputs</h3><div class="space-y-1 bg-gray-900/50 p-3 rounded max-h-48 overflow-y-auto">${rawInputs.sort((a,b) => a.name.localeCompare(b.name)).map(i => `<div class="flex justify-between"><span>${i.name}</span><span class="font-mono">${i.c.toFixed(2)}</span></div>`).join('') || '<p class="text-gray-500">None</p>'}</div></div>
                    <div><h3 class="font-bold text-lg text-green-400 mb-2">Final Outputs</h3><div class="space-y-1 bg-gray-900/50 p-3 rounded max-h-48 overflow-y-auto">${finalOutputs.sort((a,b) => a.name.localeCompare(b.name)).map(i => `<div class="flex justify-between"><span>${i.name}</span><span class="font-mono">${i.p.toFixed(2)}</span></div>`).join('') || '<p class="text-gray-500">None</p>'}</div></div>
                </div>
            </div>
        </div>
    `;
    dom.modalContainer.appendChild(modal);
    const closeModal = () => dom.modalContainer.innerHTML = '';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    modal.querySelector('#close-modal').addEventListener('click', closeModal);
}


/**
 * Shows a modal with options for the auto-build feature.
 * @param {object} targetCard - The card that initiated the auto-build.
 */
export function showAutoBuildOptionsModal(targetCard) {
    dom.modalContainer.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 class="text-xl font-bold mb-4">Auto-Build Options</h2>
            <div class="space-y-4 text-sm">
                <label for="use-sam-toggle" class="flex items-center justify-between p-3 rounded-md bg-gray-900/50 cursor-pointer">
                    <span class="font-medium text-white">Use Reanimated SAM Recipes</span>
                    <input type="checkbox" id="use-sam-toggle" class="h-5 w-5 rounded text-indigo-500 focus:ring-indigo-600" ${state.autoBuildOptions.useSAM ? 'checked' : ''}>
                </label>
                <label for="use-alts-toggle" class="flex items-center justify-between p-3 rounded-md bg-gray-900/50 cursor-pointer">
                    <span class="font-medium text-white">Use Alternate Recipes</span>
                    <input type="checkbox" id="use-alts-toggle" class="h-5 w-5 rounded text-indigo-500 focus:ring-indigo-600" ${state.autoBuildOptions.useAlternates ? 'checked' : ''}>
                </label>
            </div>
            <div class="mt-6 flex gap-4">
                <button id="cancel-autobuild" class="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Cancel</button>
                <button id="confirm-autobuild" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Build</button>
            </div>
        </div>
    `;
    dom.modalContainer.appendChild(modal);

    const closeModal = () => dom.modalContainer.innerHTML = '';
    
    modal.querySelector('#confirm-autobuild').addEventListener('click', () => {
        state.autoBuildOptions.useSAM = modal.querySelector('#use-sam-toggle').checked;
        state.autoBuildOptions.useAlternates = modal.querySelector('#use-alts-toggle').checked;
        autoBuildInputsForCard(targetCard, state.autoBuildOptions);
        closeModal();
    });

    modal.querySelector('#cancel-autobuild').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

