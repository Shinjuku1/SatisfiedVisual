/**
 * This file (js/ui/modals.js) contains the logic for creating and displaying
 * all modal windows in the application. The Factory Summary has been completely
 * redesigned into a multi-tab dashboard for better visual appeal and more detailed information.
 */ 
import dom from '/SatisfiedVisual/js/dom.js';
import state from '/SatisfiedVisual/js/state.js';
import { recipeData } from '/SatisfiedVisual/js/data/recipes.js';
import { SOMERSLOOP_SLOTS } from '/SatisfiedVisual/js/constants.js';
import { updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';
import { autoBuildInputsForCard } from '/SatisfiedVisual/js/core/autobuild.js';

// --- Recipe Book Modal ---
export function showRecipeBookModal() {
    dom.modalContainer.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    const groupedAlternates = {};
    Object.entries(recipeData.recipes).forEach(([buildingName, recipes]) => {
        recipes.forEach(recipe => {
            if (recipe.isAlternate) {
                const outputName = Object.keys(recipe.outputs)[0];
                if (!groupedAlternates[outputName]) {
                    groupedAlternates[outputName] = [];
                }
                groupedAlternates[outputName].push({ ...recipe, building: buildingName });
            }
        });
    });

    let recipeListHTML = '';
    for (const outputName of Object.keys(groupedAlternates).sort()) {
        recipeListHTML += `<h4 class="font-bold text-indigo-300 mt-3 mb-1">${outputName}</h4>`;
        groupedAlternates[outputName].forEach(recipe => {
            const recipeKey = `${recipe.building}|${recipe.name}`;
            const isChecked = state.unlockedRecipes.has(recipeKey);
            recipeListHTML += `
                <label class="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-700 cursor-pointer">
                    <input type="checkbox" data-recipe-key="${recipeKey}" class="h-4 w-4 rounded text-indigo-500 focus:ring-indigo-600" ${isChecked ? 'checked' : ''}>
                    <span class="text-sm text-white">${recipe.name} <span class="text-xs text-gray-400">(${recipe.building})</span></span>
                </label>
            `;
        });
    }

    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl h-5/6 flex flex-col p-6">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-2xl font-bold text-yellow-400">Recipe Book</h2>
                <button id="close-modal" class="text-gray-400 hover:text-white text-3xl">&times;</button>
            </div>
            <div class="flex items-center gap-4 mb-4 border-b border-gray-700 pb-4">
                 <p class="text-sm text-gray-300 flex-1">Select which alternate recipes you have unlocked. The "Auto-Build" feature will only use recipes that are checked here.</p>
                 <button id="select-all-alts" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md text-sm">Select All</button>
                 <button id="deselect-all-alts" class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md text-sm">Deselect All</button>
            </div>
            <div class="flex-1 overflow-y-auto pr-2">
                ${recipeListHTML}
            </div>
        </div>
    `;
    dom.modalContainer.appendChild(modal);

    const closeModal = () => dom.modalContainer.innerHTML = '';
    modal.querySelector('#close-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const key = checkbox.dataset.recipeKey;
            if (checkbox.checked) {
                state.unlockedRecipes.add(key);
            } else {
                state.unlockedRecipes.delete(key);
            }
        });
    });

    modal.querySelector('#select-all-alts').addEventListener('click', () => {
        checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
                checkbox.checked = true;
                state.unlockedRecipes.add(checkbox.dataset.recipeKey);
            }
        });
    });

    modal.querySelector('#deselect-all-alts').addEventListener('click', () => {
        checkboxes.forEach(checkbox => {
            if (checkbox.checked) {
                checkbox.checked = false;
                state.unlockedRecipes.delete(checkbox.dataset.recipeKey);
            }
        });
    });
}


// --- Card Configuration Modal ---
export function showModal(cardData) {
    dom.modalContainer.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';

    if (cardData.building === 'Alien Power Augmenter') {
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
        dom.modalContainer.appendChild(modal);

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
            updateAllCalculations();
        };
        buildingsInput.addEventListener('input', update);
        fueledCheckbox.addEventListener('change', update);

    } else {
        const totalSlots = SOMERSLOOP_SLOTS[cardData.building] || 0;
        const outputOptions = Object.keys(cardData.recipe.outputs);
        modal.innerHTML = `
            <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg p-6">
                <h2 class="text-xl font-bold mb-4 text-white">Configure: ${cardData.recipe.name}</h2>
                <div class="space-y-6 text-sm">
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
                    <div class="bg-gray-900/50 p-4 rounded-md ${outputOptions.length > 0 ? '' : 'hidden'}">
                        <label class="font-medium text-gray-300">Target Production Rate</label>
                        <div class="flex items-center gap-2 mt-2">
                            <select data-control="target-item" class="flex-1 bg-gray-700 border border-gray-600 rounded p-2 text-white">
                                ${outputOptions.map(name => `<option value="${name}">${name}</option>`).join('')}
                            </select>
                            <input type="number" placeholder="Items/min" min="0" step="0.01" class="w-32 bg-gray-700 p-2 rounded text-center border border-gray-600" data-control="target-rate">
                        </div>
                    </div>
                    <div class="pt-4 ${totalSlots > 0 ? '' : 'hidden'}">
                        <label class="flex justify-between text-purple-400"><span>Somersloops Inserted</span><span data-value="ss">${cardData.somersloops} / ${totalSlots}</span></label>
                        <input type="range" min="0" max="${totalSlots}" value="${cardData.somersloops}" step="1" class="w-full h-2 mt-2" data-control="ss">
                    </div>
                </div>
                <button id="close-modal" class="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Done</button>
            </div>
        `;
        dom.modalContainer.appendChild(modal);

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
                const ssMultiplier = totalSlots > 0 ? (1 + (cardData.somersloops / totalSlots)) : 1;
                const newTargetRate = baseRate * cardData.buildings * (cardData.powerShard / 100) * ssMultiplier;
                controls.targetRate.value = newTargetRate.toFixed(2);
            }
            updateAllCalculations();
            isUpdating = false;
        };
        const updateFromTargetRate = () => {
            if (isUpdating || !controls.targetItem.value) return;
            isUpdating = true;
            cardData.buildings = Math.max(0, parseInt(controls.buildings.value, 10) || 1);
            cardData.powerShards = Math.max(0, Math.min(3, parseInt(controls.shards.value, 10) || 0));
            if (controls.ssSlider) cardData.somersloops = parseInt(controls.ssSlider.value, 10);
            const targetName = controls.targetItem.value;
            const desiredRate = parseFloat(controls.targetRate.value) || 0;
            const baseRate = cardData.recipe.outputs[targetName] || 0;
            if (baseRate > 0 && cardData.buildings > 0) {
                const ssMultiplier = totalSlots > 0 ? (1 + (cardData.somersloops / totalSlots)) : 1;
                const requiredClock = (desiredRate / (baseRate * cardData.buildings * ssMultiplier)) * 100;
                const maxClock = 100 + 50 * cardData.powerShards;
                cardData.powerShard = Math.max(0.1, Math.min(maxClock, requiredClock));
                controls.clock.value = cardData.powerShard.toFixed(2);
                controls.clockSlider.value = cardData.powerShard;
            }
            updateAllCalculations();
            isUpdating = false;
        };
        controls.clock.addEventListener('input', updateFromClock);
        controls.clockSlider.addEventListener('input', updateFromClock);
        controls.buildings.addEventListener('input', updateFromClock);
        controls.shards.addEventListener('input', updateFromClock);
        if(controls.ssSlider) controls.ssSlider.addEventListener('input', updateFromClock);
        if(controls.targetRate) controls.targetRate.addEventListener('input', updateFromTargetRate);
        if(controls.targetItem) controls.targetItem.addEventListener('change', updateFromClock);
        updateFromClock();
    }
    
    const closeModal = () => dom.modalContainer.innerHTML = '';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    modal.querySelector('#close-modal').addEventListener('click', closeModal);
}

// --- Factory Summary Dashboard ---
export function showSummaryModal() {
    const production = {}, consumption = {};
    let powerConsumption = 0, powerProduction = 0;
    const alienAugmenters = [], buildingSummary = {}, powerByConsumer = {}, powerByProducer = {};
    let totalShards = 0, totalLoops = 0;

    state.placedCards.forEach(card => {
        const buildingInfo = state.buildingsMap.get(card.building);
        const isPowerGenerator = buildingInfo && buildingInfo.category === 'Power';
        const name = isPowerGenerator ? card.recipe.name : card.building;

        if (!buildingSummary[name]) {
            buildingSummary[name] = { cardCount: 0, buildingCount: 0 };
        }
        buildingSummary[name].cardCount++;
        buildingSummary[name].buildingCount += card.buildings;
        totalShards += (card.powerShards || 0) * card.buildings;
        totalLoops += (card.somersloops || 0) * card.buildings;

        if (card.building === 'Alien Power Augmenter') {
            alienAugmenters.push(card); return;
        }

        if (card.buildings > 0) {
            Object.entries(card.outputs).forEach(([n, v]) => { production[n] = (production[n] || 0) + v; });
            Object.entries(card.inputs).forEach(([n, v]) => { consumption[n] = (consumption[n] || 0) + v; });
            if (card.power < 0) {
                const c = -card.power;
                powerConsumption += c;
                powerByConsumer[card.building] = (powerByConsumer[card.building] || 0) + c;
            } else {
                powerProduction += card.power;
                powerByProducer[name] = (powerByProducer[name] || 0) + card.power;
            }
        }
    });
    
    let flatPowerAdded = 0, boostMultiplier = 0;
    alienAugmenters.forEach(a => { flatPowerAdded += 500 * a.buildings; boostMultiplier += (a.isFueled ? 0.3 : 0.1) * a.buildings; });
    powerProduction = (powerProduction + flatPowerAdded) * (1 + boostMultiplier);
    if(alienAugmenters.length > 0) powerByProducer['Alien Power Augmenters'] = flatPowerAdded * (1 + boostMultiplier);

    const allItems = new Set([...Object.keys(production), ...Object.keys(consumption)]);
    const rawInputs = [], finalOutputs = [];
    allItems.forEach(item => {
        const p = production[item] || 0;
        const c = consumption[item] || 0;
        if (c > 0 && p === 0) {
            rawInputs.push({ name: item, c: c });
        }
        const net = p - c;
        if (net > 0.01) {
            finalOutputs.push({ name: item, p: net });
        }
    });

    const topPowerConsumers = Object.entries(powerByConsumer).sort(([, a], [, b]) => b - a).slice(0, 10);
    const topPowerProducers = Object.entries(powerByProducer).sort(([, a], [, b]) => b - a).slice(0, 10);

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl h-5/6 flex flex-col">
            <div class="flex justify-between items-center p-4 border-b border-gray-700">
                <h2 class="text-2xl font-bold text-white">Factory Summary Dashboard</h2>
                <button id="close-modal" class="text-gray-400 hover:text-white text-3xl">&times;</button>
            </div>
            <div class="flex border-b border-gray-700">
                <button data-tab="power" class="summary-tab-button active font-semibold p-4">Power</button>
                <button data-tab="buildings" class="summary-tab-button font-semibold p-4">Buildings & Upgrades</button>
                <button data-tab="resources" class="summary-tab-button font-semibold p-4">Resources</button>
                <button data-tab="ledger" class="summary-tab-button font-semibold p-4">Item Ledger</button>
            </div>
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
                <div id="summary-tab-power" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${createPowerOverviewHTML(powerProduction, powerConsumption)}
                    ${createPowerBreakdownHTML('Top Power Consumers', topPowerConsumers, powerConsumption, 'cyan')}
                    ${createPowerBreakdownHTML('Power Producers', topPowerProducers, powerProduction, 'green')}
                </div>
                <div id="summary-tab-buildings" class="hidden">
                    ${createBuildingSummaryHTML(buildingSummary, totalShards, totalLoops)}
                </div>
                <div id="summary-tab-resources" class="hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${createResourceListHTML('Raw Inputs', rawInputs, 'c', 'orange')}
                    ${createResourceListHTML('Final Outputs', finalOutputs, 'p', 'green')}
                </div>
                <div id="summary-tab-ledger" class="hidden">
                    ${createLedgerHTML(allItems, production, consumption)}
                </div>
            </div>
        </div>
    `;
    dom.modalContainer.appendChild(modal);

    const tabs = modal.querySelectorAll('.summary-tab-button');
    const panels = modal.querySelectorAll('[id^="summary-tab-"]');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            panels.forEach(p => p.classList.add('hidden'));
            modal.querySelector(`#summary-tab-${tab.dataset.tab}`).classList.remove('hidden');
        });
    });

    const closeModal = () => dom.modalContainer.innerHTML = '';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    modal.querySelector('#close-modal').addEventListener('click', closeModal);
}

// --- HTML Generation Helpers for Summary ---
function createPowerOverviewHTML(prod, cons) {
    const net = prod - cons;
    return `
    <div class="bg-gray-900/50 p-4 rounded-lg lg:col-span-1">
        <h3 class="font-bold text-lg text-cyan-400 mb-3 flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            Power Overview
        </h3>
        <div class="text-sm space-y-2">
            <p class="flex justify-between"><span>Consumption:</span> <span class="font-bold text-white">${cons.toFixed(2)} MW</span></p>
            <p class="flex justify-between"><span>Production:</span> <span class="font-bold text-white">${prod.toFixed(2)} MW</span></p>
            <p class="flex justify-between border-t border-gray-600 mt-2 pt-2"><span>Net:</span> <span class="font-bold ${net >= 0 ? 'text-green-400' : 'text-red-400'}">${net.toFixed(2)} MW</span></p>
        </div>
    </div>`;
}

function createPowerBreakdownHTML(title, sources, total, color) {
    const icon = title === 'Top Power Consumers' ? 
        `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>` :
        `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>`;
    
    return `
    <div class="bg-gray-900/50 p-4 rounded-lg">
        <h3 class="font-bold text-lg text-${color}-400 mb-3 flex items-center gap-2">${icon} ${title}</h3>
        <div class="text-xs space-y-3">
            ${sources.map(([name, power]) => {
                const percentage = total > 0 ? (power / total) * 100 : 0;
                return `
                <div>
                    <div class="flex justify-between mb-1">
                        <span class="text-gray-300 truncate">${name}</span>
                        <span class="font-mono text-white">${power.toFixed(2)} MW</span>
                    </div>
                    <div class="w-full bg-gray-700 rounded-full h-2"><div class="bg-${color}-500 h-2 rounded-full" style="width: ${percentage}%"></div></div>
                </div>`
            }).join('') || `<p class="text-gray-500">No power ${title.toLowerCase().includes('consumer') ? 'consumers' : 'producers'}.</p>`}
        </div>
    </div>`;
}

function createBuildingSummaryHTML(summary, shards, loops) {
    return `
    <div class="bg-gray-900/50 p-4 rounded-lg">
        <h3 class="font-bold text-lg text-yellow-400 mb-3 flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
            Buildings & Upgrades
        </h3>
        <div class="text-sm grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="space-y-2">
                 <p class="flex justify-between"><span>Power Shards:</span> <span class="font-bold text-white">${shards}</span></p>
                 <p class="flex justify-between"><span>Somersloops:</span> <span class="font-bold text-white">${loops}</span></p>
            </div>
            <div class="space-y-1 text-xs md:col-span-2">
                 <h4 class="font-bold text-gray-400 mb-1 text-right">Cards (Total Bldgs)</h4>
                <div class="grid grid-cols-2 gap-x-6">
                ${Object.entries(summary).sort(([a], [b]) => a.localeCompare(b)).map(([name, {cardCount, buildingCount}]) => {
                    const displayCount = cardCount > 1 ? `${cardCount} <span class="text-xs text-gray-400">(${buildingCount})</span>` : `${buildingCount}`;
                    return `<p class="flex justify-between border-b border-gray-700/50 py-1"><span>${name}</span> <span class="font-bold text-white">${displayCount}</span></p>`
                }).join('')}
                </div>
            </div>
        </div>
    </div>`;
}

function createResourceListHTML(title, items, key, color) {
    const icon = title === 'Raw Inputs' ? 
        `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>` :
        `<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>`;

    return `
    <div class="bg-gray-900/50 p-4 rounded-lg flex flex-col">
        <h3 class="font-bold text-lg text-${color}-400 mb-3 flex items-center gap-2">${icon} ${title}</h3>
        <div class="text-sm space-y-2 flex-1 overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
        ${items.sort((a,b)=>a.name.localeCompare(b.name)).map(i => `
            <div class="flex justify-between border-b border-gray-700/50 py-1">
                <span>${i.name}</span>
                <span class="font-mono text-white">${i[key].toFixed(2)}</span>
            </div>`).join('') || `<p class="text-gray-500 col-span-full">None</p>`}
        </div>
    </div>`;
}

function createLedgerHTML(allItems, production, consumption) {
    return `
    <div class="bg-gray-900/50 p-4 rounded-lg flex flex-col">
        <h3 class="font-bold text-lg text-purple-400 mb-3 flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Full Item Ledger
        </h3>
        <div class="text-xs flex-1 flex flex-col">
            <div class="grid grid-cols-4 font-bold border-b border-gray-600 pb-2 mb-2">
                <span>Item</span>
                <span class="text-right">Produced /min</span>
                <span class="text-right">Consumed /min</span>
                <span class="text-right">Net /min</span>
            </div>
            <div class="flex-1 overflow-y-auto pr-2">
            ${[...allItems].sort().map(item => {
                const p = production[item] || 0;
                const c = consumption[item] || 0;
                const net = p - c;
                return `
                <div class="grid grid-cols-4 font-mono py-1 border-b border-gray-700/50">
                    <span class="font-sans font-normal text-gray-300 truncate">${item}</span>
                    <span class="text-right text-green-400">${p.toFixed(2)}</span>
                    <span class="text-right text-orange-400">${c.toFixed(2)}</span>
                    <span class="text-right font-bold ${net > 0.01 ? 'text-green-300' : net < -0.01 ? 'text-red-400' : 'text-gray-400'}">${net.toFixed(2)}</span>
                </div>`
            }).join('')}
            </div>
        </div>
    </div>`;
}

// --- Auto-Build Options Modal ---
export function showAutoBuildOptionsModal(onConfirm) {
    dom.modalContainer.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 class="text-xl font-bold mb-4">Auto-Build Options</h2>
            <p class="text-sm text-gray-400 mb-4">Auto-build will only use alternate recipes that are enabled in the Recipe Book.</p>
            <div class="space-y-4 text-sm">
                <label for="use-alts-toggle" class="flex items-center justify-between p-3 rounded-md bg-gray-900/50 cursor-pointer">
                    <span class="font-medium text-white">Use Unlocked Alternate Recipes</span>
                    <input type="checkbox" id="use-alts-toggle" class="h-5 w-5 rounded text-indigo-500 focus:ring-indigo-600" checked>
                </label>
                <label for="use-sam-toggle" class="flex items-center justify-between p-3 rounded-md bg-gray-900/50 cursor-pointer">
                    <span class="font-medium text-white">Use Reanimated SAM Recipes</span>
                    <input type="checkbox" id="use-sam-toggle" class="h-5 w-5 rounded text-indigo-500 focus:ring-indigo-600" ${state.autoBuildOptions.useSAM ? 'checked' : ''}>
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
    
    const samToggle = modal.querySelector('#use-sam-toggle');
    const altsToggle = modal.querySelector('#use-alts-toggle');

    modal.querySelector('#confirm-autobuild').addEventListener('click', () => {
        const options = {
            useSAM: samToggle.checked,
            useAlternates: altsToggle.checked
        };
        onConfirm(options); 
        closeModal();
    });

    modal.querySelector('#cancel-autobuild').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

}


