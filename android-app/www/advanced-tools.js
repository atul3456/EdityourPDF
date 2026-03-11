// advanced-tools.js
// Handles: OCR, Security, Compression, Conversion, Split, Rotate, Watermark, Page Numbers, PDF to Excel

const API_BASE = './api';

document.addEventListener('DOMContentLoaded', () => {
    setupAdvancedTools();
    setupSecurityTools();
});

function setupAdvancedTools() {
    // OCR
    const ocrCard = document.getElementById('card-ocr');
    if (ocrCard) {
        ocrCard.addEventListener('click', () => showView('ocr'));
        const ocrDrop = document.getElementById('ocr-drop-zone');
        const ocrInput = document.getElementById('ocr-upload-input');

        ocrDrop.addEventListener('click', () => ocrInput.click());
        ocrDrop.addEventListener('dragover', (e) => e.preventDefault());
        ocrDrop.addEventListener('drop', (e) => { e.preventDefault(); handleOCR(e.dataTransfer.files[0]); });
        ocrInput.addEventListener('change', (e) => handleOCR(e.target.files[0]));
    }
}

async function handleOCR(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');

    document.getElementById('ocr-drop-zone').classList.add('hidden');
    document.getElementById('ocr-processing').classList.remove('hidden');

    const updateProgress = (msg) => {
        const txt = document.querySelector('#ocr-processing p') || document.querySelector('#ocr-processing .spinner-text');
        if (txt) txt.innerText = msg;
    };
    updateProgress('Initializing OCR Engine...');

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdfDoc.numPages;
        const newPdf = await PDFLib.PDFDocument.create();

        for (let i = 1; i <= totalPages; i++) {
            updateProgress(`Processing Page ${i} of ${totalPages}...`);
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const result = await Tesseract.recognize(canvas, 'eng', {});
            const { data } = result;

            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const imgEmbed = await newPdf.embedJpg(imgData);
            const newPage = newPdf.addPage([imgEmbed.width, imgEmbed.height]);
            newPage.drawImage(imgEmbed, { x: 0, y: 0, width: newPage.getWidth(), height: newPage.getHeight() });

            const { words } = data;
            const height = newPage.getHeight();
            for (const word of words) {
                const { text, bbox } = word;
                const fontSize = (bbox.y1 - bbox.y0);
                const pdfY = height - bbox.y1;
                newPage.drawText(text, { x: bbox.x0, y: pdfY, size: fontSize, opacity: 0 });
            }
        }

        updateProgress('Finalizing PDF...');
        const pdfBytes = await newPdf.save();
        showSuccess(new Blob([pdfBytes], { type: 'application/pdf' }), 'ocr_' + file.name);
        document.getElementById('ocr-processing').classList.add('hidden');
    } catch (e) {
        console.error(e);
        document.getElementById('ocr-processing').classList.add('hidden');
        document.getElementById('ocr-drop-zone').classList.remove('hidden');
        showToast('OCR Failed: ' + e.message, 'error');
    }
}

// Helper: Generic File Upload
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload.php`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Upload failed');
    const json = await res.json();
    if (json.error) throw new Error(json.message);
    return json;
}

// ========================
// SECURITY TOOL
// ========================
let secFile = null;
let secMode = 'protect';

function setupSecurityTools() {
    const card = document.getElementById('card-security');
    if (card) card.addEventListener('click', () => showView('security'));

    const drop = document.getElementById('sec-drop-zone');
    const inp = document.getElementById('sec-upload-input');

    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleSecFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleSecFile(e.target.files[0]));

        document.getElementById('btn-mode-protect').addEventListener('click', () => setSecMode('protect'));
        document.getElementById('btn-mode-unlock').addEventListener('click', () => setSecMode('unlock'));
        document.getElementById('btn-mode-perms').addEventListener('click', () => setSecMode('permissions'));
        document.getElementById('btn-process-security').addEventListener('click', processSecurity);
    }
}

function handleSecFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    secFile = file;
    document.getElementById('sec-drop-zone').classList.add('hidden');
    document.getElementById('sec-options').classList.remove('hidden');
}

function setSecMode(mode) {
    secMode = mode;
    document.querySelectorAll('[id^="btn-mode-"]').forEach(b => { b.classList.remove('primary'); b.classList.add('secondary'); });
    const btn = document.getElementById(`btn-mode-${mode}`);
    btn.classList.remove('secondary');
    btn.classList.add('primary');
    const passInput = document.getElementById('sec-password');
    if (mode === 'permissions') passInput.classList.add('hidden');
    else passInput.classList.remove('hidden');
}

async function processSecurity() {
    if (!secFile) return;
    const pwd = document.getElementById('sec-password').value;

    const showSecError = (msg) => {
        const opts = document.getElementById('sec-options');
        let errBox = opts.querySelector('.error-msg-box');
        if (!errBox) {
            errBox = document.createElement('div');
            errBox.className = 'error-msg-box';
            errBox.style.cssText = 'color:#ff4d4d;margin-top:10px;font-size:0.9rem;';
            opts.appendChild(errBox);
        }
        errBox.innerText = msg;
        setTimeout(() => errBox.innerText = '', 5000);
    };

    if (secMode === 'protect' && !pwd) return showSecError('Password required to protect');
    if (secMode === 'unlock' && !pwd) return showSecError('Password required to unlock');

    document.getElementById('sec-options').classList.add('hidden');
    document.getElementById('sec-drop-zone').classList.add('hidden');
    showProgress('Processing Security...');

    try {
        const buffer = await secFile.arrayBuffer();
        let pdfDoc;

        if (secMode === 'unlock') {
            try {
                pdfDoc = await PDFLib.PDFDocument.load(buffer, { password: pwd });
            } catch (e) {
                if (e.message.includes('Password')) throw new Error('Incorrect Password or File validation failed.');
                throw e;
            }
            const bytes = await pdfDoc.save();
            showSuccess(new Blob([bytes], { type: 'application/pdf' }), 'unlocked_' + secFile.name);
        } else {
            try {
                pdfDoc = await PDFLib.PDFDocument.load(buffer);
            } catch (e) {
                if (e.message.includes('Password')) throw new Error('Input PDF is already password protected. Unlock it first.');
                throw e;
            }

            if (secMode === 'protect') {
                pdfDoc.encrypt({
                    userPassword: pwd, ownerPassword: pwd,
                    permissions: ['Print', 'Copy', 'Modify', 'Annotate', 'FillForms', 'Extract', 'Assemble', 'PrintHighResolution'],
                });
                const bytes = await pdfDoc.save();
                showSuccess(new Blob([bytes], { type: 'application/pdf' }), 'protected_' + secFile.name);
            } else if (secMode === 'permissions') {
                const ownerPwd = 'owner' + Math.floor(Math.random() * 10000);
                pdfDoc.encrypt({ userPassword: '', ownerPassword: ownerPwd, permissions: [] });
                const bytes = await pdfDoc.save();
                showSuccess(new Blob([bytes], { type: 'application/pdf' }), 'restricted_' + secFile.name);
            }
        }
        secFile = null;
        document.getElementById('sec-password').value = '';
    } catch (e) {
        console.error(e);
        hideProgress();
        document.getElementById('sec-options').classList.remove('hidden');
        showToast('Security operation failed: ' + e.message, 'error');
    }
}

// ========================
// COMPRESSION TOOL (FIXED)
// ========================
(function initExtras() {
    document.addEventListener('DOMContentLoaded', () => {
        setupCompress();
        setupConvert();
        setupSplitTool();
        setupRotateTool();
        setupWatermarkTool();
        setupPageNumbersTool();
        setupPdfToExcelTool();
        setupReorderTool();
        setupPdfToTextTool();
        setupMetadataTool();
        setupRedactTool();
        setupCompareTool();
        setupPdfToMarkdownTool();
        setupFormFillerTool();
        setupDeletePagesTool();
        setupPageResizeTool();
        setupSummarizeTool();
    });
})();

let compFile = null;
let compLevel = 'ebook';

function setupCompress() {
    const card = document.getElementById('card-compress');
    if (card) card.addEventListener('click', () => showView('compress'));

    const drop = document.getElementById('compress-drop-zone');
    const inp = document.getElementById('compress-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleCompFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleCompFile(e.target.files[0]));

        document.querySelectorAll('#compress-options button[data-level]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                compLevel = e.target.dataset.level;
                document.querySelectorAll('#compress-options button[data-level]').forEach(b => { b.classList.remove('primary'); b.classList.add('secondary'); });
                e.target.classList.remove('secondary'); e.target.classList.add('primary');
            });
        });
        document.getElementById('btn-process-compress').addEventListener('click', processCompress);
    }
}

function handleCompFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    compFile = file;
    // Show original file size
    const sizeStr = formatFileSize(file.size);
    const fileInfo = document.getElementById('comp-file-info');
    if (fileInfo) {
        fileInfo.innerHTML = `<i class="fa-solid fa-file-pdf"></i> ${file.name} <span class="file-size-badge">${sizeStr}</span>`;
        fileInfo.style.display = 'block';
    }
    document.getElementById('compress-drop-zone').classList.add('hidden');
    document.getElementById('compress-options').classList.remove('hidden');
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function processCompress() {
    if (!compFile) return;

    const btn = document.getElementById('btn-process-compress');
    const spinner = document.getElementById('compress-spinner');
    const statusTxt = document.getElementById('compress-mode-text');

    btn.disabled = true;
    btn.innerText = 'Processing...';
    spinner.classList.remove('hidden');
    statusTxt.style.display = 'block';

    const updateStatus = (msg) => statusTxt.innerText = msg;
    const originalSize = compFile.size;

    // Helper: compress all pages at a given quality+scale and return pdf bytes
    async function compressAtQuality(pdfDoc, totalPages, quality, scale, targetWPoints, targetHPoints) {
        const newPdf = await PDFLib.PDFDocument.create();
        for (let i = 1; i <= totalPages; i++) {
            updateStatus(`Compressing page ${i}/${totalPages}  (quality ${Math.round(quality * 100)}%)…`);
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
            const imgData = canvas.toDataURL('image/jpeg', quality);
            const imgEmbed = await newPdf.embedJpg(imgData);
            let newPage;
            if (targetWPoints > 0 && targetHPoints > 0) {
                newPage = newPdf.addPage([targetWPoints, targetHPoints]);
                newPage.drawImage(imgEmbed, { x: 0, y: 0, width: targetWPoints, height: targetHPoints });
            } else {
                const origVP = page.getViewport({ scale: 1.0 });
                newPage = newPdf.addPage([origVP.width, origVP.height]);
                newPage.drawImage(imgEmbed, { x: 0, y: 0, width: newPage.getWidth(), height: newPage.getHeight() });
            }
        }
        return await newPdf.save();
    }

    try {
        const arrayBuffer = await compFile.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdfDoc.numPages;

        // Get target size if specified
        const targetVal = parseFloat(document.getElementById('comp-target-val').value);
        const targetUnit = document.getElementById('comp-target-unit').value;
        let targetBytes = 0;
        if (targetVal > 0) {
            if (targetUnit === 'KB') targetBytes = targetVal * 1024;
            else if (targetUnit === 'MB') targetBytes = targetVal * 1024 * 1024;
        }

        // Get optional page resize dimensions
        const resizeW = parseFloat(document.getElementById('comp-resize-w').value);
        const resizeH = parseFloat(document.getElementById('comp-resize-h').value);
        const resizeUnit = document.getElementById('comp-resize-unit').value;
        let targetWPoints = 0, targetHPoints = 0;
        if (resizeW > 0 && resizeH > 0) {
            const factor = (resizeUnit === 'mm') ? 2.835 : (resizeUnit === 'cm') ? 28.35 : 72;
            targetWPoints = resizeW * factor;
            targetHPoints = resizeH * factor;
        }

        let pdfBytes;
        let reachedTarget = true;

        if (targetBytes <= 0) {
            // ── No target: use fixed quality/scale by compression level ──
            let scale, quality;
            if (compLevel === 'screen') { scale = 0.5; quality = 0.25; }
            else if (compLevel === 'ebook') { scale = 0.72; quality = 0.50; }
            else /* printer */ { scale = 1.0; quality = 0.78; }
            updateStatus(`Compressing at ${compLevel} quality…`);
            pdfBytes = await compressAtQuality(pdfDoc, totalPages, quality, scale, targetWPoints, targetHPoints);

        } else {
            // ── Target size: binary search over JPEG quality ──
            updateStatus(`Calibrating compression…`);

            // Step 1 – quick calibration on page 1 at quality=0.5 to estimate scale of compression
            const calibPage = await pdfDoc.getPage(1);
            const calibVP = calibPage.getViewport({ scale: 1.0 });
            const calibCanvas = document.createElement('canvas');
            calibCanvas.width = calibVP.width;
            calibCanvas.height = calibVP.height;
            await calibPage.render({ canvasContext: calibCanvas.getContext('2d'), viewport: calibVP }).promise;
            const calibData = calibCanvas.toDataURL('image/jpeg', 0.5);
            // Estimate full-doc size at quality=0.5 (rough, for initial bounds)
            const estimatedPerPage = calibData.length * 0.75; // base64 → raw bytes approx
            const estimatedTotal = estimatedPerPage * totalPages;

            // Decide maximum render scale
            const renderScaleRatio = targetBytes / originalSize;
            const maxScale = Math.max(0.1, Math.min(1.0, Math.sqrt(renderScaleRatio) * 1.5));

            // Step 2 – binary search over parameter p [0.0 ... 1.0]
            let lo = 0.0, hi = 1.0;
            let bestBytes = null;
            let bestPdf = null;
            let closestDiff = Infinity;
            const MAX_ITER = 12;

            for (let iter = 0; iter < MAX_ITER; iter++) {
                const p = (lo + hi) / 2;

                // Map p to scale and quality:
                const currentScale = Math.max(0.05, maxScale * (0.2 + 0.8 * p));
                const currentQuality = Math.max(0.01, Math.min(0.95, p * 0.95));

                updateStatus(`Search pass ${iter + 1}/${MAX_ITER} (Qual: ${Math.round(currentQuality * 100)}%, Scale: ${Math.round(currentScale * 100)}%)…`);
                const candidate = await compressAtQuality(pdfDoc, totalPages, currentQuality, currentScale, targetWPoints, targetHPoints);
                const candidateSize = candidate.length;

                const diff = Math.abs(candidateSize - targetBytes);

                // We want to find the absolute closest match to targetBytes.
                // We allow it to be slightly over (e.g. up to 5% over) if that's the closest we can get,
                // otherwise we prefer the closest value we can find under the limit.
                if (diff < closestDiff) {
                    bestBytes = candidateSize;
                    bestPdf = candidate;
                    closestDiff = diff;
                }

                if (candidateSize < targetBytes) {
                    // Under target — try to increase size to get closer
                    lo = p;
                } else {
                    // Over target — try to decrease size
                    hi = p;
                }

                // Convergence check
                if ((hi - lo) < 0.01 || diff < (targetBytes * 0.02)) break; // Stop early if within 2%
            }

            if (bestBytes === null) {
                reachedTarget = false;
                updateStatus(`Maximum compression applied (target not perfectly reached)…`);
                pdfBytes = bestPdf; // Fallback
            } else {
                pdfBytes = bestPdf;
            }
        }

        updateStatus('Finalizing…');

        const outputSize = pdfBytes.length;
        const reduction = ((1 - outputSize / originalSize) * 100).toFixed(1);

        // Target is considered achieved if it is within an acceptable margin (+10% or strictly under).
        const acceptableTarget = targetBytes > 0 && (outputSize <= targetBytes * 1.10);

        const targetNote = (targetBytes > 0 && !acceptableTarget)
            ? `<div class="stat-row stat-bad"><span>⚠ Target:</span> <strong>Not exactly reachable</strong></div>`
            : (targetBytes > 0
                ? `<div class="stat-row stat-good"><span>✔ Target:</span> <strong>${formatFileSize(targetBytes)} — achieved!</strong></div>`
                : '');

        const sizeInfo = `
            <div class="compress-stats">
                ${targetNote}
                <div class="stat-row"><span>Original:</span> <strong>${formatFileSize(originalSize)}</strong></div>
                <div class="stat-row ${reduction > 0 ? 'stat-good' : 'stat-bad'}"><span>Compressed:</span> <strong>${formatFileSize(outputSize)}</strong></div>
                <div class="stat-row ${reduction > 0 ? 'stat-good' : 'stat-bad'}">
                    <span>Reduction:</span> <strong>${reduction > 0 ? reduction + '% smaller' : 'No reduction achieved'}</strong>
                </div>
            </div>`;

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        showSuccess(blob, 'compressed_' + compFile.name, sizeInfo);

        spinner.classList.add('hidden');
        statusTxt.style.display = 'none';
        btn.disabled = false;
        btn.innerText = 'Compress Now';
        compFile = null;
        document.getElementById('compress-options').classList.add('hidden');

    } catch (e) {
        console.error(e);
        updateStatus('Error: ' + e.message);
        btn.disabled = false;
        btn.innerText = 'Compress Now';
        spinner.classList.add('hidden');
        showToast('Compression Failed: ' + e.message, 'error');
    }
}

// ========================
// CONVERSION TOOL (FIXED - All Pages)
// ========================
function setupConvert() {
    const card = document.getElementById('card-convert');
    if (card) card.addEventListener('click', () => showView('convert'));

    const drop = document.getElementById('convert-drop-zone');
    const inp = document.getElementById('convert-upload-input');

    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleConvFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleConvFile(e.target.files[0]));
    }
}

async function handleConvFile(file) {
    if (!file) return;
    let mode = 'pdf-to-img';
    if (file.type.startsWith('image/')) mode = 'img-to-pdf';
    else if (file.type !== 'application/pdf') return showToast('Upload a PDF or Image file.', 'warning');

    document.getElementById('convert-drop-zone').classList.add('hidden');
    document.getElementById('convert-options').classList.remove('hidden');
    document.getElementById('convert-spinner').classList.remove('hidden');
    document.getElementById('convert-mode-text').innerText = `Converting ${mode}...`;

    try {
        if (mode === 'img-to-pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await PDFLib.PDFDocument.create();
            let image;
            if (file.type === 'image/jpeg') image = await pdfDoc.embedJpg(arrayBuffer);
            else if (file.type === 'image/png') image = await pdfDoc.embedPng(arrayBuffer);
            else throw new Error('Unsupported image format. Use JPG or PNG.');

            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
            const pdfBytes = await pdfDoc.save();
            showSuccess(new Blob([pdfBytes], { type: 'application/pdf' }), file.name.split('.')[0] + '.pdf');

        } else {
            // PDF to Images - ALL pages
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const totalPages = pdf.numPages;

            if (totalPages === 1) {
                // Single page - download directly
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
                showSuccess(blob, file.name.replace('.pdf', '') + '.jpg');
            } else {
                // Multiple pages - download as ZIP
                document.getElementById('convert-mode-text').innerText = `Converting ${totalPages} pages...`;
                const zip = new JSZip();
                for (let i = 1; i <= totalPages; i++) {
                    document.getElementById('convert-mode-text').innerText = `Page ${i}/${totalPages}...`;
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 2.0 });
                    const canvas = document.createElement('canvas');
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                    const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.92));
                    zip.file(`page_${i}.jpg`, blob);
                }
                const zipBlob = await zip.generateAsync({ type: 'blob' });
                showSuccess(zipBlob, file.name.replace('.pdf', '') + '_images.zip');
            }
        }
    } catch (e) {
        console.error(e);
        showToast('Conversion failed: ' + e.message, 'error');
    }

    document.getElementById('convert-spinner').classList.add('hidden');
    document.getElementById('convert-options').classList.add('hidden');
    document.getElementById('convert-drop-zone').classList.remove('hidden');
}

// ========================
// SPLIT PDF TOOL (NEW)
// ========================
function setupSplitTool() {
    const card = document.getElementById('card-split');
    if (!card) return;
    card.addEventListener('click', () => showView('split'));

    const drop = document.getElementById('split-drop-zone');
    const inp = document.getElementById('split-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleSplitFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleSplitFile(e.target.files[0]));
    }
    const processBtn = document.getElementById('btn-process-split');
    if (processBtn) processBtn.addEventListener('click', processSplit);
}

let splitFile = null;

function handleSplitFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    splitFile = file;
    document.getElementById('split-drop-zone').classList.add('hidden');
    document.getElementById('split-options').classList.remove('hidden');
    // Show page count
    file.arrayBuffer().then(buf => pdfjsLib.getDocument(buf).promise).then(pdf => {
        document.getElementById('split-page-count').innerText = `This PDF has ${pdf.numPages} pages`;
    });
}

async function processSplit() {
    if (!splitFile) return;
    const rangeInput = document.getElementById('split-range').value.trim();
    const splitMode = document.getElementById('split-mode').value;

    showProgress('Splitting PDF...');
    try {
        const arrayBuffer = await splitFile.arrayBuffer();
        const srcDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const totalPages = srcDoc.getPageCount();

        if (splitMode === 'extract') {
            // Extract specific pages: "1,3,5-8"
            const pageIndices = parsePageRange(rangeInput, totalPages);
            if (pageIndices.length === 0) throw new Error('Invalid page range. Use format like "1,3,5-8"');

            const newDoc = await PDFLib.PDFDocument.create();
            const pages = await newDoc.copyPages(srcDoc, pageIndices);
            pages.forEach(p => newDoc.addPage(p));

            const bytes = await newDoc.save();
            showSuccess(new Blob([bytes], { type: 'application/pdf' }), 'extracted_' + splitFile.name);

        } else {
            // Split into individual pages - ZIP
            const zip = new JSZip();
            for (let i = 0; i < totalPages; i++) {
                const newDoc = await PDFLib.PDFDocument.create();
                const [page] = await newDoc.copyPages(srcDoc, [i]);
                newDoc.addPage(page);
                const bytes = await newDoc.save();
                zip.file(`page_${i + 1}.pdf`, bytes);
            }
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            showSuccess(zipBlob, splitFile.name.replace('.pdf', '') + '_split.zip');
        }

        splitFile = null;
        document.getElementById('split-options').classList.add('hidden');
        document.getElementById('split-drop-zone').classList.remove('hidden');
    } catch (e) {
        console.error(e);
        hideProgress();
        showToast('Split failed: ' + e.message, 'error');
    }
}

function parsePageRange(input, totalPages) {
    const indices = new Set();
    if (!input) {
        // Default: all pages
        for (let i = 0; i < totalPages; i++) indices.add(i);
        return [...indices];
    }
    const parts = input.split(',');
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
            const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
            if (isNaN(start) || isNaN(end)) continue;
            for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
                indices.add(i - 1); // 0-indexed
            }
        } else {
            const num = parseInt(trimmed);
            if (!isNaN(num) && num >= 1 && num <= totalPages) {
                indices.add(num - 1);
            }
        }
    }
    return [...indices].sort((a, b) => a - b);
}

// ========================
// ROTATE PDF TOOL (NEW)
// ========================
function setupRotateTool() {
    const card = document.getElementById('card-rotate');
    if (!card) return;
    card.addEventListener('click', () => showView('rotate'));

    const drop = document.getElementById('rotate-drop-zone');
    const inp = document.getElementById('rotate-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleRotateFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleRotateFile(e.target.files[0]));
    }
    const processBtn = document.getElementById('btn-process-rotate');
    if (processBtn) processBtn.addEventListener('click', processRotate);
}

let rotateFile = null;

function handleRotateFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    rotateFile = file;
    document.getElementById('rotate-drop-zone').classList.add('hidden');
    document.getElementById('rotate-options').classList.remove('hidden');
}

async function processRotate() {
    if (!rotateFile) return;
    const angle = parseInt(document.getElementById('rotate-angle').value);

    showProgress('Rotating pages...');
    try {
        const arrayBuffer = await rotateFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        pages.forEach(page => {
            const currentRotation = page.getRotation().angle;
            page.setRotation(PDFLib.degrees(currentRotation + angle));
        });

        const bytes = await pdfDoc.save();
        showSuccess(new Blob([bytes], { type: 'application/pdf' }), 'rotated_' + rotateFile.name);

        rotateFile = null;
        document.getElementById('rotate-options').classList.add('hidden');
        document.getElementById('rotate-drop-zone').classList.remove('hidden');
    } catch (e) {
        console.error(e);
        hideProgress();
        showToast('Rotation failed: ' + e.message, 'error');
    }
}

// ========================
// WATERMARK TOOL (NEW)
// ========================
function setupWatermarkTool() {
    const card = document.getElementById('card-watermark');
    if (!card) return;
    card.addEventListener('click', () => showView('watermark'));

    const drop = document.getElementById('watermark-drop-zone');
    const inp = document.getElementById('watermark-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleWatermarkFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleWatermarkFile(e.target.files[0]));
    }
    const processBtn = document.getElementById('btn-process-watermark');
    if (processBtn) processBtn.addEventListener('click', processWatermark);
}

let watermarkFile = null;

function handleWatermarkFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    watermarkFile = file;
    document.getElementById('watermark-drop-zone').classList.add('hidden');
    document.getElementById('watermark-options').classList.remove('hidden');
}

async function processWatermark() {
    if (!watermarkFile) return;
    const text = document.getElementById('watermark-text').value.trim();
    if (!text) return showToast('Please enter watermark text.', 'warning');

    const opacity = parseFloat(document.getElementById('watermark-opacity').value) || 0.3;
    const fontSize = parseInt(document.getElementById('watermark-size').value) || 50;

    showProgress('Adding watermark...');
    try {
        const arrayBuffer = await watermarkFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        for (const page of pages) {
            const { width, height } = page.getSize();
            // Draw diagonal watermark
            page.drawText(text, {
                x: width / 2 - (text.length * fontSize * 0.25),
                y: height / 2,
                size: fontSize,
                color: PDFLib.rgb(0.5, 0.5, 0.5),
                opacity: opacity,
                rotate: PDFLib.degrees(-45),
            });
        }

        const bytes = await pdfDoc.save();
        showSuccess(new Blob([bytes], { type: 'application/pdf' }), 'watermarked_' + watermarkFile.name);

        watermarkFile = null;
        document.getElementById('watermark-options').classList.add('hidden');
        document.getElementById('watermark-drop-zone').classList.remove('hidden');
    } catch (e) {
        console.error(e);
        hideProgress();
        showToast('Watermark failed: ' + e.message, 'error');
    }
}

// ========================
// PAGE NUMBERS TOOL (NEW)
// ========================
function setupPageNumbersTool() {
    const card = document.getElementById('card-pagenums');
    if (!card) return;
    card.addEventListener('click', () => showView('pagenums'));

    const drop = document.getElementById('pagenums-drop-zone');
    const inp = document.getElementById('pagenums-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handlePageNumsFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handlePageNumsFile(e.target.files[0]));
    }
    const processBtn = document.getElementById('btn-process-pagenums');
    if (processBtn) processBtn.addEventListener('click', processPageNums);
}

let pagenumsFile = null;

function handlePageNumsFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    pagenumsFile = file;
    document.getElementById('pagenums-drop-zone').classList.add('hidden');
    document.getElementById('pagenums-options').classList.remove('hidden');
}

async function processPageNums() {
    if (!pagenumsFile) return;
    const position = document.getElementById('pagenums-position').value;
    const format = document.getElementById('pagenums-format').value;

    showProgress('Adding page numbers...');
    try {
        const arrayBuffer = await pagenumsFile.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();
        const totalPages = pages.length;
        const fontSize = 12;

        pages.forEach((page, idx) => {
            const { width, height } = page.getSize();
            let text;
            if (format === 'num') text = `${idx + 1}`;
            else if (format === 'num-of') text = `${idx + 1} of ${totalPages}`;
            else text = `Page ${idx + 1}`;

            let x, y;
            if (position.includes('bottom')) y = 20;
            else y = height - 20;

            if (position.includes('center')) x = width / 2 - (text.length * fontSize * 0.15);
            else if (position.includes('right')) x = width - 40 - (text.length * fontSize * 0.3);
            else x = 40;

            page.drawText(text, {
                x, y, size: fontSize,
                color: PDFLib.rgb(0.3, 0.3, 0.3),
            });
        });

        const bytes = await pdfDoc.save();
        showSuccess(new Blob([bytes], { type: 'application/pdf' }), 'numbered_' + pagenumsFile.name);

        pagenumsFile = null;
        document.getElementById('pagenums-options').classList.add('hidden');
        document.getElementById('pagenums-drop-zone').classList.remove('hidden');
    } catch (e) {
        console.error(e);
        hideProgress();
        showToast('Failed to add page numbers: ' + e.message, 'error');
    }
}

// ========================
// PDF TO EXCEL/CSV TOOL (NEW)
// ========================
function setupPdfToExcelTool() {
    const card = document.getElementById('card-pdf-excel');
    if (!card) return;
    card.addEventListener('click', () => showView('pdf-excel'));

    const drop = document.getElementById('pdf-excel-drop-zone');
    const inp = document.getElementById('pdf-excel-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handlePdfToExcel(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handlePdfToExcel(e.target.files[0]));
    }
}

async function handlePdfToExcel(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');

    showProgress('Extracting text from PDF...');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let allRows = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();

            // Group text items by Y position to detect rows
            const lineMap = {};
            for (const item of content.items) {
                const y = Math.round(item.transform[5]); // Y position
                if (!lineMap[y]) lineMap[y] = [];
                lineMap[y].push({ text: item.str, x: item.transform[4] });
            }

            // Sort by Y (descending = top to bottom in PDF coords)
            const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);
            for (const y of sortedYs) {
                const items = lineMap[y].sort((a, b) => a.x - b.x);
                // Detect columns by large gaps in X position
                const row = [];
                let lastX = -1;
                let currentCell = '';
                for (const item of items) {
                    if (lastX >= 0 && item.x - lastX > 30) {
                        row.push(currentCell.trim());
                        currentCell = item.text;
                    } else {
                        currentCell += (currentCell ? ' ' : '') + item.text;
                    }
                    lastX = item.x + (item.text.length * 5);
                }
                if (currentCell.trim()) row.push(currentCell.trim());
                if (row.some(cell => cell.length > 0)) allRows.push(row);
            }
        }

        if (allRows.length === 0) throw new Error('No extractable text found in PDF');

        // Generate CSV
        const maxCols = Math.max(...allRows.map(r => r.length));
        const csvContent = allRows.map(row => {
            while (row.length < maxCols) row.push('');
            return row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',');
        }).join('\n');

        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        showSuccess(blob, file.name.replace('.pdf', '') + '.csv');
    } catch (e) {
        console.error(e);
        hideProgress();
        showToast('PDF to Excel failed: ' + e.message, 'error');
    }
}

// ========================
// UTILITY
// ========================
function downloadBlobLocal(data, fileName, mimeType) {
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// ========================
// REORDER PAGES TOOL
// ========================
let reorderFile = null;
let reorderPageOrder = [];

function setupReorderTool() {
    const card = document.getElementById('card-reorder');
    if (!card) return;
    card.addEventListener('click', () => showView('reorder'));

    const drop = document.getElementById('reorder-drop-zone');
    const inp = document.getElementById('reorder-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleReorderFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleReorderFile(e.target.files[0]));
    }

    const processBtn = document.getElementById('btn-process-reorder');
    if (processBtn) processBtn.addEventListener('click', processReorder);
}

async function handleReorderFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    reorderFile = file;

    showProgress('Loading PDF pages...');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
        const grid = document.getElementById('reorder-pages-grid');
        grid.innerHTML = '';
        reorderPageOrder = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            const item = document.createElement('div');
            item.className = 'reorder-page-item';
            item.dataset.pageIndex = i - 1;
            item.draggable = true;
            item.innerHTML = `<div class="page-label">Page ${i}</div>`;
            item.prepend(canvas);

            // Drag events
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.pageIndex);
                item.classList.add('dragging');
            });
            item.addEventListener('dragend', () => item.classList.remove('dragging'));
            item.addEventListener('dragover', (e) => { e.preventDefault(); item.classList.add('drag-over-item'); });
            item.addEventListener('dragleave', () => item.classList.remove('drag-over-item'));
            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('drag-over-item');
                const fromIdx = e.dataTransfer.getData('text/plain');
                const toIdx = item.dataset.pageIndex;
                if (fromIdx !== toIdx) {
                    const fromEl = grid.querySelector(`[data-page-index="${fromIdx}"]`);
                    if (fromEl) {
                        // Swap positions
                        const parent = grid;
                        const children = [...parent.children];
                        const fromPos = children.indexOf(fromEl);
                        const toPos = children.indexOf(item);
                        if (fromPos < toPos) {
                            parent.insertBefore(fromEl, item.nextSibling);
                        } else {
                            parent.insertBefore(fromEl, item);
                        }
                        // Update labels
                        updateReorderLabels();
                    }
                }
            });

            grid.appendChild(item);
            reorderPageOrder.push(i - 1);
        }

        hideProgress();
        document.getElementById('reorder-drop-zone').classList.add('hidden');
        document.getElementById('reorder-preview').classList.remove('hidden');
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Failed to load PDF: ' + e.message, 'error');
    }
}

function updateReorderLabels() {
    const grid = document.getElementById('reorder-pages-grid');
    const items = grid.querySelectorAll('.reorder-page-item');
    items.forEach((item, i) => {
        item.querySelector('.page-label').textContent = 'Page ' + (i + 1);
    });
}

async function processReorder() {
    if (!reorderFile) return showToast('No PDF loaded.', 'warning');

    showProgress('Reordering pages...');
    try {
        const arrayBuffer = await reorderFile.arrayBuffer();
        const srcDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const newDoc = await PDFLib.PDFDocument.create();

        // Get current order from DOM
        const grid = document.getElementById('reorder-pages-grid');
        const items = grid.querySelectorAll('.reorder-page-item');
        const newOrder = [...items].map(item => parseInt(item.dataset.pageIndex));

        const copiedPages = await newDoc.copyPages(srcDoc, newOrder);
        copiedPages.forEach(p => newDoc.addPage(p));

        const pdfBytes = await newDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        showSuccess(blob, 'reordered_' + reorderFile.name);
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Reorder failed: ' + e.message, 'error');
    }
}

// ========================
// PDF TO TEXT TOOL
// ========================
function setupPdfToTextTool() {
    const card = document.getElementById('card-pdf-text');
    if (!card) return;
    card.addEventListener('click', () => showView('pdf-text'));

    const drop = document.getElementById('pdf-text-drop-zone');
    const inp = document.getElementById('pdf-text-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handlePdfToText(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handlePdfToText(e.target.files[0]));
    }
}

async function handlePdfToText(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');

    showProgress('Extracting text from PDF...');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
        let allText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            allText += `--- Page ${i} ---\n${pageText}\n\n`;
        }

        if (!allText.trim()) throw new Error('No text found in PDF. The PDF may contain only images.');

        const blob = new Blob([allText], { type: 'text/plain;charset=utf-8' });
        showSuccess(blob, file.name.replace('.pdf', '') + '.txt');
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Text extraction failed: ' + e.message, 'error');
    }
}

// ========================
// PDF METADATA VIEWER TOOL
// ========================
function setupMetadataTool() {
    const card = document.getElementById('card-metadata');
    if (!card) return;
    card.addEventListener('click', () => showView('metadata'));

    const drop = document.getElementById('metadata-drop-zone');
    const inp = document.getElementById('metadata-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleMetadata(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleMetadata(e.target.files[0]));
    }
}

async function handleMetadata(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');

    showProgress('Reading PDF metadata...');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

        const title = pdfDoc.getTitle() || 'N/A';
        const author = pdfDoc.getAuthor() || 'N/A';
        const subject = pdfDoc.getSubject() || 'N/A';
        const creator = pdfDoc.getCreator() || 'N/A';
        const producer = pdfDoc.getProducer() || 'N/A';
        const creationDate = pdfDoc.getCreationDate();
        const modDate = pdfDoc.getModificationDate();
        const pageCount = pdfDoc.getPageCount();

        const fileSizeKB = (file.size / 1024).toFixed(1);
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
        const sizeStr = file.size > 1024 * 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;

        const formatDate = (d) => {
            if (!d) return 'N/A';
            try { return d.toLocaleDateString() + ' ' + d.toLocaleTimeString(); } catch { return 'N/A'; }
        };

        const display = document.getElementById('metadata-display');
        display.innerHTML = `
            <div class="metadata-grid">
                <span class="meta-label">File Name</span><span class="meta-value">${file.name}</span>
                <span class="meta-label">File Size</span><span class="meta-value">${sizeStr}</span>
                <span class="meta-label">Pages</span><span class="meta-value">${pageCount}</span>
                <span class="meta-label">Title</span><span class="meta-value">${title}</span>
                <span class="meta-label">Author</span><span class="meta-value">${author}</span>
                <span class="meta-label">Subject</span><span class="meta-value">${subject}</span>
                <span class="meta-label">Creator</span><span class="meta-value">${creator}</span>
                <span class="meta-label">Producer</span><span class="meta-value">${producer}</span>
                <span class="meta-label">Created</span><span class="meta-value">${formatDate(creationDate)}</span>
                <span class="meta-label">Modified</span><span class="meta-value">${formatDate(modDate)}</span>
            </div>
        `;
        display.classList.remove('hidden');
        document.getElementById('metadata-drop-zone').classList.add('hidden');
        hideProgress();
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Failed to read metadata: ' + e.message, 'error');
    }
}

// ========================
// REDACT PDF TOOL
// ========================
let redactFile = null;
let redactRects = []; // [{pageIdx, x, y, w, h}]

function setupRedactTool() {
    const card = document.getElementById('card-redact');
    if (!card) return;
    card.addEventListener('click', () => showView('redact'));

    const drop = document.getElementById('redact-drop-zone');
    const inp = document.getElementById('redact-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleRedactFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleRedactFile(e.target.files[0]));
    }

    const undoBtn = document.getElementById('btn-undo-redact');
    if (undoBtn) undoBtn.addEventListener('click', () => {
        if (redactRects.length > 0) {
            const removed = redactRects.pop();
            const wrapper = document.querySelector(`.redact-page-wrapper[data-page="${removed.pageIdx}"]`);
            if (wrapper) {
                const boxes = wrapper.querySelectorAll('.redact-box');
                if (boxes.length > 0) boxes[boxes.length - 1].remove();
            }
            showToast('Removed last redaction.', 'info');
        }
    });

    const clearBtn = document.getElementById('btn-clear-redacts');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        redactRects = [];
        document.querySelectorAll('.redact-box').forEach(b => b.remove());
        showToast('All redactions cleared.', 'info');
    });

    const processBtn = document.getElementById('btn-process-redact');
    if (processBtn) processBtn.addEventListener('click', processRedact);
}

async function handleRedactFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    redactFile = file;
    redactRects = [];

    showProgress('Loading PDF pages...');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
        const container = document.getElementById('redact-pages-container');
        container.innerHTML = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.2 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            const wrapper = document.createElement('div');
            wrapper.className = 'redact-page-wrapper';
            wrapper.dataset.page = i - 1;
            wrapper.style.position = 'relative';
            wrapper.style.display = 'inline-block';

            const label = document.createElement('div');
            label.className = 'page-label';
            label.textContent = 'Page ' + i;

            wrapper.appendChild(canvas);
            wrapper.appendChild(label);

            // Drawing redact boxes
            let isDrawing = false, startX, startY, currentBox;
            wrapper.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('redact-box')) return;
                const rect = canvas.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;
                isDrawing = true;
                currentBox = document.createElement('div');
                currentBox.className = 'redact-box';
                currentBox.style.left = startX + 'px';
                currentBox.style.top = startY + 'px';
                wrapper.appendChild(currentBox);
            });
            wrapper.addEventListener('mousemove', (e) => {
                if (!isDrawing) return;
                const rect = canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                const w = mx - startX;
                const h = my - startY;
                currentBox.style.width = Math.abs(w) + 'px';
                currentBox.style.height = Math.abs(h) + 'px';
                currentBox.style.left = (w < 0 ? mx : startX) + 'px';
                currentBox.style.top = (h < 0 ? my : startY) + 'px';
            });
            wrapper.addEventListener('mouseup', (e) => {
                if (!isDrawing) return;
                isDrawing = false;
                const bw = parseFloat(currentBox.style.width) || 0;
                const bh = parseFloat(currentBox.style.height) || 0;
                if (bw < 5 || bh < 5) { currentBox.remove(); return; }
                const scaleX = canvas.width / canvas.offsetWidth;
                const scaleY = canvas.height / canvas.offsetHeight;
                redactRects.push({
                    pageIdx: parseInt(wrapper.dataset.page),
                    x: parseFloat(currentBox.style.left) * scaleX,
                    y: parseFloat(currentBox.style.top) * scaleY,
                    w: bw * scaleX,
                    h: bh * scaleY
                });
            });

            container.appendChild(wrapper);
        }

        hideProgress();
        document.getElementById('redact-drop-zone').classList.add('hidden');
        document.getElementById('redact-workspace').classList.remove('hidden');
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Failed to load PDF: ' + e.message, 'error');
    }
}

async function processRedact() {
    if (!redactFile || redactRects.length === 0) return showToast('Draw at least one redaction box on the pages.', 'warning');

    showProgress('Applying redactions...');
    try {
        const arrayBuffer = await redactFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
        const newPdf = await PDFLib.PDFDocument.create();

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            // Apply redactions for this page
            const pageRects = redactRects.filter(r => r.pageIdx === i - 1);
            const renderScale = 2.0 / 1.2; // ratio between render scale and display scale
            ctx.fillStyle = '#000000';
            for (const r of pageRects) {
                ctx.fillRect(r.x * renderScale, r.y * renderScale, r.w * renderScale, r.h * renderScale);
            }

            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            const img = await newPdf.embedJpg(imgData);
            const origViewport = page.getViewport({ scale: 1.0 });
            const newPage = newPdf.addPage([origViewport.width, origViewport.height]);
            newPage.drawImage(img, { x: 0, y: 0, width: origViewport.width, height: origViewport.height });
        }

        const pdfBytes = await newPdf.save();
        showSuccess(new Blob([pdfBytes], { type: 'application/pdf' }), 'redacted_' + redactFile.name);

        redactFile = null;
        redactRects = [];
        document.getElementById('redact-workspace').classList.add('hidden');
        document.getElementById('redact-drop-zone').classList.remove('hidden');
        document.getElementById('redact-pages-container').innerHTML = '';
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Redaction failed: ' + e.message, 'error');
    }
}

// ========================
// COMPARE PDFs TOOL
// ========================
let compareFile1 = null, compareFile2 = null;
let comparePdf1 = null, comparePdf2 = null;
let compareCurrentPage = 0;

function setupCompareTool() {
    const card = document.getElementById('card-compare');
    if (!card) return;
    card.addEventListener('click', () => showView('compare'));

    const drop1 = document.getElementById('compare-drop-zone-1');
    const inp1 = document.getElementById('compare-upload-1');
    const drop2 = document.getElementById('compare-drop-zone-2');
    const inp2 = document.getElementById('compare-upload-2');

    if (drop1) {
        drop1.addEventListener('click', () => inp1.click());
        drop1.addEventListener('dragover', (e) => e.preventDefault());
        drop1.addEventListener('drop', (e) => { e.preventDefault(); handleCompareFile(e.dataTransfer.files[0], 1); });
        inp1.addEventListener('change', (e) => handleCompareFile(e.target.files[0], 1));
    }
    if (drop2) {
        drop2.addEventListener('click', () => inp2.click());
        drop2.addEventListener('dragover', (e) => e.preventDefault());
        drop2.addEventListener('drop', (e) => { e.preventDefault(); handleCompareFile(e.dataTransfer.files[0], 2); });
        inp2.addEventListener('change', (e) => handleCompareFile(e.target.files[0], 2));
    }

    const processBtn = document.getElementById('btn-process-compare');
    if (processBtn) processBtn.addEventListener('click', processCompare);

    const prevBtn = document.getElementById('compare-prev');
    const nextBtn = document.getElementById('compare-next');
    if (prevBtn) prevBtn.addEventListener('click', () => { if (compareCurrentPage > 0) { compareCurrentPage--; renderComparePage(); } });
    if (nextBtn) nextBtn.addEventListener('click', () => {
        const maxPages = Math.max(comparePdf1 ? comparePdf1.numPages : 0, comparePdf2 ? comparePdf2.numPages : 0);
        if (compareCurrentPage < maxPages - 1) { compareCurrentPage++; renderComparePage(); }
    });
}

async function handleCompareFile(file, slot) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');

    if (slot === 1) {
        compareFile1 = file;
        const nameEl = document.getElementById('compare-name-1');
        nameEl.textContent = file.name;
        nameEl.classList.remove('hidden');
    } else {
        compareFile2 = file;
        const nameEl = document.getElementById('compare-name-2');
        nameEl.textContent = file.name;
        nameEl.classList.remove('hidden');
    }

    if (compareFile1 && compareFile2) {
        document.getElementById('btn-process-compare').classList.remove('hidden');
    }
}

async function processCompare() {
    if (!compareFile1 || !compareFile2) return;

    showProgress('Comparing PDFs...');
    try {
        const buf1 = await compareFile1.arrayBuffer();
        const buf2 = await compareFile2.arrayBuffer();
        comparePdf1 = await pdfjsLib.getDocument(new Uint8Array(buf1)).promise;
        comparePdf2 = await pdfjsLib.getDocument(new Uint8Array(buf2)).promise;
        compareCurrentPage = 0;

        hideProgress();
        document.getElementById('compare-upload-area').classList.add('hidden');
        document.getElementById('btn-process-compare').classList.add('hidden');
        document.getElementById('compare-results').classList.remove('hidden');
        await renderComparePage();
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Comparison failed: ' + e.message, 'error');
    }
}

async function renderComparePage() {
    const pageNum = compareCurrentPage + 1;
    const maxPages = Math.max(comparePdf1.numPages, comparePdf2.numPages);
    document.getElementById('compare-page-info').textContent = `Page ${pageNum} of ${maxPages}`;

    const scale = 1.5;
    const canvas1 = document.getElementById('compare-canvas-1');
    const canvas2 = document.getElementById('compare-canvas-2');
    const canvasDiff = document.getElementById('compare-canvas-diff');

    // Render page from PDF 1
    let imgData1 = null;
    if (pageNum <= comparePdf1.numPages) {
        const page1 = await comparePdf1.getPage(pageNum);
        const vp1 = page1.getViewport({ scale });
        canvas1.width = vp1.width; canvas1.height = vp1.height;
        const ctx1 = canvas1.getContext('2d');
        await page1.render({ canvasContext: ctx1, viewport: vp1 }).promise;
        imgData1 = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);
    } else {
        canvas1.width = canvas2.width || 400; canvas1.height = canvas2.height || 600;
        const ctx1 = canvas1.getContext('2d');
        ctx1.fillStyle = '#f0f0f0'; ctx1.fillRect(0, 0, canvas1.width, canvas1.height);
        ctx1.fillStyle = '#999'; ctx1.font = '20px Outfit'; ctx1.textAlign = 'center';
        ctx1.fillText('No page', canvas1.width / 2, canvas1.height / 2);
    }

    // Render page from PDF 2
    let imgData2 = null;
    if (pageNum <= comparePdf2.numPages) {
        const page2 = await comparePdf2.getPage(pageNum);
        const vp2 = page2.getViewport({ scale });
        canvas2.width = vp2.width; canvas2.height = vp2.height;
        const ctx2 = canvas2.getContext('2d');
        await page2.render({ canvasContext: ctx2, viewport: vp2 }).promise;
        imgData2 = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);
    } else {
        canvas2.width = canvas1.width || 400; canvas2.height = canvas1.height || 600;
        const ctx2 = canvas2.getContext('2d');
        ctx2.fillStyle = '#f0f0f0'; ctx2.fillRect(0, 0, canvas2.width, canvas2.height);
        ctx2.fillStyle = '#999'; ctx2.font = '20px Outfit'; ctx2.textAlign = 'center';
        ctx2.fillText('No page', canvas2.width / 2, canvas2.height / 2);
    }

    // Compute diff
    const diffW = Math.max(canvas1.width, canvas2.width);
    const diffH = Math.max(canvas1.height, canvas2.height);
    canvasDiff.width = diffW; canvasDiff.height = diffH;
    const ctxDiff = canvasDiff.getContext('2d');

    if (imgData1 && imgData2) {
        const diffData = ctxDiff.createImageData(diffW, diffH);
        let diffCount = 0;
        for (let y = 0; y < diffH; y++) {
            for (let x = 0; x < diffW; x++) {
                const idx = (y * diffW + x) * 4;
                let r1 = 255, g1 = 255, b1 = 255;
                let r2 = 255, g2 = 255, b2 = 255;
                if (x < imgData1.width && y < imgData1.height) {
                    const i1 = (y * imgData1.width + x) * 4;
                    r1 = imgData1.data[i1]; g1 = imgData1.data[i1 + 1]; b1 = imgData1.data[i1 + 2];
                }
                if (x < imgData2.width && y < imgData2.height) {
                    const i2 = (y * imgData2.width + x) * 4;
                    r2 = imgData2.data[i2]; g2 = imgData2.data[i2 + 1]; b2 = imgData2.data[i2 + 2];
                }
                const diff = Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
                if (diff > 30) {
                    // Highlight differences in magenta
                    diffData.data[idx] = 255;
                    diffData.data[idx + 1] = 0;
                    diffData.data[idx + 2] = 200;
                    diffData.data[idx + 3] = 255;
                    diffCount++;
                } else {
                    // Faded grayscale for unchanged
                    const gray = Math.round((r1 + g1 + b1) / 3);
                    diffData.data[idx] = gray;
                    diffData.data[idx + 1] = gray;
                    diffData.data[idx + 2] = gray;
                    diffData.data[idx + 3] = 100;
                }
            }
        }
        ctxDiff.putImageData(diffData, 0, 0);
        const pct = ((diffCount / (diffW * diffH)) * 100).toFixed(2);
        ctxDiff.fillStyle = 'rgba(0,0,0,0.7)';
        ctxDiff.fillRect(0, 0, 200, 30);
        ctxDiff.fillStyle = pct > 5 ? '#f87171' : '#34d399';
        ctxDiff.font = '14px Outfit';
        ctxDiff.fillText(`${pct}% pixels differ`, 10, 20);
    } else {
        ctxDiff.fillStyle = '#1a1a2e';
        ctxDiff.fillRect(0, 0, diffW, diffH);
        ctxDiff.fillStyle = '#a5b4fc';
        ctxDiff.font = '18px Outfit';
        ctxDiff.textAlign = 'center';
        ctxDiff.fillText('Page only in one document', diffW / 2, diffH / 2);
    }
}

// ========================
// PDF TO MARKDOWN TOOL
// ========================
let markdownContent = '';

function setupPdfToMarkdownTool() {
    const card = document.getElementById('card-pdf-markdown');
    if (!card) return;
    card.addEventListener('click', () => showView('pdf-markdown'));

    const drop = document.getElementById('pdf-markdown-drop-zone');
    const inp = document.getElementById('pdf-markdown-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handlePdfToMarkdown(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handlePdfToMarkdown(e.target.files[0]));
    }

    const copyBtn = document.getElementById('btn-copy-markdown');
    if (copyBtn) copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(markdownContent).then(() => showToast('Markdown copied to clipboard!', 'success'));
    });

    const downloadBtn = document.getElementById('btn-download-markdown');
    if (downloadBtn) downloadBtn.addEventListener('click', () => {
        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        downloadBlobLocal(markdownContent, 'converted.md', 'text/markdown');
    });
}

async function handlePdfToMarkdown(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');

    showProgress('Converting PDF to Markdown...');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
        let md = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            if (content.items.length === 0) continue;

            // Analyze font sizes for heading detection
            const fontSizes = content.items.map(item => item.height || 12).filter(h => h > 0);
            const avgFontSize = fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length;
            const maxFontSize = Math.max(...fontSizes);

            // Group items by Y position (lines)
            const lineMap = {};
            for (const item of content.items) {
                if (!item.str.trim()) continue;
                const y = Math.round(item.transform[5]);
                if (!lineMap[y]) lineMap[y] = { items: [], fontSize: 0 };
                lineMap[y].items.push(item);
                lineMap[y].fontSize = Math.max(lineMap[y].fontSize, item.height || 12);
            }

            const sortedYs = Object.keys(lineMap).map(Number).sort((a, b) => b - a);

            if (pdf.numPages > 1) {
                md += `\n---\n*Page ${i}*\n\n`;
            }

            let prevY = null;
            for (const y of sortedYs) {
                const line = lineMap[y];
                const text = line.items.sort((a, b) => a.transform[4] - b.transform[4]).map(it => it.str).join(' ').trim();
                if (!text) continue;

                const fs = line.fontSize;

                // Detect paragraph breaks (large Y gap)
                if (prevY !== null && Math.abs(prevY - y) > avgFontSize * 2.5) {
                    md += '\n';
                }

                // Heading detection based on font size relative to average
                if (fs >= maxFontSize * 0.95 && fs > avgFontSize * 1.4) {
                    md += `# ${text}\n\n`;
                } else if (fs > avgFontSize * 1.25) {
                    md += `## ${text}\n\n`;
                } else if (fs > avgFontSize * 1.1) {
                    md += `### ${text}\n\n`;
                } else {
                    // Detect bullet points
                    if (/^[•\-\u2022\u25CF\u25CB\u2023\u2043]/.test(text)) {
                        md += `- ${text.replace(/^[•\-\u2022\u25CF\u25CB\u2023\u2043]\s*/, '')}\n`;
                    } else if (/^\d+[\.\)]\s/.test(text)) {
                        md += `${text}\n`;
                    } else {
                        md += `${text}\n`;
                    }
                }
                prevY = y;
            }
        }

        markdownContent = md.trim();

        if (!markdownContent) throw new Error('No text found in PDF.');

        document.getElementById('pdf-markdown-output').innerHTML =
            `<pre style="white-space:pre-wrap;word-break:break-word;max-height:400px;overflow-y:auto;padding:15px;background:rgba(0,0,0,0.3);border-radius:8px;color:#e2e8f0;font-size:0.85rem;text-align:left;">${markdownContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`;
        document.getElementById('pdf-markdown-drop-zone').classList.add('hidden');
        document.getElementById('pdf-markdown-preview').classList.remove('hidden');
        hideProgress();
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Markdown conversion failed: ' + e.message, 'error');
    }
}

// ========================
// FORM FILLER TOOL
// ========================
let formFillerFile = null;
let formFillerDoc = null;

function setupFormFillerTool() {
    const card = document.getElementById('card-form-filler');
    if (!card) return;
    card.addEventListener('click', () => showView('form-filler'));

    const drop = document.getElementById('form-filler-drop-zone');
    const inp = document.getElementById('form-filler-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleFormFillerFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleFormFillerFile(e.target.files[0]));
    }

    const processBtn = document.getElementById('btn-process-form');
    if (processBtn) processBtn.addEventListener('click', processFormFill);
}

async function handleFormFillerFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    formFillerFile = file;

    showProgress('Detecting form fields...');
    try {
        const arrayBuffer = await file.arrayBuffer();
        formFillerDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const form = formFillerDoc.getForm();
        const fields = form.getFields();

        const container = document.getElementById('form-fields-container');
        container.innerHTML = '';

        if (fields.length === 0) {
            container.innerHTML = '<p style="color:#f87171;text-align:center;">No form fields detected in this PDF.<br><small style="color:#a5b4fc;">This tool works with PDFs that have interactive form fields (text boxes, checkboxes, dropdowns).</small></p>';
            hideProgress();
            document.getElementById('form-filler-drop-zone').classList.add('hidden');
            document.getElementById('form-filler-workspace').classList.remove('hidden');
            return;
        }

        for (const field of fields) {
            const name = field.getName();
            const type = field.constructor.name;
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'form-field-item';

            if (type === 'PDFTextField') {
                const currentVal = field.getText() || '';
                const isMultiline = field.isMultiline && field.isMultiline();
                fieldDiv.innerHTML = `
                    <label class="form-field-label">${name}</label>
                    ${isMultiline
                        ? `<textarea class="glass-input form-field-input" data-field-name="${name}" data-field-type="text" rows="3" placeholder="Enter text...">${currentVal}</textarea>`
                        : `<input type="text" class="glass-input form-field-input" data-field-name="${name}" data-field-type="text" value="${currentVal}" placeholder="Enter text...">`
                    }
                `;
            } else if (type === 'PDFCheckBox') {
                const checked = field.isChecked();
                fieldDiv.innerHTML = `
                    <label class="form-field-label" style="display:flex;align-items:center;gap:8px;">
                        <input type="checkbox" class="form-field-input" data-field-name="${name}" data-field-type="checkbox" ${checked ? 'checked' : ''}>
                        ${name}
                    </label>
                `;
            } else if (type === 'PDFDropdown') {
                const options = field.getOptions();
                const selected = field.getSelected ? field.getSelected() : [];
                let optHtml = options.map(opt =>
                    `<option value="${opt}" ${selected.includes(opt) ? 'selected' : ''}>${opt}</option>`
                ).join('');
                fieldDiv.innerHTML = `
                    <label class="form-field-label">${name}</label>
                    <select class="glass-select form-field-input" data-field-name="${name}" data-field-type="dropdown">${optHtml}</select>
                `;
            } else if (type === 'PDFRadioGroup') {
                const options = field.getOptions();
                const selected = field.getSelected ? field.getSelected() : '';
                let radioHtml = options.map(opt =>
                    `<label style="display:flex;align-items:center;gap:6px;color:#e2e8f0;">
                        <input type="radio" name="form-radio-${name}" class="form-field-input" data-field-name="${name}" data-field-type="radio" value="${opt}" ${selected === opt ? 'checked' : ''}>
                        ${opt}
                    </label>`
                ).join('');
                fieldDiv.innerHTML = `<label class="form-field-label">${name}</label><div style="display:flex;flex-direction:column;gap:6px;">${radioHtml}</div>`;
            } else {
                fieldDiv.innerHTML = `<label class="form-field-label">${name} <small style="color:#888;">(${type} - read only)</small></label>`;
            }

            container.appendChild(fieldDiv);
        }

        hideProgress();
        document.getElementById('form-filler-drop-zone').classList.add('hidden');
        document.getElementById('form-filler-workspace').classList.remove('hidden');
        showToast(`Found ${fields.length} form field(s).`, 'success');
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Failed to read form fields: ' + e.message, 'error');
    }
}

async function processFormFill() {
    if (!formFillerDoc) return showToast('No form loaded.', 'warning');

    showProgress('Filling form fields...');
    try {
        const form = formFillerDoc.getForm();
        const inputs = document.querySelectorAll('.form-field-input');

        for (const input of inputs) {
            const name = input.dataset.fieldName;
            const type = input.dataset.fieldType;
            if (!name) continue;

            try {
                if (type === 'text') {
                    const field = form.getTextField(name);
                    field.setText(input.value || '');
                } else if (type === 'checkbox') {
                    const field = form.getCheckBox(name);
                    if (input.checked) field.check(); else field.uncheck();
                } else if (type === 'dropdown') {
                    const field = form.getDropdown(name);
                    if (input.value) field.select(input.value);
                } else if (type === 'radio') {
                    if (input.checked) {
                        const field = form.getRadioGroup(name);
                        field.select(input.value);
                    }
                }
            } catch (fieldErr) {
                console.warn('Field error:', name, fieldErr);
            }
        }

        // Flatten form (make fields non-editable)
        form.flatten();

        const pdfBytes = await formFillerDoc.save();
        showSuccess(new Blob([pdfBytes], { type: 'application/pdf' }), 'filled_' + formFillerFile.name);

        formFillerDoc = null;
        formFillerFile = null;
        document.getElementById('form-filler-workspace').classList.add('hidden');
        document.getElementById('form-filler-drop-zone').classList.remove('hidden');
        document.getElementById('form-fields-container').innerHTML = '';
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Form fill failed: ' + e.message, 'error');
    }
}

// ========================
// DELETE PAGES TOOL
// ========================
let deletePagesFile = null;
let deletePagesSelected = new Set();

function setupDeletePagesTool() {
    const card = document.getElementById('card-delete-pages');
    if (!card) return;
    card.addEventListener('click', () => showView('delete-pages'));

    const drop = document.getElementById('delete-pages-drop-zone');
    const inp = document.getElementById('delete-pages-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handleDeletePagesFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handleDeletePagesFile(e.target.files[0]));
    }

    const processBtn = document.getElementById('btn-process-delete-pages');
    if (processBtn) processBtn.addEventListener('click', processDeletePages);
}

async function handleDeletePagesFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    deletePagesFile = file;
    deletePagesSelected = new Set();

    showProgress('Loading PDF pages...');
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
        const grid = document.getElementById('delete-pages-grid');
        grid.innerHTML = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            const item = document.createElement('div');
            item.className = 'delete-page-item';
            item.dataset.pageIndex = i - 1;
            item.innerHTML = `<div class="page-label">Page ${i}</div><div class="delete-overlay"><i class="fa-solid fa-trash"></i></div>`;
            item.prepend(canvas);

            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.pageIndex);
                if (deletePagesSelected.has(idx)) {
                    deletePagesSelected.delete(idx);
                    item.classList.remove('selected-for-delete');
                } else {
                    deletePagesSelected.add(idx);
                    item.classList.add('selected-for-delete');
                }
                updateDeleteCount(pdf.numPages);
            });

            grid.appendChild(item);
        }

        hideProgress();
        document.getElementById('delete-pages-drop-zone').classList.add('hidden');
        document.getElementById('delete-pages-workspace').classList.remove('hidden');
        updateDeleteCount(pdf.numPages);
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Failed to load PDF: ' + e.message, 'error');
    }
}

function updateDeleteCount(total) {
    const count = deletePagesSelected.size;
    const info = document.getElementById('delete-count-info');
    if (count === 0) {
        info.textContent = 'Click pages to select for deletion';
        info.style.color = '#a5b4fc';
    } else if (count >= total) {
        info.textContent = `⚠ Cannot delete all ${total} pages`;
        info.style.color = '#fbbf24';
    } else {
        info.textContent = `${count} page(s) selected for deletion`;
        info.style.color = '#f87171';
    }
}

async function processDeletePages() {
    if (!deletePagesFile) return showToast('No PDF loaded.', 'warning');
    if (deletePagesSelected.size === 0) return showToast('Select at least one page to delete.', 'warning');

    showProgress('Removing pages...');
    try {
        const arrayBuffer = await deletePagesFile.arrayBuffer();
        const srcDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const totalPages = srcDoc.getPageCount();

        if (deletePagesSelected.size >= totalPages) {
            hideProgress();
            return showToast('Cannot delete all pages from a PDF.', 'warning');
        }

        const keepIndices = [];
        for (let i = 0; i < totalPages; i++) {
            if (!deletePagesSelected.has(i)) keepIndices.push(i);
        }

        const newDoc = await PDFLib.PDFDocument.create();
        const copiedPages = await newDoc.copyPages(srcDoc, keepIndices);
        copiedPages.forEach(p => newDoc.addPage(p));

        const pdfBytes = await newDoc.save();
        const removed = deletePagesSelected.size;
        showSuccess(new Blob([pdfBytes], { type: 'application/pdf' }), 'trimmed_' + deletePagesFile.name);
        showToast(`Removed ${removed} page(s). ${keepIndices.length} page(s) remaining.`, 'success');

        deletePagesFile = null;
        deletePagesSelected = new Set();
        document.getElementById('delete-pages-workspace').classList.add('hidden');
        document.getElementById('delete-pages-drop-zone').classList.remove('hidden');
        document.getElementById('delete-pages-grid').innerHTML = '';
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Delete pages failed: ' + e.message, 'error');
    }
}

// ========================
// PAGE RESIZE TOOL
// ========================
let pageResizeFile = null;
let pageResizeSize = 'a4';

const PAGE_SIZES = {
    a4: { w: 595.28, h: 841.89, label: 'A4' },
    letter: { w: 612, h: 792, label: 'US Letter' },
    legal: { w: 612, h: 1008, label: 'US Legal' },
    a3: { w: 841.89, h: 1190.55, label: 'A3' },
    a5: { w: 419.53, h: 595.28, label: 'A5' },
};

function setupPageResizeTool() {
    const card = document.getElementById('card-page-resize');
    if (!card) return;
    card.addEventListener('click', () => showView('page-resize'));

    const drop = document.getElementById('page-resize-drop-zone');
    const inp = document.getElementById('page-resize-upload-input');
    if (drop) {
        drop.addEventListener('click', () => inp.click());
        drop.addEventListener('dragover', (e) => e.preventDefault());
        drop.addEventListener('drop', (e) => { e.preventDefault(); handlePageResizeFile(e.dataTransfer.files[0]); });
        inp.addEventListener('change', (e) => handlePageResizeFile(e.target.files[0]));
    }

    // Preset buttons
    document.querySelectorAll('.resize-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.resize-preset').forEach(b => { b.classList.remove('active'); b.classList.remove('primary'); b.classList.add('secondary'); });
            btn.classList.add('active');
            btn.classList.remove('secondary');
            btn.classList.add('primary');
            pageResizeSize = btn.dataset.size;
            const customInputs = document.getElementById('custom-size-inputs');
            if (pageResizeSize === 'custom') {
                customInputs.classList.remove('hidden');
                customInputs.style.display = 'flex';
            } else {
                customInputs.classList.add('hidden');
            }
        });
    });

    const processBtn = document.getElementById('btn-process-resize');
    if (processBtn) processBtn.addEventListener('click', processPageResize);
}

function handlePageResizeFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    pageResizeFile = file;
    document.getElementById('page-resize-drop-zone').classList.add('hidden');
    document.getElementById('page-resize-options').classList.remove('hidden');
}

async function processPageResize() {
    if (!pageResizeFile) return;

    let targetW, targetH;

    if (pageResizeSize === 'custom') {
        const unit = document.getElementById('resize-custom-unit').value;
        let w = parseFloat(document.getElementById('resize-custom-w').value);
        let h = parseFloat(document.getElementById('resize-custom-h').value);
        if (!w || !h || w <= 0 || h <= 0) return showToast('Enter valid custom dimensions.', 'warning');
        // Convert to points (1 in = 72pt, 1 mm = 2.835pt)
        const factor = unit === 'in' ? 72 : 2.835;
        targetW = w * factor;
        targetH = h * factor;
    } else {
        const size = PAGE_SIZES[pageResizeSize];
        if (!size) return showToast('Invalid page size.', 'warning');
        targetW = size.w;
        targetH = size.h;
    }

    const keepAspect = document.getElementById('resize-keep-aspect').checked;

    showProgress('Resizing pages...');
    try {
        const arrayBuffer = await pageResizeFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(new Uint8Array(arrayBuffer)).promise;
        const newPdf = await PDFLib.PDFDocument.create();

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const origVp = page.getViewport({ scale: 1.0 });

            // Render at high quality
            const renderScale = 2.0;
            const viewport = page.getViewport({ scale: renderScale });
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            await page.render({ canvasContext: ctx, viewport }).promise;

            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            const img = await newPdf.embedJpg(imgData);

            const newPage = newPdf.addPage([targetW, targetH]);

            if (keepAspect) {
                // Fit content maintaining aspect ratio
                const origRatio = origVp.width / origVp.height;
                const targetRatio = targetW / targetH;
                let drawW, drawH, drawX, drawY;
                if (origRatio > targetRatio) {
                    drawW = targetW;
                    drawH = targetW / origRatio;
                } else {
                    drawH = targetH;
                    drawW = targetH * origRatio;
                }
                drawX = (targetW - drawW) / 2;
                drawY = (targetH - drawH) / 2;
                newPage.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
            } else {
                // Stretch to fill
                newPage.drawImage(img, { x: 0, y: 0, width: targetW, height: targetH });
            }
        }

        const pdfBytes = await newPdf.save();
        const sizeLabel = PAGE_SIZES[pageResizeSize] ? PAGE_SIZES[pageResizeSize].label : 'custom';
        showSuccess(new Blob([pdfBytes], { type: 'application/pdf' }), `resized_${sizeLabel}_` + pageResizeFile.name);

        pageResizeFile = null;
        document.getElementById('page-resize-options').classList.add('hidden');
        document.getElementById('page-resize-drop-zone').classList.remove('hidden');
    } catch (e) {
        hideProgress();
        console.error(e);
        showToast('Page resize failed: ' + e.message, 'error');
    }
}

// ========================
// SUMMARIZE PDF TOOL (AI - Gemini)
// ========================
let summarizeFile = null;
let lastSummaryText = '';

function setupSummarizeTool() {
    const card = document.getElementById('card-summarize');
    if (!card) return;
    card.addEventListener('click', () => showView('summarize'));

    const drop = document.getElementById('summarize-drop-zone');
    const inp = document.getElementById('summarize-upload-input');
    if (!drop) return;

    drop.addEventListener('click', () => inp.click());
    drop.addEventListener('dragover', (e) => e.preventDefault());
    drop.addEventListener('drop', (e) => { e.preventDefault(); handleSummarizeFile(e.dataTransfer.files[0]); });
    inp.addEventListener('change', (e) => handleSummarizeFile(e.target.files[0]));

    const processBtn = document.getElementById('btn-process-summarize');
    if (processBtn) processBtn.addEventListener('click', processSummarize);

    const copyBtn = document.getElementById('btn-copy-summary');
    if (copyBtn) copyBtn.addEventListener('click', () => {
        if (!lastSummaryText) return;
        navigator.clipboard.writeText(lastSummaryText).then(() => {
            showToast('Summary copied to clipboard!', 'success');
        }).catch(() => {
            showToast('Failed to copy. Try selecting & copying manually.', 'warning');
        });
    });

    const downloadBtn = document.getElementById('btn-download-summary');
    if (downloadBtn) downloadBtn.addEventListener('click', () => {
        if (!lastSummaryText) return;
        const blob = new Blob([lastSummaryText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (summarizeFile ? summarizeFile.name.replace('.pdf', '') : 'summary') + '_summary.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    const newBtn = document.getElementById('btn-new-summarize');
    if (newBtn) newBtn.addEventListener('click', resetSummarize);
}

function handleSummarizeFile(file) {
    if (!file || file.type !== 'application/pdf') return showToast('Please upload a PDF file.', 'warning');
    summarizeFile = file;

    const fileInfo = document.getElementById('summarize-file-info');
    if (fileInfo) {
        fileInfo.innerHTML = `<i class="fa-solid fa-file-pdf" style="color:#a78bfa;"></i> <strong>${file.name}</strong> &mdash; ${formatFileSize(file.size)}`;
        fileInfo.style.display = 'block';
    }

    document.getElementById('summarize-drop-zone').classList.add('hidden');
    document.getElementById('summarize-options').classList.remove('hidden');
    document.getElementById('summarize-result').classList.add('hidden');
}

async function processSummarize() {
    if (!summarizeFile) return;

    // Check API key
    const apiKey = (typeof CONFIG !== 'undefined' && CONFIG.GEMINI_API_KEY) ? CONFIG.GEMINI_API_KEY : '';
    if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
        showToast('Gemini API key not configured. Please update config.js.', 'error');
        return;
    }

    const summaryType = document.getElementById('summarize-type').value;
    const lang = document.getElementById('summarize-lang').value;

    const spinner = document.getElementById('summarize-spinner');
    const statusEl = document.getElementById('summarize-status');
    const btn = document.getElementById('btn-process-summarize');

    spinner.classList.remove('hidden');
    statusEl.style.display = 'block';
    statusEl.innerText = 'Extracting text from PDF…';
    btn.disabled = true;

    try {
        // Step 1: Extract text from PDF
        const arrayBuffer = await summarizeFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
        const totalPages = pdf.numPages;

        let fullText = '';
        for (let i = 1; i <= totalPages; i++) {
            statusEl.innerText = `Reading page ${i} of ${totalPages}…`;
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            fullText += `\n--- Page ${i} ---\n${pageText}`;
        }

        // Truncate to ~30,000 chars to stay within Gemini token limits
        const MAX_CHARS = 30000;
        if (fullText.length > MAX_CHARS) {
            fullText = fullText.substring(0, MAX_CHARS) + '\n\n[... content truncated for length ...]';
        }

        if (fullText.trim().length < 50) {
            throw new Error('Not enough readable text found in PDF. Try an OCR scan first.');
        }

        // Step 2: Build prompt
        statusEl.innerText = 'Sending to Gemini AI…';
        const promptMap = {
            brief: `Provide a brief, concise summary (2-4 sentences) of the following document in ${lang}:`,
            detailed: `Provide a comprehensive, detailed summary of the following document in ${lang}. Include key topics, main arguments, and important conclusions:`,
            bullets: `Summarize the following document as a clear, organized bullet-point list in ${lang}. Use • for bullets. Group related points under subheadings if appropriate:`,
            insights: `Extract and list the top 10 key insights, findings, or takeaways from the following document in ${lang}. Number each insight:`,
            qa: `Based on the following document, generate 10 important questions and their detailed answers in ${lang}. Format as:\nQ: [question]\nA: [answer]\n`,
        };
        const instruction = promptMap[summaryType] || promptMap.detailed;

        const prompt = `${instruction}\n\n---DOCUMENT START---\n${fullText}\n---DOCUMENT END---`;

        // Step 3: Call Gemini API
        const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(GEMINI_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.4,
                    maxOutputTokens: 2048,
                },
            }),
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            const errMsg = errData?.error?.message || `HTTP ${response.status}`;
            throw new Error(`Gemini API error: ${errMsg}`);
        }

        const data = await response.json();
        const summaryText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (!summaryText) throw new Error('No summary returned from Gemini. Please try again.');

        // Step 4: Display result
        lastSummaryText = summaryText;
        const outputEl = document.getElementById('summarize-output');
        outputEl.innerText = summaryText;

        document.getElementById('summarize-options').classList.add('hidden');
        document.getElementById('summarize-result').classList.remove('hidden');

        statusEl.style.display = 'none';
        spinner.classList.add('hidden');
        btn.disabled = false;

        showToast('Summary generated successfully!', 'success');

    } catch (e) {
        console.error('Summarize error:', e);
        spinner.classList.add('hidden');
        statusEl.style.display = 'none';
        btn.disabled = false;
        showToast('Summarize failed: ' + e.message, 'error');
    }
}

function resetSummarize() {
    summarizeFile = null;
    lastSummaryText = '';

    const fileInfo = document.getElementById('summarize-file-info');
    if (fileInfo) fileInfo.style.display = 'none';

    const output = document.getElementById('summarize-output');
    if (output) output.innerText = '';

    document.getElementById('summarize-result').classList.add('hidden');
    document.getElementById('summarize-options').classList.add('hidden');
    document.getElementById('summarize-drop-zone').classList.remove('hidden');

    const inp = document.getElementById('summarize-upload-input');
    if (inp) inp.value = '';
}
