/**
 * This file (js/core/autoBuild.js) contains the logic for the "Auto-Build Inputs" feature.
 * It has been significantly updated to include different build strategies, such as prioritizing
 * raw resource efficiency, and to consolidate production into existing cards instead of creating duplicates.
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
        
        const deficits = new Map();
        chainCardIds.forEach(cardId => {
            const card = state.placedCards.get(cardId);
            if (!card || !card.inputs) return;
            for (const inputName in card.inputs) {
                if (![...state.connections.values()].some(c => c.to.cardId === card.id && c.to.itemName === inputName)) {
                    if (!deficits.has(inputName)) deficits.set(inputName, { totalDemand: 0, consumers: [] });
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
            const recipeInfo = RAW_RESOURCES.has(item) ? findExtractorForResource(item) : findProductionRecipe(item, options);
            if (!recipeInfo) continue;

            const { building, recipe } = recipeInfo;
            
            // --- NEW: Consolidation Logic ---
            let existingCard = null;
            // Search the entire factory, not just the current chain, for consolidation opportunities.
            for (const card of state.placedCards.values()) {
                if (card.recipe.name === recipe.name && card.building === building) {
                    existingCard = card;
                    break;
                }
            }

            if (existingCard) {
                // An existing card was found. Update it instead of creating a new one.
                let newTotalDemand = data.totalDemand;
                // Add demand from consumers already connected to this card.
                state.connections.forEach(conn => {
                    if (conn.from.cardId === existingCard.id && conn.from.itemName === item) {
                        const consumer = state.placedCards.get(conn.to.cardId);
                        if(consumer && consumer.inputs) newTotalDemand += consumer.inputs[item] || 0;
                    }
                });

                const baseRate = recipe.outputs[item];
                const required = newTotalDemand * 1.001;
                
                let buildings = existingCard.buildings;
                let clock = (required / (baseRate * buildings)) * 100;

                if (clock > 250) {
                    buildings = Math.ceil(required / (baseRate * 2.5));
                    clock = (required / (baseRate * buildings)) * 100;
                }

                existingCard.buildings = buildings;
                existingCard.powerShard = round(Math.min(250, Math.max(0.1, clock)), 3);
                if (clock > 200) existingCard.powerShards = 3; else if (clock > 150) existingCard.powerShards = 2; else if (clock > 100) existingCard.powerShards = 1; else existingCard.powerShards = 0;
                
                producersForConnecting.set(item, existingCard.id);
                // Ensure this existing card is now considered part of the chain for layout purposes.
                if (!chainCardIds.has(existingCard.id)) chainCardIds.add(existingCard.id);

            } else {
                // No existing card found, create a new one.
                const required = data.totalDemand * 1.001;
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

                const xPos = targetCard.x - (450 * iteration);
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
    groupedArrangeLayout(targetCard);
    autoBalanceChain(targetCard);
}

// --- One-time execution ---
precomputeRecipeCosts();

