/**
 * This file (js/events/listeners.js) sets up all event listeners for the application and defines their handlers.
 * It has been updated to handle the new paste/blueprint flow and settings modal.
 */
import dom from '/SatisfiedVisual/js/dom.js';
import state from '/SatisfiedVisual/js/state.js';
import { recipeData } from '/SatisfiedVisual/js/data/recipes.js';
import { screenToWorld, getNodeWorldPosition } from '/SatisfiedVisual/js/utils.js';
import { renderViewport, renderConnections, renderCardSelections, renderSelectionSummary } from '/SatisfiedVisual/js/ui/render.js';
import { calculateAndRenderNetworkStatus } from '/SatisfiedVisual/js/core/calculations.js';
import { createCard, deleteCards } from '/SatisfiedVisual/js/core/card.js';
import { saveState, copySelection, cutSelection, startClipboardPaste, finalizePaste, cancelPaste } from '/SatisfiedVisual/js/core/io.js';
import { showSummaryModal, showRecipeBookModal, showImportOptionsModal, showSettingsModal } from '/SatisfiedVisual/js/ui/modals.js';

let lastMousePos = { x: 0, y: 0 };

/**
 * Initializes and attaches all necessary event listeners for the application.
 */
export function initializeEventListeners() {
    // --- Global Listeners (document/window) ---
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    // --- Canvas Listeners ---
    dom.canvas.addEventListener('mousedown', handleCanvasMouseDown);
    dom.canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
    dom.canvas.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    dom.canvas.addEventListener('drop', handleCanvasDrop);

    // --- Header & Sidebar Listeners ---
    dom.sidebarToggleBtn.addEventListener('click', () => {
        dom.sidebar.classList.toggle('collapsed');
        dom.sidebarToggleBtn.classList.toggle('collapsed');
    });
    dom.recipeBookBtn.addEventListener('click', showRecipeBookModal);
    dom.settingsBtn.addEventListener('click', showSettingsModal); // <-- FIX: Added listener
    dom.lineStyleSelect.addEventListener('change', (e) => {
        state.lineStyle = e.target.value;
        renderConnections();
    });
    dom.summaryBtn.addEventListener('click', showSummaryModal);
    dom.exportBtn.addEventListener('click', () => {
        const blueprint = saveState();
        const a = document.createElement('a');
        a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(blueprint, null, 2));
        a.download = `factory_blueprint_${Date.now()}.json`;
        a.click();
    });
    dom.importBtn.addEventListener('click', () => dom.importInput.click());
    dom.importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const blueprint = JSON.parse(event.target.result);
                showImportOptionsModal(blueprint);
            } catch (err) {
                console.error("Error parsing blueprint file:", err);
            }
        };
        reader.readAsText(file);
        dom.importInput.value = '';
    });

    window.addEventListener('dragstart', (e) => {
        if (e.target.draggable !== true) {
            e.preventDefault();
        }
    });

    // Autosave interval respects the new setting
    setInterval(() => {
        if (state.autosaveEnabled) {
            saveState(true);
        }
    }, 15000);
}

// --- Event Handler Functions ---

function handleMouseMove(e) {
    if (state.panning) {
        state.viewport.x += e.clientX - lastMousePos.x;
        state.viewport.y += e.clientY - lastMousePos.y;
        renderViewport();
    } else if (state.isSelecting) {
        const { x, y } = state.selectionBoxStart;
        const newX = Math.min(x, e.clientX);
        const newY = Math.min(y, e.clientY);
        const width = Math.abs(x - e.clientX);
        const height = Math.abs(y - e.clientY);
        dom.selectionBox.style.left = `${newX}px`;
        dom.selectionBox.style.top = `${newY}px`;
        dom.selectionBox.style.width = `${width}px`;
        dom.selectionBox.style.height = `${height}px`;
    } else if (state.dragInfo) {
        handleCardDrag(e);
    } else if (state.isDrawingConnection) {
        handleConnectionDraw(e);
    } else if (state.pastePreview) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        const snappedX = Math.round(worldPos.x / state.gridSize) * state.gridSize;
        const snappedY = Math.round(worldPos.y / state.gridSize) * state.gridSize;
        dom.pastePreviewContainer.style.transform = `translate(${state.viewport.x + snappedX * state.viewport.zoom}px, ${state.viewport.y + snappedY * state.viewport.zoom}px) scale(${state.viewport.zoom})`;
    }
    lastMousePos = { x: e.clientX, y: e.clientY };
}

function handleMouseUp(e) {
    if (state.panning) {
        state.panning = false;
        dom.canvas.style.cursor = 'default';
    }
    if (state.isSelecting) {
        handleSelectionBoxEnd(e);
    }
    if (state.dragInfo) {
        state.dragInfo.cardsToDrag.forEach(({ card }) => {
            card.element.classList.remove('no-transition');
            card.element.style.cursor = 'grab';
        });
        state.dragInfo = null;
    }
    if (state.isDrawingConnection) {
        handleConnectionEnd(e);
    }
}

function handleKeyDown(e) {
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT') return;

    if (state.pastePreview && e.key === 'Escape') {
        cancelPaste();
        return;
    }
    
    if (e.code === 'Space' && !state.panning) {
        e.preventDefault();
        dom.canvas.style.cursor = 'grab';
        state.panning = true;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace')) {
        if (state.selectedConnectionIds.size > 0) {
            state.selectedConnectionIds.forEach(connId => state.connections.delete(connId));
            state.selectedConnectionIds.clear();
            calculateAndRenderNetworkStatus();
        }
        if (state.selectedCardIds.size > 0) {
            deleteCards(new Set(state.selectedCardIds));
            state.selectedCardIds.clear();
            renderSelectionSummary();
        }
    }
    if (e.ctrlKey || e.metaKey) {
        switch(e.key.toLowerCase()) {
            case 'c': copySelection(); break;
            case 'x': cutSelection(); break;
            case 'v': startClipboardPaste(); break;
        }
    }
}

function handleKeyUp(e) {
    if (e.code === 'Space') {
        dom.canvas.style.cursor = 'default';
        state.panning = false;
    }
}

function handleCanvasMouseDown(e) {
    if (state.pastePreview) {
        finalizePaste(e);
        return;
    }
    if (e.target.closest('.placed-card')) return;
    
    if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        state.panning = true;
        dom.canvas.style.cursor = 'grabbing';
    } else if (e.target.classList.contains('connection-line')) {
        const connId = e.target.dataset.connId;
        // Logic for selecting connections
    } else if (e.button === 0) {
        if (!e.shiftKey && !e.ctrlKey) {
            state.selectedCardIds.clear();
            renderCardSelections();
            renderSelectionSummary();
        }
        state.isSelecting = true;
        dom.selectionBox.classList.remove('hidden');
        state.selectionBoxStart = { x: e.clientX, y: e.clientY };
        dom.selectionBox.style.cssText = `left: ${e.clientX}px; top: ${e.clientY}px; width: 0; height: 0;`;
    }
    renderConnections();
}

function handleCanvasWheel(e) {
    e.preventDefault();
    const rect = dom.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = 1.1;
    const oldZoom = state.viewport.zoom;
    const newZoom = e.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
    const clampedZoom = Math.max(0.1, Math.min(2, newZoom));
    
    state.viewport.x = mouseX - (mouseX - state.viewport.x) * (clampedZoom / oldZoom);
    state.viewport.y = mouseY - (mouseY - state.viewport.y) * (clampedZoom / oldZoom);
    state.viewport.zoom = clampedZoom;
    renderViewport();
}

function handleCanvasDrop(e) {
    e.preventDefault();
    let [buildingName, recipeName] = e.dataTransfer.getData('text/plain').split('|');
    let recipe;
    if (buildingName === 'Special') {
        recipe = { name: recipeName, inputs: {}, outputs: {} };
        buildingName = recipeName; // e.g., 'Alien Power Augmenter'
    } else {
        recipe = (recipeData.recipes[buildingName] || []).find(r => r.name === recipeName);
    }
    
    if (recipe) {
        const worldPos = screenToWorld(e.clientX, e.clientY);
        createCard(buildingName, recipe, worldPos.x - 180, worldPos.y);
    }
}

function handleCardDrag(e) {
    const { dragStartPos, cardsToDrag } = state.dragInfo;
    const dx = e.clientX - dragStartPos.x;
    const dy = e.clientY - dragStartPos.y;

    if (!state.dragInfo.dragThreshold && Math.sqrt(dx*dx + dy*dy) > 5) {
        state.dragInfo.dragThreshold = true;
        cardsToDrag.forEach(({ card }) => card.element.style.cursor = 'grabbing');
    }
    if (state.dragInfo.dragThreshold) {
        cardsToDrag.forEach(({ card, startX, startY }) => {
            const cardDx = dx / state.viewport.zoom;
            const cardDy = dy / state.viewport.zoom;
            const newX = startX + cardDx;
            const newY = startY + cardDy;
            
            card.x = Math.round(newX / state.gridSize) * state.gridSize;
            card.y = Math.round(newY / state.gridSize) * state.gridSize;
            card.element.style.transform = `translate(${card.x}px, ${card.y}px)`;
        });
        
        if (!state.dragInfo.isRendering) {
            state.dragInfo.isRendering = true;
            requestAnimationFrame(() => {
                renderConnections();
                if (state.dragInfo) {
                    state.dragInfo.isRendering = false;
                }
            });
        }
    }
}

function handleConnectionDraw(e) {
    let tempLine = document.getElementById('temp-connection-line');
    if(!tempLine) {
        tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempLine.id = 'temp-connection-line';
        tempLine.setAttribute('class', 'connection-line');
        tempLine.style.stroke = "var(--accent-cyan)";
        dom.svgGroup.appendChild(tempLine);
    }
    const p1 = getNodeWorldPosition(state.connectionStartNode);
    const p2 = screenToWorld(e.clientX, e.clientY);
    
    let d;
    if (state.lineStyle === 'straight') { d = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`; }
    else if (state.lineStyle === 'circuit') {
        const midX = p1.x + 30; d = `M ${p1.x} ${p1.y} H ${midX} V ${p2.y} H ${p2.x}`;
    } else {
        const dx = Math.abs(p2.x - p1.x) * 0.6;
        d = `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
    }
    tempLine.setAttribute('d', d);
}

function handleConnectionEnd(e) {
    document.getElementById('temp-connection-line')?.remove();
    const endNode = e.target;
    const startNode = state.connectionStartNode;
    
    if (endNode?.classList.contains('connector-node') && endNode !== startNode) {
        const startCardId = startNode.closest('.placed-card').id;
        const endCardId = endNode.closest('.placed-card').id;
        const startItem = startNode.dataset.itemName;
        const endItem = endNode.dataset.itemName;
        
        if (startCardId !== endCardId && startNode.dataset.type === 'output' && endNode.dataset.type === 'input' && startItem === endItem) {
            const connId = `conn-${state.nextConnectionId++}`;
            state.connections.set(connId, { from: { cardId: startCardId, itemName: startItem }, to: { cardId: endCardId, itemName: endItem }});
            calculateAndRenderNetworkStatus();
        }
    }
    state.isDrawingConnection = false;
    state.connectionStartNode = null;
}

function handleSelectionBoxEnd(e) {
    state.isSelecting = false;
    const boxRect = dom.selectionBox.getBoundingClientRect();
    dom.selectionBox.classList.add('hidden');
    if (boxRect.width > 5 || boxRect.height > 5) {
        state.placedCards.forEach(card => {
            const cardRect = card.element.getBoundingClientRect();
            if (boxRect.left < cardRect.right && boxRect.right > cardRect.left &&
                boxRect.top < cardRect.bottom && boxRect.bottom > cardRect.top) {
                state.selectedCardIds.add(card.id);
            }
        });
        renderCardSelections();
        renderSelectionSummary();
    }
}

