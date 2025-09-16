/**
 * This file (js/dom.js) caches references to all the major DOM elements
 * used throughout the application for easy and performant access.
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
    sidebar: document.getElementById('sidebar'),
    sidebarToggleBtn: document.getElementById('sidebar-toggle-btn'),
    recipeBookBtn: document.getElementById('recipe-book-btn'),
    settingsBtn: document.getElementById('settings-btn'), // <-- New Element
};

export default dom;
