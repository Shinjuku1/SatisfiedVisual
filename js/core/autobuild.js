/**
 * This file (js/core/autoBuild.js) contains the logic for the "Auto-Build Inputs" feature.
 * It has been significantly updated to include different build strategies, consolidate production,
 * and intelligently route byproducts to satisfy demands before creating new producers.
 */
import state from '/SatisfiedVisual/js/state.js';
import { recipeData } from '/SatisfiedVisual/js/data/recipes.js';
import { createCard } from '/SatisfiedVisual/js/core/card.js';
import { groupedArrangeLayout } from '/SatisfiedVisual/js/core/layout.js';
import { updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';
import { autoBalanceChain } from '/SatisfiedVisual/js/core/balancer.js';
import { round } from '/SatisfiedVisual/js/utils.js';

// --- Global Constants & Pre-computation ---

const RAW_RESOURCES = new Set([
    'Water', 'Crude Oil', 'Nitrogen Gas', 'Iron Ore', 'Copper Ore', 'Limestone',
    'Coal', 'Caterium Ore', 'Sulfur', 'Raw Quartz', 'Bauxite', 'Uranium', 'SAM'
]);

const EXTRACTOR_MAP = {
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

const RECIPE_COST_CACHE = new Map();
const RECIPE_LOOKUP = new Map();

/**
 * Pre-calculates the raw resource cost for every recipe in the game.
 * This is a one-time operation to make the "Resource Saver" strategy fast.
 */
function precomputeRecipeCosts() {
    if (RECIPE_LOOKUP.size > 0) return; // Already computed
    // Create a lookup for finding a recipe by its output item name
    Object.values(recipeData.recipes).flat().forEach(recipe => {
        const outputName = Object.keys(recipe.outputs)[0];
        if (!RECIPE_LOOKUP.has(outputName)) {
            RECIPE_LOOKUP.set(outputName, []);
        }
        RECIPE_LOOKUP.get(outputName).push(recipe);
    });

    const calculateCost = (itemName, visited = new Set()) => {
        if (RAW_RESOURCES.has(itemName)) return { [itemName]: 1 };
        if (RECIPE_COST_CACHE.has(itemName)) return RECIPE_COST_CACHE.get(itemName);
        if (visited.has(itemName)) return {}; // Cycle detected

        visited.add(itemName);
        const recipes = RECIPE_LOOKUP.get(itemName) || [];
        if (recipes.length === 0) return {};

        const recipeToAnalyze = recipes.find(r => !r.isAlternate) || recipes[0];
        const outputRate = recipeToAnalyze.outputs[itemName];
        const totalCost = {};

        for (const [inputName, inputRate] of Object.entries(recipeToAnalyze.inputs)) {
            const inputCost = calculateCost(inputName, new Set(visited));
            for (const [rawResource, amount] of Object.entries(inputCost)) {
                totalCost[rawResource] = (totalCost[rawResource] || 0) + (amount * inputRate) / outputRate;
            }
        }
        
        RECIPE_COST_CACHE.set(itemName, totalCost);
        return totalCost;
    };

    for (const itemName of RECIPE_LOOKUP.keys()) {
        calculateCost(itemName);
    }
}

// --- Helper Functions ---

function findProductionRecipe(item, buildOptions) {
    let availableRecipes = [];
    for (const building in recipeData.recipes) {
        if (building.includes('Extractor') || building.startsWith('Miner')) continue;
        for (const recipe of recipeData.recipes[building]) {
            if (Object.keys(recipe.outputs).includes(item)) {
                const recipeKey = `${building}|${recipe.name}`;
                if (recipe.isAlternate && (!buildOptions.useAlternates || !state.unlockedRecipes.has(recipeKey))) continue;
                if (!buildOptions.useSAM && Object.keys(recipe.inputs).some(input => input.toLowerCase().includes('sam'))) continue;
                availableRecipes.push({ building, recipe });
            }
        }
    }

    if (availableRecipes.length === 0) return null;

    if (availableRecipes.length > 1) {
        const nonPackagerRecipes = availableRecipes.filter(r => r.building !== 'Packager');
        if (nonPackagerRecipes.length > 0) availableRecipes = nonPackagerRecipes;
    }

    if (availableRecipes.length === 1) return availableRecipes[0];

    if (buildOptions.buildStrategy === 'resourceSaver') {
        availableRecipes.sort((a, b) => {
            const getCost = (recipe) => {
                let totalRawCost = 0;
                const outputRate = recipe.outputs[item];
                for (const [inputName, inputRate] of Object.entries(recipe.inputs)) {
                    const costs = RECIPE_COST_CACHE.get(inputName) || {};
                    const inputRawCost = Object.values(costs).reduce((sum, val) => sum + val, 0);
                    totalRawCost += (inputRawCost * inputRate) / outputRate;
                }
                return totalRawCost;
            };
            return getCost(a.recipe) - getCost(b.recipe);
        });
    } else { // 'simple' strategy
        availableRecipes.sort((a, b) => Object.keys(a.recipe.inputs).length - Object.keys(b.recipe.inputs).length);
    }

    return availableRecipes[0];
}

function findExtractorForResource(item) {
    const extractorInfo = EXTRACTOR_MAP[item];
    if (extractorInfo) {
        const { building, recipeName } = extractorInfo;
        const recipe = recipeData.recipes[building]?.find(r => r.name === recipeName);
        if (recipe) return { building, recipe };
    }
    return null;
}

function findConnectedComponent(startCardId) {
    const connectedIds = new Set();
    const queue = [startCardId];
    const visited = new Set([startCardId]);
    while (queue.length > 0) {
        const currentId = queue.shift();
        connectedIds.add(currentId);
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
    return connectedIds;
}

// --- Main Auto-Build Function ---
export function autoBuildInputsForCard(targetCard, options) {
    let iteration = 0;
    const MAX_ITERATIONS = 20;
    const chainCardIds = findConnectedComponent(targetCard.id);

    while (iteration < MAX_ITERATIONS) {
        iteration++;
        
        updateAllCalculations(); 
        const deficits = new Map();
        const surpluses = new Map();

        // 1. Calculate all deficits and surpluses in the current chain
        chainCardIds.forEach(cardId => {
            const card = state.placedCards.get(cardId);
            if (!card) return;

            Object.entries(card.inputs).forEach(([inputName, requiredRate]) => {
                let suppliedRate = 0;
                state.connections.forEach(conn => {
                    if (conn.to.cardId === cardId && conn.to.itemName === inputName) {
                        const sourceCard = state.placedCards.get(conn.from.cardId);
                        suppliedRate += sourceCard.outputs[conn.from.itemName] || 0;
                    }
                });
                
                const deficitAmount = requiredRate - suppliedRate;
                if (deficitAmount > 0.001) {
                    if (!deficits.has(inputName)) deficits.set(inputName, { totalDemand: 0, consumers: [] });
                    const deficit = deficits.get(inputName);
                    deficit.totalDemand += deficitAmount;
                    deficit.consumers.push({ cardId: card.id, itemName: inputName, required: deficitAmount });
                }
            });

            Object.entries(card.outputs).forEach(([outputName, outputRate]) => {
                let consumedRate = 0;
                state.connections.forEach(conn => {
                    if (conn.from.cardId === cardId && conn.from.itemName === outputName) {
                        const consumerCard = state.placedCards.get(conn.to.cardId);
                        if (consumerCard) consumedRate += consumerCard.inputs[conn.to.itemName] || 0;
                    }
                });
                const surplusAmount = outputRate - consumedRate;
                if (surplusAmount > 0.001) {
                    if (!surpluses.has(outputName)) surpluses.set(outputName, { amount: 0, producers: [] });
                    const surplus = surpluses.get(outputName);
                    surplus.amount += surplusAmount;
                    surplus.producers.push({ cardId: card.id, itemName: outputName, available: surplusAmount });
                }
            });
        });
        
        if (deficits.size === 0) break;

        // 2. Try to satisfy deficits with existing surpluses first
        for (const [item, deficitData] of deficits) {
            if (surpluses.has(item)) {
                const surplus = surpluses.get(item);
                for (const consumer of deficitData.consumers) {
                    const validProducer = surplus.producers.find(p => p.cardId !== consumer.cardId && p.available > 0.001);
                    if (validProducer) {
                        const connId = `conn-${state.nextConnectionId++}`;
                        state.connections.set(connId, {
                            from: { cardId: validProducer.cardId, itemName: validProducer.itemName },
                            to: { cardId: consumer.cardId, itemName: consumer.itemName }
                        });
                        const amountToUse = Math.min(consumer.required, validProducer.available);
                        consumer.required -= amountToUse;
                        validProducer.available -= amountToUse;
                    }
                }
            }
        }

        // 3. Build for any remaining deficits
        const producersForConnecting = new Map();
        let cardsCreatedThisIteration = 0;

        for (const [item, data] of deficits) {
            const remainingDemand = data.consumers.reduce((sum, c) => sum + c.required, 0);
            if (remainingDemand < 0.001) continue;
            
            const recipeInfo = RAW_RESOURCES.has(item) ? findExtractorForResource(item) : findProductionRecipe(item, options);
            if (!recipeInfo) continue;

            const { building, recipe } = recipeInfo;
            
            let existingCard = null;
            // Find if a consolidated producer for this item already exists
            for (const card of state.placedCards.values()) {
                if (card.recipe.name === recipe.name && card.building === building) {
                    existingCard = card;
                    break;
                }
            }

            if (existingCard) {
                let totalDemandForItem = 0;
                chainCardIds.forEach(id => {
                    const card = state.placedCards.get(id);
                    if(card && card.inputs[item]){
                        totalDemandForItem += card.inputs[item];
                    }
                });

                const baseRate = recipe.outputs[item];
                const required = totalDemandForItem * 1.001; // Recalculate based on total chain need
                
                let buildings = existingCard.buildings;
                let clock = (required / (baseRate * buildings)) * 100;

                if (clock > 250) {
                    buildings = Math.ceil(required / (baseRate * 2.5));
                    clock = (required / (baseRate * buildings)) * 100;
                }

                existingCard.buildings = buildings;
                existingCard.powerShard = round(Math.min(250, Math.max(0.1, clock)), 3);
                
                producersForConnecting.set(item, existingCard.id);
                if (!chainCardIds.has(existingCard.id)) chainCardIds.add(existingCard.id);

            } else { // Create a new producer card
                const required = remainingDemand * 1.001;
                const baseRate = recipe.outputs[item];
                let buildings, clock, powerShards = 0;

                if (building.includes('Extractor') || building.startsWith('Miner')) {
                    buildings = Math.ceil(required / (baseRate || 1));
                    clock = 100;
                } else {
                    buildings = 1;
                    clock = (required / (baseRate * buildings)) * 100;
                    if (clock > 250) {
                        buildings = Math.ceil(required / (baseRate * 2.5));
                        clock = (required / (baseRate * buildings)) * 100;
                    }
                }
                
                clock = round(Math.min(250, Math.max(0.1, clock)), 3);
                if (clock > 200) powerShards = 3; else if (clock > 150) powerShards = 2; else if (clock > 100) powerShards = 1;

                const xPos = targetCard.x - (450 * (iteration + 1));
                const yPos = targetCard.y + (producersForConnecting.size * 350) - ((deficits.size - 1) * 175);
                
                const newCardId = `card-${state.nextCardId++}`;
                createCard(building, recipe, xPos, yPos, newCardId, { buildings, powerShard: clock, powerShards });
                producersForConnecting.set(item, newCardId);
                cardsCreatedThisIteration++;
                chainCardIds.add(newCardId);
            }
        }
        
        if (cardsCreatedThisIteration === 0 && producersForConnecting.size === 0) break;

        producersForConnecting.forEach((producerId, outputItem) => {
            const consumers = deficits.get(outputItem)?.consumers;
            if (consumers) {
                consumers.forEach(consumer => {
                     // Check if not already connected from another pass
                    const alreadyConnected = [...state.connections.values()].some(conn => 
                        conn.to.cardId === consumer.cardId && conn.to.itemName === consumer.itemName
                    );
                    if (!alreadyConnected) {
                        const connId = `conn-${state.nextConnectionId++}`;
                        state.connections.set(connId, {
                            from: { cardId: producerId, itemName: outputItem },
                            to: { cardId: consumer.cardId, itemName: consumer.itemName }
                        });
                    }
                });
            }
        });
    }

    // --- FINALIZATION ---
    groupedArrangeLayout(targetCard);
    autoBalanceChain(targetCard);
}

// --- One-time execution ---
precomputeRecipeCosts();

