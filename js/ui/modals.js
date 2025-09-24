/**
 * This file (js/ui/modals.js) contains the logic for creating and displaying
 * all modal windows in the application. It has been updated to include the new
 * build strategy options and persistent settings.
 */
import dom from '/SatisfiedVisual/js/dom.js';
import state from '/SatisfiedVisual/js/state.js';
import { recipeData } from '/SatisfiedVisual/js/data/recipes.js';
import { SOMERSLOOP_SLOTS } from '/SatisfiedVisual/js/constants.js';
import { updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';
import { startBlueprintPaste } from '/SatisfiedVisual/js/core/io.js';
import { loadState } from '/SatisfiedVisual/js/core/io.js';
import { autoBalanceChain } from '/SatisfiedVisual/js/core/balancer.js';
import { autoBuildInputsForCard } from '/SatisfiedVisual/js/core/autobuild.js';

const USER_SETTINGS_KEY = 'satisfactoryPlannerSettingsV1';

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
                <h2 class="text-xl font-bold mb-4 text-white">Configure: Alien Power Augmenter</h2>
                <div class="space-y-4 text-sm">
                    <div>
                        <label class="font-medium text-gray-300">Number of Augmenters</label>
                        <input type="number" value="${cardData.buildings}" min="1" step="1" class="w-full mt-1 bg-gray-700 p-2 rounded text-center border border-gray-600" data-control="buildings">
                    </div>
                    <label for="is-fueled-toggle" class="flex items-center justify-between p-3 rounded-md bg-gray-900/50 cursor-pointer">
                        <span class="font-medium text-white">Is Fueled (+30% Power Boost)</span>
                        <input type="checkbox" id="is-fueled-toggle" class="h-5 w-5 rounded text-indigo-500 focus:ring-indigo-600" ${cardData.isFueled ? 'checked' : ''}>
                    </label>
                </div>
                <button id="close-modal" class="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Done</button>
            </div>
        `;
        dom.modalContainer.appendChild(modal);

        const buildingsInput = modal.querySelector('[data-control="buildings"]');
        const isFueledToggle = modal.querySelector('#is-fueled-toggle');

        const updateAugmenter = () => {
            cardData.buildings = parseInt(buildingsInput.value, 10) || 1;
            cardData.isFueled = isFueledToggle.checked;
            cardData.element.querySelector('[data-stat="fuel-status"]').textContent = cardData.isFueled ? 'FUELED (+30% Boost)' : 'UNFUELED (+10% Boost)';
            cardData.element.querySelector('[data-stat="fuel-status"]').className = `text-sm font-bold ${cardData.isFueled ? 'text-green-400' : 'text-gray-500'}`;
            updateAllCalculations();
        };

        buildingsInput.addEventListener('input', updateAugmenter);
        isFueledToggle.addEventListener('change', updateAugmenter);

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

        const updateFromUI = () => {
            if (isUpdating) return;
            isUpdating = true;
            
            cardData.buildings = Math.max(1, parseInt(controls.buildings.value, 10) || 1);
            cardData.powerShards = Math.max(0, Math.min(3, parseInt(controls.shards.value, 10) || 0));
            
            const maxClock = 100 + 50 * cardData.powerShards;
            controls.maxClockLabel.textContent = `% (Max: ${maxClock}%)`;
            controls.clockSlider.max = maxClock;

            let newClock = parseFloat(controls.clock.value);
            newClock = Math.max(0.1, Math.min(maxClock, newClock));
            cardData.powerShard = newClock;
            
            controls.clock.value = cardData.powerShard.toFixed(2);
            controls.clockSlider.value = cardData.powerShard;

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
            if (isUpdating) return;
            const targetName = controls.targetItem.value;
            const desiredRate = parseFloat(controls.targetRate.value) || 0;
            const baseRate = cardData.recipe.outputs[targetName] || 0;

            if (baseRate > 0 && cardData.buildings > 0) {
                const ssMultiplier = totalSlots > 0 ? (1 + (cardData.somersloops / totalSlots)) : 1;
                const requiredClock = (desiredRate / (baseRate * cardData.buildings * ssMultiplier)) * 100;
                controls.clock.value = requiredClock.toFixed(2);
                updateFromUI();
            }
        };

        controls.clockSlider.addEventListener('input', () => {
            controls.clock.value = parseFloat(controls.clockSlider.value).toFixed(2);
            updateFromUI();
        });
        controls.clock.addEventListener('change', () => {
             controls.clockSlider.value = controls.clock.value;
             updateFromUI();
        });
        controls.targetRate.addEventListener('change', updateFromTargetRate);
        
        controls.buildings.addEventListener('input', updateFromUI);
        controls.shards.addEventListener('input', updateFromUI);
        if(controls.ssSlider) controls.ssSlider.addEventListener('input', updateFromUI);
        if(controls.targetItem) controls.targetItem.addEventListener('change', updateFromUI);

        updateFromUI(); // Initial sync
    }
    
    const closeModal = () => dom.modalContainer.innerHTML = '';
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    modal.querySelector('#close-modal').addEventListener('click', closeModal);
}

// --- NEW/REVAMPED: Factory Summary Dashboard ---
export function showSummaryModal() {
    // --- 1. Data Aggregation ---
    const production = new Map();
    const consumption = new Map();
    const buildingSummary = new Map();
    const powerByConsumer = new Map();
    const powerByProducer = new Map();
    const alienAugmenters = [];
    let powerConsumption = 0, powerProduction = 0;
    let totalShards = 0, totalLoops = 0;

    state.placedCards.forEach(card => {
        // Summarize building counts and upgrades
        const buildingInfo = state.buildingsMap.get(card.building);
        const isPowerGenerator = buildingInfo && buildingInfo.category === 'Power';
        const summaryName = isPowerGenerator ? card.recipe.name : card.building;

        if (!buildingSummary.has(summaryName)) {
            buildingSummary.set(summaryName, { cardCount: 0, buildingCount: 0 });
        }
        const summary = buildingSummary.get(summaryName);
        summary.cardCount++;
        summary.buildingCount += card.buildings;
        totalShards += (card.powerShards || 0) * card.buildings;
        totalLoops += (card.somersloops || 0) * card.buildings;

        if (card.building === 'Alien Power Augmenter') {
            alienAugmenters.push(card);
            return; // Skip I/O for this special building
        }

        // Aggregate I/O and Power
        if (card.buildings > 0) {
            Object.entries(card.outputs).forEach(([n, v]) => production.set(n, (production.get(n) || 0) + v));
            Object.entries(card.inputs).forEach(([n, v]) => consumption.set(n, (consumption.get(n) || 0) + v));
            
            if (card.power < 0) {
                const consumed = -card.power;
                powerConsumption += consumed;
                powerByConsumer.set(card.building, (powerByConsumer.get(card.building) || 0) + consumed);
            } else {
                powerProduction += card.power;
                powerByProducer.set(summaryName, (powerByProducer.get(summaryName) || 0) + card.power);
            }
        }
    });

    // --- 2. Post-Calculation Processing ---
    let flatPowerAdded = 0, boostMultiplier = 0;
    alienAugmenters.forEach(a => {
        flatPowerAdded += 500 * a.buildings;
        boostMultiplier += (a.isFueled ? 0.3 : 0.1) * a.buildings;
    });
    const totalBasePower = powerProduction + flatPowerAdded;
    const totalBoostedPower = totalBasePower * (1 + boostMultiplier);
    if (alienAugmenters.length > 0) {
        const augmenterPower = flatPowerAdded * (1 + boostMultiplier);
        powerByProducer.set('Alien Augmenter', (powerByProducer.get('Alien Augmenter') || 0) + augmenterPower);
    }
    
    // Calculate Raw Inputs (Gross Consumption) and Final Outputs (Net Production)
    const allItems = new Set([...production.keys(), ...consumption.keys()]);
    const finalOutputs = [];
    const rawInputs = [];
    const RAW_RESOURCES = new Set(['Water', 'Crude Oil', 'Nitrogen Gas', 'Iron Ore', 'Copper Ore', 'Limestone', 'Coal', 'Caterium Ore', 'Sulfur', 'Raw Quartz', 'Bauxite', 'Uranium', 'SAM']);

    allItems.forEach(item => {
        const consumed = consumption.get(item) || 0;
        if (RAW_RESOURCES.has(item) && consumed > 0.001) {
            rawInputs.push({ name: item, rate: consumed });
        }
        const net = (production.get(item) || 0) - consumed;
        if (net > 0.001) {
            finalOutputs.push({ name: item, rate: net });
        }
    });

    const topPowerConsumers = [...powerByConsumer.entries()].sort(([, a], [, b]) => b - a).slice(0, 10);
    const topPowerProducers = [...powerByProducer.entries()].sort(([, a], [, b]) => b - a);

    // --- 3. Render Modal ---
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-2xl w-full max-w-7xl h-5/6 flex flex-col">
            <div class="flex justify-between items-center p-4 border-b border-gray-700">
                <h2 class="text-2xl font-bold text-white">Factory Summary Dashboard</h2>
                <button id="close-modal" class="text-gray-400 hover:text-white text-3xl">&times;</button>
            </div>
            <div class="flex border-b border-gray-700">
                <button data-tab="power" class="summary-tab-button active">Power</button>
                <button data-tab="resources" class="summary-tab-button">Resources</button>
                <button data-tab="buildings" class="summary-tab-button">Buildings</button>
                <button data-tab="ledger" class="summary-tab-button">Item Ledger</button>
                <button data-tab="support" class="summary-tab-button">Support & Info</button>
            </div>
            <div class="flex-1 overflow-y-auto p-6 space-y-6">
                <div id="summary-tab-power">
                    ${createPowerSummaryHTML(totalBoostedPower, powerConsumption, topPowerProducers, topPowerConsumers)}
                </div>
                <div id="summary-tab-resources" class="hidden grid grid-cols-1 md:grid-cols-2 gap-6">
                    ${createResourceListHTML('Total Raw Inputs', rawInputs, 'orange')}
                    ${createResourceListHTML('Final Net Outputs', finalOutputs, 'green')}
                </div>
                <div id="summary-tab-buildings" class="hidden">
                    ${createBuildingSummaryHTML(buildingSummary, totalShards, totalLoops)}
                </div>
                <div id="summary-tab-ledger" class="hidden">
                    ${createLedgerHTML(allItems, production, consumption)}
                </div>
                <div id="summary-tab-support" class="hidden">
                    ${createSupportHTML()}
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

// --- HTML Generation Helpers for New Summary ---
function createPowerSummaryHTML(prod, cons, producers, consumers) {
    const net = prod - cons;
    const capacityUsage = prod > 0 ? (cons / prod) * 100 : 0;
    return `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="summary-card lg:col-span-1">
            <div class="summary-card-header text-cyan-400">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span>Power Overview</span>
            </div>
            <div class="text-sm space-y-3">
                <p class="flex justify-between"><span>Production:</span> <span class="font-bold text-white">${prod.toFixed(2)} MW</span></p>
                <p class="flex justify-between"><span>Consumption:</span> <span class="font-bold text-white">${cons.toFixed(2)} MW</span></p>
                <div class="pt-2">
                    <div class="flex justify-between mb-1">
                        <span class="font-bold">Capacity Usage</span>
                        <span class="font-bold ${capacityUsage > 100 ? 'text-red-400' : 'text-white'}">${capacityUsage.toFixed(1)}%</span>
                    </div>
                    <div class="summary-progress-bar-bg"><div class="summary-progress-bar ${capacityUsage > 100 ? 'bg-red-500' : 'bg-cyan-500'}" style="width: ${Math.min(100, capacityUsage)}%"></div></div>
                </div>
                 <p class="flex justify-between border-t border-gray-600 mt-2 pt-3"><span>Net Balance:</span> <span class="font-bold text-lg ${net >= 0 ? 'text-green-400' : 'text-red-400'}">${net.toFixed(2)} MW</span></p>
            </div>
        </div>
        <div class="summary-card">
            ${createPowerBreakdownHTML('Power Producers', producers, prod, 'green')}
        </div>
        <div class="summary-card">
            ${createPowerBreakdownHTML('Top Power Consumers', consumers, cons, 'orange')}
        </div>
    </div>`;
}

function createPowerBreakdownHTML(title, sources, total, color) {
    const icon = title.includes('Consumer') ? 
        `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>` :
        `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>`;
    return `
    <div class="summary-card-header text-${color}-400">${icon} <span>${title}</span></div>
    <div class="text-xs space-y-3 overflow-y-auto pr-2 flex-1">
        ${sources.map(([name, power]) => {
            const percentage = total > 0 ? (power / total) * 100 : 0;
            return `
            <div>
                <div class="flex justify-between mb-1">
                    <span class="text-gray-300 truncate">${name}</span>
                    <span class="font-mono text-white">${power.toFixed(2)} MW</span>
                </div>
                <div class="summary-progress-bar-bg"><div class="summary-progress-bar bg-${color}-500" style="width: ${percentage}%"></div></div>
            </div>`;
        }).join('') || `<p class="text-gray-500 text-center flex-1 flex items-center justify-center">No power ${title.toLowerCase().includes('consumer') ? 'consumers' : 'producers'}.</p>`}
    </div>`;
}

function createResourceListHTML(title, items, color) {
    const icon = title.includes('Input') ?
        `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>` :
        `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>`;
    return `
    <div class="summary-card">
        <div class="summary-card-header text-${color}-400">${icon} <span>${title}</span></div>
        <div class="text-sm space-y-2 flex-1 overflow-y-auto pr-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        ${items.sort((a,b)=>a.name.localeCompare(b.name)).map(i => `
            <div class="flex justify-between border-b border-gray-700/50 py-1.5">
                <span class="text-gray-300">${i.name}</span>
                <span class="font-mono text-white">${i.rate.toFixed(2)}</span>
            </div>`).join('') || `<p class="text-gray-500 col-span-full text-center flex-1 flex items-center justify-center">None</p>`}
        </div>
    </div>`;
}

function createBuildingSummaryHTML(summary, shards, loops) {
    return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="summary-card md:col-span-1">
             <div class="summary-card-header text-yellow-400">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M2 13.5V6.3a2 2 0 012-2h4.5a2 2 0 012 2v2.4M2 13.5V18a2 2 0 002 2h4.5a2 2 0 002-2v-2.4M12.5 13.5V6.3a2 2 0 012-2h4.5a2 2 0 012 2v2.4M12.5 13.5V18a2 2 0 002 2h4.5a2 2 0 002-2v-2.4" /></svg>
                <span>Factory Upgrades</span>
            </div>
             <div class="text-sm space-y-3">
                <p class="flex justify-between text-lg"><span>Power Shards Used:</span> <span class="font-bold text-white">${shards}</span></p>
                <p class="flex justify-between text-lg"><span>Somersloops Inserted:</span> <span class="font-bold text-white">${loops}</span></p>
            </div>
        </div>
        <div class="summary-card md:col-span-2">
             <div class="summary-card-header text-indigo-400">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                <span>Building Counts</span>
            </div>
            <div class="text-xs flex-1 overflow-y-auto pr-2">
                <div class="grid grid-cols-2 md:grid-cols-3 gap-x-6">
                ${[...summary.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, {cardCount, buildingCount}]) => `
                    <p class="flex justify-between border-b border-gray-700/50 py-1.5">
                        <span class="text-gray-300 truncate">${name}</span> 
                        <span class="font-bold text-white">${buildingCount}</span>
                    </p>
                `).join('')}
                </div>
            </div>
        </div>
    </div>`;
}

function createLedgerHTML(allItems, production, consumption) {
    return `
    <div class="summary-card">
        <div class="summary-card-header text-purple-400">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            <span>Full Item Ledger</span>
        </div>
        <div class="flex-1 overflow-y-auto pr-2 text-xs">
            <table class="summary-table">
                <thead>
                    <tr><th>Item</th><th class="text-right">Produced /min</th><th class="text-right">Consumed /min</th><th class="text-right">Net /min</th></tr>
                </thead>
                <tbody>
                ${[...allItems].sort().map(item => {
                    const p = production.get(item) || 0;
                    const c = consumption.get(item) || 0;
                    const net = p - c;
                    return `
                    <tr>
                        <td class="font-sans font-normal text-gray-300 truncate">${item}</td>
                        <td class="text-right font-mono text-green-400">${p.toFixed(2)}</td>
                        <td class="text-right font-mono text-orange-400">${c.toFixed(2)}</td>
                        <td class="text-right font-mono font-bold ${net > 0.01 ? 'text-green-300' : net < -0.01 ? 'text-red-400' : 'text-gray-400'}">${net.toFixed(2)}</td>
                    </tr>`;
                }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
}

function createSupportHTML() {
    return `
    <div class="summary-card max-w-lg mx-auto text-center">
        <div class="summary-card-header text-yellow-400 justify-center">
             <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M8 9.5A1.5 1.5 0 106.5 8 1.5 1.5 0 008 9.5zM11.5 8a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/><path d="M2.368 1.623a.5.5 0 01.52-.323l14.28.006a.5.5 0 01.488.63l-1.393 5.438a.5.5 0 01-.488.369H4.156a.5.5 0 01-.488-.63L2.368 1.623zM2.81 8.614a1.5 1.5 0 01-1.488-.63L0 1.623a1.5 1.5 0 011.56-1.3l14.28.005a1.5 1.5 0 011.464 1.891l-1.393 5.438a1.5 1.5 0 01-1.464 1.108H4.32a1.5 1.5 0 01-1.51-1.074zM16 11.5a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 012 11.5V10h14v1.5z"/></svg>
            <span>Support the Project</span>
        </div>
        <div class="text-gray-300 space-y-4">
            <p>If you find this tool useful, please consider supporting its development. Your support helps keep the project alive and allows for new features to be added!</p>
            <p>Every little bit helps. Thank you!</p>
            <a href="https://buymeacoffee.com/shinjuku1" target="_blank" rel="noopener noreferrer" class="inline-block bg-yellow-400 hover:bg-yellow-500 text-black font-bold py-3 px-6 text-lg rounded-lg transition-colors mt-4">
                Buy Me a Coffee
            </a>
        </div>
    </div>
    `;
}

// --- Import Options Modal ---
export function showImportOptionsModal(blueprint) {
    dom.modalContainer.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 class="text-xl font-bold mb-4">Import Blueprint</h2>
            <p class="text-sm text-gray-400 mb-6">How would you like to import this blueprint?</p>
            <div class="flex flex-col gap-4">
                <button id="import-replace" class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-colors">Replace Current Factory</button>
                <button id="import-paste" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded transition-colors">Paste from Blueprint</button>
                <button id="import-cancel" class="w-full mt-2 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors">Cancel</button>
            </div>
        </div>
    `;
    dom.modalContainer.appendChild(modal);

    const closeModal = () => dom.modalContainer.innerHTML = '';

    modal.querySelector('#import-replace').addEventListener('click', () => {
        loadState(blueprint);
        closeModal();
    });
    modal.querySelector('#import-paste').addEventListener('click', () => {
        startBlueprintPaste(blueprint);
        closeModal();
    });
    modal.querySelector('#import-cancel').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

// --- Settings Modal ---
export function showSettingsModal() {
    dom.modalContainer.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 class="text-xl font-bold mb-6 text-white">Settings</h2>
            <div class="space-y-4">
                 <label for="autosave-toggle" class="flex items-center justify-between p-3 rounded-md bg-gray-900/50 cursor-pointer">
                    <span class="font-medium text-white">Enable Autosave</span>
                    <input type="checkbox" id="autosave-toggle" class="h-5 w-5 rounded text-indigo-500 focus:ring-indigo-600" ${state.autosaveEnabled ? 'checked' : ''}>
                </label>
            </div>
             <button id="close-modal" class="mt-8 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded">Done</button>
        </div>
    `;
    dom.modalContainer.appendChild(modal);

    const closeModal = () => dom.modalContainer.innerHTML = '';
    modal.querySelector('#close-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modal.querySelector('#autosave-toggle').addEventListener('change', (e) => {
        state.autosaveEnabled = e.target.checked;
        try {
            localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify({
                autosaveEnabled: state.autosaveEnabled
            }));
        } catch (err) {
            console.error("Could not save user settings.", err);
        }
    });
}


// --- Auto-Build Options Modal ---
export function showAutoBuildOptionsModal(cardData) {
    dom.modalContainer.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 class="text-xl font-bold mb-4">Auto-Build Options</h2>
            <p class="text-sm text-gray-400 mb-6">Auto-build will only use alternate recipes that are enabled in the Recipe Book.</p>
            
            <div class="space-y-4">
                <div class="p-3 rounded-md bg-gray-900/50">
                    <h3 class="font-medium text-white mb-3">Build Strategy</h3>
                    <div class="space-y-2 text-sm">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="radio" name="build-strategy" value="simple" class="h-4 w-4 text-indigo-500 focus:ring-indigo-600" ${state.autoBuildOptions.buildStrategy === 'simple' ? 'checked' : ''}>
                            <div>
                                <p class="text-gray-200">Simple (Fastest)</p>
                                <p class="text-gray-400 text-xs">Prioritizes recipes with the fewest ingredients.</p>
                            </div>
                        </label>
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="radio" name="build-strategy" value="resourceSaver" class="h-4 w-4 text-indigo-500 focus:ring-indigo-600" ${state.autoBuildOptions.buildStrategy === 'resourceSaver' ? 'checked' : ''}>
                            <div>
                                <p class="text-gray-200">Resource Saver (Most Efficient)</p>
                                <p class="text-gray-400 text-xs">Prioritizes alternate recipes to minimize raw resource use.</p>
                            </div>
                        </label>
                    </div>
                </div>

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
        const selectedStrategy = modal.querySelector('input[name="build-strategy"]:checked').value;
        state.autoBuildOptions.buildStrategy = selectedStrategy; // Persist choice for next time
        
        const options = {
            useSAM: samToggle.checked,
            useAlternates: altsToggle.checked,
            buildStrategy: selectedStrategy
        };
        autoBuildInputsForCard(cardData, options);
        closeModal();
    });

    modal.querySelector('#cancel-autobuild').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

// --- NEW: Auto-Balance Options Modal ---
export function showAutoBalanceOptionsModal(cardData) {
    dom.modalContainer.innerHTML = '';
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
        <div class="bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 class="text-xl font-bold mb-4">Auto-Balance Options</h2>
            <p class="text-sm text-gray-400 mb-6">The chain will be balanced around any locked cards. The settings below apply to all <span class="font-bold text-white">unlocked</span> cards.</p>
            
            <div class="space-y-4">
                <div class="p-3 rounded-md bg-gray-900/50">
                    <h3 class="font-medium text-white mb-3">Balancing Strategy</h3>
                    <div class="space-y-2 text-sm">
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="radio" name="balance-strategy" value="buildingsFirst" class="h-4 w-4 text-indigo-500 focus:ring-indigo-600" ${state.autoBalanceOptions.strategy === 'buildingsFirst' ? 'checked' : ''}>
                            <div>
                                <p class="text-gray-200">Prioritize Buildings</p>
                                <p class="text-gray-400 text-xs">Adds new buildings before overclocking beyond 100%.</p>
                            </div>
                        </label>
                        <label class="flex items-center gap-3 cursor-pointer">
                            <input type="radio" name="balance-strategy" value="shardsFirst" class="h-4 w-4 text-indigo-500 focus:ring-indigo-600" ${state.autoBalanceOptions.strategy === 'shardsFirst' ? 'checked' : ''}>
                            <div>
                                <p class="text-gray-200">Prioritize Power Shards</p>
                                <p class="text-gray-400 text-xs">Overclocks up to 250% before adding new buildings.</p>
                            </div>
                        </label>
                    </div>
                </div>

                <label for="clear-loops-toggle" class="flex items-center justify-between p-3 rounded-md bg-gray-900/50 cursor-pointer">
                    <span class="font-medium text-white">Reset Somersloops</span>
                     <input type="checkbox" id="clear-loops-toggle" class="h-5 w-5 rounded text-indigo-500 focus:ring-indigo-600" ${state.autoBalanceOptions.clearLoops ? 'checked' : ''}>
                </label>
            </div>

            <div class="mt-6 flex gap-4">
                <button id="cancel-autobalance" class="w-full bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">Cancel</button>
                <button id="confirm-autobalance" class="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded">Balance</button>
            </div>
        </div>
    `;
    dom.modalContainer.appendChild(modal);

    const closeModal = () => dom.modalContainer.innerHTML = '';
    
    modal.querySelector('#confirm-autobalance').addEventListener('click', () => {
        const selectedStrategy = modal.querySelector('input[name="balance-strategy"]:checked').value;
        const clearLoops = modal.querySelector('#clear-loops-toggle').checked;

        // Persist choices for next time
        state.autoBalanceOptions.strategy = selectedStrategy;
        state.autoBalanceOptions.clearLoops = clearLoops;
        
        const options = {
            strategy: selectedStrategy,
            clearLoops: clearLoops
        };
        autoBalanceChain(cardData, options); 
        closeModal();
    });

    modal.querySelector('#cancel-autobalance').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}


