/**
 * This file (js/core/layout.js) contains the logic for the "Arrange Connected" feature.
 * It uses a hybrid approach: a high-level modular sort for complex factories, and a
 * layered graph drawing (Sugiyama-style) algorithm for arranging modules and simple chains
 * to ensure maximum readability and flow.
 */
import state from '/SatisfiedVisual/js/state.js';
import { updateAllCalculations } from '/SatisfiedVisual/js/core/calculations.js';

// --- Configuration ---
const KEY_INTERMEDIATE_BUILDINGS = new Set(['Manufacturer', 'Blender', 'Particle Accelerator', 'Quantum Encoder', 'Assembler']);
const CARD_WIDTH = 360;
const CARD_HEIGHT = 280;
const COL_SPACING = 200;
const ROW_SPACING = 50;
const MODULE_SPACING_X = 300;
const MODULE_SPACING_Y = 160;

// --- Main Layout Entry Point ---

export function groupedArrangeLayout(startCard) {
    const originalAnchorX = startCard.x;
    const originalAnchorY = startCard.y;
    const allConnectedIds = findConnectedComponent(startCard.id);

    // Identify anchors for modular layout
    const finalProductCardIds = findFinalProductCards(allConnectedIds);
    const anchorCardIds = new Set(finalProductCardIds);
    allConnectedIds.forEach(id => {
        const card = state.placedCards.get(id);
        if (card && KEY_INTERMEDIATE_BUILDINGS.has(card.building) && !finalProductCardIds.has(id)) {
            anchorCardIds.add(id);
        }
    });

    // Use modular layout for complex factories, otherwise use the advanced layered layout directly.
    if (anchorCardIds.size <= 1) {
        arrangeConnectedLayout(startCard, allConnectedIds);
    } else {
        const { subGroups, groupMap } = createSubGroups(anchorCardIds, allConnectedIds);
        const sortedGroupIndices = topoSorModules(subGroups, groupMap);
        positionModules(sortedGroupIndices, subGroups, startCard, groupMap);
    }

    // Anchor the start card to its original position by shifting the entire group.
    const finalAnchorX = startCard.x;
    const finalAnchorY = startCard.y;
    const shiftX = originalAnchorX - finalAnchorX;
    const shiftY = originalAnchorY - finalAnchorY;

    if (shiftX !== 0 || shiftY !== 0) {
        allConnectedIds.forEach(id => {
            const card = state.placedCards.get(id);
            if (card) {
                card.x += shiftX;
                card.y += shiftY;
                card.element.style.transform = `translate(${card.x}px, ${card.y}px)`;
            }
        });
    }

    setTimeout(() => updateAllCalculations(), 600);
}

// --- Modular Layout Functions ---

function createSubGroups(anchorCardIds, allConnectedIds) {
    const subGroups = [];
    const assignedIds = new Set();
    const groupMap = new Map();
    for (const anchorId of anchorCardIds) {
        if (assignedIds.has(anchorId)) continue;
        const subGroupIds = new Set();
        const queue = [anchorId];
        const visited = new Set([anchorId]);
        while (queue.length > 0) {
            const currentId = queue.shift();
            if (assignedIds.has(currentId) && currentId !== anchorId) continue;
            subGroupIds.add(currentId);
            state.connections.forEach(conn => {
                if (conn.to.cardId === currentId && allConnectedIds.has(conn.from.cardId) && !visited.has(conn.from.cardId)) {
                    visited.add(conn.from.cardId);
                    queue.push(conn.from.cardId);
                }
            });
        }
        if (subGroupIds.size > 0) {
            subGroupIds.forEach(id => assignedIds.add(id));
            subGroups.push({ anchorId, ids: subGroupIds });
        }
    }
    subGroups.forEach((group, index) => {
        group.ids.forEach(cardId => groupMap.set(cardId, index));
    });
    return { subGroups, groupMap };
}

function topoSorModules(subGroups, groupMap) {
    const groupAdj = new Map();
    const groupInDegree = new Map();
    subGroups.forEach((_, index) => {
        groupAdj.set(index, []);
        groupInDegree.set(index, 0);
    });
    state.connections.forEach(conn => {
        const fromGroupIdx = groupMap.get(conn.from.cardId);
        const toGroupIdx = groupMap.get(conn.to.cardId);
        if (fromGroupIdx !== undefined && toGroupIdx !== undefined && fromGroupIdx !== toGroupIdx) {
            if (!groupAdj.get(fromGroupIdx).includes(toGroupIdx)) {
                groupAdj.get(fromGroupIdx).push(toGroupIdx);
                groupInDegree.set(toGroupIdx, groupInDegree.get(toGroupIdx) + 1);
            }
        }
    });
    const sortedGroupIndices = [];
    const queue = [];
    subGroups.forEach((_, index) => {
        if (groupInDegree.get(index) === 0) queue.push(index);
    });
    while (queue.length > 0) {
        const u = queue.shift();
        sortedGroupIndices.push(u);
        groupAdj.get(u)?.forEach(v => {
            groupInDegree.set(v, groupInDegree.get(v) - 1);
            if (groupInDegree.get(v) === 0) queue.push(v);
        });
    }
    return sortedGroupIndices;
}

function positionModules(sortedGroupIndices, subGroups, startCard, groupMap) {
    // 1. Arrange cards within each module first to calculate their bounds
    const moduleBounds = new Map();
    subGroups.forEach((group, index) => {
        const groupAnchor = state.placedCards.get(group.anchorId);
        arrangeConnectedLayout(groupAnchor, group.ids); // Arrange internally
        const bounds = getCardSetBounds(group.ids);
        bounds.width = bounds.maxX - bounds.minX;
        bounds.height = bounds.maxY - bounds.minY;
        moduleBounds.set(index, bounds);
    });

    // 2. Assign modules to layers (columns) based on the topological sort
    const moduleLayers = [];
    const moduleToLayerMap = new Map();
    for (const groupIndex of sortedGroupIndices) {
        let maxRank = -1;
        state.connections.forEach(conn => {
            const fromGroupIdx = groupMap.get(conn.from.cardId);
            const toGroupIdx = groupMap.get(conn.to.cardId);
            if (toGroupIdx === groupIndex && fromGroupIdx !== groupIndex && moduleToLayerMap.has(fromGroupIdx)) {
                maxRank = Math.max(maxRank, moduleToLayerMap.get(fromGroupIdx).layer);
            }
        });
        const rank = maxRank + 1;
        if (!moduleLayers[rank]) moduleLayers[rank] = [];
        moduleToLayerMap.set(groupIndex, { layer: rank, pos: moduleLayers[rank].length });
        moduleLayers[rank].push(groupIndex);
    }

    // 3. Position the layers and the modules within them
    let currentX = startCard.x;

    moduleLayers.forEach((layer, layerIndex) => {
        const layerHeight = layer.reduce((sum, groupIndex) => sum + moduleBounds.get(groupIndex).height, 0) + Math.max(0, layer.length - 1) * MODULE_SPACING_Y;
        let currentY = startCard.y - layerHeight / 2;

        layer.sort((aIndex, bIndex) => {
            const getBarycenter = (idx, targetLayer) => {
                let totalY = 0;
                let count = 0;
                state.connections.forEach(conn => {
                    const fromIdx = groupMap.get(conn.from.cardId);
                    const toIdx = groupMap.get(conn.to.cardId);
                    if (toIdx === idx && fromIdx !== idx && moduleToLayerMap.get(fromIdx)?.layer === targetLayer) {
                        const fromBounds = moduleBounds.get(fromIdx);
                        totalY += fromBounds.minY + fromBounds.height / 2;
                        count++;
                    }
                });
                return count > 0 ? totalY / count : 0;
            };
            return getBarycenter(aIndex, layerIndex - 1) - getBarycenter(bIndex, layerIndex - 1);
        });

        layer.forEach(groupIndex => {
            const group = subGroups[groupIndex];
            const bounds = moduleBounds.get(groupIndex);
            
            const deltaX = currentX - bounds.minX;
            const deltaY = currentY - bounds.minY;

            moveCardSet(group.ids, deltaX, deltaY);
            
            bounds.minX += deltaX; bounds.maxX += deltaX;
            bounds.minY += deltaY; bounds.maxY += deltaY;

            currentY += bounds.height + MODULE_SPACING_Y;
        });

        const layerWidth = Math.max(0, ...layer.map(idx => moduleBounds.get(idx).width));
        currentX += layerWidth + MODULE_SPACING_X;
    });
}

// --- Layered Layout (Sugiyama-style) Algorithm ---

export function arrangeConnectedLayout(anchorCard, cardIdsToArrange) {
    const { layers, cardToLayerMap } = assignLayers(cardIdsToArrange);
    minimizeCrossings(layers, cardToLayerMap);
    assignCoordinates(layers, anchorCard);
}

function assignLayers(cardIds) {
    const layers = [];
    const cardToLayerMap = new Map();
    const sortedCardIds = topologicalSort(cardIds);

    for (const cardId of sortedCardIds) {
        let maxRank = -1;
        state.connections.forEach(conn => {
            if (conn.to.cardId === cardId && cardToLayerMap.has(conn.from.cardId)) {
                maxRank = Math.max(maxRank, cardToLayerMap.get(conn.from.cardId).layer);
            }
        });
        const rank = maxRank + 1;
        
        if (!layers[rank]) layers[rank] = [];
        cardToLayerMap.set(cardId, { layer: rank, pos: layers[rank].length });
        layers[rank].push(cardId);
    }
    return { layers, cardToLayerMap };
}

function minimizeCrossings(layers, cardToLayerMap) {
    for (let i = 0; i < 4; i++) {
        for (let l = 1; l < layers.length; l++) {
            sortLayerByBarycenter(layers[l], cardToLayerMap, l, true);
        }
        for (let l = layers.length - 2; l >= 0; l--) {
            sortLayerByBarycenter(layers[l], cardToLayerMap, l, false);
        }
    }
}

function assignCoordinates(layers, anchorCard) {
    layers.forEach((layer, layerIndex) => {
        const layerHeight = layer.length * (CARD_HEIGHT + ROW_SPACING) - ROW_SPACING;
        const xPos = anchorCard.x + layerIndex * (CARD_WIDTH + COL_SPACING);
        
        layer.forEach((cardId, cardIndex) => {
            const yPos = anchorCard.y - (layerHeight / 2) + cardIndex * (CARD_HEIGHT + ROW_SPACING);
            const card = state.placedCards.get(cardId);
            if (card) {
                card.x = Math.round(xPos / state.gridSize) * state.gridSize;
                card.y = Math.round(yPos / state.gridSize) * state.gridSize;
                card.element.style.transform = `translate(${card.x}px, ${card.y}px)`;
            }
        });
    });
}

// --- General Helper Functions ---

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

function findFinalProductCards(chainCardIds) {
    const finalProductIds = new Set(chainCardIds);
    state.connections.forEach(conn => {
        if (chainCardIds.has(conn.from.cardId) && chainCardIds.has(conn.to.cardId)) {
            finalProductIds.delete(conn.from.cardId);
        }
    });
    if (finalProductIds.size === 0 && chainCardIds.size > 0) {
        let maxRank = -1;
        let lastCardId = [...chainCardIds][0];
        const { cardToLayerMap } = assignLayers(chainCardIds);
        cardToLayerMap.forEach((info, id) => {
            if (info.layer > maxRank) {
                maxRank = info.layer;
                lastCardId = id;
            }
        });
        finalProductIds.add(lastCardId);
    }
    return finalProductIds;
}

function topologicalSort(cardIds) {
    const sorted = [];
    const inDegree = new Map();
    const adj = new Map();
    cardIds.forEach(id => { inDegree.set(id, 0); adj.set(id, []); });
    state.connections.forEach(conn => {
        if (cardIds.has(conn.from.cardId) && cardIds.has(conn.to.cardId)) {
            adj.get(conn.from.cardId).push(conn.to.cardId);
            inDegree.set(conn.to.cardId, (inDegree.get(conn.to.cardId) || 0) + 1);
        }
    });
    const queue = [];
    cardIds.forEach(id => { if (inDegree.get(id) === 0) queue.push(id); });
    while (queue.length > 0) {
        const u = queue.shift();
        sorted.push(u);
        adj.get(u)?.forEach(v => {
            inDegree.set(v, inDegree.get(v) - 1);
            if (inDegree.get(v) === 0) queue.push(v);
        });
    }
    return sorted;
}

function sortLayerByBarycenter(layer, cardToLayerMap, layerIndex, isUpstreamPass) {
    const barycenters = new Map();
    layer.forEach(cardId => {
        let totalPos = 0, count = 0;
        const adjacentLayerIndex = isUpstreamPass ? layerIndex - 1 : layerIndex + 1;
        state.connections.forEach(conn => {
            let neighborId = null;
            if (isUpstreamPass && conn.to.cardId === cardId) neighborId = conn.from.cardId;
            else if (!isUpstreamPass && conn.from.cardId === cardId) neighborId = conn.to.cardId;
            if (neighborId && cardToLayerMap.has(neighborId) && cardToLayerMap.get(neighborId).layer === adjacentLayerIndex) {
                totalPos += cardToLayerMap.get(neighborId).pos;
                count++;
            }
        });
        barycenters.set(cardId, count > 0 ? totalPos / count : -1);
    });
    layer.sort((a, b) => barycenters.get(a) - barycenters.get(b));
    layer.forEach((cardId, index) => { cardToLayerMap.get(cardId).pos = index; });
}

function getCardSetBounds(cardIds) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    cardIds.forEach(id => {
        const card = state.placedCards.get(id);
        if (card) {
            minX = Math.min(minX, card.x);
            maxX = Math.max(maxX, card.x + CARD_WIDTH);
            minY = Math.min(minY, card.y);
            maxY = Math.max(maxY, card.y + CARD_HEIGHT);
        }
    });
    return { minX, maxX, minY, maxY };
}

function moveCardSet(cardIds, deltaX, deltaY) {
    cardIds.forEach(id => {
        const card = state.placedCards.get(id);
        if (card) {
            card.x += deltaX;
            card.y += deltaY;
            card.element.style.transform = `translate(${card.x}px, ${card.y}px)`;
        }
    });
}

