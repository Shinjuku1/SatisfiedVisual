/**
 * This file (js/core/balancer.js) contains the logic for the "Auto Balance Chain" feature.
 * It uses a single, robust backward pass (from consumers to producers) to perfectly balance
 * a production line by adjusting building counts and clock speeds to meet aggregated demand.
 */
import state from '/SatisfiedVisual/js/state.js';
import { updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';
import { SOMERSLOOP_SLOTS } from '/SatisfiedVisual/js/constants.js';
import { round } from '/SatisfiedVisual/js/utils.js';

/**
 * Balances a connected production chain by adjusting building counts and clock speeds.
 * @param {object} startCard - The card within the chain to start the process from.
 */
export function autoBalanceChain(startCard) {
    // 1. Find all cards in the same connected production line (the "chain").
    const chainCardIds = new Set();
    const queue = [startCard.id];
    const visited = new Set([startCard.id]);

    while (queue.length > 0) {
        const currentId = queue.shift();
        chainCardIds.add(currentId);
        state.connections.forEach(conn => {
            let neighborId = null;
            if (conn.from.cardId === currentId) neighborId = conn.to.cardId;
            if (conn.to.cardId === currentId) neighborId = conn.from.cardId;
            if (neighborId && state.placedCards.has(neighborId) && !visited.has(neighborId)) {
                visited.add(neighborId);
                queue.push(neighborId);
            }
        });
    }

    // 2. Topologically sort the cards to establish a clear processing order from producers to consumers.
    const sortedCardIds = [];
    const inDegree = new Map();
    const adj = new Map();
    chainCardIds.forEach(id => { inDegree.set(id, 0); adj.set(id, []); });
    state.connections.forEach(conn => {
        if (chainCardIds.has(conn.from.cardId) && chainCardIds.has(conn.to.cardId)) {
            adj.get(conn.from.cardId).push(conn.to.cardId);
            inDegree.set(conn.to.cardId, (inDegree.get(conn.to.cardId) || 0) + 1);
        }
    });
    const sortQueue = [];
    chainCardIds.forEach(id => { if (inDegree.get(id) === 0) sortQueue.push(id); });
    while (sortQueue.length > 0) {
        const u = sortQueue.shift();
        sortedCardIds.push(u);
        adj.get(u)?.forEach(v => {
            inDegree.set(v, inDegree.get(v) - 1);
            if (inDegree.get(v) === 0) sortQueue.push(v);
        });
    }

    // 3. Create a temporary, mutable copy of the card data for our calculations.
    const tempCardData = new Map();
    chainCardIds.forEach(id => {
        const originalCard = state.placedCards.get(id);
        // Deep copy the I/O objects to prevent modifying the original state during calculation.
        tempCardData.set(id, { ...originalCard, inputs: {...originalCard.inputs}, outputs: {...originalCard.outputs} });
    });

    // 4. Perform a single backward pass from consumers to producers to calculate and set the correct sizes.
    const reversedSortedIds = [...sortedCardIds].reverse();
    for (const cardId of reversedSortedIds) {
        const card = tempCardData.get(cardId);
        if (!card) continue;

        let maxRequiredTheoreticalClock = 0;

        // For each output of the current card, find the total demand from all its consumers.
        for (const outputName in card.recipe.outputs) {
            let totalDemand = 0;
            let isFinalProduct = true;

            state.connections.forEach(conn => {
                if (conn.from.cardId === cardId && conn.from.itemName === outputName && chainCardIds.has(conn.to.cardId)) {
                    isFinalProduct = false;
                    // The demand is the consumer's *already calculated* input requirement from our temp data.
                    totalDemand += tempCardData.get(conn.to.cardId).inputs[outputName] || 0;
                }
            });

            // If an output has no consumers *within the chain*, its demand is its own current output rate.
            if (isFinalProduct) {
                totalDemand = card.outputs[outputName];
            }

            if (totalDemand > 0) {
                const baseRate = card.recipe.outputs[outputName];
                if (baseRate > 0) {
                    // This is the clock speed required for this single product if we only had one building.
                    const theoreticalClock = (totalDemand / baseRate) * 100;
                    maxRequiredTheoreticalClock = Math.max(maxRequiredTheoreticalClock, theoreticalClock);
                }
            }
        }

        if (maxRequiredTheoreticalClock > 0) {
            const isExtractor = card.building.includes('Extractor') || card.building.startsWith('Miner');
            
            // ** SIZING LOGIC: Prioritize buildings over clock speed. **
            let newBuildings = card.buildings;
            let newClock = maxRequiredTheoreticalClock / newBuildings;

            if (newClock > 250 && !isExtractor) {
                newBuildings = Math.ceil(maxRequiredTheoreticalClock / 250);
                newClock = maxRequiredTheoreticalClock / newBuildings;
            } else if (isExtractor) {
                // Extractors are balanced by adding more buildings, not overclocking.
                newBuildings = Math.ceil(maxRequiredTheoreticalClock / 100);
                newClock = 100;
            }
            
            newClock = Math.min(250, Math.max(0.1, newClock));

            // Update the card's data in our temporary map.
            card.buildings = newBuildings;
            card.powerShard = newClock;
            if (newClock > 200) card.powerShards = 3;
            else if (newClock > 150) card.powerShards = 2;
            else if (newClock > 100) card.powerShards = 1;
            else card.powerShards = 0;

            // CRITICAL: Immediately update this card's I/O in the temp map.
            // This provides the correct demand signal for the next (upstream) cards in the loop.
            const clockMultiplier = card.powerShard / 100;
            const totalSlots = SOMERSLOOP_SLOTS[card.building] || 0;
            const outputMultiplier = totalSlots > 0 ? (1 + (card.somersloops / totalSlots)) : 1;
            for (const inputName in card.recipe.inputs) {
                const total = card.recipe.inputs[inputName] * clockMultiplier * card.buildings;
                card.inputs[inputName] = round(total, 3);
            }
            for (const outputName in card.recipe.outputs) {
                const total = card.recipe.outputs[outputName] * clockMultiplier * outputMultiplier * card.buildings;
                card.outputs[outputName] = round(total, 3);
            }
        }
    }

    // 5. Apply the final, calculated values to the actual application state.
    tempCardData.forEach((tempCard, cardId) => {
        const actualCard = state.placedCards.get(cardId);
        actualCard.buildings = tempCard.buildings;
        actualCard.powerShard = tempCard.powerShard;
        actualCard.powerShards = tempCard.powerShards;
    });

    // 6. Trigger a full recalculation to update all visuals.
    updateAllCalculations();

}
