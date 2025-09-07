/**
 * This file (js/core/calculations.js) contains the core logic for all numerical
 * calculations in the planner, including I/O rates, power, and network status.
 * The power calculation formula has been corrected to use the proper exponents.
 */
import state from '/SatisfiedVisual/js/state.js';
import { SOMERSLOOP_SLOTS } from '/SatisfiedVisual/js/constants.js';
import { renderGlobalTotals, renderSelectionSummary, renderConnections } from '/SatisfiedVisual/js/ui/render.js';

/**
 * Updates all cards, totals, and network statuses. The main calculation loop.
 */
export function updateAllCalculations() {
    state.placedCards.forEach(card => {
        if (card.building !== 'Alien Power Augmenter') {
            updateCardCalculations(card);
        }
    });
    calculateAndRenderNetworkStatus();
    renderGlobalTotals();
    renderSelectionSummary();
}

/**
 * Calculates and updates the UI for a single card's inputs, outputs, and power.
 * @param {object} cardData - The data object for the card to update.
 */
export function updateCardCalculations(cardData) {
    const { recipe, buildings, powerShard, somersloops, element, building } = cardData;
    const clockSpeedMultiplier = powerShard / 100;

    // Update Inputs
    cardData.inputs = {};
    Object.entries(recipe.inputs).forEach(([name, rate]) => {
        const total = rate * clockSpeedMultiplier * buildings;
        cardData.inputs[name] = total;
        const inputEl = element.querySelector(`[data-input-name="${name}"] .io-rate`);
        if (inputEl) inputEl.textContent = total.toFixed(2);
    });

    // Update Outputs
    const totalSlots = SOMERSLOOP_SLOTS[building] || 0;
    const outputMultiplier = totalSlots > 0 ? (1 + (somersloops / totalSlots)) : 1;
    cardData.outputs = {};
    Object.entries(recipe.outputs).forEach(([name, rate]) => {
        const total = rate * clockSpeedMultiplier * outputMultiplier * buildings;
        cardData.outputs[name] = total;
        const outputEl = element.querySelector(`[data-output-name="${name}"] .io-rate`);
        if (outputEl) outputEl.textContent = total.toFixed(2);
    });

    // --- DEFINITIVE POWER CALCULATION LOGIC ---
    const basePower = state.buildingsMap.get(building)?.power || 0;
    const isGenerator = basePower > 0;

    if (isGenerator) {
        // Generators produce power. The value is positive.
        // The in-game overclock exponent for generators is ~1.321928
        const powerExponent = 1.321928;
        const overclockPowerMultiplier = Math.pow(clockSpeedMultiplier, powerExponent);
        cardData.power = Math.abs(basePower) * overclockPowerMultiplier * buildings;
    } else if (basePower < 0) {
        // Consumers use power. The value is negative.
        // The in-game overclock exponent for consumers is 1.6
        const powerExponent = 1.6;
        const overclockPowerMultiplier = Math.pow(clockSpeedMultiplier, powerExponent);
        const amplificationPowerMultiplier = Math.pow(outputMultiplier, 2);
        const totalConsumed = Math.abs(basePower) * overclockPowerMultiplier * amplificationPowerMultiplier * buildings;
        cardData.power = -totalConsumed; // Ensure the final value is negative
    } else {
        cardData.power = 0;
    }

    // Update UI Stats
    const powerEl = element.querySelector('[data-value="power"]');
    if (powerEl) powerEl.textContent = cardData.power.toFixed(2);
    
    const buildingsEl = element.querySelector('[data-stat="buildings"]');
    if(buildingsEl) buildingsEl.textContent = buildings;
    
    const clockEl = element.querySelector('[data-stat="clock"]');
    if(clockEl) clockEl.textContent = powerShard.toFixed(2);
    
    const ssStat = element.querySelector('[data-stat="somersloops"]');
    if(ssStat) ssStat.textContent = `${somersloops}/${totalSlots}`;

    const psStat = element.querySelector('[data-stat="shards"]');
    if(psStat) psStat.innerHTML = `
        <svg class="w-3 h-3 inline -mt-1" viewBox="0 0 24 24" fill="currentColor" style="color: var(--accent-yellow);"><path d="M12 1.5l-9 15h18l-9-15zm0 4.85l5.54 9.15h-11.08l5.54-9.15z"></path></svg>
        ${cardData.powerShards}`;
    
    element.classList.toggle('somersloop-active', somersloops > 0);
}


/**
 * Simulates the factory network to identify and flag resource deficits.
 */
export function calculateAndRenderNetworkStatus() {
    // ... (This function's logic is correct and remains unchanged)
    let changed = true;
    const effectiveOutputs = new Map();
    state.placedCards.forEach(card => effectiveOutputs.set(card.id, {...card.outputs}));

    for (let i = 0; i < state.placedCards.size && changed; i++) {
        changed = false;
        state.placedCards.forEach(card => {
            if (card.building === 'Alien Power Augmenter') return;

            let hasDeficit = false;
            Object.entries(card.inputs).forEach(([inputName, required]) => {
                let supplied = 0;
                state.connections.forEach(conn => {
                    if (conn.to.cardId === card.id && conn.to.itemName === inputName) {
                        const sourceOutputs = effectiveOutputs.get(conn.from.cardId);
                        if(sourceOutputs) supplied += sourceOutputs[conn.from.itemName] || 0;
                    }
                });
                if (supplied < required - 0.01) hasDeficit = true;
            });

            if (hasDeficit) {
                const currentCardOutputs = effectiveOutputs.get(card.id);
                for (const outName in currentCardOutputs) {
                    if (currentCardOutputs[outName] !== 0) {
                        currentCardOutputs[outName] = 0;
                        changed = true;
                    }
                }
            }
        });
    }

    state.connections.forEach(conn => conn.isDeficit = false);
    state.placedCards.forEach(card => card.inputDeficits = new Set());
    
    const outputDemands = new Map();
    state.connections.forEach(conn => {
        const outputKey = `${conn.from.cardId}:${conn.from.itemName}`;
        const inputCard = state.placedCards.get(conn.to.cardId);
        if (inputCard) {
            const required = inputCard.inputs[conn.to.itemName] || 0;
            const currentDemand = outputDemands.get(outputKey) || 0;
            outputDemands.set(outputKey, currentDemand + required);
        }
    });

    state.connections.forEach(conn => {
        const outputKey = `${conn.from.cardId}:${conn.from.itemName}`;
        const sourceEffectiveOutputs = effectiveOutputs.get(conn.from.cardId);
        if (sourceEffectiveOutputs) {
            const supply = sourceEffectiveOutputs[conn.from.itemName] || 0;
            const demand = outputDemands.get(outputKey) || 0;
            if (supply < demand - 0.01) conn.isDeficit = true;
        }
    });

    state.placedCards.forEach(card => {
        if (card.building === 'Alien Power Augmenter') return;
        Object.keys(card.inputs).forEach(inputName => {
            const effectiveCardOutputs = effectiveOutputs.get(card.id);
            if (effectiveCardOutputs && Object.values(effectiveCardOutputs).every(v => v === 0)) {
                card.inputDeficits.add(inputName);
            }
        });
    });

    state.placedCards.forEach(card => {
        card.element.querySelectorAll('.io-item[data-input-name]').forEach(el => {
            el.classList.toggle('deficit', card.inputDeficits.has(el.dataset.inputName));
        });
    });

    renderConnections();

}
