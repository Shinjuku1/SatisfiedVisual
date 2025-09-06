/**
 * This file (js/dom.js) caches and exports references to all necessary DOM elements.
 * This prevents repeated queries to the DOM, which is a performance best practice.
 */

const dom = {
    canvas: document.getElementById('canvas'),
    canvasContent: document.getElementById('canvas-content'),
    pastePreviewContainer: document.getElementById('paste-preview-container'),
    canvasGrid: document.getElementById('canvas-grid'),
    connectorSvg: document.getElementById('connector-svg'),
    svgGroup: document.getElementById('svg-group'),
    library: document.getElementById('recipe-library'),
    filterInput: document.getElementById('recipe-filter'),
    totalInputs: document.getElementById('total-inputs'),
    totalOutputs: document.getElementById('total-outputs'),
    totalPower: document.getElementById('total-power'),
    importBtn: document.getElementById('import-btn'),
    exportBtn: document.getElementById('export-btn'),
    importInput: document.getElementById('import-input'),
    modalContainer: document.getElementById('modal-container'),
    toastContainer: document.getElementById('toast-container'),
    contextMenuContainer: document.getElementById('context-menu-container'),
    lineStyleSelect: document.getElementById('line-style-select'),
    summaryBtn: document.getElementById('summary-btn'),
    selectionBox: document.getElementById('selection-box'),
    selectionSummary: document.getElementById('selection-summary'),
};

export default dom;