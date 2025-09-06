/**
 * This file (js/core/calculations.js) contains the core logic for calculating production rates,
 * power consumption, and network-wide deficits.
 */
import state from '/js/state.js';
import { SOMERSLOOP_SLOTS, GENERATOR_BUILDINGS } from '/js/constants.js';
import { renderGlobalTotals, renderSelectionSummary, renderConnections } from '/js/ui/render.js';

/**
 * Recalculates everything in the factory - cards, totals, and network status.
 * This is the main function to call after any change.
 */
export function updateAllCalculations() {
    state.placedCards.forEach(card => {
        // Alien Power Augmenter has special logic handled in renderGlobalTotals
        if (card.building !== 'Alien Power Augmenter') {
            updateCardCalculations(card);
        }
    });
    calculateAndRenderNetworkStatus(); // This function now calls renderGlobalTotals and renderSelectionSummary
}

/**
 * Updates the input/output rates and power for a single card based on its current settings.
 * @param {object} cardData - The state object for the card to update.
 */
export function updateCardCalculations(cardData) {
    const { recipe, buildings, powerShard, somersloops, element, building } = cardData;
    const clockSpeedMultiplier = powerShard / 100;
    
    // Calculate Inputs
    cardData.inputs = {};
    Object.entries(recipe.inputs).forEach(([name, rate]) => {
        const total = rate * clockSpeedMultiplier * buildings;
        cardData.inputs[name] = total;
        element.querySelector(`[data-input-name="${name}"] .io-rate`).textContent = total.toFixed(2);
    });

    // Calculate Somersloop bonus
    const totalSlots = SOMERSLOOP_SLOTS[building] || 0;
    const outputMultiplier = totalSlots > 0 ? (1 + (somersloops / totalSlots)) : 1;

    // Calculate Outputs
    cardData.outputs = {};
    Object.entries(recipe.outputs).forEach(([name, rate]) => {
        const total = rate * clockSpeedMultiplier * outputMultiplier * buildings;
        cardData.outputs[name] = total;
        element.querySelector(`[data-output-name="${name}"] .io-rate`).textContent = total.toFixed(2);
    });

    // Calculate Power
    const basePower = state.buildingsMap.get(building)?.power || 0;
    const isGenerator = GENERATOR_BUILDINGS.has(building);

    if (isGenerator) {
        // Generators have positive base power and scale linearly with clock speed
        cardData.power = basePower * clockSpeedMultiplier * buildings;
    } else if (basePower < 0) {
        // Production buildings have negative base power and scale exponentially
        const powerExponent = 1.321928;
        const overclockPowerMultiplier = Math.pow(clockSpeedMultiplier, powerExponent);
        const amplificationPowerMultiplier = Math.pow(outputMultiplier, 2); // Somersloops also affect power
        cardData.power = basePower * overclockPowerMultiplier * amplificationPowerMultiplier * buildings;
    } else {
        cardData.power = 0;
    }
    
    // Update the card's display
    element.querySelector('[data-value="power"]').textContent = Math.abs(cardData.power).toFixed(2);
    element.querySelector('[data-stat="buildings"]').textContent = buildings;
    element.querySelector('[data-stat="clock"]').textContent = powerShard.toFixed(2);
    
    const ssStat = element.querySelector('[data-stat="somersloops"]');
    if(ssStat) ssStat.textContent = `${somersloops}/${totalSlots}`;

    const psStat = element.querySelector('[data-stat="shards"]');
    if(psStat) psStat.textContent = cardData.powerShards;
    
    element.classList.toggle('somersloop-active', somersloops > 0);
}


/**
 * Simulates the factory network to find and display resource deficits.
 * It iteratively checks if inputs are met and shuts down production if they are not.
 */
export function calculateAndRenderNetworkStatus() {
    let changed = true;
    const effectiveOutputs = new Map();
    state.placedCards.forEach(card => effectiveOutputs.set(card.id, {...card.outputs}));

    // Iteratively "shut down" machines with unmet needs
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

    // Reset deficit visual states
    state.connections.forEach(conn => conn.isDeficit = false);
    state.placedCards.forEach(card => card.inputDeficits = new Set());

    // Calculate demands on each output node
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

    // Mark connections as deficit if supply < demand
    state.connections.forEach(conn => {
        const outputKey = `${conn.from.cardId}:${conn.from.itemName}`;
        const sourceCard = state.placedCards.get(conn.from.cardId);
        const sourceEffectiveOutputs = effectiveOutputs.get(conn.from.cardId);
        if (sourceCard && sourceEffectiveOutputs) {
            const supply = sourceEffectiveOutputs[conn.from.itemName] || 0;
            const demand = outputDemands.get(outputKey) || 0;
            if (supply < demand - 0.01) conn.isDeficit = true;
        }
    });
    
    // Mark card inputs as deficit if they are starved
    state.placedCards.forEach(card => {
        if (card.building === 'Alien Power Augmenter') return;
        Object.keys(card.inputs).forEach(inputName => {
            let isInputDeficit = false;
            state.connections.forEach(conn => {
                if (conn.to.cardId === card.id && conn.to.itemName === inputName) {
                    const sourceOutputs = effectiveOutputs.get(conn.from.cardId);
                    // If the source has no output (is itself starved), this input is in deficit.
                    if (!sourceOutputs || sourceOutputs[conn.from.itemName] === 0) {
                        isInputDeficit = true;
                    }
                }
            });
            // Also mark as deficit if the machine is shut down entirely.
            if (isInputDeficit || (effectiveOutputs.get(card.id) && Object.values(effectiveOutputs.get(card.id)).every(v => v === 0))) {
                card.inputDeficits.add(inputName);
            }
        });
    });

    // Re-render the UI to show the new deficit states and totals
    state.placedCards.forEach(card => {
        card.element.querySelectorAll('.io-item[data-input-name]').forEach(el => {
            el.classList.toggle('deficit', card.inputDeficits.has(el.dataset.inputName));
        });
    });
    
    renderConnections();
    renderGlobalTotals();
    renderSelectionSummary();
}

