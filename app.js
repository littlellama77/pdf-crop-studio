/**
 * CropPDF Studio — Complete Application Logic
 * High-performance client-side PDF Cropping, Snipping, and Redaction
 */

// Configure PDF.js worker
if (window.pdfjsLib) {
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
}

(function () {
  'use strict';

  // --- STATE ---
  const state = {
    pdfDoc: null,          // PDF.js document instance
    pdfBytes: null,        // Original raw Uint8Array bytes
    pdfLibDoc: null,       // PDF-lib document instance (for modifications)
    fileName: 'document.pdf',
    totalPages: 0,
    currentPage: 1,
    currentScale: 1.2,     // Base render scale
    rotation: 0,           // 0, 90, 180, 270
    activeTab: 'tabSnip',  // 'tabSnip', 'tabTrim', 'tabRedact'

    // Crop box state (normalized 0..1 coordinates relative to rendered page canvas)
    crop: {
      active: false,
      normX: 0.1,
      normY: 0.1,
      normW: 0.8,
      normH: 0.6,
      aspectRatio: null    // null for free, or numeric width/height
    },

    // Snippet settings
    clarityMultiplier: 2,  // 1x, 2x, 3x

    // Redaction cut-out boxes (stored per page: { pageNum: [ { normX, normY, normW, normH, color } ] })
    redactions: {},

    // Drag / Resize interaction state
    interaction: {
      mode: null,          // 'draw', 'move', 'resize', or null
      handle: null,        // 'nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'
      startX: 0,
      startY: 0,
      startCrop: null
    }
  };

  // --- DOM ELEMENTS ---
  const elements = {
    // Header
    docMeta: document.getElementById('docMeta'),
    fileNameDisplay: document.getElementById('fileNameDisplay'),
    filePagesBadge: document.getElementById('filePagesBadge'),
    headerPageNav: document.getElementById('headerPageNav'),
    pageNumberInput: document.getElementById('pageNumberInput'),
    pageTotalDisplay: document.getElementById('pageTotalDisplay'),
    btnPrevPage: document.getElementById('btnPrevPage'),
    btnNextPage: document.getElementById('btnNextPage'),
    btnZoomOut: document.getElementById('btnZoomOut'),
    btnZoomIn: document.getElementById('btnZoomIn'),
    zoomDisplay: document.getElementById('zoomDisplay'),
    btnFitWidth: document.getElementById('btnFitWidth'),
    btnFitPage: document.getElementById('btnFitPage'),
    btnRotateCW: document.getElementById('btnRotateCW'),
    btnTrySample: document.getElementById('btnTrySample'),
    btnTrySampleDrop: document.getElementById('btnTrySampleDrop'),
    pdfFileInput: document.getElementById('pdfFileInput'),
    pdfFileInputDrop: document.getElementById('pdfFileInputDrop'),
    btnHelp: document.getElementById('btnHelp'),
    modalHelp: document.getElementById('modalHelp'),
    btnCloseHelp: document.getElementById('btnCloseHelp'),

    // Sidebar & Viewport
    sidebarThumbnails: document.getElementById('sidebarThumbnails'),
    thumbnailsContainer: document.getElementById('thumbnailsContainer'),
    btnCollapseSidebar: document.getElementById('btnCollapseSidebar'),
    stageViewport: document.getElementById('stageViewport'),
    emptyDropzone: document.getElementById('emptyDropzone'),
    canvasWorkspace: document.getElementById('canvasWorkspace'),
    canvasStage: document.getElementById('canvasStage'),
    pdfCanvas: document.getElementById('pdfCanvas'),
    cropOverlay: document.getElementById('cropOverlay'),
    cropBox: document.getElementById('cropBox'),
    cropBadge: document.getElementById('cropBadge'),
    maskTop: document.getElementById('maskTop'),
    maskBottom: document.getElementById('maskBottom'),
    maskLeft: document.getElementById('maskLeft'),
    maskRight: document.getElementById('maskRight'),
    redactOverlaysContainer: document.getElementById('redactOverlaysContainer'),

    // Quick toolbar
    floatingCanvasBar: document.getElementById('floatingCanvasBar'),
    btnAutoDetect: document.getElementById('btnAutoDetect'),
    btnSelectAll: document.getElementById('btnSelectAll'),
    btnCenterCrop: document.getElementById('btnCenterCrop'),
    btnClearCrop: document.getElementById('btnClearCrop'),

    // Inspector Panel
    panelInspector: document.getElementById('panelInspector'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),

    // Tab 1: Snip
    previewCanvas: document.getElementById('previewCanvas'),
    noSelectionNotice: document.getElementById('noSelectionNotice'),
    snipPixelStats: document.getElementById('snipPixelStats'),
    valMetricW: document.getElementById('valMetricW'),
    valMetricH: document.getElementById('valMetricH'),
    valMetricMM: document.getElementById('valMetricMM'),
    valMetricRatio: document.getElementById('valMetricRatio'),
    ratioChips: document.querySelectorAll('.chip'),
    qualityButtons: document.querySelectorAll('.quality-btn'),
    clarityLabel: document.getElementById('clarityLabel'),
    btnCopyClipboard: document.getElementById('btnCopyClipboard'),
    btnDownloadPNG: document.getElementById('btnDownloadPNG'),
    btnDownloadJPG: document.getElementById('btnDownloadJPG'),
    btnDownloadPDFSnippet: document.getElementById('btnDownloadPDFSnippet'),

    // Tab 2: Trim
    trimScopeRadios: document.querySelectorAll('input[name="trimScope"]'),
    customRangeInputWrap: document.getElementById('customRangeInputWrap'),
    customRangeInput: document.getElementById('customRangeInput'),
    marginPaddingSlider: document.getElementById('marginPaddingSlider'),
    marginPaddingVal: document.getElementById('marginPaddingVal'),
    btnExportTrimmedPDF: document.getElementById('btnExportTrimmedPDF'),
    currentPageNumDisplays: document.querySelectorAll('.current-page-num'),

    // Tab 3: Redact
    redactColorRadios: document.querySelectorAll('input[name="redactColor"]'),
    btnAddCurrentAsCutout: document.getElementById('btnAddCurrentAsCutout'),
    redactListContainer: document.getElementById('redactListContainer'),
    noRedactHint: document.getElementById('noRedactHint'),
    btnExportCleanedPDF: document.getElementById('btnExportCleanedPDF'),

    // Toast
    toastContainer: document.getElementById('toastContainer'),

    // Nav modes & Layouts
    navBtnPdfStudio: document.getElementById('navBtnPdfStudio'),
    navBtnCvCompiler: document.getElementById('navBtnCvCompiler'),
    pdfStudioLayout: document.getElementById('pdfStudioLayout'),
    cvStudioLayout: document.getElementById('cvStudioLayout'),
    btnSendCropToCV: document.getElementById('btnSendCropToCV'),

    // CV Compiler Sidebar
    cvSlicesCountBadge: document.getElementById('cvSlicesCountBadge'),
    btnClearAllCvSlices: document.getElementById('btnClearAllCvSlices'),
    cvImageFileInput: document.getElementById('cvImageFileInput'),
    cvImageFileInputDrop: document.getElementById('cvImageFileInputDrop'),
    btnCvScreenCapture: document.getElementById('btnCvScreenCapture'),
    btnCvLoadSample: document.getElementById('btnCvLoadSample'),
    btnCvLoadSampleDrop: document.getElementById('btnCvLoadSampleDrop'),
    cvSlicesContainer: document.getElementById('cvSlicesContainer'),
    cvEmptySlicesHint: document.getElementById('cvEmptySlicesHint'),

    // CV Compiler Stage
    btnViewPaginated: document.getElementById('btnViewPaginated'),
    btnViewContinuous: document.getElementById('btnViewContinuous'),
    btnCvZoomOut: document.getElementById('btnCvZoomOut'),
    cvZoomDisplay: document.getElementById('cvZoomDisplay'),
    btnCvZoomIn: document.getElementById('btnCvZoomIn'),
    btnCvFitWidth: document.getElementById('btnCvFitWidth'),
    btnCvFitPage: document.getElementById('btnCvFitPage'),
    cvPageStatBadge: document.getElementById('cvPageStatBadge'),
    cvCanvasStageScroll: document.getElementById('cvCanvasStageScroll'),
    cvPagesWrapper: document.getElementById('cvPagesWrapper'),
    cvWelcomeCard: document.getElementById('cvWelcomeCard'),

    // CV Compiler Inspector
    cvFormatChips: document.querySelectorAll('.cv-format-chip'),
    cvMarginSlider: document.getElementById('cvMarginSlider'),
    cvMarginValDisplay: document.getElementById('cvMarginValDisplay'),
    cvGapSlider: document.getElementById('cvGapSlider'),
    cvGapValDisplay: document.getElementById('cvGapValDisplay'),
    cvAutoWhiteCheck: document.getElementById('cvAutoWhiteCheck'),
    cvWhiteThresholdWrap: document.getElementById('cvWhiteThresholdWrap'),
    cvWhiteThresholdSlider: document.getElementById('cvWhiteThresholdSlider'),
    cvWhiteThresholdDisplay: document.getElementById('cvWhiteThresholdDisplay'),
    cvEnhanceContrastCheck: document.getElementById('cvEnhanceContrastCheck'),
    btnExportCvPDF: document.getElementById('btnExportCvPDF'),
    btnExportCvPNG: document.getElementById('btnExportCvPNG'),
    btnCopyCvClipboard: document.getElementById('btnCopyCvClipboard'),
    btnPrintCv: document.getElementById('btnPrintCv'),

    // Slice Trimmer Modal
    cvTrimModal: document.getElementById('cvTrimModal'),
    btnCloseCvTrimModal: document.getElementById('btnCloseCvTrimModal'),
    cvTrimCanvas: document.getElementById('cvTrimCanvas'),
    cvTrimMaskTop: document.getElementById('cvTrimMaskTop'),
    cvTrimMaskBottom: document.getElementById('cvTrimMaskBottom'),
    cvTrimMaskLeft: document.getElementById('cvTrimMaskLeft'),
    cvTrimMaskRight: document.getElementById('cvTrimMaskRight'),
    sliderTrimTop: document.getElementById('sliderTrimTop'),
    sliderTrimBottom: document.getElementById('sliderTrimBottom'),
    sliderTrimLeft: document.getElementById('sliderTrimLeft'),
    sliderTrimRight: document.getElementById('sliderTrimRight'),
    valTrimTop: document.getElementById('valTrimTop'),
    valTrimBottom: document.getElementById('valTrimBottom'),
    valTrimLeft: document.getElementById('valTrimLeft'),
    valTrimRight: document.getElementById('valTrimRight'),
    btnCvAutoTrimSlice: document.getElementById('btnCvAutoTrimSlice'),
    btnCvResetTrim: document.getElementById('btnCvResetTrim'),
    btnCvApplyTrim: document.getElementById('btnCvApplyTrim'),

    // Screen Capture Modal
    cvCaptureModal: document.getElementById('cvCaptureModal'),
    btnCloseCvCaptureModal: document.getElementById('btnCloseCvCaptureModal'),
    btnCancelCvCapture: document.getElementById('btnCancelCvCapture'),
    btnConfirmCvCapture: document.getElementById('btnConfirmCvCapture'),
    cvCaptureStage: document.getElementById('cvCaptureStage'),
    cvCaptureCanvas: document.getElementById('cvCaptureCanvas'),
    cvCaptureCropBox: document.getElementById('cvCaptureCropBox'),
    cvCaptureCropBadge: document.getElementById('cvCaptureCropBadge')
  };

  // --- INITIALIZATION ---
  function init() {
    setupEventListeners();
    setupDropzone();
    setupKeyboardShortcuts();
    setupCropInteractions();
    setupCvCompiler();
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else {
      iconSvg = `<svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }

    toast.innerHTML = `${iconSvg}<span>${message}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // File inputs
    elements.pdfFileInput.addEventListener('change', handleFileInput);
    elements.pdfFileInputDrop.addEventListener('change', handleFileInput);

    // Sample buttons
    elements.btnTrySample.addEventListener('click', loadSamplePDF);
    elements.btnTrySampleDrop.addEventListener('click', loadSamplePDF);

    // Page navigation
    elements.btnPrevPage.addEventListener('click', () => changePage(state.currentPage - 1));
    elements.btnNextPage.addEventListener('click', () => changePage(state.currentPage + 1));
    elements.pageNumberInput.addEventListener('change', (e) => {
      const page = parseInt(e.target.value, 10);
      if (page >= 1 && page <= state.totalPages) changePage(page);
      else e.target.value = state.currentPage;
    });

    // Zoom & View
    elements.btnZoomIn.addEventListener('click', () => setZoom(state.currentScale * 1.25));
    elements.btnZoomOut.addEventListener('click', () => setZoom(state.currentScale / 1.25));
    elements.zoomDisplay.addEventListener('click', () => setZoom(1.0));
    elements.btnFitWidth.addEventListener('click', fitToWidth);
    elements.btnFitPage.addEventListener('click', fitToPage);
    elements.btnRotateCW.addEventListener('click', rotatePage);

    // Sidebar collapse
    elements.btnCollapseSidebar.addEventListener('click', toggleSidebar);

    // Help Modal
    elements.btnHelp.addEventListener('click', () => elements.modalHelp.style.display = 'flex');
    elements.btnCloseHelp.addEventListener('click', () => elements.modalHelp.style.display = 'none');
    elements.modalHelp.addEventListener('click', (e) => {
      if (e.target === elements.modalHelp) elements.modalHelp.style.display = 'none';
    });

    // Tabs
    elements.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Aspect Ratio chips
    elements.ratioChips.forEach(chip => {
      chip.addEventListener('click', () => {
        elements.ratioChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const ratio = chip.dataset.ratio;
        if (ratio === 'free') {
          state.crop.aspectRatio = null;
        } else {
          const parts = ratio.split(':').map(Number);
          state.crop.aspectRatio = parts.length === 2 ? parts[0] / parts[1] : parseFloat(ratio);
        }
        if (state.crop.active) {
          enforceAspectRatio();
          updateCropBoxUI();
          updateSnippetPreview();
        }
      });
    });

    // Clarity buttons
    elements.qualityButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.qualityButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.clarityMultiplier = parseInt(btn.dataset.scale, 10);
        elements.clarityLabel.textContent = `${state.clarityMultiplier}x (${state.clarityMultiplier === 1 ? 'Standard' : state.clarityMultiplier === 2 ? 'High Res' : 'Ultra Sharp'})`;
        updateSnippetPreview();
      });
    });

    // Floating toolbar actions
    elements.btnAutoDetect.addEventListener('click', autoDetectContentBounds);
    elements.btnSelectAll.addEventListener('click', selectAllPage);
    elements.btnCenterCrop.addEventListener('click', centerCropBox);
    elements.btnClearCrop.addEventListener('click', clearCropBox);

    // Export Actions - Snip Tab
    elements.btnCopyClipboard.addEventListener('click', copySnippetToClipboard);
    elements.btnDownloadPNG.addEventListener('click', () => downloadSnippetImage('png'));
    elements.btnDownloadJPG.addEventListener('click', () => downloadSnippetImage('jpeg'));
    elements.btnDownloadPDFSnippet.addEventListener('click', downloadSnippetPDF);

    // Export Actions - Trim Tab
    elements.trimScopeRadios.forEach(r => {
      r.addEventListener('change', (e) => {
        elements.customRangeInputWrap.style.display = e.target.value === 'custom' ? 'block' : 'none';
      });
    });
    elements.marginPaddingSlider.addEventListener('input', (e) => {
      elements.marginPaddingVal.textContent = `${e.target.value} mm`;
    });
    elements.btnExportTrimmedPDF.addEventListener('click', exportTrimmedPDF);

    // Export Actions - Redact Tab
    elements.btnAddCurrentAsCutout.addEventListener('click', addCurrentAsCutout);
    elements.btnExportCleanedPDF.addEventListener('click', exportCleanedPDF);
  }

  // --- DROPZONE SETUP ---
  function setupDropzone() {
    const dz = elements.stageViewport;
    ['dragenter', 'dragover'].forEach(name => {
      dz.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.emptyDropzone.querySelector('.dropzone-card')?.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(name => {
      dz.addEventListener(name, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.emptyDropzone.querySelector('.dropzone-card')?.classList.remove('dragover');
      });
    });

    dz.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0 && files[0].type === 'application/pdf') {
        loadPDFFromFile(files[0]);
      } else {
        showToast('Please drop a valid PDF file.', 'info');
      }
    });
  }

  // --- KEYBOARD SHORTCUTS ---
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Don't trigger if focus is on an input
      if (['INPUT', 'TEXTAREA'].includes(document.target?.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (state.crop.active) {
          e.preventDefault();
          copySnippetToClipboard();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.crop.active) {
          e.preventDefault();
          clearCropBox();
        }
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        setZoom(state.currentScale * 1.25);
      } else if (e.key === '-') {
        e.preventDefault();
        setZoom(state.currentScale / 1.25);
      } else if (e.key === 'ArrowLeft') {
        if (state.currentPage > 1) changePage(state.currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        if (state.currentPage < state.totalPages) changePage(state.currentPage + 1);
      } else if (e.key === 'Escape') {
        if (elements.modalHelp.style.display !== 'none') {
          elements.modalHelp.style.display = 'none';
        } else {
          clearCropBox();
        }
      }
    });
  }

  // --- FILE HANDLING ---
  function handleFileInput(e) {
    const file = e.target.files?.[0];
    if (file) loadPDFFromFile(file);
    e.target.value = ''; // Reset input
  }

  async function loadPDFFromFile(file) {
    try {
      showToast('Loading document...', 'info');
      const arrayBuffer = await file.arrayBuffer();
      state.fileName = file.name;
      await processLoadedPDF(new Uint8Array(arrayBuffer));
      showToast(`Loaded "${file.name}"`, 'success');
    } catch (err) {
      console.error('Error loading PDF file:', err);
      showToast('Failed to load PDF file. Is it password protected?', 'info');
    }
  }

  async function processLoadedPDF(bytes) {
    state.pdfBytes = bytes;
    
    // Load with PDF.js
    const loadingTask = window.pdfjsLib.getDocument({ data: bytes.slice() });
    state.pdfDoc = await loadingTask.promise;
    state.totalPages = state.pdfDoc.numPages;
    state.currentPage = 1;
    state.rotation = 0;
    state.redactions = {};

    // Update UI elements
    elements.fileNameDisplay.textContent = state.fileName;
    elements.filePagesBadge.textContent = `${state.totalPages} page${state.totalPages > 1 ? 's' : ''}`;
    elements.pageTotalDisplay.textContent = state.totalPages;
    elements.pageNumberInput.max = state.totalPages;
    elements.pageNumberInput.value = 1;
    elements.currentPageNumDisplays.forEach(el => el.textContent = '1');

    elements.docMeta.style.display = 'flex';
    elements.headerPageNav.style.display = 'flex';
    elements.sidebarThumbnails.style.display = 'flex';
    elements.emptyDropzone.style.display = 'none';
    elements.canvasWorkspace.style.display = 'flex';
    elements.panelInspector.style.display = 'flex';

    // Render initial page
    await renderPage(state.currentPage);
    renderThumbnails();

    // Default crop box (centered 70% width, 50% height)
    setDefaultCropBox();
  }

  // --- SAMPLE PDF GENERATOR ---
  async function loadSamplePDF() {
    try {
      showToast('Generating sample document...', 'info');
      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();
      
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // --- PAGE 1: Executive Invoice & Receipt ---
      const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
      const { width: p1W, height: p1H } = page1.getSize();

      // Top colored banner
      page1.drawRectangle({
        x: 0,
        y: p1H - 90,
        width: p1W,
        height: 90,
        color: rgb(0.06, 0.08, 0.14)
      });

      page1.drawText('NEXUS ENTERPRISES LLC', {
        x: 45,
        y: p1H - 52,
        size: 22,
        font: fontBold,
        color: rgb(1, 1, 1)
      });
      page1.drawText('OFFICIAL COMMERCIAL INVOICE & DISPATCH NOTE', {
        x: 45,
        y: p1H - 72,
        size: 10,
        font: fontRegular,
        color: rgb(0.5, 0.6, 0.8)
      });

      // Invoice info badges
      page1.drawText('INVOICE NO: #INV-2026-8942', {
        x: 45,
        y: p1H - 130,
        size: 12,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1)
      });
      page1.drawText('ISSUED DATE: October 6, 2026', {
        x: 45,
        y: p1H - 148,
        size: 10,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3)
      });
      page1.drawText('DUE DATE: Upon Receipt', {
        x: 45,
        y: p1H - 164,
        size: 10,
        font: fontRegular,
        color: rgb(0.3, 0.3, 0.3)
      });

      // Table Box
      page1.drawRectangle({
        x: 45,
        y: p1H - 320,
        width: p1W - 90,
        height: 130,
        color: rgb(0.96, 0.97, 0.99),
        borderColor: rgb(0.85, 0.88, 0.93),
        borderWidth: 1
      });

      // Table header
      page1.drawRectangle({
        x: 45,
        y: p1H - 220,
        width: p1W - 90,
        height: 30,
        color: rgb(0.39, 0.4, 0.95)
      });
      page1.drawText('ITEM DESCRIPTION', { x: 60, y: p1H - 202, size: 9, font: fontBold, color: rgb(1, 1, 1) });
      page1.drawText('QTY', { x: 320, y: p1H - 202, size: 9, font: fontBold, color: rgb(1, 1, 1) });
      page1.drawText('RATE', { x: 390, y: p1H - 202, size: 9, font: fontBold, color: rgb(1, 1, 1) });
      page1.drawText('AMOUNT (USD)', { x: 450, y: p1H - 202, size: 9, font: fontBold, color: rgb(1, 1, 1) });

      // Row 1
      page1.drawText('Enterprise Cloud Architecture Audit', { x: 60, y: p1H - 245, size: 10, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      page1.drawText('1', { x: 325, y: p1H - 245, size: 10, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      page1.drawText('$4,500.00', { x: 385, y: p1H - 245, size: 10, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      page1.drawText('$4,500.00', { x: 460, y: p1H - 245, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

      // Row 2
      page1.drawText('Automated Vector Pipeline Deployment', { x: 60, y: p1H - 275, size: 10, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      page1.drawText('4', { x: 325, y: p1H - 275, size: 10, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      page1.drawText('$1,200.00', { x: 385, y: p1H - 275, size: 10, font: fontRegular, color: rgb(0.1, 0.1, 0.1) });
      page1.drawText('$4,800.00', { x: 460, y: p1H - 275, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });

      // Total Box
      page1.drawRectangle({
        x: p1W - 240,
        y: p1H - 400,
        width: 195,
        height: 60,
        color: rgb(0.93, 0.98, 0.95),
        borderColor: rgb(0.2, 0.7, 0.4),
        borderWidth: 1.5
      });
      page1.drawText('TOTAL BALANCE DUE:', { x: p1W - 225, y: p1H - 365, size: 9, font: fontBold, color: rgb(0.1, 0.5, 0.25) });
      page1.drawText('$9,300.00 USD', { x: p1W - 225, y: p1H - 388, size: 16, font: fontBold, color: rgb(0.05, 0.45, 0.2) });

      // Mock Barcode for snipping testing
      page1.drawRectangle({ x: 45, y: 80, width: 220, height: 40, color: rgb(0.1, 0.1, 0.1) });
      for (let i = 0; i < 28; i++) {
        if (i % 3 === 0) {
          page1.drawRectangle({ x: 50 + i * 7.5, y: 80, width: 3, height: 40, color: rgb(1, 1, 1) });
        }
      }
      page1.drawText('* 2026-NEXUS-VERIFIED *', { x: 80, y: 65, size: 8, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

      // --- PAGE 2: Analytics & Chart Report ---
      const page2 = pdfDoc.addPage([595.28, 841.89]);
      const { width: p2W, height: p2H } = page2.getSize();

      page2.drawText('ANNUAL PERFORMANCE ANALYTICS', {
        x: 45,
        y: p2H - 60,
        size: 18,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.2)
      });
      page2.drawText('Key Performance Indicators & Growth Projection Charts', {
        x: 45,
        y: p2H - 80,
        size: 10,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4)
      });

      // Draw Mock Bar Chart
      page2.drawRectangle({
        x: 45,
        y: p2H - 330,
        width: p2W - 90,
        height: 220,
        color: rgb(0.98, 0.98, 1),
        borderColor: rgb(0.85, 0.85, 0.95),
        borderWidth: 1
      });
      page2.drawText('MONTHLY REVENUE EXPANSION (Q1 - Q4)', {
        x: 60,
        y: p2H - 135,
        size: 11,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.4)
      });

      // Chart bars
      const bars = [
        { label: 'JAN', height: 70, val: '$42k' },
        { label: 'MAR', height: 95, val: '$61k' },
        { label: 'MAY', height: 120, val: '$88k' },
        { label: 'JUL', height: 145, val: '$110k' },
        { label: 'SEP', height: 165, val: '$135k' },
        { label: 'NOV', height: 180, val: '$152k' }
      ];
      bars.forEach((b, idx) => {
        const bx = 85 + idx * 70;
        page2.drawRectangle({
          x: bx,
          y: p2H - 310,
          width: 38,
          height: b.height,
          color: rgb(0.39, 0.4, 0.95)
        });
        page2.drawText(b.label, { x: bx + 8, y: p2H - 325, size: 8, font: fontBold, color: rgb(0.4, 0.4, 0.5) });
        page2.drawText(b.val, { x: bx + 5, y: p2H - 305 + b.height, size: 8, font: fontRegular, color: rgb(0.2, 0.2, 0.4) });
      });

      // Stamp Box (Great for Testing Cut Out / Redact!)
      page2.drawRectangle({
        x: 45,
        y: p2H - 460,
        width: 170,
        height: 70,
        color: rgb(1, 0.95, 0.95),
        borderColor: rgb(0.9, 0.2, 0.2),
        borderWidth: 2
      });
      page2.drawText('STRICTLY CONFIDENTIAL', { x: 55, y: p2H - 425, size: 10, font: fontBold, color: rgb(0.85, 0.1, 0.1) });
      page2.drawText('DO NOT DISTRIBUTE - INTERNAL ONLY', { x: 55, y: p2H - 445, size: 7, font: fontRegular, color: rgb(0.7, 0.2, 0.2) });

      // Save and process
      const samplePdfBytes = await pdfDoc.save();
      state.fileName = 'Sample_Business_Report.pdf';
      await processLoadedPDF(samplePdfBytes);
      showToast('Sample PDF loaded successfully!', 'success');
    } catch (err) {
      console.error('Error generating sample PDF:', err);
      showToast('Error generating sample PDF', 'info');
    }
  }

  // --- RENDERING PAGE ---
  async function renderPage(pageNum) {
    if (!state.pdfDoc) return;
    state.currentPage = pageNum;

    elements.pageNumberInput.value = pageNum;
    elements.btnPrevPage.disabled = pageNum <= 1;
    elements.btnNextPage.disabled = pageNum >= state.totalPages;
    elements.currentPageNumDisplays.forEach(el => el.textContent = pageNum.toString());

    // Update active thumbnail card
    const thumbs = elements.thumbnailsContainer.querySelectorAll('.thumb-card');
    thumbs.forEach(t => {
      t.classList.toggle('active', parseInt(t.dataset.page, 10) === pageNum);
    });

    const page = await state.pdfDoc.getPage(pageNum);
    const rotation = (page.rotate + state.rotation) % 360;
    const viewport = page.getViewport({ scale: state.currentScale, rotation });

    const canvas = elements.pdfCanvas;
    const ctx = canvas.getContext('2d');

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    // Match overlay dimensions
    elements.canvasStage.style.width = `${viewport.width}px`;
    elements.canvasStage.style.height = `${viewport.height}px`;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    // Refresh crop box UI and preview
    updateCropBoxUI();
    updateSnippetPreview();
    renderRedactionOverlays();
  }

  // --- THUMBNAILS GENERATION ---
  async function renderThumbnails() {
    if (!state.pdfDoc) return;
    elements.thumbnailsContainer.innerHTML = '';

    for (let i = 1; i <= state.totalPages; i++) {
      const card = document.createElement('div');
      card.className = `thumb-card ${i === state.currentPage ? 'active' : ''}`;
      card.dataset.page = i;

      const canvas = document.createElement('canvas');
      canvas.className = 'thumb-canvas';

      const label = document.createElement('span');
      label.className = 'thumb-label';
      label.textContent = `Page ${i}`;

      card.appendChild(canvas);
      card.appendChild(label);
      card.addEventListener('click', () => changePage(i));
      elements.thumbnailsContainer.appendChild(card);

      // Render thumbnail in background
      (async (pNum, cvs) => {
        try {
          const p = await state.pdfDoc.getPage(pNum);
          const vp = p.getViewport({ scale: 0.25 });
          cvs.width = vp.width;
          cvs.height = vp.height;
          const ctx = cvs.getContext('2d');
          await p.render({ canvasContext: ctx, viewport: vp }).promise;
        } catch (e) {
          console.warn('Thumb render error:', e);
        }
      })(i, canvas);
    }
  }

  function changePage(pageNum) {
    if (pageNum < 1 || pageNum > state.totalPages || pageNum === state.currentPage) return;
    renderPage(pageNum);
  }

  function setZoom(newScale) {
    newScale = Math.max(0.4, Math.min(3.5, newScale));
    state.currentScale = newScale;
    elements.zoomDisplay.textContent = `${Math.round(newScale * 100)}%`;
    renderPage(state.currentPage);
  }

  function fitToWidth() {
    if (!elements.pdfCanvas) return;
    const availableWidth = elements.stageViewport.clientWidth - 120;
    const currentW = elements.pdfCanvas.width / state.currentScale;
    if (currentW > 0) {
      setZoom(availableWidth / currentW);
    }
  }

  function fitToPage() {
    if (!elements.pdfCanvas) return;
    const availableHeight = elements.stageViewport.clientHeight - 120;
    const currentH = elements.pdfCanvas.height / state.currentScale;
    if (currentH > 0) {
      setZoom(availableHeight / currentH);
    }
  }

  function rotatePage() {
    state.rotation = (state.rotation + 90) % 360;
    renderPage(state.currentPage);
  }

  function toggleSidebar() {
    const isHidden = elements.sidebarThumbnails.style.display === 'none';
    elements.sidebarThumbnails.style.display = isHidden ? 'flex' : 'none';
  }

  // --- CROP BOX LOGIC & UI ---
  function setDefaultCropBox() {
    state.crop.active = true;
    state.crop.normX = 0.12;
    state.crop.normY = 0.12;
    state.crop.normW = 0.76;
    state.crop.normH = 0.55;
    updateCropBoxUI();
    updateSnippetPreview();
  }

  function selectAllPage() {
    state.crop.active = true;
    state.crop.normX = 0;
    state.crop.normY = 0;
    state.crop.normW = 1;
    state.crop.normH = 1;
    updateCropBoxUI();
    updateSnippetPreview();
    showToast('Selected full page area', 'info');
  }

  function centerCropBox() {
    if (!state.crop.active) setDefaultCropBox();
    const w = state.crop.normW;
    const h = state.crop.normH;
    state.crop.normX = Math.max(0, (1 - w) / 2);
    state.crop.normY = Math.max(0, (1 - h) / 2);
    updateCropBoxUI();
    updateSnippetPreview();
  }

  function clearCropBox() {
    state.crop.active = false;
    updateCropBoxUI();
    updateSnippetPreview();
    showToast('Selection cleared', 'info');
  }

  function updateCropBoxUI() {
    const canvas = elements.pdfCanvas;
    const overlay = elements.cropOverlay;
    if (!canvas || !overlay) return;

    const cW = canvas.width;
    const cH = canvas.height;

    if (!state.crop.active) {
      elements.cropBox.style.display = 'none';
      elements.maskTop.style.display = 'none';
      elements.maskBottom.style.display = 'none';
      elements.maskLeft.style.display = 'none';
      elements.maskRight.style.display = 'none';
      setExportButtonsEnabled(false);
      return;
    }

    elements.cropBox.style.display = 'block';
    elements.maskTop.style.display = 'block';
    elements.maskBottom.style.display = 'block';
    elements.maskLeft.style.display = 'block';
    elements.maskRight.style.display = 'block';
    setExportButtonsEnabled(true);

    const left = state.crop.normX * cW;
    const top = state.crop.normY * cH;
    const width = state.crop.normW * cW;
    const height = state.crop.normH * cH;

    // Position crop box
    elements.cropBox.style.left = `${left}px`;
    elements.cropBox.style.top = `${top}px`;
    elements.cropBox.style.width = `${width}px`;
    elements.cropBox.style.height = `${height}px`;

    // Position surrounding dim masks
    elements.maskTop.style.top = '0px';
    elements.maskTop.style.left = '0px';
    elements.maskTop.style.width = '100%';
    elements.maskTop.style.height = `${top}px`;

    elements.maskBottom.style.top = `${top + height}px`;
    elements.maskBottom.style.left = '0px';
    elements.maskBottom.style.width = '100%';
    elements.maskBottom.style.height = `${Math.max(0, cH - (top + height))}px`;

    elements.maskLeft.style.top = `${top}px`;
    elements.maskLeft.style.left = '0px';
    elements.maskLeft.style.width = `${left}px`;
    elements.maskLeft.style.height = `${height}px`;

    elements.maskRight.style.top = `${top}px`;
    elements.maskRight.style.left = `${left + width}px`;
    elements.maskRight.style.width = `${Math.max(0, cW - (left + width))}px`;
    elements.maskRight.style.height = `${height}px`;

    // Calculate dimensions
    const pxW = Math.round(width / state.currentScale);
    const pxH = Math.round(height / state.currentScale);
    const mmW = Math.round((pxW / 72) * 25.4);
    const mmH = Math.round((pxH / 72) * 25.4);
    const ratioStr = (pxW / pxH).toFixed(2);

    elements.cropBadge.textContent = `${pxW} × ${pxH} px`;
    elements.snipPixelStats.textContent = `${pxW} × ${pxH} px`;
    elements.valMetricW.textContent = `${pxW} px`;
    elements.valMetricH.textContent = `${pxH} px`;
    elements.valMetricMM.textContent = `${mmW} × ${mmH} mm`;
    elements.valMetricRatio.textContent = ratioStr;
  }

  function setExportButtonsEnabled(enabled) {
    elements.btnCopyClipboard.disabled = !enabled;
    elements.btnDownloadPNG.disabled = !enabled;
    elements.btnDownloadJPG.disabled = !enabled;
    elements.btnDownloadPDFSnippet.disabled = !enabled;
    if (elements.btnSendCropToCV) elements.btnSendCropToCV.disabled = !enabled;
    elements.btnExportTrimmedPDF.disabled = !enabled;
    elements.btnAddCurrentAsCutout.disabled = !enabled;
  }

  // --- SNIPPET PREVIEW UPDATE ---
  function updateSnippetPreview() {
    const canvas = elements.pdfCanvas;
    const preview = elements.previewCanvas;
    if (!canvas || !preview) return;

    if (!state.crop.active) {
      elements.noSelectionNotice.style.display = 'flex';
      preview.style.display = 'none';
      return;
    }

    elements.noSelectionNotice.style.display = 'none';
    preview.style.display = 'block';

    const cW = canvas.width;
    const cH = canvas.height;
    const sx = Math.floor(state.crop.normX * cW);
    const sy = Math.floor(state.crop.normY * cH);
    const sw = Math.max(1, Math.floor(state.crop.normW * cW));
    const sh = Math.max(1, Math.floor(state.crop.normH * cH));

    preview.width = sw;
    preview.height = sh;
    const ctx = preview.getContext('2d');
    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
  }

  // --- AUTO-DETECT CONTENT MARGINS (MAGIC CROP) ---
  function autoDetectContentBounds() {
    const canvas = elements.pdfCanvas;
    if (!canvas) return;

    showToast('Analyzing content bounds...', 'info');
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx.getImageData(0, 0, w, h).data;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let foundContent = false;

    // Scan pixels with step to maintain fast response
    const step = 2;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = (y * w + x) * 4;
        const r = imgData[idx];
        const g = imgData[idx + 1];
        const b = imgData[idx + 2];
        const a = imgData[idx + 3];

        // If not transparent and not near-white
        if (a > 30 && (r < 242 || g < 242 || b < 242)) {
          foundContent = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!foundContent) {
      showToast('No high-contrast content detected; keeping current crop.', 'info');
      return;
    }

    // Add 16px padding
    const pad = 16;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w, maxX + pad);
    maxY = Math.min(h, maxY + pad);

    state.crop.active = true;
    state.crop.normX = minX / w;
    state.crop.normY = minY / h;
    state.crop.normW = (maxX - minX) / w;
    state.crop.normH = (maxY - minY) / h;

    updateCropBoxUI();
    updateSnippetPreview();
    showToast('Magic Auto-Crop snapped to content!', 'success');
  }

  // --- MOUSE & TOUCH INTERACTIONS ---
  function setupCropInteractions() {
    const overlay = elements.cropOverlay;
    const box = elements.cropBox;

    // Overlay mousedown: start drawing or moving
    overlay.addEventListener('mousedown', (e) => {
      if (!state.pdfDoc) return;
      if (e.button !== 0) return; // Left click only

      const rect = overlay.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Handle resize handle click
      const handleEl = e.target.closest('.handle');
      if (handleEl) {
        e.stopPropagation();
        state.interaction.mode = 'resize';
        state.interaction.handle = handleEl.dataset.handle;
        state.interaction.startX = clickX;
        state.interaction.startY = clickY;
        state.interaction.startCrop = { ...state.crop };
        return;
      }

      // Handle dragging inside existing crop box
      const isInsideCrop = e.target.closest('#cropBox');
      if (isInsideCrop && state.crop.active) {
        e.stopPropagation();
        state.interaction.mode = 'move';
        state.interaction.startX = clickX;
        state.interaction.startY = clickY;
        state.interaction.startCrop = { ...state.crop };
        return;
      }

      // Otherwise: Start drawing a new crop box
      state.interaction.mode = 'draw';
      state.interaction.startX = clickX;
      state.interaction.startY = clickY;

      state.crop.active = true;
      state.crop.normX = Math.max(0, Math.min(1, clickX / overlay.clientWidth));
      state.crop.normY = Math.max(0, Math.min(1, clickY / overlay.clientHeight));
      state.crop.normW = 0.005;
      state.crop.normH = 0.005;

      state.interaction.startCrop = { ...state.crop };
      updateCropBoxUI();
    });

    window.addEventListener('mousemove', (e) => {
      if (!state.interaction.mode) return;
      e.preventDefault();

      const rect = overlay.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const currentY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const dx = (currentX - state.interaction.startX) / rect.width;
      const dy = (currentY - state.interaction.startY) / rect.height;
      const start = state.interaction.startCrop;

      if (state.interaction.mode === 'move') {
        let nx = start.normX + dx;
        let ny = start.normY + dy;
        // Clamp bounds
        nx = Math.max(0, Math.min(1 - start.normW, nx));
        ny = Math.max(0, Math.min(1 - start.normH, ny));
        state.crop.normX = nx;
        state.crop.normY = ny;
      } else if (state.interaction.mode === 'draw') {
        const startNormX = start.normX;
        const startNormY = start.normY;
        const curNormX = currentX / rect.width;
        const curNormY = currentY / rect.height;

        let left = Math.min(startNormX, curNormX);
        let top = Math.min(startNormY, curNormY);
        let width = Math.abs(curNormX - startNormX);
        let height = Math.abs(curNormY - startNormY);

        if (state.crop.aspectRatio) {
          const pixelRatioTarget = state.crop.aspectRatio * (rect.height / rect.width);
          width = height * pixelRatioTarget;
          if (left + width > 1) {
            width = 1 - left;
            height = width / pixelRatioTarget;
          }
        }

        state.crop.normX = left;
        state.crop.normY = top;
        state.crop.normW = Math.max(0.01, width);
        state.crop.normH = Math.max(0.01, height);
      } else if (state.interaction.mode === 'resize') {
        resizeWithHandle(state.interaction.handle, dx, dy, start, rect.width, rect.height);
      }

      updateCropBoxUI();
      updateSnippetPreview();
    });

    window.addEventListener('mouseup', () => {
      if (state.interaction.mode) {
        state.interaction.mode = null;
        state.interaction.handle = null;
        updateCropBoxUI();
        updateSnippetPreview();
      }
    });
  }

  function resizeWithHandle(handle, dx, dy, start, rW, rH) {
    let nx = start.normX;
    let ny = start.normY;
    let nw = start.normW;
    let nh = start.normH;

    if (handle.includes('e')) nw = Math.max(0.01, Math.min(1 - nx, start.normW + dx));
    if (handle.includes('s')) nh = Math.max(0.01, Math.min(1 - ny, start.normH + dy));
    if (handle.includes('w')) {
      const right = start.normX + start.normW;
      nx = Math.max(0, Math.min(right - 0.01, start.normX + dx));
      nw = right - nx;
    }
    if (handle.includes('n')) {
      const bottom = start.normY + start.normH;
      ny = Math.max(0, Math.min(bottom - 0.01, start.normY + dy));
      nh = bottom - ny;
    }

    if (state.crop.aspectRatio) {
      const pageRatioAdjustment = (rH / rW);
      const targetNormRatio = state.crop.aspectRatio * pageRatioAdjustment;
      nw = nh * targetNormRatio;
      if (nx + nw > 1) {
        nw = 1 - nx;
        nh = nw / targetNormRatio;
      }
    }

    state.crop.normX = nx;
    state.crop.normY = ny;
    state.crop.normW = nw;
    state.crop.normH = nh;
  }

  function enforceAspectRatio() {
    if (!state.crop.aspectRatio || !elements.pdfCanvas) return;
    const cW = elements.pdfCanvas.width;
    const cH = elements.pdfCanvas.height;
    const pageRatioAdjustment = (cH / cW);
    const targetNormRatio = state.crop.aspectRatio * pageRatioAdjustment;

    let nw = state.crop.normH * targetNormRatio;
    let nh = state.crop.normH;

    if (state.crop.normX + nw > 1) {
      nw = 1 - state.crop.normX;
      nh = nw / targetNormRatio;
    }

    state.crop.normW = nw;
    state.crop.normH = nh;
  }

  // --- TAB SWITCHING ---
  function switchTab(tabId) {
    state.activeTab = tabId;
    elements.tabButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabId));
    elements.tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === tabId));
  }

  // --- EXPORT 1: COPY TO CLIPBOARD ---
  async function copySnippetToClipboard() {
    if (!state.crop.active || !elements.pdfCanvas) return;

    try {
      showToast('Rendering high-res snippet...', 'info');
      const blob = await renderSnippetBlob('png', state.clarityMultiplier);
      if (!blob) throw new Error('Blob creation failed');

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        showToast('Copied image to clipboard!', 'success');
      } else {
        // Fallback: download if clipboard API is not permitted
        downloadSnippetImage('png');
        showToast('Downloaded snippet image', 'success');
      }
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      showToast('Clipboard permission blocked. Downloading image instead...', 'info');
      downloadSnippetImage('png');
    }
  }

  // --- EXPORT 2: DOWNLOAD IMAGE (PNG/JPG) ---
  async function downloadSnippetImage(format = 'png') {
    if (!state.crop.active || !elements.pdfCanvas) return;

    try {
      showToast(`Generating ${format.toUpperCase()}...`, 'info');
      const blob = await renderSnippetBlob(format, state.clarityMultiplier);
      if (!blob) throw new Error('Render failed');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      a.href = url;
      a.download = `${baseName}_crop_p${state.currentPage}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Saved ${format.toUpperCase()} image!`, 'success');
    } catch (err) {
      console.error('Download error:', err);
      showToast('Failed to save image', 'info');
    }
  }

  // Helper to re-render the page at high DPI for pristine snippet export
  async function renderSnippetBlob(format = 'png', scaleMult = 2) {
    const page = await state.pdfDoc.getPage(state.currentPage);
    const rotation = (page.rotate + state.rotation) % 360;
    
    // High DPI viewport
    const highScale = state.currentScale * scaleMult;
    const viewport = page.getViewport({ scale: highScale, rotation });

    const offscreen = document.createElement('canvas');
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;
    const ctx = offscreen.getContext('2d');

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    // Crop box coordinates on the high-res canvas
    const sx = Math.floor(state.crop.normX * viewport.width);
    const sy = Math.floor(state.crop.normY * viewport.height);
    const sw = Math.floor(state.crop.normW * viewport.width);
    const sh = Math.floor(state.crop.normH * viewport.height);

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = sw;
    croppedCanvas.height = sh;
    const cropCtx = croppedCanvas.getContext('2d');

    // Fill white if JPEG
    if (format === 'jpeg') {
      cropCtx.fillStyle = '#ffffff';
      cropCtx.fillRect(0, 0, sw, sh);
    }

    cropCtx.drawImage(offscreen, sx, sy, sw, sh, 0, 0, sw, sh);

    return new Promise((resolve) => {
      const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      croppedCanvas.toBlob(resolve, mime, 0.95);
    });
  }

  // --- EXPORT 3: VECTOR PDF SNIPPET ---
  async function downloadSnippetPDF() {
    if (!state.crop.active || !state.pdfBytes) return;

    try {
      showToast('Generating vector PDF snippet...', 'info');
      const { PDFDocument } = window.PDFLib;
      const srcDoc = await PDFDocument.load(state.pdfBytes);
      const newDoc = await PDFDocument.create();

      const srcPage = srcDoc.getPage(state.currentPage - 1);
      const { width: pW, height: pH } = srcPage.getSize();

      // Convert normalized canvas coordinates to PDF point coordinates
      // Note: PDF origin (0, 0) is at bottom-left!
      const pdfW = state.crop.normW * pW;
      const pdfH = state.crop.normH * pH;
      const pdfX = state.crop.normX * pW;
      const pdfY = (1 - (state.crop.normY + state.crop.normH)) * pH;

      // Embed page into new document
      const [embeddedPage] = await newDoc.embedPages([srcPage]);
      const newPage = newDoc.addPage([pdfW, pdfH]);

      newPage.drawPage(embeddedPage, {
        x: -pdfX,
        y: -pdfY,
        width: pW,
        height: pH
      });

      const pdfDataUri = await newDoc.save();
      const blob = new Blob([pdfDataUri], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      a.href = url;
      a.download = `${baseName}_snippet_p${state.currentPage}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Vector PDF snippet downloaded!', 'success');
    } catch (err) {
      console.error('PDF snippet error:', err);
      showToast('Failed to export PDF snippet', 'info');
    }
  }

  // --- EXPORT 4: LOSSLESS TRIMMED PDF DOCUMENT ---
  async function exportTrimmedPDF() {
    if (!state.crop.active || !state.pdfBytes) return;

    try {
      showToast('Trimming document pages losslessly...', 'info');
      const { PDFDocument } = window.PDFLib;
      const doc = await PDFDocument.load(state.pdfBytes);
      const total = doc.getPageCount();

      // Determine which pages to trim
      const scopeRadio = document.querySelector('input[name="trimScope"]:checked')?.value || 'current';
      let targetPages = [];

      if (scopeRadio === 'current') {
        targetPages = [state.currentPage - 1];
      } else if (scopeRadio === 'all') {
        targetPages = Array.from({ length: total }, (_, i) => i);
      } else if (scopeRadio === 'custom') {
        const rawRange = elements.customRangeInput.value.trim();
        targetPages = parsePageRange(rawRange, total);
        if (targetPages.length === 0) {
          showToast('Invalid custom page range. Example: 1-3, 5', 'info');
          return;
        }
      }

      const paddingMm = parseFloat(elements.marginPaddingSlider.value) || 0;
      const paddingPoints = (paddingMm / 25.4) * 72; // mm to points

      // Apply crop to target pages
      targetPages.forEach(pIdx => {
        const page = doc.getPage(pIdx);
        const { width: pW, height: pH } = page.getSize();

        let pdfX = state.crop.normX * pW;
        let pdfY = (1 - (state.crop.normY + state.crop.normH)) * pH;
        let pdfW = state.crop.normW * pW;
        let pdfH = state.crop.normH * pH;

        // Apply padding
        if (paddingPoints > 0) {
          pdfX = Math.max(0, pdfX - paddingPoints);
          pdfY = Math.max(0, pdfY - paddingPoints);
          pdfW = Math.min(pW - pdfX, pdfW + paddingPoints * 2);
          pdfH = Math.min(pH - pdfY, pdfH + paddingPoints * 2);
        }

        page.setCropBox(pdfX, pdfY, pdfW, pdfH);
        page.setMediaBox(pdfX, pdfY, pdfW, pdfH);
      });

      const trimmedBytes = await doc.save();
      const blob = new Blob([trimmedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      a.href = url;
      a.download = `${baseName}_trimmed.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`Trimmed PDF downloaded (${targetPages.length} page${targetPages.length > 1 ? 's' : ''})!`, 'success');
    } catch (err) {
      console.error('Trim PDF error:', err);
      showToast('Error trimming PDF', 'info');
    }
  }

  function parsePageRange(str, maxPages) {
    const pages = new Set();
    const parts = str.split(',');
    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;
      if (clean.includes('-')) {
        const [start, end] = clean.split('-').map(n => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.max(1, start); i <= Math.min(maxPages, end); i++) {
            pages.add(i - 1);
          }
        }
      } else {
        const num = parseInt(clean, 10);
        if (!isNaN(num) && num >= 1 && num <= maxPages) {
          pages.add(num - 1);
        }
      }
    }
    return Array.from(pages);
  }

  // --- REDACTION / CUT OUT SYSTEM ---
  function addCurrentAsCutout() {
    if (!state.crop.active) return;

    const pageNum = state.currentPage;
    if (!state.redactions[pageNum]) {
      state.redactions[pageNum] = [];
    }

    const selectedColor = document.querySelector('input[name="redactColor"]:checked')?.value || '#ffffff';

    state.redactions[pageNum].push({
      normX: state.crop.normX,
      normY: state.crop.normY,
      normW: state.crop.normW,
      normH: state.crop.normH,
      color: selectedColor
    });

    renderRedactionOverlays();
    renderRedactionList();
    showToast(`Added cut-out box to Page ${pageNum}`, 'success');
  }

  function renderRedactionOverlays() {
    elements.redactOverlaysContainer.innerHTML = '';
    const items = state.redactions[state.currentPage] || [];
    const canvas = elements.pdfCanvas;
    if (!canvas) return;

    items.forEach((item, index) => {
      const box = document.createElement('div');
      box.className = 'redact-box-overlay';
      box.style.left = `${item.normX * canvas.width}px`;
      box.style.top = `${item.normY * canvas.height}px`;
      box.style.width = `${item.normW * canvas.width}px`;
      box.style.height = `${item.normH * canvas.height}px`;
      box.style.backgroundColor = item.color;

      const delBtn = document.createElement('button');
      delBtn.className = 'redact-delete-btn';
      delBtn.textContent = '✕';
      delBtn.title = 'Remove this cut-out';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteRedaction(state.currentPage, index);
      });

      box.appendChild(delBtn);
      elements.redactOverlaysContainer.appendChild(box);
    });

    elements.btnExportCleanedPDF.disabled = Object.values(state.redactions).flat().length === 0;
  }

  function renderRedactionList() {
    elements.redactListContainer.innerHTML = '';
    const allItems = [];
    for (const [pNum, list] of Object.entries(state.redactions)) {
      list.forEach((item, idx) => {
        allItems.push({ pageNum: parseInt(pNum, 10), idx, item });
      });
    }

    if (allItems.length === 0) {
      elements.noRedactHint.style.display = 'block';
      elements.redactListContainer.appendChild(elements.noRedactHint);
      return;
    }

    elements.noRedactHint.style.display = 'none';
    allItems.forEach(({ pageNum, idx, item }) => {
      const row = document.createElement('div');
      row.className = 'redact-item-row';
      row.innerHTML = `
        <span>Page ${pageNum}: Box #${idx + 1} (${item.color === '#ffffff' ? 'Whiteout' : 'Blackout'})</span>
        <button class="redact-item-del" title="Delete">✕</button>
      `;
      row.querySelector('.redact-item-del').addEventListener('click', () => {
        deleteRedaction(pageNum, idx);
      });
      elements.redactListContainer.appendChild(row);
    });
  }

  function deleteRedaction(pageNum, index) {
    if (state.redactions[pageNum]) {
      state.redactions[pageNum].splice(index, 1);
      if (state.redactions[pageNum].length === 0) {
        delete state.redactions[pageNum];
      }
      renderRedactionOverlays();
      renderRedactionList();
      showToast('Cut-out removed', 'info');
    }
  }

  async function exportCleanedPDF() {
    const totalRedacts = Object.values(state.redactions).flat().length;
    if (totalRedacts === 0 || !state.pdfBytes) return;

    try {
      showToast('Applying redactions and cut-outs...', 'info');
      const { PDFDocument, rgb } = window.PDFLib;
      const doc = await PDFDocument.load(state.pdfBytes);

      for (const [pageNumStr, boxes] of Object.entries(state.redactions)) {
        const pageIdx = parseInt(pageNumStr, 10) - 1;
        if (pageIdx < 0 || pageIdx >= doc.getPageCount()) continue;

        const page = doc.getPage(pageIdx);
        const { width: pW, height: pH } = page.getSize();

        boxes.forEach(b => {
          const pdfX = b.normX * pW;
          const pdfY = (1 - (b.normY + b.normH)) * pH;
          const pdfW = b.normW * pW;
          const pdfH = b.normH * pH;

          const colorVal = b.color === '#000000' ? rgb(0, 0, 0) : rgb(1, 1, 1);
          page.drawRectangle({
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            color: colorVal
          });
        });
      }

      const cleanedBytes = await doc.save();
      const blob = new Blob([cleanedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      const baseName = state.fileName.replace(/\.pdf$/i, '');
      a.href = url;
      a.download = `${baseName}_cleaned.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Cleaned PDF exported successfully!', 'success');
    } catch (err) {
      console.error('Redact PDF error:', err);
      showToast('Error exporting cleaned PDF', 'info');
    }
  }

  // ==========================================================================
  // CV SCREENSHOT COMPILER MODULE
  // ==========================================================================
  function setupCvCompiler() {
    const cvState = {
      slices: [],          // [{ id, title, img, naturalW, naturalH, trim: { top, bottom, left, right } }]
      activeMode: 'pdf',   // 'pdf' or 'cv'
      viewMode: 'paginated', // 'paginated' or 'continuous'
      format: 'a4',        // 'a4', 'letter', 'auto'
      marginMm: 12,        // mm
      gapPx: 10,           // px
      autoWhite: true,
      whiteSensitivity: 2, // 1 to 4
      enhanceContrast: true,
      zoom: 0.8,
      activeTrimSliceId: null,
      activeTrimState: { top: 0, bottom: 0, left: 0, right: 0 },
      dragSrcIndex: null,
      captureSnapshotCanvas: null,
      captureCrop: null,
      captureIsDragging: false,
      captureStartX: 0,
      captureStartY: 0
    };

    // Mode Switcher Navigation
    function switchToMode(mode) {
      cvState.activeMode = mode;
      if (mode === 'pdf') {
        elements.navBtnPdfStudio?.classList.add('active');
        elements.navBtnCvCompiler?.classList.remove('active');
        if (elements.pdfStudioLayout) elements.pdfStudioLayout.style.display = 'flex';
        if (elements.cvStudioLayout) elements.cvStudioLayout.style.display = 'none';
        if (state.pdfDoc) {
          elements.docMeta.style.display = 'flex';
          elements.headerPageNav.style.display = 'flex';
        }
      } else {
        elements.navBtnCvCompiler?.classList.add('active');
        elements.navBtnPdfStudio?.classList.remove('active');
        if (elements.pdfStudioLayout) elements.pdfStudioLayout.style.display = 'none';
        if (elements.cvStudioLayout) elements.cvStudioLayout.style.display = 'flex';
        elements.docMeta.style.display = 'none';
        elements.headerPageNav.style.display = 'none';
        renderCvSlicesList();
        renderCompiledCV();
      }
    }

    elements.navBtnPdfStudio?.addEventListener('click', () => switchToMode('pdf'));
    elements.navBtnCvCompiler?.addEventListener('click', () => switchToMode('cv'));

    // Synergy: Send current crop from PDF Cropper to CV Compiler
    if (elements.btnSendCropToCV) {
      elements.btnSendCropToCV.addEventListener('click', () => {
        if (!state.crop.active || !elements.pdfCanvas) return;
        const canvas = elements.pdfCanvas;
        const cW = canvas.width;
        const cH = canvas.height;
        const sx = Math.floor(state.crop.normX * cW);
        const sy = Math.floor(state.crop.normY * cH);
        const sw = Math.max(1, Math.floor(state.crop.normW * cW));
        const sh = Math.max(1, Math.floor(state.crop.normH * cH));

        const offscreen = document.createElement('canvas');
        offscreen.width = sw;
        offscreen.height = sh;
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

        const img = new Image();
        img.onload = () => {
          addCvSlice(img, `PDF Page ${state.currentPage} Snip`);
          switchToMode('cv');
          showToast('Snip added to CV Compiler!', 'success');
        };
        img.src = offscreen.toDataURL('image/png');
      });
    }

    // Global Clipboard Paste (Ctrl+V)
    window.addEventListener('paste', (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (loadEvt) => {
              const img = new Image();
              img.onload = () => {
                const sectionIdx = cvState.slices.length + 1;
                const defaultNames = ['Header & Bio', 'Work Experience', 'Education & Skills', 'Projects & Certs'];
                const sliceName = defaultNames[cvState.slices.length] || `CV Section ${sectionIdx}`;
                addCvSlice(img, sliceName);
                if (cvState.activeMode !== 'cv') {
                  switchToMode('cv');
                }
                showToast(`Pasted screenshot added as "${sliceName}"!`, 'success');
              };
              img.src = loadEvt.target.result;
            };
            reader.readAsDataURL(file);
          }
          break;
        }
      }
    });

    // File Upload Handler (Multiple Images)
    function handleCvFilesUpload(files) {
      if (!files || files.length === 0) return;
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = new Image();
          img.onload = () => {
            const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
            addCvSlice(img, cleanName || `CV Section ${cvState.slices.length + 1}`);
            if (cvState.activeMode !== 'cv') switchToMode('cv');
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      });
      showToast(`Added ${files.length} screenshot${files.length > 1 ? 's' : ''}`, 'success');
    }

    elements.cvImageFileInput?.addEventListener('change', (e) => {
      handleCvFilesUpload(e.target.files);
      e.target.value = '';
    });
    elements.cvImageFileInputDrop?.addEventListener('change', (e) => {
      handleCvFilesUpload(e.target.files);
      e.target.value = '';
    });

    // Add Slice to State
    function addCvSlice(img, title) {
      const sliceId = 'slice_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const newSlice = {
        id: sliceId,
        title: title || `CV Section ${cvState.slices.length + 1}`,
        img: img,
        naturalW: img.naturalWidth || img.width,
        naturalH: img.naturalHeight || img.height,
        trim: { top: 0, bottom: 0, left: 0, right: 0 }
      };

      cvState.slices.push(newSlice);
      renderCvSlicesList();
      renderCompiledCV();
    }

    // Render Slices List in Sidebar
    function renderCvSlicesList() {
      const container = elements.cvSlicesContainer;
      const countBadge = elements.cvSlicesCountBadge;
      if (!container) return;

      const count = cvState.slices.length;
      if (countBadge) {
        countBadge.textContent = `${count} slice${count === 1 ? '' : 's'}`;
      }

      if (count === 0) {
        container.innerHTML = '';
        if (elements.cvEmptySlicesHint) {
          container.appendChild(elements.cvEmptySlicesHint);
          elements.cvEmptySlicesHint.style.display = 'flex';
        }
        setCvExportButtonsEnabled(false);
        return;
      }

      if (elements.cvEmptySlicesHint) {
        elements.cvEmptySlicesHint.style.display = 'none';
      }

      container.innerHTML = '';
      cvState.slices.forEach((slice, index) => {
        const card = document.createElement('div');
        card.className = 'cv-slice-card';
        card.draggable = true;
        card.dataset.id = slice.id;
        card.dataset.index = index;

        // Effective dimensions after trim
        const effW = Math.max(1, slice.naturalW - slice.trim.left - slice.trim.right);
        const effH = Math.max(1, slice.naturalH - slice.trim.top - slice.trim.bottom);
        const isTrimmed = slice.trim.top > 0 || slice.trim.bottom > 0 || slice.trim.left > 0 || slice.trim.right > 0;

        card.innerHTML = `
          <div class="cv-slice-card-top">
            <span class="cv-drag-handle" title="Drag to reorder">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            </span>
            <input type="text" class="cv-slice-title-input" value="${slice.title}" title="Rename section">
            ${isTrimmed ? '<span class="cv-trimmed-badge" title="Edge trimmed">Trimmed</span>' : ''}
          </div>
          <div class="cv-slice-thumb-wrap">
            <img src="${slice.img.src}" alt="${slice.title}">
          </div>
          <div class="cv-slice-meta-row">
            <span>${effW} × ${effH} px</span>
            <div class="cv-slice-actions">
              <button class="icon-btn icon-btn-sm btn-trim-slice" title="Trim edges (cut header, battery bar, overlap)">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
              </button>
              <button class="icon-btn icon-btn-sm btn-move-up" title="Move Up" ${index === 0 ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="m18 15-6-6-6 6"/></svg>
              </button>
              <button class="icon-btn icon-btn-sm btn-move-down" title="Move Down" ${index === count - 1 ? 'disabled' : ''}>
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              <button class="icon-btn icon-btn-sm btn-delete-slice" title="Delete section">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        `;

        // Event: Rename
        const titleInput = card.querySelector('.cv-slice-title-input');
        titleInput.addEventListener('change', (e) => {
          slice.title = e.target.value.trim() || `Section ${index + 1}`;
        });
        titleInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') titleInput.blur();
        });

        // Event: Trim
        card.querySelector('.btn-trim-slice').addEventListener('click', () => {
          openTrimModal(slice.id);
        });

        // Event: Move Up
        card.querySelector('.btn-move-up')?.addEventListener('click', () => {
          if (index > 0) {
            const temp = cvState.slices[index];
            cvState.slices[index] = cvState.slices[index - 1];
            cvState.slices[index - 1] = temp;
            renderCvSlicesList();
            renderCompiledCV();
          }
        });

        // Event: Move Down
        card.querySelector('.btn-move-down')?.addEventListener('click', () => {
          if (index < count - 1) {
            const temp = cvState.slices[index];
            cvState.slices[index] = cvState.slices[index + 1];
            cvState.slices[index + 1] = temp;
            renderCvSlicesList();
            renderCompiledCV();
          }
        });

        // Event: Delete
        card.querySelector('.btn-delete-slice').addEventListener('click', () => {
          cvState.slices.splice(index, 1);
          renderCvSlicesList();
          renderCompiledCV();
          showToast('Section removed', 'info');
        });

        // HTML5 Drag and Drop Reordering
        card.addEventListener('dragstart', (e) => {
          cvState.dragSrcIndex = index;
          card.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
        });

        card.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          card.classList.add('drag-over');
        });

        card.addEventListener('dragleave', () => {
          card.classList.remove('drag-over');
        });

        card.addEventListener('drop', (e) => {
          e.preventDefault();
          card.classList.remove('drag-over');
          const targetIndex = index;
          if (cvState.dragSrcIndex !== null && cvState.dragSrcIndex !== targetIndex) {
            const movedItem = cvState.slices.splice(cvState.dragSrcIndex, 1)[0];
            cvState.slices.splice(targetIndex, 0, movedItem);
            renderCvSlicesList();
            renderCompiledCV();
          }
        });

        card.addEventListener('dragend', () => {
          card.classList.remove('dragging');
          document.querySelectorAll('.cv-slice-card').forEach(c => c.classList.remove('drag-over'));
        });

        container.appendChild(card);
      });

      setCvExportButtonsEnabled(true);
    }

    // Clear All Slices
    elements.btnClearAllCvSlices?.addEventListener('click', () => {
      if (cvState.slices.length === 0) return;
      if (confirm('Clear all CV screenshot sections?')) {
        cvState.slices = [];
        renderCvSlicesList();
        renderCompiledCV();
        showToast('All sections cleared', 'info');
      }
    });

    // Enable/Disable CV Export Buttons
    function setCvExportButtonsEnabled(enabled) {
      if (elements.btnExportCvPDF) elements.btnExportCvPDF.disabled = !enabled;
      if (elements.btnExportCvPNG) elements.btnExportCvPNG.disabled = !enabled;
      if (elements.btnCopyCvClipboard) elements.btnCopyCvClipboard.disabled = !enabled;
      if (elements.btnPrintCv) elements.btnPrintCv.disabled = !enabled;
    }

    // ========================================================================
    // SAMPLE CV SLICES SYNTHESIS
    // ========================================================================
    function loadSampleCvSlices() {
      showToast('Generating sample CV screenshot slices...', 'info');
      cvState.slices = [];

      // Slice 1: Header, Contact & Executive Bio
      const canvas1 = document.createElement('canvas');
      canvas1.width = 1400;
      canvas1.height = 480;
      const ctx1 = canvas1.getContext('2d');

      // Subtle off-white background (simulating screenshot)
      ctx1.fillStyle = '#fafbfc';
      ctx1.fillRect(0, 0, 1400, 480);

      // Dark executive banner
      ctx1.fillStyle = '#0f172a';
      ctx1.fillRect(0, 0, 1400, 190);

      // Name & Title
      ctx1.fillStyle = '#ffffff';
      ctx1.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx1.fillText('ALEXANDRA MORGAN', 60, 80);

      ctx1.fillStyle = '#94a3b8';
      ctx1.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx1.fillText('PRINCIPAL SYSTEMS ARCHITECT & CLOUD LEAD', 60, 125);

      // Contact Info Pill Bar
      ctx1.fillStyle = '#38bdf8';
      ctx1.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx1.fillText('alexandra.morgan@techmail.io   •   +1 (415) 890-2341   •   San Francisco, CA   •   github.com/amorgan', 60, 160);

      // Executive Summary
      ctx1.fillStyle = '#1e293b';
      ctx1.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx1.fillText('EXECUTIVE SUMMARY', 60, 240);

      ctx1.strokeStyle = '#e2e8f0';
      ctx1.lineWidth = 2;
      ctx1.beginPath();
      ctx1.moveTo(60, 255);
      ctx1.lineTo(1340, 255);
      ctx1.stroke();

      ctx1.fillStyle = '#475569';
      ctx1.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const summaryLine1 = 'Accomplished engineering architect with 10+ years specializing in hyper-scale distributed backends, zero-downtime migrations,';
      const summaryLine2 = 'and Kubernetes orchestration. Proven track record directing cross-functional squads to scale revenue infrastructure to 99.999% SLA.';
      ctx1.fillText(summaryLine1, 60, 300);
      ctx1.fillText(summaryLine2, 60, 335);

      // Key Metrics
      ctx1.fillStyle = '#0f172a';
      ctx1.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx1.fillText('• 450M Daily Events   • $1.4M Cloud Savings   • 14 Microservices Deployed   • 18 Patents Filed', 60, 400);

      const img1 = new Image();
      img1.onload = () => {
        addCvSlice(img1, 'Header, Contact & Bio');

        // Slice 2: Professional Experience
        const canvas2 = document.createElement('canvas');
        canvas2.width = 1400;
        canvas2.height = 640;
        const ctx2 = canvas2.getContext('2d');

        ctx2.fillStyle = '#f8fafc'; // slightly off-white screenshot tint
        ctx2.fillRect(0, 0, 1400, 640);

        ctx2.fillStyle = '#1e293b';
        ctx2.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx2.fillText('WORK EXPERIENCE', 60, 50);

        ctx2.strokeStyle = '#e2e8f0';
        ctx2.lineWidth = 2;
        ctx2.beginPath();
        ctx2.moveTo(60, 65);
        ctx2.lineTo(1340, 65);
        ctx2.stroke();

        // Job 1
        ctx2.fillStyle = '#0f172a';
        ctx2.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx2.fillText('Senior Staff Cloud Architect — Apex Global Technologies', 60, 110);
        ctx2.fillStyle = '#64748b';
        ctx2.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx2.fillText('San Francisco, CA | 2022 – Present', 1050, 110);

        ctx2.fillStyle = '#334155';
        ctx2.font = '17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx2.fillText('• Architected streaming data pipeline across 3 multi-cloud regions handling over 140,000 req/sec.', 80, 150);
        ctx2.fillText('• Decreased global API p99 latency by 64% by refactoring caching topology into decentralized edge pods.', 80, 185);
        ctx2.fillText('• Governed security audit and SOC2 Type II compliance roadmap across 32 engineering teams.', 80, 220);

        // Job 2
        ctx2.fillStyle = '#0f172a';
        ctx2.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx2.fillText('Lead Distributed Systems Engineer — NovaTech Distributed Labs', 60, 290);
        ctx2.fillStyle = '#64748b';
        ctx2.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx2.fillText('Seattle, WA | 2019 – 2022', 1100, 290);

        ctx2.fillStyle = '#334155';
        ctx2.font = '17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx2.fillText('• Designed real-time pub/sub infrastructure serving 18M concurrent WebSocket connections.', 80, 330);
        ctx2.fillText('• Rebuilt CI/CD automated deployment mesh, reducing release cycle lead time from 4 days to 18 minutes.', 80, 365);
        ctx2.fillText('• Mentored 12 senior & junior engineers and initiated internal architectural design review standards.', 80, 400);

        // Job 3
        ctx2.fillStyle = '#0f172a';
        ctx2.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx2.fillText('Senior Backend Engineer — CloudGrid Networks', 60, 470);
        ctx2.fillStyle = '#64748b';
        ctx2.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx2.fillText('Palo Alto, CA | 2016 – 2019', 1080, 470);

        ctx2.fillStyle = '#334155';
        ctx2.font = '17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx2.fillText('• Developed high-throughput microservices in Go and Python with PostgreSQL connection multiplexing.', 80, 510);
        ctx2.fillText('• Authored automated disaster recovery protocols tested against chaotic synthetic outage injections.', 80, 545);

        const img2 = new Image();
        img2.onload = () => {
          addCvSlice(img2, 'Work Experience');

          // Slice 3: Technical Skills & Education
          const canvas3 = document.createElement('canvas');
          canvas3.width = 1400;
          canvas3.height = 460;
          const ctx3 = canvas3.getContext('2d');

          ctx3.fillStyle = '#ffffff';
          ctx3.fillRect(0, 0, 1400, 460);

          ctx3.fillStyle = '#1e293b';
          ctx3.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('TECHNICAL EXPERTISE & EDUCATION', 60, 50);

          ctx3.strokeStyle = '#e2e8f0';
          ctx3.lineWidth = 2;
          ctx3.beginPath();
          ctx3.moveTo(60, 65);
          ctx3.lineTo(1340, 65);
          ctx3.stroke();

          // Skills categories
          ctx3.fillStyle = '#0f172a';
          ctx3.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('Languages & Frameworks:', 60, 115);
          ctx3.fillStyle = '#334155';
          ctx3.font = '17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('Go, Rust, Python, TypeScript, Node.js, gRPC, Protobuf, GraphQL, SQL, C++', 320, 115);

          ctx3.fillStyle = '#0f172a';
          ctx3.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('Cloud & Infrastructure:', 60, 160);
          ctx3.fillStyle = '#334155';
          ctx3.font = '17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('Kubernetes, Docker, AWS (EKS, Lambda, DynamoDB), GCP, Terraform, Istio, Envoy', 320, 160);

          ctx3.fillStyle = '#0f172a';
          ctx3.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('Storage & Streaming:', 60, 205);
          ctx3.fillStyle = '#334155';
          ctx3.font = '17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('Apache Kafka, Redis Cluster, PostgreSQL, ScyllaDB, Elasticsearch, ClickHouse', 320, 205);

          // Education & Certifications
          ctx3.fillStyle = '#1e293b';
          ctx3.font = 'bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('EDUCATION & CREDENTIALS', 60, 280);

          ctx3.strokeStyle = '#e2e8f0';
          ctx3.lineWidth = 2;
          ctx3.beginPath();
          ctx3.moveTo(60, 295);
          ctx3.lineTo(1340, 295);
          ctx3.stroke();

          ctx3.fillStyle = '#0f172a';
          ctx3.font = 'bold 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('M.S. Computer Science — University of California, Berkeley', 60, 340);
          ctx3.fillStyle = '#64748b';
          ctx3.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('GPA: 3.92 / 4.0 | Focus: Distributed Computing & Operating Systems', 60, 370);

          ctx3.fillStyle = '#0f172a';
          ctx3.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx3.fillText('Certifications: AWS Certified Solutions Architect (Professional)  •  CKA (Certified Kubernetes Admin)', 60, 420);

          const img3 = new Image();
          img3.onload = () => {
            addCvSlice(img3, 'Skills & Education');
            switchToMode('cv');
            showToast('Loaded 3 sample CV screenshot slices!', 'success');
          };
          img3.src = canvas3.toDataURL('image/png');
        };
        img2.src = canvas2.toDataURL('image/png');
      };
      img1.src = canvas1.toDataURL('image/png');
    }

    elements.btnCvLoadSample?.addEventListener('click', loadSampleCvSlices);
    elements.btnCvLoadSampleDrop?.addEventListener('click', loadSampleCvSlices);

    // ========================================================================
    // SCREEN CAPTURE & LIVE SNIPPING
    // ========================================================================
    async function startScreenSnip() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        showToast('Screen capture is not supported in this browser. Use Ctrl+V to paste screenshots!', 'info');
        return;
      }

      try {
        showToast('Select screen or window to snip from...', 'info');
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        // Capture frame to canvas
        const offCanvas = document.createElement('canvas');
        offCanvas.width = video.videoWidth;
        offCanvas.height = video.videoHeight;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(video, 0, 0);

        // Stop video streams
        stream.getTracks().forEach(t => t.stop());

        cvState.captureSnapshotCanvas = offCanvas;
        openCaptureModal();
      } catch (err) {
        if (err.name !== 'NotAllowedError') {
          console.error('Screen capture error:', err);
          showToast('Failed to capture screen: ' + err.message, 'info');
        }
      }
    }

    elements.btnCvScreenCapture?.addEventListener('click', startScreenSnip);

    function openCaptureModal() {
      const modal = elements.cvCaptureModal;
      const canvas = elements.cvCaptureCanvas;
      const snapshot = cvState.captureSnapshotCanvas;
      if (!modal || !canvas || !snapshot) return;

      canvas.width = snapshot.width;
      canvas.height = snapshot.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(snapshot, 0, 0);

      cvState.captureCrop = null;
      if (elements.cvCaptureCropBox) elements.cvCaptureCropBox.style.display = 'none';
      if (elements.btnConfirmCvCapture) elements.btnConfirmCvCapture.disabled = true;

      modal.style.display = 'flex';
      setupCaptureModalInteractions();
    }

    function setupCaptureModalInteractions() {
      const stage = elements.cvCaptureStage;
      const canvas = elements.cvCaptureCanvas;
      const box = elements.cvCaptureCropBox;
      const badge = elements.cvCaptureCropBadge;
      if (!stage || !canvas) return;

      function onMouseDown(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        cvState.captureIsDragging = true;
        cvState.captureStartX = x;
        cvState.captureStartY = y;
        cvState.captureCrop = { x, y, w: 0, h: 0 };

        if (box) {
          box.style.display = 'block';
          box.style.left = `${(x / scaleX)}px`;
          box.style.top = `${(y / scaleY)}px`;
          box.style.width = '0px';
          box.style.height = '0px';
        }
      }

      function onMouseMove(e) {
        if (!cvState.captureIsDragging || !cvState.captureCrop) return;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const currX = Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX));
        const currY = Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY));

        const minX = Math.min(cvState.captureStartX, currX);
        const minY = Math.min(cvState.captureStartY, currY);
        const w = Math.abs(currX - cvState.captureStartX);
        const h = Math.abs(currY - cvState.captureStartY);

        cvState.captureCrop = { x: minX, y: minY, w, h };

        if (box) {
          box.style.left = `${minX / scaleX}px`;
          box.style.top = `${minY / scaleY}px`;
          box.style.width = `${w / scaleX}px`;
          box.style.height = `${h / scaleY}px`;
        }
        if (badge) {
          badge.textContent = `${Math.round(w)} × ${Math.round(h)} px`;
        }
      }

      function onMouseUp() {
        if (!cvState.captureIsDragging) return;
        cvState.captureIsDragging = false;
        if (cvState.captureCrop && cvState.captureCrop.w > 20 && cvState.captureCrop.h > 20) {
          if (elements.btnConfirmCvCapture) elements.btnConfirmCvCapture.disabled = false;
        } else {
          if (elements.btnConfirmCvCapture) elements.btnConfirmCvCapture.disabled = true;
        }
      }

      stage.onmousedown = onMouseDown;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }

    elements.btnCloseCvCaptureModal?.addEventListener('click', () => {
      elements.cvCaptureModal.style.display = 'none';
    });
    elements.btnCancelCvCapture?.addEventListener('click', () => {
      elements.cvCaptureModal.style.display = 'none';
    });

    elements.btnConfirmCvCapture?.addEventListener('click', () => {
      const crop = cvState.captureCrop;
      const snapshot = cvState.captureSnapshotCanvas;
      if (!crop || !snapshot || crop.w < 10 || crop.h < 10) return;

      const offCanvas = document.createElement('canvas');
      offCanvas.width = Math.round(crop.w);
      offCanvas.height = Math.round(crop.h);
      const ctx = offCanvas.getContext('2d');
      ctx.drawImage(snapshot, Math.round(crop.x), Math.round(crop.y), Math.round(crop.w), Math.round(crop.h), 0, 0, Math.round(crop.w), Math.round(crop.h));

      const img = new Image();
      img.onload = () => {
        addCvSlice(img, `Screen Snip ${cvState.slices.length + 1}`);
        elements.cvCaptureModal.style.display = 'none';
        showToast('Screen snip added to CV!', 'success');
      };
      img.src = offCanvas.toDataURL('image/png');
    });

    // ========================================================================
    // SLICE TRIMMER MODAL
    // ========================================================================
    function openTrimModal(sliceId) {
      const slice = cvState.slices.find(s => s.id === sliceId);
      if (!slice) return;

      cvState.activeTrimSliceId = sliceId;
      cvState.activeTrimState = { ...slice.trim };

      const modal = elements.cvTrimModal;
      const canvas = elements.cvTrimCanvas;
      if (!modal || !canvas) return;

      canvas.width = slice.naturalW;
      canvas.height = slice.naturalH;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(slice.img, 0, 0);

      // Set slider max values
      const maxTrimH = Math.floor(slice.naturalH * 0.45);
      const maxTrimW = Math.floor(slice.naturalW * 0.45);

      if (elements.sliderTrimTop) {
        elements.sliderTrimTop.max = maxTrimH;
        elements.sliderTrimTop.value = slice.trim.top;
      }
      if (elements.sliderTrimBottom) {
        elements.sliderTrimBottom.max = maxTrimH;
        elements.sliderTrimBottom.value = slice.trim.bottom;
      }
      if (elements.sliderTrimLeft) {
        elements.sliderTrimLeft.max = maxTrimW;
        elements.sliderTrimLeft.value = slice.trim.left;
      }
      if (elements.sliderTrimRight) {
        elements.sliderTrimRight.max = maxTrimW;
        elements.sliderTrimRight.value = slice.trim.right;
      }

      updateTrimMaskUI();
      modal.style.display = 'flex';
    }

    function updateTrimMaskUI() {
      const canvas = elements.cvTrimCanvas;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const sX = rect.width / canvas.width;
      const sY = rect.height / canvas.height;

      const topPx = (cvState.activeTrimState.top || 0) * sY;
      const bottomPx = (cvState.activeTrimState.bottom || 0) * sY;
      const leftPx = (cvState.activeTrimState.left || 0) * sX;
      const rightPx = (cvState.activeTrimState.right || 0) * sX;

      if (elements.cvTrimMaskTop) {
        elements.cvTrimMaskTop.style.top = '0px';
        elements.cvTrimMaskTop.style.left = '0px';
        elements.cvTrimMaskTop.style.width = '100%';
        elements.cvTrimMaskTop.style.height = `${topPx}px`;
      }
      if (elements.cvTrimMaskBottom) {
        elements.cvTrimMaskBottom.style.bottom = '0px';
        elements.cvTrimMaskBottom.style.left = '0px';
        elements.cvTrimMaskBottom.style.width = '100%';
        elements.cvTrimMaskBottom.style.height = `${bottomPx}px`;
      }
      if (elements.cvTrimMaskLeft) {
        elements.cvTrimMaskLeft.style.top = `${topPx}px`;
        elements.cvTrimMaskLeft.style.bottom = `${bottomPx}px`;
        elements.cvTrimMaskLeft.style.left = '0px';
        elements.cvTrimMaskLeft.style.width = `${leftPx}px`;
      }
      if (elements.cvTrimMaskRight) {
        elements.cvTrimMaskRight.style.top = `${topPx}px`;
        elements.cvTrimMaskRight.style.bottom = `${bottomPx}px`;
        elements.cvTrimMaskRight.style.right = '0px';
        elements.cvTrimMaskRight.style.width = `${rightPx}px`;
      }

      if (elements.valTrimTop) elements.valTrimTop.textContent = `${cvState.activeTrimState.top} px`;
      if (elements.valTrimBottom) elements.valTrimBottom.textContent = `${cvState.activeTrimState.bottom} px`;
      if (elements.valTrimLeft) elements.valTrimLeft.textContent = `${cvState.activeTrimState.left} px`;
      if (elements.valTrimRight) elements.valTrimRight.textContent = `${cvState.activeTrimState.right} px`;
    }

    elements.sliderTrimTop?.addEventListener('input', (e) => {
      cvState.activeTrimState.top = parseInt(e.target.value, 10);
      updateTrimMaskUI();
    });
    elements.sliderTrimBottom?.addEventListener('input', (e) => {
      cvState.activeTrimState.bottom = parseInt(e.target.value, 10);
      updateTrimMaskUI();
    });
    elements.sliderTrimLeft?.addEventListener('input', (e) => {
      cvState.activeTrimState.left = parseInt(e.target.value, 10);
      updateTrimMaskUI();
    });
    elements.sliderTrimRight?.addEventListener('input', (e) => {
      cvState.activeTrimState.right = parseInt(e.target.value, 10);
      updateTrimMaskUI();
    });

    // Auto-detect Blank White Margins
    elements.btnCvAutoTrimSlice?.addEventListener('click', () => {
      const slice = cvState.slices.find(s => s.id === cvState.activeTrimSliceId);
      if (!slice) return;

      const canvas = elements.cvTrimCanvas;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data, width, height } = imgData;

      let top = 0, bottom = 0, left = 0, right = 0;
      const threshold = 245;

      function isWhitePixel(idx) {
        const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
        return a < 20 || (r >= threshold && g >= threshold && b >= threshold);
      }

      // Top
      for (let y = 0; y < height * 0.4; y++) {
        let allWhite = true;
        for (let x = 0; x < width; x += 3) {
          if (!isWhitePixel((y * width + x) * 4)) { allWhite = false; break; }
        }
        if (allWhite) top = y; else break;
      }

      // Bottom
      for (let y = height - 1; y > height * 0.6; y--) {
        let allWhite = true;
        for (let x = 0; x < width; x += 3) {
          if (!isWhitePixel((y * width + x) * 4)) { allWhite = false; break; }
        }
        if (allWhite) bottom = height - 1 - y; else break;
      }

      // Left
      for (let x = 0; x < width * 0.35; x++) {
        let allWhite = true;
        for (let y = 0; y < height; y += 3) {
          if (!isWhitePixel((y * width + x) * 4)) { allWhite = false; break; }
        }
        if (allWhite) left = x; else break;
      }

      // Right
      for (let x = width - 1; x > width * 0.65; x--) {
        let allWhite = true;
        for (let y = 0; y < height; y += 3) {
          if (!isWhitePixel((y * width + x) * 4)) { allWhite = false; break; }
        }
        if (allWhite) right = width - 1 - x; else break;
      }

      cvState.activeTrimState = { top, bottom, left, right };
      if (elements.sliderTrimTop) elements.sliderTrimTop.value = top;
      if (elements.sliderTrimBottom) elements.sliderTrimBottom.value = bottom;
      if (elements.sliderTrimLeft) elements.sliderTrimLeft.value = left;
      if (elements.sliderTrimRight) elements.sliderTrimRight.value = right;
      updateTrimMaskUI();
      showToast(`Auto-detected margins: T:${top}px, B:${bottom}px, L:${left}px, R:${right}px`, 'info');
    });

    elements.btnCvResetTrim?.addEventListener('click', () => {
      cvState.activeTrimState = { top: 0, bottom: 0, left: 0, right: 0 };
      if (elements.sliderTrimTop) elements.sliderTrimTop.value = 0;
      if (elements.sliderTrimBottom) elements.sliderTrimBottom.value = 0;
      if (elements.sliderTrimLeft) elements.sliderTrimLeft.value = 0;
      if (elements.sliderTrimRight) elements.sliderTrimRight.value = 0;
      updateTrimMaskUI();
    });

    elements.btnCvApplyTrim?.addEventListener('click', () => {
      const slice = cvState.slices.find(s => s.id === cvState.activeTrimSliceId);
      if (slice) {
        slice.trim = { ...cvState.activeTrimState };
        renderCvSlicesList();
        renderCompiledCV();
        elements.cvTrimModal.style.display = 'none';
        showToast('Trim applied to section', 'success');
      }
    });

    elements.btnCloseCvTrimModal?.addEventListener('click', () => {
      elements.cvTrimModal.style.display = 'none';
    });

    // ========================================================================
    // COMPILATION & LIVE RENDERING ENGINE
    // ========================================================================
    function renderCompiledCV() {
      const wrapper = elements.cvPagesWrapper;
      const statBadge = elements.cvPageStatBadge;
      if (!wrapper) return;

      if (cvState.slices.length === 0) {
        // Keep welcome card visible
        wrapper.querySelectorAll('.cv-paper-page').forEach(p => p.remove());
        if (elements.cvWelcomeCard) elements.cvWelcomeCard.style.display = 'flex';
        if (statBadge) statBadge.textContent = '0 Slices • Ready to Compile';
        setCvExportButtonsEnabled(false);
        return;
      }

      if (elements.cvWelcomeCard) {
        elements.cvWelcomeCard.style.display = 'none';
      }

      // Calculate Target Dimensions (Standard 150 DPI render resolution)
      let pageWidth = 1240; // px
      let pageHeight = 1754; // px (A4 1:1.414)

      if (cvState.format === 'letter') {
        pageWidth = 1275;
        pageHeight = 1650; // US Letter 8.5 x 11
      }

      const marginPx = Math.round((cvState.marginMm / 25.4) * 150);
      const contentWidth = Math.max(100, pageWidth - 2 * marginPx);
      const contentHeight = Math.max(100, pageHeight - 2 * marginPx);

      // Pre-process each slice (Trimming + Background Whiteout + Contrast)
      const processedSlices = cvState.slices.map(slice => {
        const sx = slice.trim.left;
        const sy = slice.trim.top;
        const sw = Math.max(1, slice.naturalW - slice.trim.left - slice.trim.right);
        const sh = Math.max(1, slice.naturalH - slice.trim.top - slice.trim.bottom);

        const offCanvas = document.createElement('canvas');
        offCanvas.width = sw;
        offCanvas.height = sh;
        const offCtx = offCanvas.getContext('2d');
        offCtx.drawImage(slice.img, sx, sy, sw, sh, 0, 0, sw, sh);

        // Apply White Background Harmonizer
        if (cvState.autoWhite) {
          const imgData = offCtx.getImageData(0, 0, sw, sh);
          const d = imgData.data;
          // Thresholds based on sensitivity
          const threshMap = { 1: 246, 2: 236, 3: 226, 4: 216 };
          const thresh = threshMap[cvState.whiteSensitivity] || 236;

          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            // Check if near white
            if (r >= thresh && g >= thresh && b >= thresh) {
              const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
              if (maxDiff <= 18) {
                d[i] = 255;
                d[i + 1] = 255;
                d[i + 2] = 255;
              }
            } else if (cvState.enhanceContrast && r < 120 && g < 120 && b < 120) {
              // Deepen dark text
              d[i] = Math.max(0, r - 25);
              d[i + 1] = Math.max(0, g - 25);
              d[i + 2] = Math.max(0, b - 25);
            }
          }
          offCtx.putImageData(imgData, 0, 0);
        }

        // Rendered dimensions on page
        const renderH = Math.round((sh / sw) * contentWidth);
        return {
          id: slice.id,
          title: slice.title,
          canvas: offCanvas,
          width: contentWidth,
          height: renderH
        };
      });

      // Clear existing page elements
      wrapper.querySelectorAll('.cv-paper-page').forEach(p => p.remove());

      if (cvState.viewMode === 'continuous' || cvState.format === 'auto') {
        // Continuous single sheet mode
        const totalContentH = processedSlices.reduce((acc, s) => acc + s.height, 0) + (processedSlices.length - 1) * cvState.gapPx;
        const totalSheetH = totalContentH + 2 * marginPx;

        const pageEl = document.createElement('div');
        pageEl.className = 'cv-paper-page';
        pageEl.style.width = `${pageWidth}px`;
        pageEl.style.height = `${totalSheetH}px`;

        const canvas = document.createElement('canvas');
        canvas.className = 'cv-page-canvas';
        canvas.width = pageWidth;
        canvas.height = totalSheetH;
        canvas.style.width = `${pageWidth}px`;
        canvas.style.height = `${totalSheetH}px`;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageWidth, totalSheetH);

        let currY = marginPx;
        processedSlices.forEach(s => {
          ctx.drawImage(s.canvas, marginPx, currY, s.width, s.height);
          currY += s.height + cvState.gapPx;
        });

        pageEl.appendChild(canvas);
        pageEl.insertAdjacentHTML('beforeend', `<div class="cv-page-number-tag">Continuous Sheet • ${cvState.slices.length} Sections</div>`);
        wrapper.appendChild(pageEl);

        if (statBadge) {
          statBadge.textContent = `Continuous Sheet • ${cvState.slices.length} Slices`;
        }
      } else {
        // Paginated Mode (A4 or US Letter)
        const pages = [];
        let currPage = { slices: [], usedHeight: 0 };
        pages.push(currPage);

        processedSlices.forEach(s => {
          const needed = s.height + (currPage.slices.length > 0 ? cvState.gapPx : 0);
          if (currPage.slices.length > 0 && (currPage.usedHeight + needed) > contentHeight) {
            // Start next page
            currPage = { slices: [s], usedHeight: s.height };
            pages.push(currPage);
          } else {
            currPage.slices.push(s);
            currPage.usedHeight += needed;
          }
        });

        // Render each paper page
        pages.forEach((pageData, pIdx) => {
          const pageEl = document.createElement('div');
          pageEl.className = 'cv-paper-page';
          pageEl.style.width = `${pageWidth}px`;
          pageEl.style.height = `${pageHeight}px`;

          const canvas = document.createElement('canvas');
          canvas.className = 'cv-page-canvas';
          canvas.width = pageWidth;
          canvas.height = pageHeight;
          canvas.style.width = `${pageWidth}px`;
          canvas.style.height = `${pageHeight}px`;

          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageWidth, pageHeight);

          let currY = marginPx;
          pageData.slices.forEach(s => {
            ctx.drawImage(s.canvas, marginPx, currY, s.width, s.height);
            currY += s.height + cvState.gapPx;
          });

          pageEl.appendChild(canvas);
          pageEl.insertAdjacentHTML('beforeend', `<div class="cv-page-number-tag">Page ${pIdx + 1} of ${pages.length} (${cvState.format.toUpperCase()})</div>`);
          wrapper.appendChild(pageEl);
        });

        if (statBadge) {
          statBadge.textContent = `${pages.length} Page${pages.length > 1 ? 's' : ''} (${cvState.format.toUpperCase()}) • ${cvState.slices.length} Slices`;
        }
      }

      // Apply Zoom scaling
      wrapper.style.transform = `scale(${cvState.zoom})`;
      setCvExportButtonsEnabled(true);
    }

    // View Mode Toggle (Paginated vs Continuous)
    elements.btnViewPaginated?.addEventListener('click', () => {
      elements.btnViewPaginated.classList.add('active');
      elements.btnViewContinuous?.classList.remove('active');
      cvState.viewMode = 'paginated';
      renderCompiledCV();
    });
    elements.btnViewContinuous?.addEventListener('click', () => {
      elements.btnViewContinuous.classList.add('active');
      elements.btnViewPaginated?.classList.remove('active');
      cvState.viewMode = 'continuous';
      renderCompiledCV();
    });

    // Zoom Controls
    function setCvZoom(z) {
      cvState.zoom = Math.max(0.35, Math.min(2.0, z));
      if (elements.cvZoomDisplay) {
        elements.cvZoomDisplay.textContent = `${Math.round(cvState.zoom * 100)}%`;
      }
      if (elements.cvPagesWrapper) {
        elements.cvPagesWrapper.style.transform = `scale(${cvState.zoom})`;
      }
    }

    elements.btnCvZoomIn?.addEventListener('click', () => setCvZoom(cvState.zoom * 1.15));
    elements.btnCvZoomOut?.addEventListener('click', () => setCvZoom(cvState.zoom / 1.15));
    elements.cvZoomDisplay?.addEventListener('click', () => setCvZoom(0.85));

    elements.btnCvFitWidth?.addEventListener('click', () => {
      const scrollport = elements.cvCanvasStageScroll;
      if (!scrollport) return;
      const targetW = cvState.format === 'letter' ? 1275 : 1240;
      const availW = scrollport.clientWidth - 80;
      setCvZoom(availW / targetW);
    });

    elements.btnCvFitPage?.addEventListener('click', () => {
      const scrollport = elements.cvCanvasStageScroll;
      if (!scrollport) return;
      const targetH = cvState.format === 'letter' ? 1650 : 1754;
      const availH = scrollport.clientHeight - 80;
      setCvZoom(availH / targetH);
    });

    // Inspector Format Chips
    elements.cvFormatChips?.forEach(chip => {
      chip.addEventListener('click', () => {
        elements.cvFormatChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        cvState.format = chip.dataset.format;
        renderCompiledCV();
      });
    });

    // Margins & Gap Sliders
    elements.cvMarginSlider?.addEventListener('input', (e) => {
      cvState.marginMm = parseInt(e.target.value, 10);
      if (elements.cvMarginValDisplay) elements.cvMarginValDisplay.textContent = `${cvState.marginMm} mm`;
      renderCompiledCV();
    });

    elements.cvGapSlider?.addEventListener('input', (e) => {
      cvState.gapPx = parseInt(e.target.value, 10);
      if (elements.cvGapValDisplay) elements.cvGapValDisplay.textContent = `${cvState.gapPx} px`;
      renderCompiledCV();
    });

    // Whitening Controls
    elements.cvAutoWhiteCheck?.addEventListener('change', (e) => {
      cvState.autoWhite = e.target.checked;
      if (elements.cvWhiteThresholdWrap) {
        elements.cvWhiteThresholdWrap.style.display = cvState.autoWhite ? 'block' : 'none';
      }
      renderCompiledCV();
    });

    elements.cvWhiteThresholdSlider?.addEventListener('input', (e) => {
      cvState.whiteSensitivity = parseInt(e.target.value, 10);
      const labels = { 1: 'Level 1 (Subtle)', 2: 'Level 2 (Normal)', 3: 'Level 3 (Aggressive)', 4: 'Level 4 (Max)' };
      if (elements.cvWhiteThresholdDisplay) {
        elements.cvWhiteThresholdDisplay.textContent = labels[cvState.whiteSensitivity] || 'Level 2';
      }
      renderCompiledCV();
    });

    elements.cvEnhanceContrastCheck?.addEventListener('change', (e) => {
      cvState.enhanceContrast = e.target.checked;
      renderCompiledCV();
    });

    // ========================================================================
    // EXPORT ACTIONS
    // ========================================================================
    // 1. Export PDF
    async function exportCompiledCvPDF() {
      if (cvState.slices.length === 0) return;
      const pageCanvases = elements.cvPagesWrapper.querySelectorAll('.cv-page-canvas');
      if (pageCanvases.length === 0) return;

      try {
        showToast('Compiling print-ready vector PDF...', 'info');
        const { PDFDocument } = window.PDFLib;
        const pdfDoc = await PDFDocument.create();

        for (let i = 0; i < pageCanvases.length; i++) {
          const canvas = pageCanvases[i];
          const pngDataUrl = canvas.toDataURL('image/png');
          const pngImage = await pdfDoc.embedPng(pngDataUrl);

          // Standard dimensions in PDF points (72 DPI)
          let pW = 595.28, pH = 841.89; // A4
          if (cvState.format === 'letter') {
            pW = 612; pH = 792;
          } else if (cvState.viewMode === 'continuous' || cvState.format === 'auto') {
            pW = Math.round((canvas.width / 150) * 72);
            pH = Math.round((canvas.height / 150) * 72);
          }

          const page = pdfDoc.addPage([pW, pH]);
          page.drawImage(pngImage, {
            x: 0,
            y: 0,
            width: pW,
            height: pH
          });
        }

        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'Compiled_Resume_CV.pdf';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Compiled CV PDF exported successfully!', 'success');
      } catch (err) {
        console.error('PDF export error:', err);
        showToast('Error exporting PDF: ' + err.message, 'info');
      }
    }

    elements.btnExportCvPDF?.addEventListener('click', exportCompiledCvPDF);

    // 2. Export PNG
    function exportCompiledCvPNG() {
      const pageCanvases = elements.cvPagesWrapper.querySelectorAll('.cv-page-canvas');
      if (pageCanvases.length === 0) return;

      if (pageCanvases.length === 1) {
        const url = pageCanvases[0].toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Compiled_CV.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('CV PNG saved!', 'success');
      } else {
        // Stitch pages vertically into one high-res PNG
        let totalW = pageCanvases[0].width;
        let totalH = 0;
        pageCanvases.forEach(c => totalH += c.height + 20);

        const merged = document.createElement('canvas');
        merged.width = totalW;
        merged.height = totalH;
        const mCtx = merged.getContext('2d');
        mCtx.fillStyle = '#ffffff';
        mCtx.fillRect(0, 0, totalW, totalH);

        let currY = 0;
        pageCanvases.forEach(c => {
          mCtx.drawImage(c, 0, currY);
          currY += c.height + 20;
        });

        const url = merged.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Compiled_CV_Full.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('All CV pages saved as full PNG!', 'success');
      }
    }

    elements.btnExportCvPNG?.addEventListener('click', exportCompiledCvPNG);

    // 3. Copy to Clipboard
    async function copyCompiledCvToClipboard() {
      const pageCanvases = elements.cvPagesWrapper.querySelectorAll('.cv-page-canvas');
      if (pageCanvases.length === 0) return;

      try {
        const canvas = pageCanvases[0];
        canvas.toBlob(async (blob) => {
          if (!blob) return;
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            showToast('Compiled CV copied to clipboard!', 'success');
          } catch (clipErr) {
            console.error('Clipboard copy error:', clipErr);
            showToast('Failed to copy to clipboard directly.', 'info');
          }
        }, 'image/png');
      } catch (err) {
        console.error('Copy error:', err);
      }
    }

    elements.btnCopyCvClipboard?.addEventListener('click', copyCompiledCvToClipboard);

    // 4. Print
    elements.btnPrintCv?.addEventListener('click', () => {
      window.print();
    });
  }

  // Kickoff on DOM loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
