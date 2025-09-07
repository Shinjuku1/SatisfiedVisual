/**
 * This file (js/core/autoBuild.js) contains the logic for the "Auto-Build Inputs" feature.
 * This is an iterative, multi-pass algorithm that repeatedly scans the entire factory for deficits,
 * plans a solution, and builds machines until the factory is satisfied.
 */ 
import state from '/SatisfiedVisual/js/state.js';
import { recipeData } from '/SatisfiedVisual/js/data/recipes.js';
import { createCard } from '/SatisfiedVisual/js/core/card.js';
import { groupedArrangeLayout } from '/SatisfiedVisual/js/core/layout.js'; // <-- FIX: Import the correct function
import { updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';
import { autoBalanceChain } from '/SatisfiedVisual/js/core/balancer.js';

// --- Helper Functions ---

const RAW_RESOURCE_MAP = {
    'Water': { building: 'Water Extractor', recipeName: 'Water' },
    'Crude Oil': { building: 'Oil Extractor', recipeName: 'Crude Oil' },
    'Nitrogen Gas': { building: 'Resource Well Extractor', recipeName: 'Nitrogen Gas' },
    'Iron Ore': { building: 'Miner Mk.1', recipeName: 'Iron Ore' },
    'Copper Ore': { building: 'Miner Mk.1', recipeName: 'Copper Ore' },
    'Limestone': { building: 'Miner Mk.1', recipeName: 'Limestone' },
    'Coal': { building: 'Miner Mk.1', recipeName: 'Coal' },
    'Caterium Ore': { building: 'Miner Mk.1', recipeName: 'Caterium Ore' },
    'Sulfur': { building: 'Miner Mk.1', recipeName: 'Sulfur' },
    'Raw Quartz': { building: 'Miner Mk.1', recipeName: 'Raw Quartz' },
    'Bauxite': { building: 'Miner Mk.1', recipeName: 'Bauxite' },
    'Uranium': { building: 'Miner Mk.1', recipeName: 'Uranium' },
    'SAM': { building: 'Miner Mk.1', recipeName: 'SAM' }
};

function findProductionRecipe(item, buildOptions) {
    let availableRecipes = [];
    for (const building in recipeData.recipes) {
        if (building.includes('Extractor') || building.startsWith('Miner')) continue;
        for (const recipe of recipeData.recipes[building]) {
            if (Object.keys(recipe.outputs).includes(item)) {
                const recipeKey = `${building}|${recipe.name}`;
                if (recipe.isAlternate && buildOptions.useAlternates && !state.unlockedRecipes.has(recipeKey)) continue;
                if (!buildOptions.useSAM && Object.keys(recipe.inputs).includes('Reanimated SAM')) continue;
                availableRecipes.push({ building, recipe });
            }
        }
    }

    if (availableRecipes.length === 0) return null;

    if (availableRecipes.length > 1) {
        const nonPackagerRecipes = availableRecipes.filter(r => r.building !== 'Packager');
        if (nonPackagerRecipes.length > 0) {
            availableRecipes = nonPackagerRecipes;
        }
    }

    if (availableRecipes.length === 1) return availableRecipes[0];

    return availableRecipes.sort((a, b) => {
        return Object.keys(a.recipe.inputs).length - Object.keys(b.recipe.inputs).length;
    })[0];
}


function findExtractorForResource(item) {
    const extractorInfo = RAW_RESOURCE_MAP[item];
    if (extractorInfo) {
        const { building, recipeName } = extractorInfo;
        const recipe = recipeData.recipes[building]?.find(r => r.name === recipeName);
        if (recipe) return { building, recipe };
    }
    return null;
}

// --- Main Auto-Build Function ---
export function autoBuildInputsForCard(targetCard, options) {
    let iteration = 0;
    const MAX_ITERATIONS = 20;

    while (iteration < MAX_ITERATIONS) {
        iteration++;
        
        const deficits = new Map();
        state.placedCards.forEach(card => {
            if (!card.inputs) return;
            for (const inputName in card.inputs) {
                const isConnected = [...state.connections.values()].some(conn =>
                    conn.to.cardId === card.id && conn.to.itemName === inputName
                );
                if (!isConnected) {
                    if (!deficits.has(inputName)) {
                        deficits.set(inputName, { totalDemand: 0, consumers: [] });
                    }
                    const deficit = deficits.get(inputName);
                    deficit.totalDemand += card.inputs[inputName];
                    deficit.consumers.push({ cardId: card.id, itemName: inputName });
                }
            }
        });

        if (deficits.size === 0) break;

        const producersForConnecting = new Map();
        let cardsCreatedThisIteration = 0;

        for (const [item, data] of deficits) {
            const { totalDemand } = data;
            let recipeInfo;
            if (RAW_RESOURCE_MAP[item]) {
                recipeInfo = findExtractorForResource(item);
            } else {
                recipeInfo = findProductionRecipe(item, options);
            }

            if (!recipeInfo) continue;

            let existingCard = null;
            for (const card of state.placedCards.values()) {
                if (card.recipe.name === recipeInfo.recipe.name && card.building === recipeInfo.building) {
                    existingCard = card;
                    break;
                }
            }

            if (existingCard) {
                let newTotalDemand = totalDemand;
                state.connections.forEach(conn => {
                    if (conn.from.cardId === existingCard.id && conn.from.itemName === item) {
                        const connectedConsumer = state.placedCards.get(conn.to.cardId);
                        if (connectedConsumer && connectedConsumer.inputs) {
                            newTotalDemand += connectedConsumer.inputs[item] || 0;
                        }
                    }
                });
                
                const { recipe } = recipeInfo;
                const required = newTotalDemand * 1.001;
                const baseRate = recipe.outputs[item];

                let buildings = existingCard.buildings;
                let clock = (required / (baseRate * buildings)) * 100;
                if (clock > 250) {
                    buildings = Math.ceil(required / (baseRate * 2.5));
                    clock = (required / (baseRate * buildings)) * 100;
                }
                
                existingCard.buildings = buildings;
                existingCard.powerShard = Math.min(250, clock);
                if (clock > 200) existingCard.powerShards = 3; else if (clock > 150) existingCard.powerShards = 2; else if (clock > 100) existingCard.powerShards = 1; else existingCard.powerShards = 0;
                
                producersForConnecting.set(item, existingCard.id);

            } else {
                const { building, recipe } = recipeInfo;
                const required = totalDemand * 1.001;
                const baseRate = recipe.outputs[item];
                const isExtractor = building.includes('Extractor') || building.startsWith('Miner');
                const buildings = (isExtractor || !baseRate) ? Math.ceil(required / (baseRate || 1)) : Math.ceil(required / baseRate);
                const clock = isExtractor ? 100 : (required / (baseRate * buildings)) * 100;
                let powerShards = 0;
                if (clock > 200) powerShards = 3; else if (clock > 150) powerShards = 2; else if (clock > 100) powerShards = 1;

                const xPos = targetCard.x - (450 * iteration);
                const yPos = targetCard.y + (producersForConnecting.size * 350) - ((deficits.size -1) * 175) ;
                
                const newCardId = `card-${state.nextCardId++}`;
                createCard(building, recipe, xPos, yPos, newCardId, { buildings, powerShard: clock, powerShards });
                producersForConnecting.set(item, newCardId);
                cardsCreatedThisIteration++;
            }
        }
        
        if (cardsCreatedThisIteration === 0 && producersForConnecting.size === 0) {
            break;
        }

        producersForConnecting.forEach((producerId, outputItem) => {
            const consumers = deficits.get(outputItem)?.consumers;
            if (consumers) {
                consumers.forEach(consumer => {
                    const connId = `conn-${state.nextConnectionId++}`;
                    state.connections.set(connId, {
                        from: { cardId: producerId, itemName: outputItem },
                        to: { cardId: consumer.cardId, itemName: consumer.itemName }
                    });
                });
            }
        });
        
        updateAllCalculations();
    }

    // --- FINALIZATION ---
    groupedArrangeLayout(targetCard); // <-- FIX: Call the correct existing function
    autoBalanceChain(targetCard); 

}

