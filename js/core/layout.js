/**
 * This file (js/core/layout.js) contains the logic for the "Arrange Connected" feature,
 * including the new, more advanced grouped arrangement for complex factories.
 */
import state from '/SatisfiedVisual/js/state.js';
import { updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';

// --- Main Layout Functions ---

/**
 * Arranges all cards connected to the anchor card in a logical, column-based layout.
 * @param {object} anchorCard - The card to use as the center point of the layout.
 * @param {Set<string>} [cardIdsToArrange] - Optional subset of card IDs to arrange. If not provided, arranges the entire connected chain.
 */
export function arrangeConnectedLayout(anchorCard, cardIdsToArrange = null) {
    const allConnectedIds = findConnectedComponent(anchorCard);
    const chainCardIds = cardIdsToArrange ? new Set([...cardIdsToArrange].filter(id => allConnectedIds.has(id))) : allConnectedIds;

    const upstream = new Map();
    const downstream = new Map();

    // BFS backwards for upstream cards
    let upQueue = [{ id: anchorCard.id, level: 0 }];
    let upVisited = new Set([anchorCard.id]);
    while (upQueue.length > 0) {
        const { id, level } = upQueue.shift();
        if (id !== anchorCard.id) {
            if (!upstream.has(level)) upstream.set(level, []);
            upstream.get(level).push(id);
        }
        state.connections.forEach(conn => {
            if (conn.to.cardId === id && chainCardIds.has(conn.from.cardId) && !upVisited.has(conn.from.cardId)) {
                upVisited.add(conn.from.cardId);
                upQueue.push({ id: conn.from.cardId, level: level + 1 });
            }
        });
    }

    // BFS forwards for downstream cards
    let downQueue = [{ id: anchorCard.id, level: 0 }];
    let downVisited = new Set([anchorCard.id]);
    while (downQueue.length > 0) {
        const { id, level } = downQueue.shift();
        if (id !== anchorCard.id) {
            if (!downstream.has(level)) downstream.set(level, []);
            downstream.get(level).push(id);
        }
        state.connections.forEach(conn => {
            if (conn.from.cardId === id && chainCardIds.has(conn.to.cardId) && !downVisited.has(conn.to.cardId)) {
                downVisited.add(conn.to.cardId);
                downQueue.push({ id: conn.to.cardId, level: level + 1 });
            }
        });
    }
    
    const colWidth = 450;
    const rowHeight = 320;
    const anchorPos = {
        x: Math.round(anchorCard.x / state.gridSize) * state.gridSize,
        y: Math.round(anchorCard.y / state.gridSize) * state.gridSize
    };
    anchorCard.x = anchorPos.x;
    anchorCard.y = anchorPos.y;
    anchorCard.element.style.transform = `translate(${anchorCard.x}px, ${anchorCard.y}px)`;

    positionColumn(upstream, anchorPos, -colWidth, rowHeight);
    positionColumn(downstream, anchorPos, colWidth, rowHeight);
    
    setTimeout(() => updateAllCalculations(), 550);
}

/**
 * NEW: Arranges a complex factory into logical sub-factory groups.
 * @param {object} startCard - A card within the factory to be arranged.
 */
export function groupedArrangeLayout(startCard) {
    const allConnectedIds = findConnectedComponent(startCard);

    // 1. Find all "final product" cards in the chain.
    const finalProductCardIds = findFinalProductCards(allConnectedIds);
    
    if (finalProductCardIds.size === 0 && allConnectedIds.size > 0) {
        // If no clear final product, fall back to the simple line layout.
        arrangeConnectedLayout(startCard, allConnectedIds);
        return;
    }

    // 2. For each final product, create a sub-group of its dependencies.
    const subGroups = [];
    const assignedIds = new Set();
    finalProductCardIds.forEach(finalCardId => {
        const subGroupIds = new Set();
        const queue = [finalCardId];
        const visited = new Set([finalCardId]);

        while(queue.length > 0) {
            const currentId = queue.shift();
            if (assignedIds.has(currentId) && currentId !== finalCardId) continue;
            subGroupIds.add(currentId);
            
            state.connections.forEach(conn => {
                if(conn.to.cardId === currentId && allConnectedIds.has(conn.from.cardId) && !visited.has(conn.from.cardId)) {
                    visited.add(conn.from.cardId);
                    queue.push(conn.from.cardId);
                }
            });
        }
        subGroupIds.forEach(id => assignedIds.add(id));
        if (subGroupIds.size > 0) {
            subGroups.push({ anchorId: finalCardId, ids: subGroupIds });
        }
    });

    // 3. Arrange the groups in a grid.
    const gridWidth = Math.ceil(Math.sqrt(subGroups.length));
    const groupSpacingX = 2000;
    const groupSpacingY = 1600;

    subGroups.forEach((group, index) => {
        const gridX = index % gridWidth;
        const gridY = Math.floor(index / gridWidth);

        const groupAnchor = state.placedCards.get(group.anchorId);
        
        const newAnchorX = startCard.x + (gridX * groupSpacingX);
        const newAnchorY = startCard.y + (gridY * groupSpacingY);

        const deltaX = newAnchorX - groupAnchor.x;
        const deltaY = newAnchorY - groupAnchor.y;

        group.ids.forEach(id => {
            const card = state.placedCards.get(id);
            if(card) {
                card.x += deltaX;
                card.y += deltaY;
            }
        });

        // Arrange the cards *within* this subgroup.
        arrangeConnectedLayout(groupAnchor, group.ids);
    });

    setTimeout(() => updateAllCalculations(), 600); // Slightly longer timeout for complex arrangements
}


// --- Helper Functions ---

function findConnectedComponent(startCard) {
    const connectedIds = new Set();
    const queue = [startCard.id];
    const visited = new Set([startCard.id]);
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

function findFinalProductCards(chainCardIds) {
    const finalProductIds = new Set(chainCardIds);
    state.connections.forEach(conn => {
        // If a card is a supplier to another card *within the same chain*, it's not a final product.
        if (chainCardIds.has(conn.from.cardId) && chainCardIds.has(conn.to.cardId)) {
            finalProductIds.delete(conn.from.cardId);
        }
    });
     // Fallback for single-line chains: find the single most downstream card.
     if (finalProductIds.size === 0 && chainCardIds.size > 0) {
        let lastCardId = [...chainCardIds][0];
        let changed = true;
        while(changed) {
            changed = false;
            for(const conn of state.connections.values()){
                if(conn.from.cardId === lastCardId && chainCardIds.has(conn.to.cardId)){
                    lastCardId = conn.to.cardId;
                    changed = true;
                    break;
                }
            }
        }
        finalProductIds.add(lastCardId);
    }
    return finalProductIds;
}

function positionColumn(levelMap, anchorPos, colWidth, rowHeight) {
    for (const [level, ids] of levelMap.entries()) {
        const yOffset = -(ids.length - 1) / 2 * rowHeight;
        ids.forEach((id, index) => {
            const card = state.placedCards.get(id);
            if (card) {
                const newX = anchorPos.x + level * colWidth;
                const newY = anchorPos.y + yOffset + index * rowHeight;
                card.x = Math.round(newX / state.gridSize) * state.gridSize;
                card.y = Math.round(newY / state.gridSize) * state.gridSize;
                card.element.style.transform = `translate(${card.x}px, ${card.y}px)`;
            }
        });
    }

}
