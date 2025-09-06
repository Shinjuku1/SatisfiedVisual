/**
 * This file (js/constants.js) holds static game data and constants
 * that are shared across multiple modules.
 */
import { recipeData } from '/js/data/recipes.js';

// Defines the maximum number of Somersloops that can be installed in each building type.
export const SOMERSLOOP_SLOTS = {
    'Constructor': 1, 
    'Smelter': 1, 
    'Assembler': 2, 
    'Foundry': 2, 
    'Refinery': 2, 
    'Converter': 2,
    'Manufacturer': 4, 
    'Blender': 4, 
    'Particle Accelerator': 4, 
    'Quantum Encoder': 4,
};

// Creates a Set of all building names that are categorized as 'Power' generators.
// This allows for quick lookups to determine if a building produces or consumes power.
export const GENERATOR_BUILDINGS = new Set(recipeData.buildings.filter(b => b.category === 'Power').map(b => b.name));