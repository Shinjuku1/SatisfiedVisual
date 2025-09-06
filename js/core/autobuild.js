/**
 * This file (js/core/autoBuild.js) contains the logic for the "Auto-Build Inputs" feature,
 * which automatically generates a production chain for a given card's inputs.
 */
import state from '/js/state.js';
import { recipeData } from '/js/data/recipes.js';
import { createCard } from '/js/core/card.js';
import { arrangeConnectedLayout } from '/js/core/layout.js';
import { showToast } from '/js/utils.js';

/**
 * Finds the most suitable recipe to produce a given item based on user options.
 * @param {string} item - The name of the item to produce.
 * @param {object} buildOptions - The user's options ({ useSAM, useAlternates }).
 * @returns {object|null} An object containing the building and recipe, or null if none is found.
 */
function findRecipe(item, buildOptions) {
    const availableRecipes = [];
    for (const building in recipeData.recipes) {
        for (const recipe of recipeData.recipes[building]) {
            if (Object.keys(recipe.outputs).includes(item)) {
                // Filter based on options
                if (!buildOptions.useSAM && Object.keys(recipe.inputs).includes('Reanimated SAM')) {
                    continue; // Skip SAM recipes if disabled
                }
                if (!buildOptions.useAlternates && recipe.isAlternate) {
                    continue; // Skip alternate recipes if disabled
                }
                availableRecipes.push({ building, recipe });
            }
        }
    }
    // Simple strategy: prefer non-alternate, then pick the first one.
    // A more complex strategy could score recipes based on resource efficiency.
    return availableRecipes.find(r => !r.recipe.isAlternate) || availableRecipes[0] || null;
}

/**
 * Main function to generate and connect cards to satisfy the inputs of a target card.
 * @param {object} targetCard - The card for which to build inputs.
 * @param {object} options - The user's options ({ useSAM, useAlternates }).
 */
export function autoBuildInputsForCard(targetCard, options) {
    const requiredRates = new Map();
    const connectedInputs = new Set();

    // 1. Determine which inputs are unconnected and need to be built.
    state.connections.forEach(conn => {
        if (conn.to.cardId === targetCard.id) {
            connectedInputs.add(conn.to.itemName);
        }
    });

    Object.entries(targetCard.inputs).forEach(([inputName, requiredRate]) => {
        if (!connectedInputs.has(inputName)) {
            requiredRates.set(inputName, requiredRate);
        }
    });

    if (requiredRates.size === 0) {
        showToast("All inputs are already connected.");
        return;
    }

    // 2. Set up the build queue and tracking maps.
    const buildQueue = [...requiredRates.keys()];
    const processed = new Set();
    const createdCards = new Map(); // Maps item name to the ID of the card that produces it.
    const itemToConsumers = new Map(); // Maps item name to a list of cards that consume it.

    // Initialize consumers with the target card's needs.
    requiredRates.forEach((_, itemName) => {
        itemToConsumers.set(itemName, [{ cardId: targetCard.id, itemName: itemName }]);
    });

    let buildDepth = 0;
    const MAX_DEPTH = 10; // Failsafe to prevent infinite loops from recipe cycles.

    // 3. Process the build queue recursively.
    while (buildQueue.length > 0 && buildDepth < MAX_DEPTH) {
        const currentItem = buildQueue.shift();
        if (processed.has(currentItem)) continue;
        processed.add(currentItem);

        const recipeInfo = findRecipe(currentItem, options);
        if (!recipeInfo) continue; // It's a raw resource, can't be built.

        const { building, recipe } = recipeInfo;
        // Add a small buffer to required rate to overcome floating point inaccuracies
        const required = requiredRates.get(currentItem) * 1.001;
        const baseRate = recipe.outputs[currentItem];
        
        // Calculate the number of buildings and clock speed needed.
        const buildings = Math.ceil(required / (baseRate * 2.5)); // Assume max overclock to use fewer buildings
        const clock = (required / (baseRate * buildings)) * 100;
        
        let powerShards = 0;
        if (clock > 200) powerShards = 3;
        else if (clock > 150) powerShards = 2;
        else if (clock > 100) powerShards = 1;

        // Create the new card.
        const newCardId = `card-${state.nextCardId++}`;
        const yOffset = (itemToConsumers.get(currentItem)?.length - 1 || 0) * 100;
        createCard(building, recipe, targetCard.x - (buildDepth + 1) * 450, targetCard.y + yOffset, newCardId, { buildings: buildings, powerShard: clock, powerShards: powerShards });
        createdCards.set(currentItem, newCardId);

        // Add the new card's inputs to the required rates and the build queue.
        Object.entries(recipe.inputs).forEach(([inputName, inputRate]) => {
            const neededForThis = inputRate * (clock / 100) * buildings;
            requiredRates.set(inputName, (requiredRates.get(inputName) || 0) + neededForThis);
            
            if (!itemToConsumers.has(inputName)) itemToConsumers.set(inputName, []);
            itemToConsumers.get(inputName).push({ cardId: newCardId, itemName: inputName });
            
            if (!processed.has(inputName)) {
                buildQueue.push(inputName);
            }
        });
        
        buildDepth++;
    }

    // 4. Connect all the newly created cards.
    itemToConsumers.forEach((consumers, outputItem) => {
        const producerId = createdCards.get(outputItem);
        if (producerId) {
            consumers.forEach(consumer => {
                const connId = `conn-${state.nextConnectionId++}`;
                state.connections.set(connId, {
                    from: { cardId: producerId, itemName: outputItem },
                    to: { cardId: consumer.cardId, itemName: consumer.itemName }
                });
            });
        }
    });
    
    // 5. Clean up the layout.
    arrangeConnectedLayout(targetCard);
}

