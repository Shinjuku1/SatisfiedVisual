/**
 * This file Manages the recipe library sidebar, including population and filtering.
 */
import dom from '../../js/dom.js';
import { recipeData } from '../data/recipes.js';

/**
 * Populates the recipe library sidebar from the recipe data.
 */
export function populateLibrary() {
    dom.library.innerHTML = '';
    const groupedRecipes = {};
    
    Object.entries(recipeData.recipes).forEach(([buildingName, recipes]) => {
        if (!groupedRecipes[buildingName]) groupedRecipes[buildingName] = [];
        recipes.forEach(recipe => groupedRecipes[buildingName].push(recipe));
    });

    // Add the special "Alien Power Augmenter" as a virtual recipe
    groupedRecipes['Special'] = [{name: 'Alien Power Augmenter', inputs: {}, outputs: {}}];
    
    for(const buildingName in groupedRecipes) {
        const details = document.createElement('details');
        details.className = 'bg-gray-700/50 rounded';
        details.open = ['Constructor', 'Smelter'].includes(buildingName);
        
        const summary = document.createElement('summary');
        summary.className = 'p-2 font-bold text-white cursor-pointer';
        summary.textContent = buildingName;
        details.appendChild(summary);
        
        const container = document.createElement('div');
        container.className = 'p-2 border-t border-gray-600 space-y-1';
        
        groupedRecipes[buildingName].forEach(recipe => {
            const el = document.createElement('div');
            el.className = 'bg-gray-700 p-2 rounded-md cursor-grab border border-transparent hover:border-indigo-500';
            el.draggable = true;
            el.dataset.recipeKey = `${buildingName}|${recipe.name}`;
            el.dataset.searchTerms = `${recipe.name.toLowerCase()} ${buildingName.toLowerCase()}`;
            el.innerHTML = `<p class="font-bold text-sm text-white pointer-events-none">${recipe.name}</p>`;
            el.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/plain', e.target.dataset.recipeKey));
            container.appendChild(el);
        });

        details.appendChild(container);
        dom.library.appendChild(details);
    }
}

/**
 * Filters the recipe library based on the user's search input.
 */
export function filterLibrary() {
    const searchTerm = dom.filterInput.value.toLowerCase();
    dom.library.querySelectorAll('details').forEach(details => {
        let hasVisibleChild = false;
        details.querySelectorAll('[data-recipe-key]').forEach(el => {
            const isVisible = el.dataset.searchTerms.includes(searchTerm);
            el.style.display = isVisible ? 'block' : 'none';
            if (isVisible) hasVisibleChild = true;
        });
        
        if (searchTerm) {
            details.open = hasVisibleChild;
            details.style.display = hasVisibleChild ? 'block' : 'none';
        } else {
            // Reset to default state when search is cleared
            details.style.display = 'block';
            details.open = ['Constructor', 'Smelter'].includes(details.querySelector('summary').textContent);
        }
    });
}
