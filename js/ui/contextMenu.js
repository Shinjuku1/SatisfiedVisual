/**
 * This file Manages the right-click context menu for cards.
 */
import dom from '../dom.js';
import state from '../state.js';
import { showModal, showAutoBuildOptionsModal } from './modals.js';
import { deleteCards, createCard } from '../core/card.js';
import { arrangeConnectedLayout } from '../core/layout.js';

/**
 * Creates and displays the context menu at the specified event coordinates.
 * @param {MouseEvent} e - The mouse event that triggered the menu.
 * @param {object} cardData - The data for the card that was right-clicked.
 */
export function showContextMenu(e, cardData) {
    e.preventDefault();
    dom.contextMenuContainer.innerHTML = '';
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    
    const hasUnconnectedInputs = cardData.recipe && Object.keys(cardData.recipe.inputs).length > 0 && Object.keys(cardData.recipe.inputs).some(inputName => {
        return ![...state.connections.values()].some(conn => conn.to.cardId === cardData.id && conn.to.itemName === inputName);
    });

    menu.innerHTML = `
        <button data-action="configure">Configure</button>
        <button data-action="duplicate">Duplicate</button>
        <button data-action="arrange-connected">Arrange Connected</button>
        ${hasUnconnectedInputs ? '<button data-action="autobuild-inputs">Auto-Build Inputs</button>' : ''}
        <button data-action="delete" class="text-red-400">Delete</button>
    `;
    dom.contextMenuContainer.appendChild(menu);
    const closeMenu = () => dom.contextMenuContainer.innerHTML = '';

    menu.querySelector('[data-action="configure"]').addEventListener('click', () => { showModal(cardData); closeMenu(); });
    menu.querySelector('[data-action="delete"]').addEventListener('click', () => { 
        state.selectedCardIds.add(cardData.id); 
        deleteCards(state.selectedCardIds); 
        state.selectedCardIds.clear(); 
        closeMenu(); 
    });
    menu.querySelector('[data-action="duplicate"]').addEventListener('click', () => {
        const config = { buildings: cardData.buildings, powerShards: cardData.powerShards, powerShard: cardData.powerShard, somersloops: cardData.somersloops, isFueled: cardData.isFueled };
        createCard(cardData.building, cardData.recipe, cardData.x + state.gridSize * 2, cardData.y + state.gridSize * 2, null, config);
        closeMenu();
    });
    
    const arrangeBtn = menu.querySelector('[data-action="arrange-connected"]');
    if (arrangeBtn) {
        arrangeBtn.addEventListener('click', () => {
            arrangeConnectedLayout(cardData);
            closeMenu();
        });
    }

    const autoBuildBtn = menu.querySelector('[data-action="autobuild-inputs"]');
    if (autoBuildBtn) {
        autoBuildBtn.addEventListener('click', () => {
            showAutoBuildOptionsModal(cardData);
            closeMenu();
        });
    }

    document.addEventListener('click', closeMenu, { once: true });
}
