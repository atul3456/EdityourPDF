/* =====================================================================
   IMAGE TOOLS — EdityourPDF
   All processing is done client-side via Canvas 2D API.
   Mobile-first, touch-friendly.
   ===================================================================== */

/* ---------- UTILITIES ---------- */

function imgShowSection(id) {
    document.querySelectorAll('.img-tool-section, #img-editor-dashboard, #home-dashboard').forEach(s => s.classList.add('hidden'));
    const sec = document.getElementById(id);
    if (sec) sec.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function imgGoHome() {
    document.querySelectorAll('.img-tool-section, #img-editor-dashboard').forEach(s => s.classList.add('hidden'));
    document.getElementById('img-editor-dashboard').classList.remove('hidden');
    window.scrollTo(0, 0);
}

function imgFileToCanvas(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve({ canvas, img });
        };
        img.onerror = reject;
        img.src = url;
    });
}

function canvasToBlob(canvas, mime = 'image/jpeg', quality = 0.92) {
    return new Promise(resolve => canvas.toBlob(resolve, mime, quality));
}

function blobToFile(blob, name) {
    return new File([blob], name, { type: blob.type });
}

function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function downloadBlob(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(a.href); }, 1000);
}

function imgShowToast(msg, type = 'success') {
    const tc = document.getElementById('toast-container');
    if (!tc) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    tc.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

function setupImgDropZone(zoneId, inputId, cb, acceptMultiple = false) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;

    zone.addEventListener('click', () => input.click());

    zone.addEventListener('dragover', e => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length) cb(acceptMultiple ? files : files[0]);
    });

    input.addEventListener('change', () => {
        if (input.files.length) cb(acceptMultiple ? input.files : input.files[0]);
        input.value = '';
    });
}

/* ========================================================
   1. IMAGE COMPRESS
   Accurate binary-search quality loop to hit target size.
   ======================================================== */

(function initImgCompress() {
    let currentFile = null;

    setupImgDropZone('img-compress-drop-zone', 'img-compress-input', async function (file) {
        if (!file.type.startsWith('image/')) { imgShowToast('Please upload an image file.', 'error'); return; }
        currentFile = file;
        const info = document.getElementById('img-compress-file-info');
        info.textContent = `${file.name} — ${formatBytes(file.size)}`;
        info.style.display = 'block';
        document.getElementById('img-compress-options').classList.remove('hidden');
    });

    document.getElementById('btn-process-img-compress')?.addEventListener('click', async () => {
        if (!currentFile) return;
        const targetVal = parseFloat(document.getElementById('img-compress-target-val').value);
        const unit = document.getElementById('img-compress-target-unit').value;
        if (!targetVal || targetVal <= 0) { imgShowToast('Please enter a valid target size.', 'error'); return; }
        const targetBytes = unit === 'MB' ? targetVal * 1024 * 1024 : targetVal * 1024;
        if (targetBytes >= currentFile.size) { imgShowToast('Target size must be smaller than original.', 'error'); return; }

        const statusEl = document.getElementById('img-compress-status');
        const spinner = document.getElementById('img-compress-spinner');
        statusEl.textContent = 'Compressing…';
        statusEl.style.display = 'block';
        spinner.classList.remove('hidden');

        try {
            const { canvas } = await imgFileToCanvas(currentFile);
            const mime = (currentFile.type === 'image/png' || currentFile.type === 'image/webp') ? 'image/jpeg' : currentFile.type;
            const result = await compressToTarget(canvas, targetBytes, mime);

            spinner.classList.add('hidden');
            const savings = (((currentFile.size - result.size) / currentFile.size) * 100).toFixed(1);
            statusEl.textContent = `✅ Compressed: ${formatBytes(result.size)} (saved ${savings}%)`;

            const ext = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
            const baseName = currentFile.name.replace(/\.[^.]+$/, '');
            downloadBlob(result, `${baseName}_compressed.${ext}`);
        } catch (e) {
            spinner.classList.add('hidden');
            statusEl.textContent = '❌ Error: ' + e.message;
        }
    });

    async function compressToTarget(canvas, targetBytes, mime) {
        // --- Phase 1: Binary search on quality at full resolution ---
        let bestBlob = null;
        let bestDiff = Infinity;
        let lo = 0.01, hi = 0.99;

        for (let i = 0; i < 30; i++) {
            const mid = (lo + hi) / 2;
            const blob = await canvasToBlob(canvas, mime, mid);
            const diff = Math.abs(blob.size - targetBytes);

            if (diff < bestDiff) {
                bestBlob = blob;
                bestDiff = diff;
            }

            if (blob.size <= targetBytes) {
                lo = mid;
            } else {
                hi = mid;
            }

            // Within 2% — stop early
            if (diff < targetBytes * 0.02) break;
            if (Math.abs(hi - lo) < 0.001) break;
        }

        // If quality-only result is within 3%, return
        if (bestBlob && bestBlob.size <= targetBytes * 1.03 && bestBlob.size >= targetBytes * 0.5) {
            return bestBlob;
        }

        // --- Phase 2: Quality alone isn't enough — binary search on scale ---
        let bestScale = 1.0;
        let scaleLo = 0.05, scaleHi = 0.95;

        for (let i = 0; i < 20; i++) {
            const scaleMid = (scaleLo + scaleHi) / 2;
            const rCanvas = document.createElement('canvas');
            rCanvas.width = Math.round(canvas.width * scaleMid);
            rCanvas.height = Math.round(canvas.height * scaleMid);
            rCanvas.getContext('2d').drawImage(canvas, 0, 0, rCanvas.width, rCanvas.height);
            const blob = await canvasToBlob(rCanvas, mime, 0.5);

            if (blob.size <= targetBytes) {
                bestScale = scaleMid;
                scaleLo = scaleMid;
            } else {
                scaleHi = scaleMid;
            }
            if (Math.abs(scaleHi - scaleLo) < 0.01) break;
        }

        // --- Phase 3: Refine quality at the found scale ---
        const scaledCanvas = document.createElement('canvas');
        scaledCanvas.width = Math.round(canvas.width * bestScale);
        scaledCanvas.height = Math.round(canvas.height * bestScale);
        scaledCanvas.getContext('2d').drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);

        bestBlob = null;
        bestDiff = Infinity;
        lo = 0.01; hi = 0.99;

        for (let i = 0; i < 25; i++) {
            const mid = (lo + hi) / 2;
            const blob = await canvasToBlob(scaledCanvas, mime, mid);
            const diff = Math.abs(blob.size - targetBytes);

            if (diff < bestDiff) {
                bestBlob = blob;
                bestDiff = diff;
            }

            if (blob.size <= targetBytes) {
                lo = mid;
            } else {
                hi = mid;
            }

            if (diff < targetBytes * 0.01) break; // Within 1%
            if (Math.abs(hi - lo) < 0.001) break;
        }

        if (!bestBlob) bestBlob = await canvasToBlob(scaledCanvas, mime, 0.01);
        return bestBlob;
    }
})();

/* ========================================================
   2. IMAGE ENHANCE
   Live canvas preview with sliders.
   ======================================================== */

(function initImgEnhance() {
    let enhCanvas = null, enhCtx = null, enhOrigImage = null;
    const preview = document.getElementById('img-enhance-preview');

    function getSlider(id) { return parseFloat(document.getElementById(id)?.value ?? 0); }
    function getLabel(id) { return document.getElementById(id); }

    function applyFilters() {
        if (!enhCanvas || !enhOrigImage) return;
        enhCtx.filter = [
            `brightness(${getSlider('enh-brightness')}%)`,
            `contrast(${getSlider('enh-contrast')}%)`,
            `saturate(${getSlider('enh-saturate')}%)`,
            `sepia(${getSlider('enh-sepia')}%)`,
            `hue-rotate(${getSlider('enh-hue')}deg)`,
            `blur(${getSlider('enh-blur')}px)`,
        ].join(' ');
        enhCtx.drawImage(enhOrigImage, 0, 0, enhCanvas.width, enhCanvas.height);
        enhCtx.filter = 'none';
        // Sharpness via unsharp-mask convolution
        const sharp = getSlider('enh-sharp');
        if (sharp > 0) applySharpen(enhCtx, enhCanvas.width, enhCanvas.height, sharp / 100);
    }

    function applySharpen(ctx, w, h, amount) {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        const kernel = [0, -amount, 0, -amount, 1 + 4 * amount, -amount, 0, -amount, 0];
        const output = new Uint8ClampedArray(d);
        for (let y = 1; y < h - 1; y++) {
            for (let x = 1; x < w - 1; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * w + (x + kx)) * 4 + c;
                            sum += d[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
                        }
                    }
                    output[(y * w + x) * 4 + c] = Math.max(0, Math.min(255, sum));
                }
            }
        }
        imageData.data.set(output);
        ctx.putImageData(imageData, 0, 0);
    }

    setupImgDropZone('img-enhance-drop-zone', 'img-enhance-input', async function (file) {
        if (!file.type.startsWith('image/')) { imgShowToast('Please upload an image.', 'error'); return; }
        const { canvas, img } = await imgFileToCanvas(file);
        enhOrigImage = img;
        // Scale preview to max 600px wide
        const maxW = Math.min(600, canvas.width);
        const scale = maxW / canvas.width;
        enhCanvas = document.getElementById('img-enhance-canvas');
        enhCanvas.width = Math.round(canvas.width * scale);
        enhCanvas.height = Math.round(canvas.height * scale);
        enhCtx = enhCanvas.getContext('2d');
        enhCtx.drawImage(img, 0, 0, enhCanvas.width, enhCanvas.height);
        preview.classList.remove('hidden');
        document.getElementById('img-enhance-controls').classList.remove('hidden');
        // Store original full-res canvas
        enhCanvas._origCanvas = canvas;
    });

    ['enh-brightness', 'enh-contrast', 'enh-saturate', 'enh-sepia', 'enh-hue', 'enh-blur', 'enh-sharp'].forEach(id => {
        const el = document.getElementById(id);
        const lbl = document.getElementById(id + '-val');
        if (!el) return;
        el.addEventListener('input', () => {
            if (lbl) lbl.textContent = el.value + (id === 'enh-hue' ? '°' : id === 'enh-blur' ? 'px' : '%');
            applyFilters();
        });
    });

    document.getElementById('btn-reset-enhance')?.addEventListener('click', () => {
        ['enh-brightness', 'enh-contrast', 'enh-saturate'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.value = 100; document.getElementById(id + '-val').textContent = '100%'; }
        });
        ['enh-sepia', 'enh-blur', 'enh-sharp'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.value = 0; document.getElementById(id + '-val').textContent = id === 'enh-blur' ? '0px' : '0%'; }
        });
        const hue = document.getElementById('enh-hue');
        if (hue) { hue.value = 0; document.getElementById('enh-hue-val').textContent = '0°'; }
        applyFilters();
    });

    document.getElementById('btn-download-enhance')?.addEventListener('click', async () => {
        if (!enhCanvas || !enhOrigImage) return;
        // Apply to full-res canvas
        const fc = enhCanvas._origCanvas || enhCanvas;
        const fullCtx = fc.getContext('2d');
        fullCtx.filter = [
            `brightness(${getSlider('enh-brightness')}%)`,
            `contrast(${getSlider('enh-contrast')}%)`,
            `saturate(${getSlider('enh-saturate')}%)`,
            `sepia(${getSlider('enh-sepia')}%)`,
            `hue-rotate(${getSlider('enh-hue')}deg)`,
            `blur(${getSlider('enh-blur')}px)`,
        ].join(' ');
        fullCtx.drawImage(enhOrigImage, 0, 0);
        fullCtx.filter = 'none';
        const sharp = getSlider('enh-sharp');
        if (sharp > 0) applySharpen(fullCtx, fc.width, fc.height, sharp / 100);
        const blob = await canvasToBlob(fc, 'image/jpeg', 0.95);
        downloadBlob(blob, 'enhanced_image.jpg');
        imgShowToast('Enhanced image downloaded!');
    });
})();

/* ========================================================
   2.5 IMAGE CROP (Standalone Tool is now MERGED)
   ======================================================== */


/* ========================================================
   3. IMAGE EDIT (flip, rotate, draw, text)
   ======================================================== */

(function initImgEdit() {
    let editCanvas = null, editCtx = null, editOrig = null;
    let editMode = 'none'; // draw | text | crop | none
    let isDrawing = false, lastX = 0, lastY = 0;

    // Crop Specific State
    let cropMode = 'free'; // 'free' | 'ratio'
    let currentRatio = null;
    let box = { x: 0, y: 0, w: 0, h: 0 };
    let imgDisplay = { w: 0, h: 0, scale: 1 };
    let isCropDragging = false;
    let dragType = null;
    let startX = 0, startY = 0;
    let startBox = null;

    let historyStack = [];

    function saveHistory() {
        historyStack.push(editCtx.getImageData(0, 0, editCanvas.width, editCanvas.height));
        if (historyStack.length > 30) historyStack.shift();
    }

    function getPos(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        const scale = canvas.width / rect.width;
        if (e.touches && e.touches.length > 0) {
            return {
                x: (e.touches[0].clientX - rect.left) * scale,
                y: (e.touches[0].clientY - rect.top) * scale
            };
        }
        return {
            x: (e.clientX - rect.left) * scale,
            y: (e.clientY - rect.top) * scale
        };
    }

    setupImgDropZone('img-edit-drop-zone', 'img-edit-input', async function (file) {
        if (!file.type.startsWith('image/')) { imgShowToast('Please upload an image.', 'error'); return; }
        const { canvas, img } = await imgFileToCanvas(file);
        editOrig = img;
        editCanvas = document.getElementById('img-edit-canvas');
        const maxW = Math.min(window.innerWidth - 40, 700, canvas.width);
        const scale = maxW / canvas.width;
        editCanvas.width = Math.round(canvas.width * scale);
        editCanvas.height = Math.round(canvas.height * scale);
        editCanvas._origCanvas = canvas;
        editCtx = editCanvas.getContext('2d');
        editCtx.drawImage(img, 0, 0, editCanvas.width, editCanvas.height);
        historyStack = [];
        saveHistory();
        document.getElementById('img-edit-workspace').classList.remove('hidden');

        // Reset crop mode when loading an image
        cropSetMode('free');
        if (editMode === 'crop') initCropBox();
    });

    // Crop UI References
    const cropContainer = document.getElementById('img-crop-container');
    const cropBoxEl = document.getElementById('crop-box-el');
    const cropInfoBar = document.getElementById('crop-info-bar');
    const dimT = document.getElementById('crop-dim-top');
    const dimB = document.getElementById('crop-dim-bottom');
    const dimL = document.getElementById('crop-dim-left');
    const dimR = document.getElementById('crop-dim-right');

    window.cropSetMode = function (newMode) {
        cropMode = newMode;
        const bFree = document.getElementById('crop-mode-free-btn');
        const bRatio = document.getElementById('crop-mode-ratio-btn');
        if (bFree) bFree.className = 'glass-btn ' + (cropMode === 'free' ? 'primary' : 'secondary') + ' small';
        if (bRatio) bRatio.className = 'glass-btn ' + (cropMode === 'ratio' ? 'primary' : 'secondary') + ' small';

        const ratioPresets = document.getElementById('crop-ratio-presets');
        if (cropMode === 'ratio') {
            ratioPresets?.classList.remove('hidden');
            document.body.classList.add('crop-mode-ratio');
            if (!currentRatio) {
                document.querySelector('.crop-ratio-btn')?.click();
            } else {
                enforceRatio();
            }
        } else {
            ratioPresets?.classList.add('hidden');
            document.body.classList.remove('crop-mode-ratio');
            currentRatio = null;
            document.querySelectorAll('.crop-ratio-btn').forEach(btn => btn.classList.replace('primary', 'secondary'));
        }
    };

    document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.crop-ratio-btn').forEach(b => b.classList.replace('primary', 'secondary'));
            e.target.classList.replace('secondary', 'primary');
            const ratioStr = e.target.getAttribute('data-ratio');
            const parts = ratioStr.split(':');
            currentRatio = parseFloat(parts[0]) / parseFloat(parts[1] || 1);
            enforceRatio();
        });
    });

    function initCropBox() {
        if (!editCanvas || !editCanvas.clientWidth) return;
        imgDisplay.w = editCanvas.clientWidth;
        imgDisplay.h = editCanvas.clientHeight;
        imgDisplay.scale = editCanvas.width / imgDisplay.w;

        // Container sizing to perfectly match the displayed CSS size of the canvas
        cropContainer.style.width = imgDisplay.w + 'px';
        cropContainer.style.height = imgDisplay.h + 'px';
        cropContainer.classList.remove('hidden');

        // Initial box bounds
        const initW = imgDisplay.w * 0.9;
        const initH = imgDisplay.h * 0.9;
        box = {
            x: (imgDisplay.w - initW) / 2,
            y: (imgDisplay.h - initH) / 2,
            w: initW,
            h: initH
        };

        if (cropMode === 'ratio' && currentRatio) enforceRatio();
        else updateBoxDOM();
    }

    function enforceRatio() {
        if (!currentRatio || imgDisplay.w === 0) return;
        let newW = box.w; let newH = newW / currentRatio;
        if (newH > imgDisplay.h) { newH = imgDisplay.h; newW = newH * currentRatio; }
        if (newW > imgDisplay.w) { newW = imgDisplay.w; newH = newW / currentRatio; }
        let newX = box.x; let newY = box.y;
        if (newX + newW > imgDisplay.w) newX = imgDisplay.w - newW;
        if (newY + newH > imgDisplay.h) newY = imgDisplay.h - newH;
        box.w = newW; box.h = newH; box.x = newX; box.y = newY;
        updateBoxDOM();
    }

    function updateBoxDOM() {
        box.x = Math.max(0, Math.min(box.x, imgDisplay.w - box.w));
        box.y = Math.max(0, Math.min(box.y, imgDisplay.h - box.h));
        box.w = Math.max(20, Math.min(box.w, imgDisplay.w - box.x));
        box.h = Math.max(20, Math.min(box.h, imgDisplay.h - box.y));

        cropBoxEl.style.left = box.x + 'px';
        cropBoxEl.style.top = box.y + 'px';
        cropBoxEl.style.width = box.w + 'px';
        cropBoxEl.style.height = box.h + 'px';

        dimT.style.top = '0'; dimT.style.left = '0'; dimT.style.right = '0'; dimT.style.height = box.y + 'px';
        dimB.style.bottom = '0'; dimB.style.left = '0'; dimB.style.right = '0'; dimB.style.top = (box.y + box.h) + 'px';
        dimL.style.top = box.y + 'px'; dimL.style.bottom = (imgDisplay.h - box.y - box.h) + 'px'; dimL.style.left = '0'; dimL.style.width = box.x + 'px';
        dimR.style.top = box.y + 'px'; dimR.style.bottom = (imgDisplay.h - box.y - box.h) + 'px'; dimR.style.right = '0'; dimR.style.left = (box.x + box.w) + 'px';

        const actualW = Math.round(box.w * imgDisplay.scale);
        const actualH = Math.round(box.h * imgDisplay.scale);
        cropInfoBar.textContent = `Selection: ${actualW} × ${actualH} px`;
    }

    // Drag Interaction for Crop
    function getPointerPosCrop(e) {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    cropContainer.addEventListener('mousedown', dragStart, { passive: false });
    cropContainer.addEventListener('touchstart', dragStart, { passive: false });
    window.addEventListener('mousemove', dragMove, { passive: false });
    window.addEventListener('touchmove', dragMove, { passive: false });
    window.addEventListener('mouseup', dragEnd);
    window.addEventListener('touchend', dragEnd);

    function dragStart(e) {
        if (editMode !== 'crop') return;
        const target = e.target;
        if (target.classList.contains('crop-h')) dragType = target.getAttribute('data-h');
        else if (target === cropBoxEl || target.classList.contains('crop-grid-line')) dragType = 'move';
        else return;

        e.preventDefault();
        isCropDragging = true;
        const pos = getPointerPosCrop(e);
        startX = pos.x; startY = pos.y;
        startBox = { ...box };
    }

    function dragMove(e) {
        if (!isCropDragging || editMode !== 'crop') return;
        e.preventDefault();
        const pos = getPointerPosCrop(e);
        const dx = pos.x - startX; const dy = pos.y - startY;

        if (dragType === 'move') {
            box.x = startBox.x + dx; box.y = startBox.y + dy;
            updateBoxDOM(); return;
        }

        let newBox = { ...startBox };
        if (dragType.includes('e')) newBox.w = startBox.w + dx;
        if (dragType.includes('s')) newBox.h = startBox.h + dy;
        if (dragType.includes('w')) { newBox.x = startBox.x + dx; newBox.w = startBox.w - dx; }
        if (dragType.includes('n')) { newBox.y = startBox.y + dy; newBox.h = startBox.h - dy; }

        const minSize = 20;
        if (newBox.w < minSize) { newBox.w = minSize; if (dragType.includes('w')) newBox.x = startBox.x + startBox.w - minSize; }
        if (newBox.h < minSize) { newBox.h = minSize; if (dragType.includes('n')) newBox.y = startBox.y + startBox.h - minSize; }
        box = newBox;

        if (cropMode === 'ratio' && currentRatio) {
            if (['se', 'sw', 'ne', 'nw'].includes(dragType)) {
                let adjH = box.w / currentRatio;
                let adjW = box.h * currentRatio;
                if (Math.abs(dx) > Math.abs(dy)) {
                    box.h = adjH; if (dragType.includes('n')) box.y = startBox.y + startBox.h - box.h;
                } else {
                    box.w = adjW; if (dragType.includes('w')) box.x = startBox.x + startBox.w - box.w;
                }
            }
        }
        updateBoxDOM();
    }

    function dragEnd() {
        isCropDragging = false;
        dragType = null;
    }

    document.getElementById('btn-crop-apply')?.addEventListener('click', () => {
        if (!editCanvas || editMode !== 'crop') return;
        const scale = imgDisplay.scale;
        const actualX = Math.round(box.x * scale);
        const actualY = Math.round(box.y * scale);
        const actualW = Math.round(box.w * scale);
        const actualH = Math.round(box.h * scale);

        if (actualW < 5 || actualH < 5) return;
        saveHistory();

        // Extract the cropped region
        const data = editCtx.getImageData(actualX, actualY, actualW, actualH);

        // Update canvas internal resolution to cropped size
        editCanvas.width = actualW;
        editCanvas.height = actualH;
        editCtx.putImageData(data, 0, 0);

        // Recalculate CSS display size to maintain aspect ratio
        const containerMaxW = Math.min(window.innerWidth - 40, 700);
        const aspectRatio = actualW / actualH;
        let cssW, cssH;
        if (actualW <= containerMaxW) {
            cssW = actualW;
            cssH = actualH;
        } else {
            cssW = containerMaxW;
            cssH = containerMaxW / aspectRatio;
        }

        // Apply CSS dimensions to prevent stretching
        editCanvas.style.width = cssW + 'px';
        editCanvas.style.height = cssH + 'px';

        // Update imgDisplay values so crop box overlay aligns correctly
        imgDisplay.w = cssW;
        imgDisplay.h = cssH;
        imgDisplay.scale = actualW / cssW;

        // Also update the _origCanvas reference to the cropped content
        const newOrigCanvas = document.createElement('canvas');
        newOrigCanvas.width = actualW;
        newOrigCanvas.height = actualH;
        newOrigCanvas.getContext('2d').putImageData(data, 0, 0);
        editCanvas._origCanvas = newOrigCanvas;

        // Hide crop overlay, then re-initialize after layout settles
        cropContainer.classList.add('hidden');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                initCropBox();
            });
        });
    });

    window.addEventListener('resize', () => {
        if (editCanvas && document.getElementById('img-edit-workspace').classList.contains('hidden') === false && editMode === 'crop') {
            initCropBox();
        }
    });

    // Mode buttons
    ['draw', 'text', 'crop', 'none'].forEach(mode => {
        document.getElementById(`edit-mode-${mode}`)?.addEventListener('click', () => {
            editMode = mode;
            document.querySelectorAll('.edit-mode-btn').forEach(b => b.classList.remove('active-mode'));
            if (document.getElementById(`edit-mode-${mode}`)) {
                document.getElementById(`edit-mode-${mode}`).classList.add('active-mode');
            }
            document.getElementById('edit-draw-options')?.classList.toggle('hidden', mode !== 'draw');
            document.getElementById('edit-text-options')?.classList.toggle('hidden', mode !== 'text');
            document.getElementById('edit-crop-options')?.classList.toggle('hidden', mode !== 'crop');

            if (mode === 'crop') {
                initCropBox();
            } else {
                cropContainer?.classList.add('hidden');
            }
            editCanvas.style.cursor = mode === 'draw' ? 'crosshair' : mode === 'crop' ? 'crosshair' : 'default';
        });
    });

    // Rotate buttons
    document.getElementById('edit-rotate-cw')?.addEventListener('click', () => { saveHistory(); rotateCanvas(editCanvas, editCtx, 90, editOrig); });
    document.getElementById('edit-rotate-ccw')?.addEventListener('click', () => { saveHistory(); rotateCanvas(editCanvas, editCtx, -90, editOrig); });
    document.getElementById('edit-flip-h')?.addEventListener('click', () => { saveHistory(); flipCanvas(editCanvas, editCtx, 'h'); });
    document.getElementById('edit-flip-v')?.addEventListener('click', () => { saveHistory(); flipCanvas(editCanvas, editCtx, 'v'); });

    document.getElementById('edit-undo')?.addEventListener('click', () => {
        if (historyStack.length > 1) {
            historyStack.pop();
            editCtx.putImageData(historyStack[historyStack.length - 1], 0, 0);
        }
    });
    document.getElementById('edit-reset')?.addEventListener('click', () => {
        editCtx.drawImage(editOrig, 0, 0, editCanvas.width, editCanvas.height);
        historyStack = [];
        saveHistory();
    });

    // Draw events (mouse + touch)
    function onStart(e) {
        if (editMode === 'none') return;
        e.preventDefault();
        const pos = getPos(e, editCanvas);
        if (editMode === 'draw') {
            isDrawing = true;
            saveHistory();
            lastX = pos.x; lastY = pos.y;
        } else if (editMode === 'text') {
            const txt = document.getElementById('edit-text-content')?.value || 'Hello';
            const size = document.getElementById('edit-text-size-pick')?.value || '32';
            const color = document.getElementById('edit-text-color-pick')?.value || '#ffffff';
            saveHistory();
            editCtx.font = `bold ${size}px Outfit, sans-serif`;
            editCtx.fillStyle = color;
            editCtx.fillText(txt, pos.x, pos.y);
        }
    }

    function onMove(e) {
        if (!isDrawing || editMode !== 'draw') return;
        e.preventDefault();
        const pos = getPos(e, editCanvas);
        editCtx.beginPath();
        editCtx.moveTo(lastX, lastY);
        editCtx.lineTo(pos.x, pos.y);
        editCtx.strokeStyle = document.getElementById('edit-draw-color')?.value || '#ff0076';
        editCtx.lineWidth = parseInt(document.getElementById('edit-draw-size')?.value || '4');
        editCtx.lineCap = 'round';
        editCtx.stroke();
        lastX = pos.x; lastY = pos.y;
    }

    function onEnd(e) {
        if (editMode === 'draw') isDrawing = false;
    }

    if (document.getElementById('img-edit-canvas')) {
        const c = document.getElementById('img-edit-canvas');
        ['mousedown', 'touchstart'].forEach(ev => c.addEventListener(ev, onStart, { passive: false }));
        ['mousemove', 'touchmove'].forEach(ev => c.addEventListener(ev, onMove, { passive: false }));
        ['mouseup', 'touchend'].forEach(ev => c.addEventListener(ev, onEnd, { passive: false }));
    }

    document.getElementById('btn-download-edit')?.addEventListener('click', async () => {
        if (!editCanvas) return;
        const blob = await canvasToBlob(editCanvas, 'image/jpeg', 0.95);
        downloadBlob(blob, 'edited_image.jpg');
        imgShowToast('Image downloaded!');
    });

    function rotateCanvas(canvas, ctx, deg, origImg) {
        const angle = (deg * Math.PI) / 180;
        const w = canvas.width, h = canvas.height;
        const newW = Math.abs(Math.round(w * Math.cos(angle) - h * Math.sin(angle)));
        const newH = Math.abs(Math.round(w * Math.sin(angle) + h * Math.cos(angle)));
        const data = ctx.getImageData(0, 0, w, h);
        const tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        tmp.getContext('2d').putImageData(data, 0, 0);
        canvas.width = newW;
        canvas.height = newH;
        ctx.translate(newW / 2, newH / 2);
        ctx.rotate(angle);
        ctx.drawImage(tmp, -w / 2, -h / 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function flipCanvas(canvas, ctx, axis) {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        tmp.getContext('2d').putImageData(data, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        if (axis === 'h') { ctx.scale(-1, 1); ctx.drawImage(tmp, -canvas.width, 0); }
        else { ctx.scale(1, -1); ctx.drawImage(tmp, 0, -canvas.height); }
        ctx.restore();
    }
})();

/* ========================================================
   4. IMAGE RESIZE
   ======================================================== */

(function initImgResize() {
    let resizeFile = null;

    setupImgDropZone('img-resize-drop-zone', 'img-resize-input', async function (file) {
        if (!file.type.startsWith('image/')) { imgShowToast('Please upload an image.', 'error'); return; }
        resizeFile = file;
        const { canvas } = await imgFileToCanvas(file);
        document.getElementById('img-resize-orig-info').textContent = `Original: ${canvas.width}×${canvas.height}px — ${formatBytes(file.size)}`;
        document.getElementById('img-resize-w').value = canvas.width;
        document.getElementById('img-resize-h').value = canvas.height;
        document.getElementById('img-resize-options').classList.remove('hidden');
    });

    document.getElementById('img-resize-w')?.addEventListener('input', () => {
        if (document.getElementById('img-resize-lock')?.checked) {
            // auto-calc height (requires original ratio)
        }
    });

    document.getElementById('btn-process-img-resize')?.addEventListener('click', async () => {
        if (!resizeFile) return;
        const mode = document.querySelector('input[name="resize-mode"]:checked')?.value || 'px';
        const { canvas } = await imgFileToCanvas(resizeFile);
        let newW, newH;
        if (mode === 'px') {
            newW = parseInt(document.getElementById('img-resize-w').value) || canvas.width;
            newH = parseInt(document.getElementById('img-resize-h').value) || canvas.height;
        } else {
            const pct = parseFloat(document.getElementById('img-resize-pct').value) || 100;
            newW = Math.round(canvas.width * pct / 100);
            newH = Math.round(canvas.height * pct / 100);
        }
        const out = document.createElement('canvas');
        out.width = newW; out.height = newH;
        out.getContext('2d').drawImage(canvas, 0, 0, newW, newH);
        const blob = await canvasToBlob(out, 'image/jpeg', 0.92);
        downloadBlob(blob, 'resized_image.jpg');
        imgShowToast(`Resized to ${newW}×${newH}px — ${formatBytes(blob.size)}`);
    });
})();

/* ========================================================
   5. IMAGE CONVERT
   ======================================================== */

(function initImgConvert() {
    let convFile = null;

    setupImgDropZone('img-convert-drop-zone', 'img-convert-input', async function (file) {
        if (!file.type.startsWith('image/')) { imgShowToast('Please upload an image.', 'error'); return; }
        convFile = file;
        document.getElementById('img-convert-file-name').textContent = file.name;
        document.getElementById('img-convert-options').classList.remove('hidden');
    });

    document.getElementById('btn-process-img-convert')?.addEventListener('click', async () => {
        if (!convFile) return;
        const format = document.getElementById('img-convert-format').value;
        const { canvas } = await imgFileToCanvas(convFile);
        const mime = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', bmp: 'image/bmp' }[format] || 'image/jpeg';
        const quality = format === 'png' ? undefined : 0.92;
        const blob = await canvasToBlob(canvas, mime, quality);
        const baseName = convFile.name.replace(/\.[^.]+$/, '');
        downloadBlob(blob, `${baseName}.${format}`);
        imgShowToast(`Converted to ${format.toUpperCase()} — ${formatBytes(blob.size)}`);
    });
})();

/* ========================================================
   6. IMAGE WATERMARK — Diagonal & Tiled, fully customizable
   ======================================================== */

(function initImgWatermark() {
    let wmFile = null;
    let wmOrigCanvas = null;        // full-resolution original
    let wmMode = 'diagonal';        // 'diagonal' | 'tiled'
    let wmDebounce = null;

    // ---- tab switch (also exposed globally for inline onclick) ----
    window.wmSwitchTab = function (mode) {
        wmMode = mode;
        const isDiag = mode === 'diagonal';
        document.getElementById('wm-tab-diagonal').className = 'glass-btn ' + (isDiag ? 'primary' : 'secondary');
        document.getElementById('wm-tab-tiled').className = 'glass-btn ' + (!isDiag ? 'primary' : 'secondary');
        document.getElementById('wm-angle-row').classList.toggle('hidden', !isDiag);
        document.getElementById('wm-tiled-rows').classList.toggle('hidden', isDiag);
        schedulePreview();
    };

    // ---- drop zone ----
    setupImgDropZone('img-watermark-drop-zone', 'img-watermark-input', async function (file) {
        if (!file.type.startsWith('image/')) { imgShowToast('Please upload an image.', 'error'); return; }
        wmFile = file;
        document.getElementById('img-watermark-file-name').textContent = `${file.name} — ${formatBytes(file.size)}`;
        const { canvas } = await imgFileToCanvas(file);
        wmOrigCanvas = canvas;
        document.getElementById('img-watermark-options').classList.remove('hidden');
        renderWmPreview(canvas);   // first render
    });

    // ---- live slider label sync ----
    function syncLabel(id, labelId, suffix) {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', () => {
            document.getElementById(labelId).textContent = el.value;
            schedulePreview();
        });
    }
    syncLabel('img-wm-size', 'img-wm-size-val', 'px');
    syncLabel('img-wm-opacity', 'img-wm-opacity-val', '%');
    syncLabel('img-wm-angle', 'img-wm-angle-val', '°');
    syncLabel('img-wm-hspace', 'img-wm-hspace-val', 'px');
    syncLabel('img-wm-vspace', 'img-wm-vspace-val', 'px');
    syncLabel('img-wm-tile-angle', 'img-wm-tile-angle-val', '°');

    // auto-preview on any input change
    ['img-wm-text', 'img-wm-font', 'img-wm-color', 'img-wm-outline-color'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', schedulePreview);
        document.getElementById(id)?.addEventListener('change', schedulePreview);
    });
    ['img-wm-bold', 'img-wm-italic', 'img-wm-shadow', 'img-wm-outline'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', schedulePreview);
    });

    function schedulePreview() {
        clearTimeout(wmDebounce);
        wmDebounce = setTimeout(() => { if (wmOrigCanvas) renderWmPreview(wmOrigCanvas); }, 120);
    }

    document.getElementById('btn-wm-preview')?.addEventListener('click', () => {
        if (wmOrigCanvas) renderWmPreview(wmOrigCanvas);
    });

    // ---- read settings ----
    function getSettings() {
        return {
            text: document.getElementById('img-wm-text')?.value || 'WATERMARK',
            font: document.getElementById('img-wm-font')?.value || 'Impact',
            size: parseInt(document.getElementById('img-wm-size')?.value || 60),
            opacity: parseInt(document.getElementById('img-wm-opacity')?.value || 40) / 100,
            color: document.getElementById('img-wm-color')?.value || '#ffffff',
            outlineColor: document.getElementById('img-wm-outline-color')?.value || '#000000',
            bold: document.getElementById('img-wm-bold')?.checked ?? true,
            italic: document.getElementById('img-wm-italic')?.checked ?? false,
            shadow: document.getElementById('img-wm-shadow')?.checked ?? false,
            outline: document.getElementById('img-wm-outline')?.checked ?? false,
            angle: parseInt(document.getElementById('img-wm-angle')?.value || -35),
            hspace: parseInt(document.getElementById('img-wm-hspace')?.value || 120),
            vspace: parseInt(document.getElementById('img-wm-vspace')?.value || 80),
            tileAngle: parseInt(document.getElementById('img-wm-tile-angle')?.value || -25),
        };
    }

    // ---- build canvas font string ----
    function buildFont(s, size) {
        const weight = s.bold ? 'bold' : 'normal';
        const style = s.italic ? 'italic' : 'normal';
        return `${style} ${weight} ${size}px "${s.font}", sans-serif`;
    }

    // ---- core watermark renderer ----
    function applyWatermark(srcCanvas, s) {
        const out = document.createElement('canvas');
        out.width = srcCanvas.width;
        out.height = srcCanvas.height;
        const ctx = out.getContext('2d');

        // draw original image
        ctx.drawImage(srcCanvas, 0, 0);

        ctx.save();
        ctx.globalAlpha = s.opacity;

        if (s.shadow) {
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowOffsetX = s.size * 0.05;
            ctx.shadowOffsetY = s.size * 0.05;
            ctx.shadowBlur = s.size * 0.1;
        }

        ctx.fillStyle = s.color;
        ctx.strokeStyle = s.outlineColor;
        ctx.lineWidth = Math.max(1, s.size * 0.04);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (wmMode === 'diagonal') {
            ctx.font = buildFont(s, s.size);
            const cx = out.width / 2;
            const cy = out.height / 2;
            ctx.translate(cx, cy);
            ctx.rotate(s.angle * Math.PI / 180);
            ctx.fillText(s.text, 0, 0);
            if (s.outline) ctx.strokeText(s.text, 0, 0);

        } else {
            // TILED: stamp small text across whole image
            const tileSize = Math.max(8, Math.round(s.size));
            ctx.font = buildFont(s, tileSize);
            const metrics = ctx.measureText(s.text);
            const textW = metrics.width;
            const hGap = s.hspace;
            const vGap = s.vspace;
            const tAngle = s.tileAngle * Math.PI / 180;

            // Work in a slightly padded space so edges get covered after rotation
            const diag = Math.sqrt(out.width * out.width + out.height * out.height);
            ctx.translate(out.width / 2, out.height / 2);
            ctx.rotate(tAngle);

            const cols = Math.ceil(diag / hGap) + 2;
            const rows = Math.ceil(diag / vGap) + 2;

            for (let r = -rows; r <= rows; r++) {
                for (let c = -cols; c <= cols; c++) {
                    const x = c * hGap;
                    const y = r * vGap;
                    ctx.fillText(s.text, x, y);
                    if (s.outline) ctx.strokeText(s.text, x, y);
                }
            }
        }

        ctx.restore();
        return out;
    }

    // ---- preview: scale to max 460px wide ----
    function renderWmPreview(srcCanvas) {
        const s = getSettings();
        const out = applyWatermark(srcCanvas, s);
        const prevCanvas = document.getElementById('img-wm-preview-canvas');
        if (!prevCanvas) return;

        // Scale for preview display
        const maxW = Math.min(460, srcCanvas.width);
        const scale = maxW / srcCanvas.width;
        prevCanvas.width = Math.round(srcCanvas.width * scale);
        prevCanvas.height = Math.round(srcCanvas.height * scale);

        const pCtx = prevCanvas.getContext('2d');
        pCtx.drawImage(out, 0, 0, prevCanvas.width, prevCanvas.height);
    }

    // ---- download: full resolution ----
    document.getElementById('btn-process-img-watermark')?.addEventListener('click', async () => {
        if (!wmOrigCanvas) { imgShowToast('Please upload an image first.', 'error'); return; }
        const s = getSettings();
        const out = applyWatermark(wmOrigCanvas, s);

        const ext = wmFile?.type === 'image/png' ? 'png' : 'jpg';
        const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        const quality = ext === 'jpg' ? 0.93 : undefined;
        const blob = await canvasToBlob(out, mime, quality);
        const base = (wmFile?.name || 'image').replace(/\.[^.]+$/, '');
        downloadBlob(blob, `${base}_watermarked.${ext}`);
        imgShowToast('Watermark applied and downloaded!');
    });
})();


/* ========================================================
   7. ROTATE & FLIP
   ======================================================== */

(function initImgRotate() {
    let rotFile = null;
    let rotCanvas = null;

    setupImgDropZone('img-rotate-drop-zone', 'img-rotate-input', async function (file) {
        if (!file.type.startsWith('image/')) { imgShowToast('Please upload an image.', 'error'); return; }
        rotFile = file;
        const { canvas } = await imgFileToCanvas(file);
        rotCanvas = canvas;
        // Small preview
        const prev = document.getElementById('img-rotate-preview');
        prev.src = canvas.toDataURL('image/jpeg', 0.7);
        document.getElementById('img-rotate-workspace').classList.remove('hidden');
    });

    document.getElementById('btn-rot-cw')?.addEventListener('click', () => rotCanvasBy(90));
    document.getElementById('btn-rot-ccw')?.addEventListener('click', () => rotCanvasBy(-90));
    document.getElementById('btn-rot-180')?.addEventListener('click', () => rotCanvasBy(180));
    document.getElementById('btn-flip-h')?.addEventListener('click', () => flipRotCanvas('h'));
    document.getElementById('btn-flip-v')?.addEventListener('click', () => flipRotCanvas('v'));

    function rotCanvasBy(deg) {
        if (!rotCanvas) return;
        const angle = deg * Math.PI / 180;
        const w = rotCanvas.width, h = rotCanvas.height;
        const newW = Math.abs(Math.round(w * Math.cos(angle) - h * Math.sin(angle)));
        const newH = Math.abs(Math.round(w * Math.sin(angle) + h * Math.cos(angle)));
        const tmp = document.createElement('canvas');
        const tc = tmp.getContext('2d');
        tmp.width = w; tmp.height = h;
        tc.drawImage(rotCanvas, 0, 0);
        rotCanvas = document.createElement('canvas');
        rotCanvas.width = newW; rotCanvas.height = newH;
        const ctx = rotCanvas.getContext('2d');
        ctx.translate(newW / 2, newH / 2);
        ctx.rotate(angle);
        ctx.drawImage(tmp, -w / 2, -h / 2);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        document.getElementById('img-rotate-preview').src = rotCanvas.toDataURL('image/jpeg', 0.7);
    }

    function flipRotCanvas(axis) {
        if (!rotCanvas) return;
        const tmp = document.createElement('canvas');
        tmp.width = rotCanvas.width; tmp.height = rotCanvas.height;
        tmp.getContext('2d').drawImage(rotCanvas, 0, 0);
        const ctx = rotCanvas.getContext('2d');
        ctx.clearRect(0, 0, rotCanvas.width, rotCanvas.height);
        ctx.save();
        if (axis === 'h') { ctx.scale(-1, 1); ctx.drawImage(tmp, -rotCanvas.width, 0); }
        else { ctx.scale(1, -1); ctx.drawImage(tmp, 0, -rotCanvas.height); }
        ctx.restore();
        document.getElementById('img-rotate-preview').src = rotCanvas.toDataURL('image/jpeg', 0.7);
    }

    document.getElementById('btn-download-rotate')?.addEventListener('click', async () => {
        if (!rotCanvas) return;
        const blob = await canvasToBlob(rotCanvas, 'image/jpeg', 0.95);
        downloadBlob(blob, 'rotated_image.jpg');
        imgShowToast('Image downloaded!');
    });
})();


/* ========================================================
   9. ADD TEXT TO IMAGE
   ======================================================== */

(function initImgAddText() {
    let atFile = null, atCanvas = null, atCtx = null;

    setupImgDropZone('img-addtext-drop-zone', 'img-addtext-input', async function (file) {
        if (!file.type.startsWith('image/')) { imgShowToast('Please upload an image.', 'error'); return; }
        atFile = file;
        const { canvas, img } = await imgFileToCanvas(file);
        atCanvas = canvas;
        const preview = document.getElementById('img-addtext-canvas');
        const maxW = Math.min(window.innerWidth - 60, 700, canvas.width);
        const scale = maxW / canvas.width;
        preview.width = Math.round(canvas.width * scale);
        preview.height = Math.round(canvas.height * scale);
        preview._origCanvas = canvas;
        preview._origImg = img;
        atCanvas = preview;
        atCtx = preview.getContext('2d');
        atCtx.drawImage(img, 0, 0, preview.width, preview.height);
        document.getElementById('img-addtext-workspace').classList.remove('hidden');
        updateTextPreview();
    });

    function updateTextPreview() {
        if (!atCtx || !atCanvas._origImg) return;
        atCtx.drawImage(atCanvas._origImg, 0, 0, atCanvas.width, atCanvas.height);
        applyAllTextLayers();
    }

    const textLayers = [];
    document.getElementById('btn-add-text-layer')?.addEventListener('click', () => {
        const text = document.getElementById('at-text')?.value || 'Hello!';
        const size = document.getElementById('at-size')?.value || '48';
        const color = document.getElementById('at-color')?.value || '#ffffff';
        const font = document.getElementById('at-font')?.value || 'Outfit';
        const x = parseFloat(document.getElementById('at-x')?.value || '50');
        const y = parseFloat(document.getElementById('at-y')?.value || '50');
        const bold = document.getElementById('at-bold')?.checked;
        const italic = document.getElementById('at-italic')?.checked;
        textLayers.push({ text, size, color, font, x, y, bold, italic });
        updateTextPreview();
    });

    function applyAllTextLayers() {
        if (!atCtx) return;
        textLayers.forEach(l => {
            const weight = l.bold ? 'bold' : 'normal';
            const style = l.italic ? 'italic' : 'normal';
            atCtx.font = `${style} ${weight} ${l.size}px "${l.font}", sans-serif`;
            atCtx.fillStyle = l.color;
            atCtx.textAlign = 'center';
            atCtx.textBaseline = 'middle';
            atCtx.fillText(l.text, atCanvas.width * l.x / 100, atCanvas.height * l.y / 100);
        });
    }

    document.getElementById('btn-download-addtext')?.addEventListener('click', async () => {
        if (!atCanvas) return;
        // Apply to full-res
        const fc = atCanvas._origCanvas || atCanvas;
        const fCtx = fc.getContext('2d');
        fCtx.drawImage(atCanvas._origImg, 0, 0);
        const scaleX = fc.width / atCanvas.width;
        const scaleY = fc.height / atCanvas.height;
        textLayers.forEach(l => {
            const weight = l.bold ? 'bold' : 'normal';
            const style = l.italic ? 'italic' : 'normal';
            fCtx.font = `${style} ${weight} ${parseInt(l.size) * scaleX}px "${l.font}", sans-serif`;
            fCtx.fillStyle = l.color;
            fCtx.textAlign = 'center';
            fCtx.textBaseline = 'middle';
            fCtx.fillText(l.text, fc.width * l.x / 100, fc.height * l.y / 100);
        });
        const blob = await canvasToBlob(fc, 'image/jpeg', 0.95);
        downloadBlob(blob, 'image_with_text.jpg');
        imgShowToast('Image downloaded!');
    });
})();

/* ========================================================
   NAVBAR + ROUTING
   ======================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // --- Hamburger / Mobile Drawer ---
    const hamburger = document.getElementById('nav-hamburger');
    const drawer = document.getElementById('nav-drawer');
    const drawerOverlay = document.getElementById('nav-drawer-overlay');

    function openDrawer() {
        drawer?.classList.add('open');
        drawerOverlay?.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
        drawer?.classList.remove('open');
        drawerOverlay?.classList.remove('open');
        document.body.style.overflow = '';
    }

    hamburger?.addEventListener('click', () => {
        drawer?.classList.contains('open') ? closeDrawer() : openDrawer();
    });
    drawerOverlay?.addEventListener('click', closeDrawer);

    // Close drawer when a nav link is clicked
    document.querySelectorAll('.nav-link, .drawer-link').forEach(l => {
        l.addEventListener('click', () => closeDrawer());
    });

    // --- Support Dropdown ---
    const supportBtn = document.getElementById('nav-support-btn');
    const supportDropdown = document.getElementById('nav-support-dropdown');
    supportBtn?.addEventListener('click', e => {
        e.stopPropagation();
        supportDropdown?.classList.toggle('open');
    });
    document.addEventListener('click', () => supportDropdown?.classList.remove('open'));

    // --- Section Routing ---
    function showSection(id) {
        const allSections = [
            'home-dashboard', 'img-editor-dashboard',
            'merge-section', 'photo-pdf-section', 'ocr-section', 'summarize-section',
            'pdf-ppt-section', 'pdf-word-section', 'pdf-writer-section', 'security-section',
            'compress-section', 'convert-section', 'split-section', 'rotate-section',
            'watermark-section', 'pagenums-section', 'pdf-excel-section', 'reorder-section',
            'pdf-text-section', 'metadata-section', 'redact-section', 'compare-section',
            'pdf-markdown-section', 'form-filler-section', 'delete-pages-section', 'page-resize-section',
        ];
        document.querySelectorAll('.img-tool-section').forEach(s => s.classList.add('hidden'));
        allSections.forEach(sid => {
            const el = document.getElementById(sid);
            if (el) el.classList.toggle('hidden', sid !== id);
        });
        const editor = document.getElementById('editor-workspace');
        if (editor) editor.classList.add('hidden');
        window.scrollTo(0, 0);
    }

    // Navbar PDF Tools
    document.getElementById('nav-pdf-tools')?.addEventListener('click', e => {
        e.preventDefault();
        showSection('home-dashboard');
        closeDrawer();
    });
    document.getElementById('drawer-pdf-tools')?.addEventListener('click', e => {
        e.preventDefault();
        showSection('home-dashboard');
        closeDrawer();
    });

    // Navbar Image Editor
    document.getElementById('nav-img-editor')?.addEventListener('click', e => {
        e.preventDefault();
        showSection('img-editor-dashboard');
        closeDrawer();
    });
    document.getElementById('drawer-img-editor')?.addEventListener('click', e => {
        e.preventDefault();
        showSection('img-editor-dashboard');
        closeDrawer();
    });

    // Image tool cards routing
    const imgRoutes = {
        'img-card-compress': 'img-compress-section',
        'img-card-enhance': 'img-enhance-section',
        'img-card-edit': 'img-edit-section',
        'img-card-resize': 'img-resize-section',
        'img-card-convert': 'img-convert-section',
        'img-card-watermark': 'img-watermark-section',
        'img-card-rotate': 'img-rotate-section',
        'img-card-removebg': 'img-removebg-section',
        'img-card-addtext': 'img-addtext-section',
    };
    Object.entries(imgRoutes).forEach(([cardId, sectionId]) => {
        document.getElementById(cardId)?.addEventListener('click', () => {
            document.querySelectorAll('#home-dashboard, #img-editor-dashboard, .img-tool-section').forEach(s => s.classList.add('hidden'));
            const sec = document.getElementById(sectionId);
            if (sec) sec.classList.remove('hidden');
            window.scrollTo(0, 0);
        });
    });

    // Back to image home buttons
    document.querySelectorAll('.btn-back-img-home').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.img-tool-section').forEach(s => s.classList.add('hidden'));
            document.getElementById('home-dashboard')?.classList.add('hidden');
            document.getElementById('img-editor-dashboard')?.classList.remove('hidden');
            window.scrollTo(0, 0);
        });
    });

    // --- Modals ---
    function openModal(id) { document.getElementById(id)?.classList.remove('hidden'); }
    function closeModal(id) { document.getElementById(id)?.classList.add('hidden'); }

    ['about', 'help', 'feedback', 'donate'].forEach(m => {
        document.getElementById(`nav-${m}`)?.addEventListener('click', e => { e.preventDefault(); openModal(`modal-${m}`); closeDrawer(); });
        document.getElementById(`drawer-${m}`)?.addEventListener('click', e => { e.preventDefault(); openModal(`modal-${m}`); closeDrawer(); });
        document.getElementById(`close-modal-${m}`)?.addEventListener('click', () => closeModal(`modal-${m}`));
        document.getElementById(`modal-${m}`)?.addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(`modal-${m}`); });
    });

    // Feedback form
    document.getElementById('btn-send-feedback')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-send-feedback');
        const msg = document.getElementById('feedback-message')?.value?.trim();
        const name = document.getElementById('feedback-name')?.value?.trim() || 'Anonymous';
        const rating = document.querySelectorAll('.star-rating .star.active').length || 0;

        if (!msg) { imgShowToast('Please fill your feedback.', 'error'); return; }

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

        try {
            const res = await fetch('https://formspree.io/f/mbdzjdyw', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    name: name,
                    rating: rating + ' Stars',
                    message: msg
                })
            });

            if (res.ok) {
                imgShowToast('Thank you for your feedback! 🙏');
                closeModal('modal-feedback');
                document.getElementById('feedback-message').value = '';
                document.getElementById('feedback-name').value = '';
                document.querySelectorAll('.star-rating .star').forEach(s => s.classList.remove('active'));
            } else {
                imgShowToast('Error sending feedback. Please try again.', 'error');
            }
        } catch (err) {
            imgShowToast('Network error while sending feedback.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Feedback';
        }
    });

    // Star rating
    document.querySelectorAll('.star-rating .star').forEach((star, idx, arr) => {
        star.addEventListener('click', () => {
            arr.forEach((s, i) => s.classList.toggle('active', i <= idx));
        });
    });
});
