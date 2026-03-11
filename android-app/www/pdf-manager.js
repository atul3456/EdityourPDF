// PDF Manager Logic - Complete Suite
// Includes: Editor, Merge, Photo-to-PDF, PDF-to-PPT/Word/Writer

// --- DOM Elements ---
const homeDashboard = document.getElementById('home-dashboard');
const mergeSection = document.getElementById('merge-section');
const editorWorkspace = document.getElementById('editor-workspace');
const bottomToolbar = document.getElementById('bottom-toolbar');

// Editor Components
const pdfMainContainer = document.getElementById('pdf-main-container');
const textOptions = document.getElementById('text-options');
const zoomDisplay = document.getElementById('zoom-level-display');

// Inputs
const pdfUploadInput = document.getElementById('pdf-upload-input');
const pdfDropZone = document.getElementById('pdf-drop-zone');
const mergeUploadInput = document.getElementById('merge-upload-input');
const mergeDropZone = document.getElementById('merge-drop-zone');

// State
let currentPdfDoc = null;
let currentTool = 'cursor';
let currentZoom = 1.0;
let finalDownloadBlob = null;

document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupTools();
    setupZoom();
    setupConverters();
    setupEditorSidebar();
});

// --- Navigation & View Management ---
function setupNavigation() {
    console.log('Setting up navigation...');

    // Top & Drawer Navigation Links
    document.getElementById('nav-pdf-tools').addEventListener('click', (e) => { e.preventDefault(); showView('home'); });
    document.getElementById('nav-img-editor').addEventListener('click', (e) => { e.preventDefault(); showView('img-editor'); });
    document.getElementById('drawer-pdf-tools').addEventListener('click', (e) => { e.preventDefault(); closeMobileDrawer(); showView('home'); });
    document.getElementById('drawer-img-editor').addEventListener('click', (e) => { e.preventDefault(); closeMobileDrawer(); showView('img-editor'); });

    document.getElementById('card-editor').addEventListener('click', () => showView('editor'));
    document.getElementById('card-merge').addEventListener('click', () => showView('merge'));
    document.getElementById('card-photo-pdf').addEventListener('click', () => showView('photo-pdf'));
    document.getElementById('card-pdf-ppt').addEventListener('click', () => showView('pdf-ppt'));
    document.getElementById('card-pdf-word').addEventListener('click', () => showView('pdf-word'));
    document.getElementById('card-pdf-writer').addEventListener('click', () => showView('pdf-writer'));

    // Back Buttons
    document.querySelectorAll('.btn-back-home').forEach(btn => {
        btn.addEventListener('click', () => showView('home'));
    });

    // Modals
    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('success-modal').classList.add('hidden');
        resetAllToolStates();
    });
    document.getElementById('btn-download-final').addEventListener('click', () => {
        if (finalDownloadBlob) {
            const link = document.createElement('a');
            link.href = window.URL.createObjectURL(finalDownloadBlob.blob);
            link.download = finalDownloadBlob.name;
            link.click();
        }
    });

    // Editor Upload
    pdfDropZone.addEventListener('click', () => pdfUploadInput.click());
    pdfDropZone.addEventListener('dragover', (e) => e.preventDefault());
    pdfDropZone.addEventListener('drop', (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files, false); });
    pdfUploadInput.addEventListener('change', (e) => handleFiles(e.target.files, false));

    // Merge Upload
    mergeDropZone.addEventListener('click', () => mergeUploadInput.click());
    mergeDropZone.addEventListener('dragover', (e) => e.preventDefault());
    mergeDropZone.addEventListener('drop', (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files, true); });
    mergeUploadInput.addEventListener('change', (e) => handleFiles(e.target.files, true));
}

function closeMobileDrawer() {
    const drawer = document.getElementById('nav-drawer');
    const overlay = document.getElementById('nav-drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    document.body.style.overflow = '';
}

function showView(view) {
    const allSections = document.querySelectorAll('section, .workspace-container, .bottom-toolbar');
    allSections.forEach(el => {
        if (!el.classList.contains('hidden')) {
            el.classList.add('hidden');
        }
    });
    document.getElementById('home-dashboard').classList.add('hidden');
    document.querySelectorAll('.img-tool-section,#img-editor-dashboard').forEach(s => s.classList.add('hidden'));

    let target = null;
    if (view === 'home') target = document.getElementById('home-dashboard');
    else if (view === 'img-editor') target = document.getElementById('img-editor-dashboard');
    else if (view === 'merge') target = document.getElementById('merge-section');
    else if (view === 'editor') {
        target = document.getElementById('editor-workspace');
        target.classList.remove('hidden');
        if (currentPdfDoc) {
            document.getElementById('bottom-toolbar').classList.remove('hidden');
            document.getElementById('editor-body').classList.remove('hidden');
        }
        target.classList.add('view-enter');
        target.addEventListener('animationend', () => target.classList.remove('view-enter'), { once: true });
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }
    else if (view === 'photo-pdf') target = document.getElementById('photo-pdf-section');
    else if (view === 'ocr') target = document.getElementById('ocr-section');
    else if (view === 'security') target = document.getElementById('security-section');
    else if (view === 'compress') target = document.getElementById('compress-section');
    else if (view === 'convert') target = document.getElementById('convert-section');
    else if (view === 'summarize') target = document.getElementById('summarize-section');
    else if (view === 'voice') target = document.getElementById('voice-section');
    else if (view === 'pdf-ppt') target = document.getElementById('pdf-ppt-section');
    else if (view === 'pdf-word') target = document.getElementById('pdf-word-section');
    else if (view === 'pdf-writer') target = document.getElementById('pdf-writer-section');
    else if (view === 'split') target = document.getElementById('split-section');
    else if (view === 'rotate') target = document.getElementById('rotate-section');
    else if (view === 'watermark') target = document.getElementById('watermark-section');
    else if (view === 'pagenums') target = document.getElementById('pagenums-section');
    else if (view === 'pdf-excel') target = document.getElementById('pdf-excel-section');
    else if (view === 'reorder') target = document.getElementById('reorder-section');
    else if (view === 'pdf-text') target = document.getElementById('pdf-text-section');
    else if (view === 'metadata') target = document.getElementById('metadata-section');
    else if (view === 'redact') target = document.getElementById('redact-section');
    else if (view === 'compare') target = document.getElementById('compare-section');
    else if (view === 'pdf-markdown') target = document.getElementById('pdf-markdown-section');
    else if (view === 'form-filler') target = document.getElementById('form-filler-section');
    else if (view === 'delete-pages') target = document.getElementById('delete-pages-section');
    else if (view === 'page-resize') target = document.getElementById('page-resize-section');

    if (target) {
        target.classList.remove('hidden');
        target.classList.add('view-enter');
        target.addEventListener('animationend', () => target.classList.remove('view-enter'), { once: true });
        if (view === 'home') animateCardsEntrance();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Editor Logic ---
async function handleFiles(fileList, isMergeFlow) {
    if (!fileList || fileList.length === 0) return;
    if (isMergeFlow) showView('editor');
    try {
        if (!currentPdfDoc) {
            const first = fileList[0];
            const bytes = await first.arrayBuffer();
            currentPdfDoc = await PDFLib.PDFDocument.load(bytes);
            for (let i = 1; i < fileList.length; i++) {
                const b = await fileList[i].arrayBuffer();
                const src = await PDFLib.PDFDocument.load(b);
                const pages = await currentPdfDoc.copyPages(src, src.getPageIndices());
                pages.forEach(p => currentPdfDoc.addPage(p));
            }
        } else {
            for (let i = 0; i < fileList.length; i++) {
                const b = await fileList[i].arrayBuffer();
                const src = await PDFLib.PDFDocument.load(b);
                const pages = await currentPdfDoc.copyPages(src, src.getPageIndices());
                pages.forEach(p => currentPdfDoc.addPage(p));
            }
        }
        pdfDropZone.classList.add('hidden');
        document.getElementById('btn-editor-home-initial').classList.add('hidden');
        document.getElementById('editor-body').classList.remove('hidden');
        pdfMainContainer.classList.remove('hidden');
        bottomToolbar.classList.remove('hidden');
        renderAllPages();
    } catch (e) {
        console.error(e);
        showToast('Error loading PDF. Make sure the file is valid.', 'error');
    }
}

async function renderAllPages() {
    pdfMainContainer.innerHTML = '';
    const bytes = await currentPdfDoc.save();
    const loadingTask = pdfjsLib.getDocument(bytes);
    const pdf = await loadingTask.promise;
    const viewportWidth = window.innerWidth;
    let targetWidth;
    if (viewportWidth <= 480) targetWidth = viewportWidth - 50;
    else if (viewportWidth <= 768) targetWidth = viewportWidth * 0.75;
    else targetWidth = Math.min(700, viewportWidth * 0.55);

    currentZoom = 1.0;
    document.getElementById('pdf-main-container').style.transform = 'scale(1)';
    document.getElementById('zoom-level-display').innerText = '100%';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const defaultViewport = page.getViewport({ scale: 1.0 });
        const scale = targetWidth / defaultViewport.width;
        const viewport = page.getViewport({ scale });
        const wrapper = document.createElement('div');
        wrapper.className = 'page-wrapper';
        wrapper.style.width = `${viewport.width}px`;
        wrapper.style.height = `${viewport.height}px`;
        wrapper.dataset.pageNumber = i;
        wrapper.dataset.originalWidth = viewport.width;
        wrapper.dataset.originalHeight = viewport.height;
        // Use click for page selection so scrolling works on mobile
        wrapper.addEventListener('click', () => {
            document.querySelectorAll('.page-wrapper').forEach(p => p.classList.remove('selected-page'));
            wrapper.classList.add('selected-page');
        });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        const overlay = document.createElement('div');
        overlay.className = 'interaction-layer cursor-tool';
        overlay.addEventListener('mousedown', (e) => handleOverlayInteraction(e, overlay));
        overlay.addEventListener('touchstart', (e) => {
            // Only intercept touch for active tools, let cursor mode scroll normally
            if (currentTool !== 'cursor') handleOverlayInteraction(e, overlay);
        }, { passive: false });
        wrapper.appendChild(canvas);
        wrapper.appendChild(overlay);
        pdfMainContainer.appendChild(wrapper);
    }
    refreshOverlays();
}

// --- Editor Tools ---
function setupTools() {
    document.querySelectorAll('.tool-btn').forEach(btn => {
        if (['tool-insert-above', 'tool-insert-below', 'tool-delete-page'].includes(btn.id)) return;
        btn.addEventListener('click', () => {
            if (btn.dataset.tool === 'signature') { openSignatureModal(); return; }
            document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
            textOptions.classList.toggle('hidden', currentTool !== 'text');
            updateCursor();
            refreshOverlays();
        });
    });
    document.getElementById('tool-insert-above').addEventListener('click', () => insertPage('above'));
    document.getElementById('tool-insert-below').addEventListener('click', () => insertPage('below'));
    document.getElementById('tool-delete-page').addEventListener('click', deleteSelectedPage);
    document.getElementById('btn-apply-changes').addEventListener('click', () => applyChanges(false));
    document.getElementById('btn-download-pdf').addEventListener('click', () => applyChanges(true));
    setupSignatureModal();
}

// --- Signature Logic ---
let sigCanvas, sigCtx, isDrawing = false;
function setupSignatureModal() {
    sigCanvas = document.getElementById('signature-canvas');
    sigCtx = sigCanvas.getContext('2d');
    const startDraw = (e) => { isDrawing = true; sigCtx.beginPath(); sigCtx.lineWidth = 2; sigCtx.lineCap = 'round'; sigCtx.strokeStyle = '#000'; const { x, y } = getPos(e); sigCtx.moveTo(x, y); };
    const moveDraw = (e) => { if (!isDrawing) return; const { x, y } = getPos(e); sigCtx.lineTo(x, y); sigCtx.stroke(); };
    const endDraw = () => { isDrawing = false; sigCtx.closePath(); };
    const getPos = (e) => { const rect = sigCanvas.getBoundingClientRect(); const clientX = e.touches ? e.touches[0].clientX : e.clientX; const clientY = e.touches ? e.touches[0].clientY : e.clientY; return { x: clientX - rect.left, y: clientY - rect.top }; };
    sigCanvas.addEventListener('mousedown', startDraw);
    sigCanvas.addEventListener('mousemove', moveDraw);
    sigCanvas.addEventListener('mouseup', endDraw);
    sigCanvas.addEventListener('touchstart', startDraw);
    sigCanvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveDraw(e); });
    sigCanvas.addEventListener('touchend', endDraw);
    document.getElementById('btn-clear-sig').addEventListener('click', () => sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height));
    document.getElementById('btn-close-sig').addEventListener('click', () => document.getElementById('signature-modal').classList.add('hidden'));
    document.getElementById('btn-save-sig').addEventListener('click', () => {
        const typeArea = document.getElementById('sig-type-area');
        if (!typeArea.classList.contains('hidden')) {
            const text = document.getElementById('sig-type-input').value.trim();
            if (!text) { showToast('Please type your name first.', 'warning'); return; }
            sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
            sigCtx.font = '48px "Dancing Script", cursive';
            sigCtx.fillStyle = '#1a1a2e';
            sigCtx.textAlign = 'center';
            sigCtx.textBaseline = 'middle';
            sigCtx.fillText(text, sigCanvas.width / 2, sigCanvas.height / 2);
        }
        const dataUrl = sigCanvas.toDataURL('image/png');
        placeSignatureOnPage(dataUrl);
        document.getElementById('signature-modal').classList.add('hidden');
    });
    document.getElementById('tab-draw').addEventListener('click', () => toggleSigTab('draw'));
    document.getElementById('tab-type').addEventListener('click', () => toggleSigTab('type'));
    document.getElementById('tab-upload').addEventListener('click', () => toggleSigTab('upload'));
    document.getElementById('sig-type-input').addEventListener('input', (e) => {
        document.getElementById('sig-type-preview').textContent = e.target.value || '';
    });
    document.getElementById('sig-upload-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) { const reader = new FileReader(); reader.onload = (v) => { const img = new Image(); img.onload = () => { sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); sigCtx.drawImage(img, 0, 0, 500, 200); }; img.src = v.target.result; }; reader.readAsDataURL(file); }
    });
}
function toggleSigTab(tab) {
    document.getElementById('sig-draw-area').classList.toggle('hidden', tab !== 'draw');
    document.getElementById('sig-upload-area').classList.toggle('hidden', tab !== 'upload');
    document.getElementById('sig-type-area').classList.toggle('hidden', tab !== 'type');
    document.getElementById('tab-draw').className = 'glass-btn ' + (tab === 'draw' ? 'primary' : 'secondary') + ' small';
    document.getElementById('tab-upload').className = 'glass-btn ' + (tab === 'upload' ? 'primary' : 'secondary') + ' small';
    document.getElementById('tab-type').className = 'glass-btn ' + (tab === 'type' ? 'primary' : 'secondary') + ' small';
}
function openSignatureModal() { document.getElementById('signature-modal').classList.remove('hidden'); sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); }
function placeSignatureOnPage(imgData) {
    const wrappers = document.querySelectorAll('.page-wrapper');
    let target = document.querySelector('.page-wrapper.selected-page') || wrappers[0];
    if (!target) return;
    const overlay = target.querySelector('.interaction-layer');
    createImg(100, 100, imgData, overlay);
}

function setupZoom() {
    document.getElementById('btn-zoom-in').addEventListener('click', () => updateZoom(0.1));
    document.getElementById('btn-zoom-out').addEventListener('click', () => updateZoom(-0.1));
}
function updateZoom(c) {
    currentZoom = Math.max(0.5, Math.min(3.0, currentZoom + c));
    document.getElementById('pdf-main-container').style.transform = `scale(${currentZoom})`;
    document.getElementById('pdf-main-container').style.transformOrigin = 'top center';
    document.getElementById('zoom-level-display').innerText = `${Math.round(currentZoom * 100)}%`;
}

async function insertPage(pos) {
    if (!currentPdfDoc) return;
    const selected = document.querySelector('.page-wrapper.selected-page');
    if (!selected) return showToast('Select a page first.', 'warning');
    const idx = parseInt(selected.dataset.pageNumber) - (pos === 'above' ? 1 : 0);
    currentPdfDoc.insertPage(idx, [595, 842]);
    await renderAllPages();
}
async function deleteSelectedPage() {
    if (!currentPdfDoc) return;
    const selected = document.querySelector('.page-wrapper.selected-page');
    if (!selected) return showToast('Select a page first.', 'warning');
    currentPdfDoc.removePage(parseInt(selected.dataset.pageNumber) - 1);
    await renderAllPages();
}

// --- Converters ---
function setupConverters() {
    const pU = document.getElementById('photo-upload-input');
    const pD = document.getElementById('photo-drop-zone');
    pD.addEventListener('click', () => pU.click());
    pD.addEventListener('drop', (e) => { e.preventDefault(); convertPhotoToPdf(e.dataTransfer.files) });
    pD.addEventListener('dragover', (e) => e.preventDefault());
    pU.addEventListener('change', (e) => convertPhotoToPdf(e.target.files));
    const pptU = document.getElementById('pdf-ppt-upload-input');
    const pptD = document.getElementById('pdf-ppt-drop-zone');
    pptD.addEventListener('click', () => pptU.click());
    pptD.addEventListener('drop', (e) => { e.preventDefault(); convertPdfToDoc(e.dataTransfer.files[0], 'ppt') });
    pptD.addEventListener('dragover', (e) => e.preventDefault());
    pptU.addEventListener('change', (e) => convertPdfToDoc(e.target.files[0], 'ppt'));
    const wU = document.getElementById('pdf-word-upload-input');
    const wD = document.getElementById('pdf-word-drop-zone');
    wD.addEventListener('click', () => wU.click());
    wD.addEventListener('drop', (e) => { e.preventDefault(); convertPdfToDoc(e.dataTransfer.files[0], 'word') });
    wD.addEventListener('dragover', (e) => e.preventDefault());
    wU.addEventListener('change', (e) => convertPdfToDoc(e.target.files[0], 'word'));
    const lU = document.getElementById('pdf-writer-upload-input');
    const lD = document.getElementById('pdf-writer-drop-zone');
    lD.addEventListener('click', () => lU.click());
    lD.addEventListener('drop', (e) => { e.preventDefault(); convertPdfToDoc(e.dataTransfer.files[0], 'writer') });
    lD.addEventListener('dragover', (e) => e.preventDefault());
    lU.addEventListener('change', (e) => convertPdfToDoc(e.target.files[0], 'writer'));
}
async function convertPhotoToPdf(files) {
    if (!files || !files.length) return;
    showProgress('Converting Photos...');
    try {
        const doc = await PDFLib.PDFDocument.create();
        for (let i = 0; i < files.length; i++) {
            const f = files[i]; if (!f.type.startsWith('image/')) continue;
            const buf = await f.arrayBuffer(); let img;
            if (f.type === 'image/jpeg') img = await doc.embedJpg(buf);
            else if (f.type === 'image/png') img = await doc.embedPng(buf);
            else continue;
            const p = doc.addPage([img.width, img.height]);
            p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        }
        showSuccess(new Blob([await doc.save()], { type: 'application/pdf' }), 'photos.pdf');
    } catch (e) { console.error(e); hideProgress(); showToast('Error converting photos: ' + e.message, 'error'); }
}
async function convertPdfToDoc(file, type) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    showProgress('Converting...');
    try {
        const pdf = await pdfjsLib.getDocument(await file.arrayBuffer()).promise;
        const imgs = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const p = await pdf.getPage(i);
            const vp = p.getViewport({ scale: 2.0 });
            const cvs = document.createElement('canvas'); cvs.width = vp.width; cvs.height = vp.height;
            await p.render({ canvasContext: cvs.getContext('2d'), viewport: vp }).promise;
            imgs.push({ data: cvs.toDataURL('image/jpeg', 0.8), w: vp.width, h: vp.height });
        }
        if (type === 'ppt') {
            const pptx = new PptxGenJS();
            imgs.forEach(im => { const s = pptx.addSlide(); s.addImage({ data: im.data, x: 0, y: 0, w: '100%', h: '100%' }); });
            showSuccess(await pptx.write('blob'), 'converted.pptx');
        } else {
            const children = [];
            imgs.forEach(im => { children.push(new docx.Paragraph({ children: [new docx.ImageRun({ data: im.data, transformation: { width: im.w * 0.75, height: im.h * 0.75 } })] })); });
            const doc = new docx.Document({ sections: [{ children }] });
            showSuccess(await docx.Packer.toBlob(doc), type === 'word' ? 'converted.docx' : 'converted.odt');
        }
    } catch (e) { console.error(e); hideProgress(); showToast('Conversion failed: ' + e.message, 'error'); }
}

// --- Interaction Helpers (Mouse + Touch) ---
function getPointerXY(e) {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

function handleOverlayInteraction(e, overlay) {
    if (e.target !== overlay) return;
    // Only prevent default scroll for active tools, NOT cursor
    if (currentTool === 'cursor') return;
    if (e.cancelable) e.preventDefault();
    const rect = overlay.getBoundingClientRect();
    const pt = getPointerXY(e);
    const x = pt.x - rect.left; const y = pt.y - rect.top;
    if (currentTool === 'text') createFloatingText(x, y, overlay);
    else if (currentTool === 'image') triggerImageUpload(x, y, overlay);
    else if (currentTool === 'whiteout') startDrawingBox(e, overlay, 'whiteout-element');
    else if (currentTool === 'crop') initCropBox(overlay);
}
// Keep old name as alias for backwards compat
function handleOverlayMouseDown(e, overlay) { handleOverlayInteraction(e, overlay); }

function refreshOverlays() { document.querySelectorAll('.interaction-layer').forEach(o => { if (currentTool !== 'crop') { const c = o.querySelector('.crop-box'); if (c) c.remove(); } }); updateCursor(); }
function updateCursor() { document.querySelectorAll('.interaction-layer').forEach(e => e.className = `interaction-layer ${currentTool}-tool`); }

function startDrawingBox(e, parent, className) {
    const pt = getPointerXY(e);
    const startX = pt.x - parent.getBoundingClientRect().left;
    const startY = pt.y - parent.getBoundingClientRect().top;
    const box = document.createElement('div'); box.className = className;
    box.style.left = `${startX}px`; box.style.top = `${startY}px`; parent.appendChild(box);
    const onMove = (ev) => {
        if (ev.cancelable) ev.preventDefault();
        const mp = getPointerXY(ev);
        const cX = mp.x - parent.getBoundingClientRect().left;
        const cY = mp.y - parent.getBoundingClientRect().top;
        box.style.width = `${Math.abs(cX - startX)}px`; box.style.height = `${Math.abs(cY - startY)}px`;
        box.style.left = `${Math.min(cX, startX)}px`; box.style.top = `${Math.min(cY, startY)}px`;
    };
    const onUp = () => {
        window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
        window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
        attachDrag(box, box);
    };
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp);
}

function createFloatingText(x, y, p) {
    const c = document.createElement('div');
    c.className = 'added-text-element';
    c.style.left = x + 'px';
    c.style.top = y + 'px';
    applyStyle(c);

    // Drag bar at top
    const bar = document.createElement('div');
    bar.className = 'element-drag-bar';
    bar.innerHTML = '<i class="fa-solid fa-grip-lines"></i>';
    bar.title = 'Drag to move';

    // Delete button
    const del = document.createElement('button');
    del.className = 'element-delete-btn';
    del.innerHTML = '&#10005;';
    del.title = 'Delete';
    del.addEventListener('mousedown', (e) => e.stopPropagation());
    del.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    del.addEventListener('click', () => c.remove());

    // Editable text area
    const d = document.createElement('div');
    d.contentEditable = true;
    d.className = 'text-content';
    d.innerText = 'Type here...';
    d.style.outline = 'none';
    d.style.minHeight = '24px';
    d.style.padding = '2px 4px';
    d.style.wordBreak = 'break-word';

    // Resize handle at bottom-right
    const rh = document.createElement('div');
    rh.className = 'element-resize-handle';
    rh.title = 'Drag to resize';

    c.appendChild(bar);
    c.appendChild(del);
    c.appendChild(d);
    c.appendChild(rh);
    p.appendChild(c);

    attachDrag(c, bar);
    attachResize(c, rh, true);
}

function triggerImageUpload(x, y, p) { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e) => { const r = new FileReader(); r.onload = (v) => createImg(x, y, v.target.result, p); r.readAsDataURL(e.target.files[0]) }; i.click(); }

function createImg(x, y, src, p) {
    const c = document.createElement('div');
    c.className = 'added-image-element';
    c.style.left = x + 'px';
    c.style.top = y + 'px';
    c.style.width = '200px';
    c.style.height = '150px';

    // Drag bar at top
    const bar = document.createElement('div');
    bar.className = 'element-drag-bar';
    bar.innerHTML = '<i class="fa-solid fa-grip-lines"></i>';
    bar.title = 'Drag to move';

    // Delete button
    const del = document.createElement('button');
    del.className = 'element-delete-btn';
    del.innerHTML = '&#10005;';
    del.title = 'Delete';
    del.addEventListener('mousedown', (e) => e.stopPropagation());
    del.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    del.addEventListener('click', () => c.remove());

    // Image
    const img = document.createElement('img');
    img.src = src;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.display = 'block';
    img.style.pointerEvents = 'none';

    // Resize handle at bottom-right
    const rh = document.createElement('div');
    rh.className = 'element-resize-handle';
    rh.title = 'Drag to resize';

    c.appendChild(bar);
    c.appendChild(del);
    c.appendChild(img);
    c.appendChild(rh);
    p.appendChild(c);

    attachDrag(c, bar);
    attachResize(c, rh, false);
}

function initCropBox(overlay) {
    if (overlay.querySelector('.crop-box')) return;
    const b = document.createElement('div'); b.className = 'crop-box'; b.style.width = '80%'; b.style.height = '80%'; b.style.left = '10%'; b.style.top = '10%';
    ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'].forEach(d => {
        const h = document.createElement('div'); h.className = 'resize-handle'; h.style.display = 'block'; h.style.background = '#00e5ff';
        // Make handles larger on touch devices
        const handleSize = ('ontouchstart' in window) ? '20px' : '10px';
        h.style.width = handleSize; h.style.height = handleSize;
        if (d.includes('n')) h.style.top = '-5px'; else if (d.includes('s')) h.style.bottom = '-5px'; else h.style.top = '50%';
        if (d.includes('w')) h.style.left = '-5px'; else if (d.includes('e')) h.style.right = '-5px'; else h.style.left = '50%';
        if (d === 'n' || d === 's') h.style.transform = 'translateX(-50%)';
        if (d === 'e' || d === 'w') h.style.transform = 'translateY(-50%)';
        if (d === 'n' || d === 's') h.style.cursor = 'ns-resize';
        else if (d === 'e' || d === 'w') h.style.cursor = 'ew-resize';
        else h.style.cursor = 'nwse-resize';
        if (d === 'ne' || d === 'sw') h.style.cursor = 'nesw-resize';
        b.appendChild(h);
        const startCropResize = (e) => {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
            const pt = getPointerXY(e);
            const sX = pt.x, sY = pt.y;
            const r = { l: b.offsetLeft, t: b.offsetTop, w: b.offsetWidth, h: b.offsetHeight };
            const onMove = (ev) => {
                if (ev.cancelable) ev.preventDefault();
                const mp = getPointerXY(ev);
                const dx = mp.x - sX; const dy = mp.y - sY;
                let nl = r.l, nt = r.t, nw = r.w, nh = r.h;
                if (d.includes('n')) { nt += dy; nh -= dy; } if (d.includes('s')) { nh += dy; }
                if (d.includes('w')) { nl += dx; nw -= dx; } if (d.includes('e')) { nw += dx; }
                if (nw > 20) { b.style.width = `${nw}px`; b.style.left = `${nl}px`; }
                if (nh > 20) { b.style.height = `${nh}px`; b.style.top = `${nt}px`; }
            };
            const onUp = () => {
                window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
                window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
            };
            window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
            window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp);
        };
        h.addEventListener('mousedown', startCropResize);
        h.addEventListener('touchstart', startCropResize, { passive: false });
    });
    overlay.appendChild(b);
    attachDrag(b, b);
}

// --- Global Drag & Resize Helpers ---
function attachDrag(el, barEl) {
    let isDragging = false, startX, startY, initCX, initCY;
    const trigger = barEl || el;

    const onStart = (e) => {
        if (e.target.classList.contains('element-resize-handle') ||
            e.target.classList.contains('element-delete-btn')) return;
        if (e.type !== 'touchstart' && e.cancelable) e.preventDefault();
        const pt = getPointerXY(e);
        initCX = pt.x; initCY = pt.y;
        startX = pt.x - el.offsetLeft;
        startY = pt.y - el.offsetTop;
        isDragging = true;
        el.style.zIndex = 30;
    };
    const onMove = (e) => {
        if (!isDragging) return;
        const pt = getPointerXY(e);
        if (e.type === 'touchmove' && Math.abs(pt.x - initCX) < 5 && Math.abs(pt.y - initCY) < 5) return;
        if (e.cancelable) e.preventDefault();
        const parent = el.parentElement;
        let nx = pt.x - startX;
        let ny = pt.y - startY;
        if (parent) {
            nx = Math.max(0, Math.min(nx, parent.offsetWidth - el.offsetWidth));
            ny = Math.max(0, Math.min(ny, parent.offsetHeight - el.offsetHeight));
        }
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
    };
    const onEnd = () => { isDragging = false; el.style.zIndex = 20; };

    trigger.addEventListener('mousedown', onStart);
    trigger.addEventListener('touchstart', onStart, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchend', onEnd);
}

function attachResize(el, handle, isText) {
    const onStart = (e) => {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        const pt = getPointerXY(e);
        const sX = pt.x, sY = pt.y, sW = el.offsetWidth, sH = el.offsetHeight;
        const sFontSize = isText ? (parseFloat(el.style.fontSize) || 16) : 0;

        const onMove = (ev) => {
            if (ev.cancelable) ev.preventDefault();
            const mp = getPointerXY(ev);
            const newW = Math.max(40, sW + mp.x - sX);
            const newH = Math.max(20, sH + mp.y - sY);
            el.style.width = newW + 'px';
            el.style.height = newH + 'px';
            if (isText) el.style.fontSize = Math.max(8, sFontSize * Math.max(0.3, newW / sW)) + 'px';
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
            window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp);
        };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onMove, { passive: false }); window.addEventListener('touchend', onUp);
    };
    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
}

function applyStyle(el) { el.style.color = document.getElementById('text-color').value; el.style.fontFamily = document.getElementById('font-family').value; el.style.fontSize = `${document.getElementById('font-size').value}px`; }

// --- Color Helper ---
function domColorToPdfColor(colorStr) {
    if (!colorStr) return PDFLib.rgb(0, 0, 0);
    if (colorStr.startsWith('#')) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(colorStr);
        return result ? PDFLib.rgb(parseInt(result[1], 16) / 255, parseInt(result[2], 16) / 255, parseInt(result[3], 16) / 255) : PDFLib.rgb(0, 0, 0);
    }
    const match = colorStr.match(/\d+/g);
    if (match && match.length >= 3) return PDFLib.rgb(parseInt(match[0]) / 255, parseInt(match[1]) / 255, parseInt(match[2]) / 255);
    return PDFLib.rgb(0, 0, 0);
}

// --- Apply Changes ---
async function applyChanges(download) {
    if (!currentPdfDoc) return;
    showProgress('Applying Changes...');
    try {
        const pages = currentPdfDoc.getPages();
        const wrappers = document.querySelectorAll('.page-wrapper');
        for (let i = 0; i < wrappers.length && i < pages.length; i++) {
            const w = wrappers[i]; const p = pages[i];
            const { width, height } = p.getSize();
            const domW = parseFloat(w.dataset.originalWidth) || 1;
            const domH = parseFloat(w.dataset.originalHeight) || 1;
            const sx = width / domW; const sy = height / domH;
            w.querySelectorAll('.whiteout-element').forEach(we => {
                const l = parseFloat(we.style.left) || 0, t = parseFloat(we.style.top) || 0;
                const wd = parseFloat(we.style.width) || 0, ht = parseFloat(we.style.height) || 0;
                if (wd === 0 || ht === 0) return;
                p.drawRectangle({ x: l * sx, y: height - (t * sy) - (ht * sy), width: wd * sx, height: ht * sy, color: PDFLib.rgb(1, 1, 1) });
            });
            w.querySelectorAll('.added-text-element').forEach(t => {
                const inner = t.querySelector('.text-content');
                const textStr = (inner ? inner.innerText : t.innerText).trim();
                if (!textStr) return;
                const l = parseFloat(t.style.left) || 0, tp = parseFloat(t.style.top) || 0;
                const fs = parseFloat(t.style.fontSize) || 16;
                p.drawText(textStr, { x: l * sx, y: height - (tp * sy) - (fs * sy * 0.8), size: fs * sy, color: domColorToPdfColor(t.style.color || document.getElementById('text-color').value) });
            });
            const images = w.querySelectorAll('.added-image-element');
            for (const imgDiv of images) {
                const img = imgDiv.querySelector('img'); if (!img) continue;
                const src = img.src; let embedded;
                try { if (src.includes('base64,')) { const b64 = src.split('base64,')[1]; if (src.includes('image/jpeg') || src.includes('image/jpg')) embedded = await currentPdfDoc.embedJpg(b64); else if (src.includes('image/png')) embedded = await currentPdfDoc.embedPng(b64); } } catch (err) { console.error('Image embed error', err); }
                if (embedded) { const l = parseFloat(imgDiv.style.left) || 0, tp = parseFloat(imgDiv.style.top) || 0; const wd = parseFloat(imgDiv.style.width) || 100, ht = parseFloat(imgDiv.style.height) || 100; p.drawImage(embedded, { x: l * sx, y: height - (tp * sy) - (ht * sy), width: wd * sx, height: ht * sy }); }
            }
            const crop = w.querySelector('.crop-box');
            if (crop) {
                const parentW = parseFloat(w.dataset.originalWidth) || domW;
                const parentH = parseFloat(w.dataset.originalHeight) || domH;
                let l = crop.style.left, tp = crop.style.top, wd = crop.style.width, ht = crop.style.height;
                l = l.includes('%') ? (parseFloat(l) / 100) * parentW : (parseFloat(l) || 0);
                tp = tp.includes('%') ? (parseFloat(tp) / 100) * parentH : (parseFloat(tp) || 0);
                wd = wd.includes('%') ? (parseFloat(wd) / 100) * parentW : (parseFloat(wd) || parentW);
                ht = ht.includes('%') ? (parseFloat(ht) / 100) * parentH : (parseFloat(ht) || parentH);
                if (wd > 0 && ht > 0) { const box = { x: l * sx, y: height - (tp * sy) - (ht * sy), width: wd * sx, height: ht * sy }; p.setCropBox(box.x, box.y, box.width, box.height); p.setMediaBox(box.x, box.y, box.width, box.height); }
            }
        }
        const bytes = await currentPdfDoc.save();
        hideProgress();
        if (download) { exportPdfBlob(bytes, 'edited.pdf', 'application/pdf'); }
        else { currentPdfDoc = await PDFLib.PDFDocument.load(bytes); await renderAllPages(); }
    } catch (e) { console.error(e); hideProgress(); showToast('Error applying changes: ' + e.message, 'error'); }
}
function exportPdfBlob(d, n, t) { const b = new Blob([d], { type: t }); const l = document.createElement('a'); l.href = window.URL.createObjectURL(b); l.download = n; l.click(); }
function showProgress(t) { document.getElementById('progress-modal').classList.remove('hidden'); document.getElementById('progress-text').innerText = t; }
function hideProgress() { document.getElementById('progress-modal').classList.add('hidden'); }
function showSuccess(b, n, extraInfo) {
    hideProgress(); finalDownloadBlob = { blob: b, name: n };
    document.getElementById('success-filename').innerText = n;
    const sizeInfo = document.getElementById('success-size-info');
    if (sizeInfo && extraInfo) { sizeInfo.innerHTML = extraInfo; sizeInfo.style.display = 'block'; }
    else if (sizeInfo) { sizeInfo.style.display = 'none'; }
    document.getElementById('success-modal').classList.remove('hidden');
}
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
    const toast = document.createElement('div'); toast.className = `toast toast-${type}`;
    const icons = { info: 'fa-circle-info', success: 'fa-circle-check', warning: 'fa-triangle-exclamation', error: 'fa-circle-xmark' };
    toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i><span>${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4000);
}
function resetAllToolStates() {
    document.querySelectorAll('.upload-zone').forEach(z => z.classList.remove('hidden'));
    document.querySelectorAll('#sec-options, #compress-options, #convert-options, #ocr-processing').forEach(o => o.classList.add('hidden'));
    const compBtn = document.getElementById('btn-process-compress'); if (compBtn) { compBtn.disabled = false; compBtn.innerText = 'Compress Now'; }
    const compSpinner = document.getElementById('compress-spinner'); if (compSpinner) compSpinner.classList.add('hidden');
    const secPwd = document.getElementById('sec-password'); if (secPwd) secPwd.value = '';
}

// --- AI & Voice ---
const aiSidebar = document.getElementById('ai-sidebar');
const aiContent = document.getElementById('ai-content-area');
let fullPdfText = '';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('card-summarize').addEventListener('click', () => showView('summarize'));
    document.getElementById('close-sidebar').addEventListener('click', () => aiSidebar.classList.add('hidden'));
    const sumU = document.getElementById('summarize-upload-input');
    const sumD = document.getElementById('summarize-drop-zone');
    sumD.addEventListener('click', () => sumU.click());
    sumD.addEventListener('drop', (e) => { e.preventDefault(); handleSummarize(e.dataTransfer.files[0]) });
    sumD.addEventListener('dragover', (e) => e.preventDefault());
    sumU.addEventListener('change', (e) => handleSummarize(e.target.files[0]));
    const newCards = { 'card-reorder': 'reorder', 'card-pdf-text': 'pdf-text', 'card-metadata': 'metadata' };
    Object.entries(newCards).forEach(([id, view]) => { const el = document.getElementById(id); if (el) el.addEventListener('click', () => showView(view)); });
    animateCardsEntrance();
    document.querySelectorAll('.tool-card.large').forEach(card => {
        card.addEventListener('click', function (e) {
            const ripple = document.createElement('span'); ripple.classList.add('ripple');
            const rect = this.getBoundingClientRect(); const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
            this.appendChild(ripple); ripple.addEventListener('animationend', () => ripple.remove());
        });
    });
    document.querySelectorAll('.upload-zone').forEach(zone => {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => { zone.classList.remove('drag-over'); });
        zone.addEventListener('drop', () => { zone.classList.remove('drag-over'); });
    });
});

async function extractTextFromPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const content = await page.getTextContent(); text += content.items.map(item => item.str).join(' ') + '\n\n'; }
    return text;
}
async function handleSummarize(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    if (!CONFIG || !CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY.includes('YOUR_GEMINI')) { showToast('Please configure your Gemini API Key in config.js first!', 'warning'); return; }
    showProgress('Extracting Text & Generating Summary...');
    try {
        const text = await extractTextFromPdf(file);
        const summary = await callGeminiAPI(text);
        hideProgress(); aiContent.innerHTML = marked.parse(summary); aiSidebar.classList.remove('hidden');
    } catch (e) { console.error('Summarization Error:', e); hideProgress(); showToast('Summarization failed: ' + e.message, 'error'); }
}
async function getBestAvailableModel() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${CONFIG.GEMINI_API_KEY}`;
        const response = await fetch(url); const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        if (!data.models) throw new Error('No models found.');
        const validModels = data.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'));
        if (validModels.length === 0) throw new Error('No text-generation models available.');
        const flash = validModels.find(m => m.name.includes('flash'));
        if (flash) return flash.name;
        const pro = validModels.find(m => m.name.includes('pro'));
        if (pro) return pro.name;
        return validModels[0].name;
    } catch (e) { console.error('Error listing models:', e); return 'gemini-1.5-flash'; }
}
async function callGeminiAPI(text) {
    const modelName = await getBestAvailableModel();
    const cleanName = modelName.startsWith('models/') ? modelName.split('/')[1] : modelName;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanName}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    const data = { contents: [{ parts: [{ text: `Summarize this PDF document in a detailed, structured markdown format:\n\n${text}` }] }] };
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await response.json();
    if (json.error) throw new Error(json.error.message);
    if (!json.candidates || !json.candidates[0].content) throw new Error('Invalid response');
    return json.candidates[0].content.parts[0].text;
}
function animateCardsEntrance() {
    const cards = document.querySelectorAll('.tool-card.large');
    cards.forEach((card, i) => { card.classList.remove('card-animate'); void card.offsetWidth; card.style.animationDelay = (i * 0.06) + 's'; card.classList.add('card-animate'); });
}

// ==============================
// EDITOR SIDEBAR - ALL-IN-ONE TOOLS
// ==============================
let activeEditorTool = null;

function setupEditorSidebar() {
    const sidebar = document.getElementById('editor-tools-sidebar');
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    const openBtn = document.getElementById('btn-open-sidebar');
    if (toggleBtn) { toggleBtn.addEventListener('click', () => { sidebar.classList.add('collapsed'); if (openBtn) openBtn.classList.remove('hidden'); }); }
    if (openBtn) { openBtn.addEventListener('click', () => { sidebar.classList.remove('collapsed'); openBtn.classList.add('hidden'); }); }
    document.querySelectorAll('.sidebar-tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.editorTool;
            if (!currentPdfDoc) return showToast('Load a PDF first.', 'warning');
            document.querySelectorAll('.sidebar-tool-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeEditorTool = tool;
            openEditorToolPanel(tool);
        });
    });
    const closeBtn = document.getElementById('btn-close-tool-panel');
    if (closeBtn) closeBtn.addEventListener('click', closeEditorToolPanel);
    const applyBtn = document.getElementById('btn-apply-tool-action');
    if (applyBtn) applyBtn.addEventListener('click', () => { if (activeEditorTool) executeEditorTool(activeEditorTool); });
}

function openEditorToolPanel(tool) {
    const panel = document.getElementById('editor-tool-panel');
    const title = document.getElementById('tool-panel-title');
    const body = document.getElementById('tool-panel-body');
    const applyBtn = document.getElementById('btn-apply-tool-action');
    applyBtn.classList.remove('hidden');
    const configs = {
        'rotate': { title: 'Rotate Pages', html: '<div style="display:flex;flex-direction:column;gap:12px;"><label style="color:#a5b4fc;font-size:0.85rem;">Rotation Angle</label><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="glass-btn secondary small rot-opt active" data-deg="90">90° CW</button><button class="glass-btn secondary small rot-opt" data-deg="180">180°</button><button class="glass-btn secondary small rot-opt" data-deg="270">90° CCW</button></div><label style="color:#a5b4fc;font-size:0.85rem;">Apply to</label><select class="glass-select" id="et-rotate-scope"><option value="all">All pages</option><option value="selected">Selected page only</option></select></div>' },
        'watermark': { title: 'Add Watermark', html: '<div style="display:flex;flex-direction:column;gap:10px;"><input type="text" class="glass-input" id="et-wm-text" placeholder="Watermark text..." value="CONFIDENTIAL"><div style="display:flex;gap:10px;align-items:center;"><label style="color:#a5b4fc;font-size:0.85rem;">Size</label><input type="range" id="et-wm-size" min="20" max="120" value="50" style="flex:1;"><span id="et-wm-size-val" style="color:#e2e8f0;font-size:0.85rem;">50</span></div><div style="display:flex;gap:10px;align-items:center;"><label style="color:#a5b4fc;font-size:0.85rem;">Opacity</label><input type="range" id="et-wm-opacity" min="5" max="50" value="15" style="flex:1;"><span id="et-wm-opacity-val" style="color:#e2e8f0;font-size:0.85rem;">15%</span></div><div style="display:flex;gap:10px;align-items:center;"><label style="color:#a5b4fc;font-size:0.85rem;">Color</label><input type="color" id="et-wm-color" value="#888888"></div></div>' },
        'compress': { title: 'Compress PDF', html: '<div style="display:flex;flex-direction:column;gap:10px;"><label style="color:#a5b4fc;font-size:0.85rem;">Quality Level</label><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="glass-btn secondary small comp-opt" data-q="0.5">Low</button><button class="glass-btn secondary small comp-opt active" data-q="0.7">Medium</button><button class="glass-btn secondary small comp-opt" data-q="0.85">High</button></div></div>' },
        'pagenums': { title: 'Add Page Numbers', html: '<div style="display:flex;flex-direction:column;gap:10px;"><label style="color:#a5b4fc;font-size:0.85rem;">Position</label><select class="glass-select" id="et-pn-position"><option value="bottom-center">Bottom Center</option><option value="bottom-right">Bottom Right</option><option value="bottom-left">Bottom Left</option><option value="top-center">Top Center</option><option value="top-right">Top Right</option></select><div style="display:flex;gap:10px;align-items:center;"><label style="color:#a5b4fc;font-size:0.85rem;">Size</label><input type="range" id="et-pn-size" min="8" max="24" value="12" style="flex:1;"><span id="et-pn-size-val" style="color:#e2e8f0;font-size:0.85rem;">12</span></div><label style="color:#a5b4fc;font-size:0.85rem;">Starting number</label><input type="number" class="glass-input" id="et-pn-start" value="1" min="1" style="width:80px;"></div>' },
        'resize': { title: 'Resize Pages', html: '<div style="display:flex;flex-direction:column;gap:10px;"><label style="color:#a5b4fc;font-size:0.85rem;">Target Size</label><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="glass-btn secondary small rs-opt active" data-rs="a4">A4</button><button class="glass-btn secondary small rs-opt" data-rs="letter">Letter</button><button class="glass-btn secondary small rs-opt" data-rs="legal">Legal</button><button class="glass-btn secondary small rs-opt" data-rs="a3">A3</button><button class="glass-btn secondary small rs-opt" data-rs="a5">A5</button></div><label style="display:flex;align-items:center;gap:8px;color:#e2e8f0;font-size:0.85rem;margin-top:6px;"><input type="checkbox" id="et-rs-aspect" checked> Keep aspect ratio</label></div>' },
        'redact-inline': { title: 'Redact Content', html: '<div style="display:flex;flex-direction:column;gap:10px;"><p style="color:#e2e8f0;font-size:0.85rem;"><i class="fa-solid fa-info-circle" style="color:#a5b4fc;"></i> Draw black rectangles on the page preview using your cursor.</p></div>' },
        'delete-inline': { title: 'Delete Pages', html: '<div id="et-delete-pages-list" style="display:flex;flex-direction:column;gap:8px;max-height:300px;overflow-y:auto;"></div>' },
        'extract-text': { title: 'Extract Text', html: '<div id="et-extracted-text" style="color:#e2e8f0;font-size:0.85rem;"><p style="color:rgba(255,255,255,0.5);">Click Apply to extract text.</p></div>' },
        'metadata-inline': { title: 'PDF Metadata', html: '<div id="et-metadata-display" style="color:#e2e8f0;font-size:0.85rem;"><p style="color:rgba(255,255,255,0.5);">Click Apply to view metadata.</p></div>' }
    };
    const cfg = configs[tool]; if (!cfg) return;
    title.textContent = cfg.title; body.innerHTML = cfg.html;
    if (tool === 'redact-inline') { applyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Done'; document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active')); currentTool = 'whiteout'; updateCursor(); refreshOverlays(); }
    setupOptionButtons('.rot-opt', 'deg'); setupOptionButtons('.comp-opt', 'q'); setupOptionButtons('.rs-opt', 'rs');
    const wmSize = document.getElementById('et-wm-size'); if (wmSize) wmSize.oninput = () => document.getElementById('et-wm-size-val').textContent = wmSize.value;
    const wmOp = document.getElementById('et-wm-opacity'); if (wmOp) wmOp.oninput = () => document.getElementById('et-wm-opacity-val').textContent = wmOp.value + '%';
    const pnSize = document.getElementById('et-pn-size'); if (pnSize) pnSize.oninput = () => document.getElementById('et-pn-size-val').textContent = pnSize.value;
    if (tool === 'delete-inline') buildDeletePagesList();
    panel.classList.remove('hidden');
}

function setupOptionButtons(selector, dataKey) {
    document.querySelectorAll(selector).forEach(btn => {
        btn.addEventListener('click', () => { document.querySelectorAll(selector).forEach(b => { b.classList.remove('active', 'primary'); b.classList.add('secondary'); }); btn.classList.add('active'); btn.classList.remove('secondary'); btn.classList.add('primary'); });
    });
}
function closeEditorToolPanel() {
    document.getElementById('editor-tool-panel').classList.add('hidden');
    document.querySelectorAll('.sidebar-tool-btn').forEach(b => b.classList.remove('active'));
    activeEditorTool = null; currentTool = 'cursor';
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const cursorBtn = document.querySelector('.tool-btn[data-tool="cursor"]'); if (cursorBtn) cursorBtn.classList.add('active');
    updateCursor(); refreshOverlays();
}
function buildDeletePagesList() {
    if (!currentPdfDoc) return;
    const list = document.getElementById('et-delete-pages-list'); if (!list) return;
    const count = currentPdfDoc.getPageCount(); list.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const item = document.createElement('label');
        item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:8px;cursor:pointer;color:#e2e8f0;font-size:0.85rem;';
        item.innerHTML = `<input type="checkbox" class="et-del-cb" value="${i}"> Page ${i + 1}`;
        list.appendChild(item);
    }
}

async function executeEditorTool(tool) {
    if (!currentPdfDoc) return showToast('No PDF loaded.', 'warning');
    try {
        switch (tool) {
            case 'rotate': await execRotate(); break;
            case 'watermark': await execWatermark(); break;
            case 'compress': await execCompress(); break;
            case 'pagenums': await execPageNumbers(); break;
            case 'resize': await execResize(); break;
            case 'redact-inline': closeEditorToolPanel(); break;
            case 'delete-inline': await execDeletePages(); break;
            case 'extract-text': await execExtractText(); break;
            case 'metadata-inline': await execMetadata(); break;
        }
    } catch (e) { hideProgress(); console.error(e); showToast('Operation failed: ' + e.message, 'error'); }
}

async function execRotate() {
    const activeBtn = document.querySelector('.rot-opt.active');
    const degrees = parseInt(activeBtn?.dataset?.deg || '90');
    const scope = document.getElementById('et-rotate-scope')?.value || 'all';
    showProgress('Rotating...');
    const pages = currentPdfDoc.getPages();
    if (scope === 'selected') {
        const sel = document.querySelector('.page-wrapper.selected-page');
        if (!sel) { hideProgress(); return showToast('Select a page first.', 'warning'); }
        const idx = parseInt(sel.dataset.pageNumber) - 1;
        pages[idx].setRotation(PDFLib.degrees(pages[idx].getRotation().angle + degrees));
    } else { pages.forEach(p => p.setRotation(PDFLib.degrees(p.getRotation().angle + degrees))); }
    await renderAllPages(); hideProgress(); closeEditorToolPanel();
    showToast(`Rotated ${scope === 'all' ? 'all pages' : 'selected page'} by ${degrees}°`, 'success');
}
async function execWatermark() {
    const text = document.getElementById('et-wm-text')?.value?.trim(); if (!text) return showToast('Enter watermark text.', 'warning');
    const size = parseInt(document.getElementById('et-wm-size')?.value || '50');
    const opacity = parseInt(document.getElementById('et-wm-opacity')?.value || '15') / 100;
    const hex = document.getElementById('et-wm-color')?.value || '#888888';
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    showProgress('Adding watermark...');
    for (const page of currentPdfDoc.getPages()) { const { width, height } = page.getSize(); page.drawText(text, { x: width / 2 - (text.length * size * 0.3), y: height / 2, size, color: PDFLib.rgb(r, g, b), opacity, rotate: PDFLib.degrees(-45) }); }
    await renderAllPages(); hideProgress(); closeEditorToolPanel(); showToast('Watermark added.', 'success');
}
async function execCompress() {
    const activeBtn = document.querySelector('.comp-opt.active');
    const quality = parseFloat(activeBtn?.dataset?.q || '0.7');
    showProgress('Compressing...');
    const bytes = await currentPdfDoc.save();
    const pdf = await pdfjsLib.getDocument(bytes).promise;
    const newDoc = await PDFLib.PDFDocument.create();
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i); const vp = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas'); canvas.width = vp.width; canvas.height = vp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        const img = await newDoc.embedJpg(canvas.toDataURL('image/jpeg', quality));
        const origVp = page.getViewport({ scale: 1.0 });
        const newPage = newDoc.addPage([origVp.width, origVp.height]);
        newPage.drawImage(img, { x: 0, y: 0, width: origVp.width, height: origVp.height });
    }
    const newBytes = await newDoc.save();
    currentPdfDoc = await PDFLib.PDFDocument.load(newBytes);
    await renderAllPages(); hideProgress(); closeEditorToolPanel();
    const saved = Math.round((1 - newBytes.length / bytes.length) * 100);
    showToast(`Compressed: ${(bytes.length / 1024).toFixed(0)}KB → ${(newBytes.length / 1024).toFixed(0)}KB (${saved}% smaller)`, 'success');
}
async function execPageNumbers() {
    const position = document.getElementById('et-pn-position')?.value || 'bottom-center';
    const size = parseInt(document.getElementById('et-pn-size')?.value || '12');
    const startNum = parseInt(document.getElementById('et-pn-start')?.value || '1');
    showProgress('Adding page numbers...');
    const pages = currentPdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i]; const { width, height } = page.getSize(); const num = String(startNum + i);
        let x, y;
        if (position.startsWith('bottom')) y = 25; else y = height - 25;
        if (position.endsWith('center')) x = width / 2 - (num.length * size * 0.3); else if (position.endsWith('right')) x = width - 40; else x = 25;
        page.drawText(num, { x, y, size, color: PDFLib.rgb(0.3, 0.3, 0.3) });
    }
    await renderAllPages(); hideProgress(); closeEditorToolPanel(); showToast(`Page numbers added (${position}).`, 'success');
}
async function execResize() {
    const SIZES = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008], a3: [841.89, 1190.55], a5: [419.53, 595.28] };
    const activeBtn = document.querySelector('.rs-opt.active');
    const sizeKey = activeBtn?.dataset?.rs || 'a4';
    const [targetW, targetH] = SIZES[sizeKey] || SIZES.a4;
    const keepAspect = document.getElementById('et-rs-aspect')?.checked ?? true;
    showProgress('Resizing...');
    const bytes = await currentPdfDoc.save();
    const pdf = await pdfjsLib.getDocument(bytes).promise;
    const newDoc = await PDFLib.PDFDocument.create();
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i); const origVp = page.getViewport({ scale: 1.0 }); const renderVp = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas'); canvas.width = renderVp.width; canvas.height = renderVp.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: renderVp }).promise;
        const img = await newDoc.embedJpg(canvas.toDataURL('image/jpeg', 0.92));
        const newPage = newDoc.addPage([targetW, targetH]);
        if (keepAspect) { const or = origVp.width / origVp.height; const tr = targetW / targetH; let dw, dh; if (or > tr) { dw = targetW; dh = targetW / or; } else { dh = targetH; dw = targetH * or; } newPage.drawImage(img, { x: (targetW - dw) / 2, y: (targetH - dh) / 2, width: dw, height: dh }); }
        else { newPage.drawImage(img, { x: 0, y: 0, width: targetW, height: targetH }); }
    }
    const newBytes = await newDoc.save();
    currentPdfDoc = await PDFLib.PDFDocument.load(newBytes);
    await renderAllPages(); hideProgress(); closeEditorToolPanel(); showToast(`Pages resized to ${sizeKey.toUpperCase()}.`, 'success');
}
async function execDeletePages() {
    const checkboxes = document.querySelectorAll('.et-del-cb:checked');
    if (checkboxes.length === 0) return showToast('Select at least one page.', 'warning');
    if (checkboxes.length >= currentPdfDoc.getPageCount()) return showToast('Cannot delete all pages.', 'warning');
    showProgress('Deleting pages...');
    const indices = Array.from(checkboxes).map(cb => parseInt(cb.value)).sort((a, b) => b - a);
    for (const idx of indices) currentPdfDoc.removePage(idx);
    await renderAllPages(); hideProgress(); closeEditorToolPanel();
    showToast(`Deleted ${indices.length} page(s). ${currentPdfDoc.getPageCount()} remaining.`, 'success');
}
async function execExtractText() {
    showProgress('Extracting text...'); const bytes = await currentPdfDoc.save();
    const pdf = await pdfjsLib.getDocument(bytes).promise; let allText = '';
    for (let i = 1; i <= pdf.numPages; i++) { const page = await pdf.getPage(i); const content = await page.getTextContent(); const pageText = content.items.map(item => item.str).join(' '); if (pageText.trim()) allText += `--- Page ${i} ---\n${pageText.trim()}\n\n`; }
    hideProgress(); const display = document.getElementById('et-extracted-text');
    if (!allText.trim()) { display.innerHTML = '<p style="color:#f87171;">No text found.</p>'; }
    else { display.innerHTML = `<pre style="white-space:pre-wrap;word-break:break-word;max-height:300px;overflow-y:auto;padding:12px;background:rgba(0,0,0,0.3);border-radius:8px;font-size:0.8rem;color:#e2e8f0;">${allText.replace(/</g, '&lt;')}</pre><div style="display:flex;gap:8px;margin-top:10px;"><button class="glass-btn secondary small" onclick="navigator.clipboard.writeText(document.querySelector('#et-extracted-text pre').textContent).then(()=>showToast('Copied!','success'))"><i class="fa-solid fa-copy"></i> Copy</button><button class="glass-btn secondary small" onclick="(()=>{const b=new Blob([document.querySelector('#et-extracted-text pre').textContent],{type:'text/plain'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='extracted.txt';a.click();})()"><i class="fa-solid fa-download"></i> Download .txt</button></div>`; }
    document.getElementById('btn-apply-tool-action').classList.add('hidden');
}
async function execMetadata() {
    showProgress('Reading metadata...');
    const title = currentPdfDoc.getTitle() || 'N/A', author = currentPdfDoc.getAuthor() || 'N/A', subject = currentPdfDoc.getSubject() || 'N/A';
    const creator = currentPdfDoc.getCreator() || 'N/A', producer = currentPdfDoc.getProducer() || 'N/A';
    const pageCount = currentPdfDoc.getPageCount();
    const creationDate = currentPdfDoc.getCreationDate(), modDate = currentPdfDoc.getModificationDate();
    const fmt = (d) => { if (!d) return 'N/A'; try { return d.toLocaleDateString() + ' ' + d.toLocaleTimeString(); } catch { return 'N/A'; } };
    const bytes = await currentPdfDoc.save(); const sizeKB = (bytes.length / 1024).toFixed(1); const sizeMB = (bytes.length / (1024 * 1024)).toFixed(2);
    const sizeStr = bytes.length > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`;
    hideProgress(); const display = document.getElementById('et-metadata-display');
    display.innerHTML = `<div style="display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:0.85rem;"><span style="color:rgba(255,255,255,0.5);text-align:right;">Pages</span><span style="color:#a5b4fc;">${pageCount}</span><span style="color:rgba(255,255,255,0.5);text-align:right;">Size</span><span style="color:#a5b4fc;">${sizeStr}</span><span style="color:rgba(255,255,255,0.5);text-align:right;">Title</span><span style="color:#a5b4fc;">${title}</span><span style="color:rgba(255,255,255,0.5);text-align:right;">Author</span><span style="color:#a5b4fc;">${author}</span><span style="color:rgba(255,255,255,0.5);text-align:right;">Subject</span><span style="color:#a5b4fc;">${subject}</span><span style="color:rgba(255,255,255,0.5);text-align:right;">Creator</span><span style="color:#a5b4fc;">${creator}</span><span style="color:rgba(255,255,255,0.5);text-align:right;">Producer</span><span style="color:#a5b4fc;">${producer}</span><span style="color:rgba(255,255,255,0.5);text-align:right;">Created</span><span style="color:#a5b4fc;">${fmt(creationDate)}</span><span style="color:rgba(255,255,255,0.5);text-align:right;">Modified</span><span style="color:#a5b4fc;">${fmt(modDate)}</span></div>`;
    document.getElementById('btn-apply-tool-action').classList.add('hidden');
}

