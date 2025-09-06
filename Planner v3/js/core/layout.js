/**
 * @file Contains the logic for automatically arranging a connected group of cards.
 */
import state from '../state.js';
import { renderConnections } from '../ui/render.js';

/**
 * Arranges a graph of connected cards into a tidy, column-based layout
 * relative to an anchor card.
 * @param {object} anchorCard - The card to use as the central point for the layout.
 */
export function arrangeConnectedLayout(anchorCard) {
    // 1. Find all cards in the same connected component using Breadth-First Search (BFS).
    const connectedIds = new Set();
    const queue = [anchorCard.id];
    const visited = new Set([anchorCard.id]);

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

    // 2. Separate cards into upstream (inputs) and downstream (outputs) from the anchor.
    const upstream = new Map(); // level -> [cardId]
    const downstream = new Map(); // level -> [cardId]

    // BFS backwards for upstream cards
    let upQueue = [{ id: anchorCard.id, level: 0 }];
    let upVisited = new Set([anchorCard.id]);
    while(upQueue.length > 0) {
        const {id, level} = upQueue.shift();
        if (id !== anchorCard.id) {
            if (!upstream.has(level)) upstream.set(level, []);
            upstream.get(level).push(id);
        }

        state.connections.forEach(conn => {
            if(conn.to.cardId === id && connectedIds.has(conn.from.cardId) && !upVisited.has(conn.from.cardId)) {
                upVisited.add(conn.from.cardId);
                upQueue.push({ id: conn.from.cardId, level: level + 1 });
            }
        });
    }

    // BFS forwards for downstream cards
    let downQueue = [{ id: anchorCard.id, level: 0 }];
    let downVisited = new Set([anchorCard.id]);
    while(downQueue.length > 0) {
        const {id, level} = downQueue.shift();
        if (id !== anchorCard.id) {
            if (!downstream.has(level)) downstream.set(level, []);
            downstream.get(level).push(id);
        }
        
        state.connections.forEach(conn => {
            if(conn.from.cardId === id && connectedIds.has(conn.to.cardId) && !downVisited.has(conn.to.cardId)) {
                downVisited.add(conn.to.cardId);
                downQueue.push({ id: conn.to.cardId, level: level + 1 });
            }
        });
    }
    
    // 3. Position the cards in columns.
    const colWidth = 450;
    const rowHeight = 320;
    const anchorPos = { x: anchorCard.x, y: anchorCard.y };

    // Position upstream columns to the left of the anchor
    for (const [level, ids] of upstream.entries()) {
        const yOffset = -(ids.length - 1) / 2 * rowHeight;
        ids.forEach((id, index) => {
            const card = state.placedCards.get(id);
            if (card) {
                card.x = anchorPos.x - level * colWidth;
                card.y = anchorPos.y + yOffset + index * rowHeight;
                card.element.style.transform = `translate(${card.x}px, ${card.y}px)`;
            }
        });
    }
    
    // Position downstream columns to the right of the anchor
    for (const [level, ids] of downstream.entries()) {
        const yOffset = -(ids.length - 1) / 2 * rowHeight;
        ids.forEach((id, index) => {
            const card = state.placedCards.get(id);
            if (card) {
                card.x = anchorPos.x + level * colWidth;
                card.y = anchorPos.y + yOffset + index * rowHeight;
                card.element.style.transform = `translate(${card.x}px, ${card.y}px)`;
            }
        });
    }
    
    // Redraw connections after the card transition animation completes.
    setTimeout(renderConnections, 550);
}
