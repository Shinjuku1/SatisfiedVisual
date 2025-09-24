/**
 * This file (js/ui/contextMenu.js) handles the creation and event handling
 * for the right-click context menu on cards.
 */
import dom from '/SatisfiedVisual/js/dom.js';
import state from '/SatisfiedVisual/js/state.js';
import { createCard, deleteCards } from '/SatisfiedVisual/js/core/card.js';
import { groupedArrangeLayout } from '/SatisfiedVisual/js/core/layout.js';
import { showModal, showAutoBuildOptionsModal, showAutoBalanceOptionsModal } from '/SatisfiedVisual/js/ui/modals.js';
import { renderCardSelections } from '/SatisfiedVisual/js/ui/render.js';

/**
 * Creates and displays a context menu at the specified event coordinates.
 * @param {MouseEvent} e - The mouse event that triggered the menu.
 * @param {object} cardData - The data object for the card that was clicked.
 */
export function showContextMenu(e, cardData) {
    e.preventDefault();
    dom.contextMenuContainer.innerHTML = '';
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    
    const hasUnconnectedInputs = cardData.recipe && Object.keys(cardData.recipe.inputs).length > 0 && 
        Object.keys(cardData.recipe.inputs).some(inputName => {
            return ![...state.connections.values()].some(conn => conn.to.cardId === cardData.id && conn.to.itemName === inputName);
        });
    
    const isLocked = state.lockedCardIds.has(cardData.id);

    menu.innerHTML = `
        <button data-action="configure">Configure</button>
        <button data-action="duplicate">Duplicate</button>
        <button data-action="toggle-lock">${isLocked ? 'Unlock Card' : 'Lock Card'}</button>
        <hr class="border-gray-600 my-1">
        <button data-action="auto-arrange">Auto Arrange Chain</button>
        <hr class="border-gray-600 my-1">
        <button data-action="autobalance" class="text-yellow-400">Auto Balance Chain</button>
        ${hasUnconnectedInputs ? '<button data-action="autobuild-inputs" class="text-cyan-400">Auto-Build Inputs</button>' : ''}
        <hr class="border-gray-600 my-1">
        <button data-action="delete" class="text-red-400">Delete</button>
    `;
    dom.contextMenuContainer.appendChild(menu);

    const closeMenu = () => dom.contextMenuContainer.innerHTML = '';

    // Event Listeners for Menu Actions
    menu.querySelector('[data-action="configure"]').addEventListener('click', () => { showModal(cardData); closeMenu(); });
    
    menu.querySelector('[data-action="delete"]').addEventListener('click', () => { 
        if (!state.selectedCardIds.has(cardData.id)) {
            state.selectedCardIds.clear();
            state.selectedCardIds.add(cardData.id);
        }
        deleteCards(state.selectedCardIds); 
        state.selectedCardIds.clear(); 
        closeMenu(); 
    });

    menu.querySelector('[data-action="duplicate"]').addEventListener('click', () => {
        const config = { buildings: cardData.buildings, powerShards: cardData.powerShards, powerShard: cardData.powerShard, somersloops: cardData.somersloops, isFueled: cardData.isFueled, isLocked: cardData.isLocked };
        createCard(cardData.building, cardData.recipe, cardData.x + state.gridSize * 2, cardData.y + state.gridSize * 2, null, config);
        closeMenu();
    });

    menu.querySelector('[data-action="auto-arrange"]').addEventListener('click', () => {
        // We now call the superior grouped layout function by default.
        groupedArrangeLayout(cardData); 
        closeMenu();
    });

    const autoBuildBtn = menu.querySelector('[data-action="autobuild-inputs"]');
    if (autoBuildBtn) {
        autoBuildBtn.addEventListener('click', () => {
            showAutoBuildOptionsModal(cardData);
            closeMenu();
        });
    }
    
    const autoBalanceBtn = menu.querySelector('[data-action="autobalance"]');
    if (autoBalanceBtn) {
        autoBalanceBtn.addEventListener('click', () => {
            showAutoBalanceOptionsModal(cardData); // Show new options modal
            closeMenu();
        });
    }

    const toggleLockBtn = menu.querySelector('[data-action="toggle-lock"]');
    if (toggleLockBtn) {
        toggleLockBtn.addEventListener('click', () => {
            cardData.isLocked = !isLocked;
            if (cardData.isLocked) {
                state.lockedCardIds.add(cardData.id);
            } else {
                state.lockedCardIds.delete(cardData.id);
            }
            renderCardSelections(); // Re-render to show/hide lock icon
            closeMenu();
        });
    }

    setTimeout(() => document.addEventListener('click', closeMenu, { once: true }), 0);

}
