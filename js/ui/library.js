/**
 * This file (js/ui/library.js) handles populating and managing the recipe library sidebar.
 * The logic has been rewritten to ensure all standard and alternate recipes are correctly displayed.
 */
import dom from '/SatisfiedVisual/js/dom.js';
import state from '/SatisfiedVisual/js/state.js';
import { recipeData } from '/SatisfiedVisual/js/data/recipes.js';
import { renderHighlights } from '/SatisfiedVisual/js/ui/render.js';

/**
 * Populates the recipe library with all available recipes, grouped by building.
 */
export function populateLibrary() {
    dom.library.innerHTML = '';
    const recipesByBuilding = {};

    // 1. Group all recipes by their building name.
    Object.entries(recipeData.recipes).forEach(([buildingName, recipes]) => {
        recipesByBuilding[buildingName] = recipes;
    });
    recipesByBuilding['Special'] = [{ name: 'Alien Power Augmenter', inputs: {}, outputs: {} }];

    // 2. Build the new collapsible menu UI.
    for (const buildingName in recipesByBuilding) {
        const section = document.createElement('div');
        section.className = 'bg-gray-700/50 rounded-md overflow-hidden';
        section.dataset.buildingName = buildingName.toLowerCase();

        const chevronSVG = `<svg class="chevron w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>`;
        const header = document.createElement('div');
        header.className = 'collapsible-header flex justify-between items-center p-2 cursor-pointer hover:bg-gray-700';
        header.innerHTML = `<span class="font-bold text-white">${buildingName}</span>${chevronSVG}`;

        const content = document.createElement('div');
        content.className = 'collapsible-content border-t border-gray-600';
        
        const recipeList = document.createElement('div');
        recipeList.className = 'p-2 space-y-1';

        const buildingInfo = state.buildingsMap.get(buildingName);
        const isPowerGenerator = buildingInfo && buildingInfo.category === 'Power';

        if (isPowerGenerator) {
            // For power plants, create a single draggable item for the building itself.
            const el = createRecipeItem({
                itemName: buildingName,
                recipe: recipesByBuilding[buildingName][0], // Default to the first fuel type
                building: buildingName,
                isPowerPlant: true
            });
            recipeList.appendChild(el);
        } else {
            // For all other buildings, create an item for each unique recipe.
            recipesByBuilding[buildingName].sort((a, b) => a.name.localeCompare(b.name)).forEach(recipe => {
                const el = createRecipeItem({
                    itemName: recipe.name,
                    recipe: recipe,
                    building: buildingName
                });
                recipeList.appendChild(el);
            });
        }

        content.appendChild(recipeList);
        section.appendChild(header);
        section.appendChild(content);
        dom.library.appendChild(section);

        header.addEventListener('click', () => {
            header.classList.toggle('active');
            if (content.style.maxHeight) {
                content.style.maxHeight = null;
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
            }
        });
    }

    const initialOpen = ['Constructor', 'Smelter'];
    dom.library.querySelectorAll('.collapsible-header').forEach(header => {
        if (initialOpen.includes(header.querySelector('span').textContent)) {
            header.click();
        }
    });
}

/**
 * Creates a single recipe item element for the sidebar.
 * @param {object} itemData - The data for the recipe item.
 * @returns {HTMLElement} The created DOM element.
 */
function createRecipeItem(itemData) {
    const el = document.createElement('div');
    el.className = 'recipe-item bg-gray-700 p-2 rounded-md border border-transparent hover:border-indigo-500';
    el.draggable = true;
    
    const recipeKey = `${itemData.building}|${itemData.recipe.name}`;
    el.dataset.recipeKey = recipeKey;
    el.dataset.searchTerms = itemData.itemName.toLowerCase();
    
    const primaryOutput = Object.keys(itemData.recipe.outputs)[0] || itemData.itemName;
    el.dataset.highlightKey = itemData.isPowerPlant ? itemData.building : primaryOutput;
    
    const altIndicatorSVG = `<svg class="alt-indicator" fill="currentColor" viewBox="0 0 20 20"><path d="M10 3.5a1.5 1.5 0 01.936 2.65l-3.232 3.232a1.5 1.5 0 01-2.65-1.936L8.286 4.214A1.5 1.5 0 0110 3.5zm5.121 1.879a1.5 1.5 0 011.936 2.65l-3.232 3.232a1.5 1.5 0 01-2.65-1.936l3.946-3.946zM3.5 10a1.5 1.5 0 012.65-.936l3.232 3.232a1.5 1.5 0 01-1.936 2.65L3.504 11.714A1.5 1.5 0 013.5 10zm11.214 1.714a1.5 1.5 0 012.65 1.936l-3.232 3.232a1.5 1.5 0 01-2.65-1.936l3.232-3.232z"></path></svg>`;
    const altIndicatorHTML = itemData.recipe.isAlternate ? altIndicatorSVG : '';

    el.innerHTML = `<p class="font-bold text-sm text-white pointer-events-none flex items-center">${itemData.itemName} ${altIndicatorHTML}</p>`;
    
    el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', recipeKey));
    
    el.addEventListener('click', () => {
        const highlightKey = el.dataset.highlightKey;
        if (el.classList.contains('selected-for-highlight')) {
            el.classList.remove('selected-for-highlight');
            state.highlightedRecipeKey = null;
        } else {
            dom.library.querySelectorAll('.recipe-item.selected-for-highlight').forEach(selected => {
                selected.classList.remove('selected-for-highlight');
            });
            el.classList.add('selected-for-highlight');
            state.highlightedRecipeKey = highlightKey;
        }
        renderHighlights();
    });
    
    return el;
}

/**
 * Initializes the event listener for the recipe filter search input.
 */
export function initializeFilter() {
    dom.filterInput.addEventListener('input', () => {
        const searchTerm = dom.filterInput.value.toLowerCase();
        
        dom.library.querySelectorAll('[data-building-name]').forEach(section => {
            let hasVisibleChild = false;
            section.querySelectorAll('.recipe-item').forEach(el => {
                const isVisible = el.dataset.searchTerms.includes(searchTerm);
                el.style.display = isVisible ? 'block' : 'none';
                if (isVisible) {
                    hasVisibleChild = true;
                }
            });

            section.style.display = hasVisibleChild ? 'block' : 'none';

            const header = section.querySelector('.collapsible-header');
            const content = section.querySelector('.collapsible-content');
            
            if (searchTerm && hasVisibleChild && !header.classList.contains('active')) {
                header.classList.add('active');
                content.style.maxHeight = content.scrollHeight + "px";
            } else if (!searchTerm && header.classList.contains('active')) {
                const buildingName = header.querySelector('span').textContent;
                if (!['Constructor', 'Smelter'].includes(buildingName)) {
                    header.classList.remove('active');
                    content.style.maxHeight = null;
                }
            }
        });
    });

}
