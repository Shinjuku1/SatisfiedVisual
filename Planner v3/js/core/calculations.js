/**
 * This file Handles the core logic for all factory calculations.
 * This includes calculating I/O rates for individual cards, power consumption,
 * and propagating deficits throughout the production chain.
 */

import state, { SOMERSLOOP_SLOTS, GENERATOR_BUILDINGS } from '../state.js';
import { renderGlobalTotals, renderSelectionSummary, renderConnections } from '../ui/render.js';

/**
 * Recalculates all cards and updates all global UI elements.
 * This is the main function to call after any change to the factory layout.
 */
export function updateAllCalculations() {
    state.placedCards.forEach(card => {
        // Alien Power Augmenter is a special case with no recipe calculations
        if (card.building !== 'Alien Power Augmenter') {
            updateCardCalculations(card);
        }
    });
    renderGlobalTotals();
    renderSelectionSummary();
    calculateAndRenderNetworkStatus();
}

/**
 * Calculates the production rates and power usage for a single card based on its configuration.
 * Also updates the card's DOM elements with the new values.
 * @param {object} cardData - The data object for the card to update.
 */
export function updateCardCalculations(cardData) {
    const { recipe, buildings, powerShard, powerShards, somersloops, element, building } = cardData;
    const clockSpeedMultiplier = powerShard / 100;
    
    // Calculate and render inputs
    cardData.inputs = {};
    Object.entries(recipe.inputs).forEach(([name, rate]) => {
        const total = rate * clockSpeedMultiplier * buildings;
        cardData.inputs[name] = total;
        element.querySelector(`[data-input-name="${name}"] .io-rate`).textContent = total.toFixed(2);
    });

    // Calculate and render outputs, considering Somersloop multiplier
    const totalSlots = SOMERSLOOP_SLOTS[building] || 0;
    const outputMultiplier = totalSlots > 0 ? (1 + (somersloops / totalSlots)) : 1;

    cardData.outputs = {};
    Object.entries(recipe.outputs).forEach(([name, rate]) => {
        const total = rate * clockSpeedMultiplier * outputMultiplier * buildings;
        cardData.outputs[name] = total;
        element.querySelector(`[data-output-name="${name}"] .io-rate`).textContent = total.toFixed(2);
    });

    // Calculate and render power usage
    const basePower = state.buildingsMap.get(building)?.power || 0;
    const isGenerator = GENERATOR_BUILDINGS.has(building);

    if (isGenerator) {
        // Generators have linear power scaling
        cardData.power = basePower * clockSpeedMultiplier * buildings;
    } else if (basePower !== 0) {
        // Production buildings have non-linear power scaling. The basePower is negative.
        const powerExponent = 1.321928;
        const overclockPowerMultiplier = Math.pow(clockSpeedMultiplier, powerExponent);
        const amplificationPowerMultiplier = Math.pow(outputMultiplier, 2);
        cardData.power = basePower * overclockPowerMultiplier * amplificationPowerMultiplier * buildings;
    } else {
        cardData.power = 0;
    }
    
    // Update card stats display
    element.querySelector('[data-value="power"]').textContent = cardData.power.toFixed(2);
    element.querySelector('[data-stat="buildings"]').textContent = buildings;
    element.querySelector('[data-stat="clock"]').textContent = powerShard.toFixed(2);
    
    const ssStat = element.querySelector('[data-stat="somersloops"]');
    if(ssStat) ssStat.textContent = `${somersloops}/${totalSlots}`;

    const psStat = element.querySelector('[data-stat="shards"]');
    if(psStat) {
        psStat.innerHTML = `
            <svg class="w-3 h-3 inline -mt-1" viewBox="0 0 24 24" fill="currentColor" style="color: var(--accent-yellow);"><path d="M12 1.5l-9 15h18l-9-15zm0 4.85l5.54 9.15h-11.08l5.54-9.15z"></path></svg>
            ${powerShards}`;
    }
    
    element.classList.toggle('somersloop-active', somersloops > 0);
}

/**
 * Simulates the factory network to find production deficits.
 * Iteratively calculates effective outputs and updates the visual state of cards and connections.
 */
function calculateAndRenderNetworkStatus() {
    let changed = true;
    const effectiveOutputs = new Map();
    state.placedCards.forEach(card => effectiveOutputs.set(card.id, {...card.outputs}));

    // Iteratively check for deficits. If a card has a deficit, its output becomes zero.
    // Repeat until no more changes occur in a full pass.
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

    // Reset deficit states before recalculating
    state.connections.forEach(conn => conn.isDeficit = false);
    state.placedCards.forEach(card => card.inputDeficits = new Set());
    
    // Calculate total demand for each output node
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

    // Mark individual card inputs as being in a deficit state
    state.placedCards.forEach(card => {
        if (card.building === 'Alien Power Augmenter') return;
        Object.keys(card.inputs).forEach(inputName => {
            let isInputDeficit = false;
            state.connections.forEach(conn => {
                 if (conn.to.cardId === card.id && conn.to.itemName === inputName) {
                     const sourceOutputs = effectiveOutputs.get(conn.from.cardId);
                     if (!sourceOutputs || sourceOutputs[conn.from.itemName] === 0) {
                         isInputDeficit = true;
                     }
                 }
            });
            // Also mark as deficit if the entire card is non-operational
            const cardOutputs = effectiveOutputs.get(card.id);
            const isCardDead = cardOutputs && Object.values(cardOutputs).every(v => v === 0);
            if (isInputDeficit || (Object.keys(card.inputs).length > 0 && isCardDead)) {
                card.inputDeficits.add(inputName);
            }
        });
    });

    // Finally, render the visual changes
    state.placedCards.forEach(card => {
        card.element.querySelectorAll('.io-item[data-input-name]').forEach(el => {
            el.classList.toggle('deficit', card.inputDeficits.has(el.dataset.inputName));
        });
    });
    renderConnections();
}
