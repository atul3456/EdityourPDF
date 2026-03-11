// Image Tools - Standalone JS for image-editor.html
// Handles: navigation, compress, enhance, edit, resize, convert, watermark, rotate, add text

(function () {
    'use strict';

    // ===== TOAST =====
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

    // ===== NAVIGATION =====
    const dashboard = document.getElementById('img-editor-dashboard');
    const toolSections = document.querySelectorAll('.img-tool-section');

    function showImgTool(sectionId) {
        if (dashboard) dashboard.classList.add('hidden');
        toolSections.forEach(s => s.classList.add('hidden'));
        const target = document.getElementById(sectionId);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('view-enter');
            target.addEventListener('animationend', () => target.classList.remove('view-enter'), { once: true });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function backToImgDashboard() {
        toolSections.forEach(s => s.classList.add('hidden'));
        if (dashboard) {
            dashboard.classList.remove('hidden');
            dashboard.classList.add('view-enter');
            dashboard.addEventListener('animationend', () => dashboard.classList.remove('view-enter'), { once: true });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Card click -> tool section mapping
    const cardMap = {
        'img-card-compress': 'img-compress-section',
        'img-card-enhance': 'img-enhance-section',
        'img-card-edit': 'img-edit-section',
        'img-card-resize': 'img-resize-section',
        'img-card-convert': 'img-convert-section',
        'img-card-watermark': 'img-watermark-section',
        'img-card-rotate': 'img-rotate-section',
        'img-card-addtext': 'img-addtext-section',
        'img-card-generate': 'img-generate-section'
    };

    document.addEventListener('DOMContentLoaded', () => {
        // Wire up tool cards
        Object.entries(cardMap).forEach(([cardId, sectionId]) => {
            const card = document.getElementById(cardId);
            if (card) card.addEventListener('click', () => showImgTool(sectionId));
        });

        // Wire up back buttons
        document.querySelectorAll('.btn-back-img-home').forEach(btn => {
            btn.addEventListener('click', backToImgDashboard);
        });

        // Ripple effect on cards
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

        // Initialize all tools
        initCompress();
        initEnhance();
        initEdit();
        initResize();
        initConvert();
        initWatermark();
        initRotate();
        initAddText();

        // Support dropdown
        const supportBtn = document.getElementById('nav-support-btn');
        const supportDropdown = document.getElementById('nav-support-dropdown');
        if (supportBtn && supportDropdown) {
            supportBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                supportDropdown.classList.toggle('open');
            });
            document.addEventListener('click', () => supportDropdown.classList.remove('open'));
        }

        console.log('Image tools initialized.');
    });

    // ===== HELPER: Setup drop zone =====
    function setupDropZone(dropZoneId, inputId, onFileLoad) {
        const zone = document.getElementById(dropZoneId);
        const input = document.getElementById(inputId);
        if (!zone || !input) return;
        zone.addEventListener('click', () => input.click());
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag-over'); if (e.dataTransfer.files.length) onFileLoad(e.dataTransfer.files[0]); });
        input.addEventListener('change', e => { if (e.target.files.length) onFileLoad(e.target.files[0]); });
    }

    // ===== 1. COMPRESS IMAGE =====
    function initCompress() {
        let compressFile = null;
        setupDropZone('img-compress-drop-zone', 'img-compress-input', (file) => {
            compressFile = file;
            const info = document.getElementById('img-compress-file-info');
            if (info) { info.style.display = 'block'; info.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`; }
            const opts = document.getElementById('img-compress-options');
            if (opts) opts.classList.remove('hidden');
        });

        const btn = document.getElementById('btn-process-img-compress');
        if (btn) btn.addEventListener('click', async () => {
            if (!compressFile) return showToast('Select an image first.', 'warning');
            const targetVal = parseFloat(document.getElementById('img-compress-target-val').value);
            const unit = document.getElementById('img-compress-target-unit').value;
            if (!targetVal || targetVal <= 0) return showToast('Enter a valid target size.', 'warning');
            const targetBytes = unit === 'MB' ? targetVal * 1024 * 1024 : targetVal * 1024;

            const spinner = document.getElementById('img-compress-spinner');
            const status = document.getElementById('img-compress-status');
            if (spinner) spinner.classList.remove('hidden');
            if (status) { status.style.display = 'block'; status.textContent = 'Compressing...'; }

            try {
                const img = await loadImageFromFile(compressFile);
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                let quality = 0.92;
                let blob;
                let attempts = 0;
                do {
                    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
                    if (blob.size <= targetBytes) break;
                    quality -= 0.05;
                    attempts++;
                } while (quality > 0.01 && attempts < 30);

                // If still too large, scale down
                if (blob.size > targetBytes) {
                    let scale = 0.9;
                    while (blob.size > targetBytes && scale > 0.1) {
                        const sc = document.createElement('canvas');
                        sc.width = Math.round(img.width * scale);
                        sc.height = Math.round(img.height * scale);
                        sc.getContext('2d').drawImage(img, 0, 0, sc.width, sc.height);
                        blob = await canvasToBlob(sc, 'image/jpeg', Math.max(quality, 0.1));
                        scale -= 0.1;
                    }
                }

                if (spinner) spinner.classList.add('hidden');
                if (status) status.textContent = `Done! Final size: ${(blob.size / 1024).toFixed(1)} KB`;
                downloadBlob(blob, compressFile.name.replace(/\.[^.]+$/, '') + '_compressed.jpg');
                showToast('Image compressed!', 'success');
            } catch (err) {
                if (spinner) spinner.classList.add('hidden');
                if (status) status.textContent = 'Error: ' + err.message;
                showToast('Compression failed: ' + err.message, 'error');
            }
        });
    }

    // ===== 2. ENHANCE IMAGE =====
    function initEnhance() {
        let enhImg = null;
        const canvas = document.getElementById('img-enhance-canvas');
        const ctx = canvas ? canvas.getContext('2d') : null;

        setupDropZone('img-enhance-drop-zone', 'img-enhance-input', (file) => {
            loadImageFromFile(file).then(img => {
                enhImg = img;
                canvas.width = img.width; canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                document.getElementById('img-enhance-preview').classList.remove('hidden');
                document.getElementById('img-enhance-controls').classList.remove('hidden');
            });
        });

        const sliders = ['enh-brightness', 'enh-contrast', 'enh-saturate', 'enh-sharp', 'enh-sepia', 'enh-hue', 'enh-blur'];
        sliders.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => applyEnhance());
        });

        function applyEnhance() {
            if (!enhImg || !ctx) return;
            const b = document.getElementById('enh-brightness').value;
            const c = document.getElementById('enh-contrast').value;
            const s = document.getElementById('enh-saturate').value;
            const sepia = document.getElementById('enh-sepia').value;
            const hue = document.getElementById('enh-hue').value;
            const blur = document.getElementById('enh-blur').value;

            const valEls = {
                'enh-brightness-val': b + '%', 'enh-contrast-val': c + '%', 'enh-saturate-val': s + '%',
                'enh-sepia-val': sepia + '%', 'enh-hue-val': hue + '°', 'enh-blur-val': blur + 'px',
                'enh-sharp-val': document.getElementById('enh-sharp').value + '%'
            };
            Object.entries(valEls).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.textContent = v; });

            ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%) sepia(${sepia}%) hue-rotate(${hue}deg) blur(${blur}px)`;
            ctx.drawImage(enhImg, 0, 0, canvas.width, canvas.height);
            ctx.filter = 'none';
        }

        const resetBtn = document.getElementById('btn-reset-enhance');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            sliders.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = id === 'enh-brightness' || id === 'enh-contrast' || id === 'enh-saturate' ? 100 : 0;
            });
            applyEnhance();
        });

        const dlBtn = document.getElementById('btn-download-enhance');
        if (dlBtn) dlBtn.addEventListener('click', () => {
            if (!canvas) return;
            canvas.toBlob(blob => downloadBlob(blob, 'enhanced.png'), 'image/png');
        });
    }

    // ===== 3. EDIT IMAGE (Draw, Text, Crop) =====
    function initEdit() {
        let editImg = null;
        const canvas = document.getElementById('img-edit-canvas');
        const ctx = canvas ? canvas.getContext('2d') : null;
        let editMode = 'none';
        let drawHistory = [];
        let isDrawing = false;
        let lastX, lastY;

        setupDropZone('img-edit-drop-zone', 'img-edit-input', (file) => {
            loadImageFromFile(file).then(img => {
                editImg = img;
                canvas.width = img.width; canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                drawHistory = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
                document.getElementById('img-edit-workspace').classList.remove('hidden');
            });
        });

        // Mode buttons
        ['edit-mode-none', 'edit-mode-draw', 'edit-mode-text', 'edit-mode-crop'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => {
                editMode = id.replace('edit-mode-', '');
                document.querySelectorAll('.edit-mode-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const drawOpts = document.getElementById('edit-draw-options');
                const textOpts = document.getElementById('edit-text-options');
                const cropOpts = document.getElementById('edit-crop-options');
                const cropContainer = document.getElementById('img-crop-container');
                if (drawOpts) drawOpts.classList.toggle('hidden', editMode !== 'draw');
                if (textOpts) textOpts.classList.toggle('hidden', editMode !== 'text');
                if (cropOpts) cropOpts.classList.toggle('hidden', editMode !== 'crop');
                if (cropContainer) cropContainer.classList.toggle('hidden', editMode !== 'crop');
                canvas.style.cursor = editMode === 'draw' ? 'crosshair' : editMode === 'text' ? 'text' : 'default';
                // Init crop box
                if (editMode === 'crop') initCropOverlay();
            });
        });

        // Drawing on canvas
        if (canvas) {
            canvas.addEventListener('mousedown', e => startDraw(e));
            canvas.addEventListener('mousemove', e => draw(e));
            canvas.addEventListener('mouseup', () => endDraw());
            canvas.addEventListener('mouseleave', () => endDraw());
            canvas.addEventListener('touchstart', e => { if (editMode === 'draw') { e.preventDefault(); startDraw(e); } }, { passive: false });
            canvas.addEventListener('touchmove', e => { if (editMode === 'draw') { e.preventDefault(); draw(e); } }, { passive: false });
            canvas.addEventListener('touchend', () => endDraw());

            // Text click
            canvas.addEventListener('click', (e) => {
                if (editMode !== 'text') return;
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const scaleY = canvas.height / rect.height;
                const x = (e.clientX - rect.left) * scaleX;
                const y = (e.clientY - rect.top) * scaleY;
                const text = document.getElementById('edit-text-content').value || 'Text';
                const color = document.getElementById('edit-text-color-pick').value;
                const size = parseInt(document.getElementById('edit-text-size-pick').value) || 32;
                ctx.fillStyle = color;
                ctx.font = `${size}px Outfit, sans-serif`;
                ctx.fillText(text, x, y);
                drawHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            });
        }

        function getCanvasXY(e) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const pt = e.touches ? e.touches[0] : e;
            return { x: (pt.clientX - rect.left) * scaleX, y: (pt.clientY - rect.top) * scaleY };
        }

        function startDraw(e) {
            if (editMode !== 'draw') return;
            isDrawing = true;
            const { x, y } = getCanvasXY(e);
            lastX = x; lastY = y;
        }
        function draw(e) {
            if (!isDrawing || editMode !== 'draw') return;
            const { x, y } = getCanvasXY(e);
            ctx.strokeStyle = document.getElementById('edit-draw-color').value;
            ctx.lineWidth = parseInt(document.getElementById('edit-draw-size').value) || 4;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(x, y);
            ctx.stroke();
            lastX = x; lastY = y;
        }
        function endDraw() {
            if (isDrawing && editMode === 'draw') {
                drawHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            }
            isDrawing = false;
        }

        // Text size display
        const textSizePick = document.getElementById('edit-text-size-pick');
        if (textSizePick) textSizePick.addEventListener('input', () => {
            const v = document.getElementById('edit-text-size-val');
            if (v) v.textContent = textSizePick.value + 'px';
        });

        // Undo
        const undoBtn = document.getElementById('edit-undo');
        if (undoBtn) undoBtn.addEventListener('click', () => {
            if (drawHistory.length > 1) {
                drawHistory.pop();
                ctx.putImageData(drawHistory[drawHistory.length - 1], 0, 0);
            }
        });

        // Reset
        const resetBtn = document.getElementById('edit-reset');
        if (resetBtn) resetBtn.addEventListener('click', () => {
            if (editImg) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(editImg, 0, 0);
                drawHistory = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
            }
        });

        // Rotate CW / CCW / Flip
        const rotateCW = document.getElementById('edit-rotate-cw');
        const rotateCCW = document.getElementById('edit-rotate-ccw');
        const flipH = document.getElementById('edit-flip-h');
        const flipV = document.getElementById('edit-flip-v');
        if (rotateCW) rotateCW.addEventListener('click', () => rotateCanvas(90));
        if (rotateCCW) rotateCCW.addEventListener('click', () => rotateCanvas(-90));
        if (flipH) flipH.addEventListener('click', () => flipCanvas(true));
        if (flipV) flipV.addEventListener('click', () => flipCanvas(false));

        function rotateCanvas(deg) {
            if (!canvas) return;
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
            tempCanvas.getContext('2d').putImageData(imgData, 0, 0);
            if (deg === 90 || deg === -90) {
                canvas.width = tempCanvas.height; canvas.height = tempCanvas.width;
            }
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(deg * Math.PI / 180);
            ctx.drawImage(tempCanvas, -tempCanvas.width / 2, -tempCanvas.height / 2);
            ctx.restore();
            drawHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }

        function flipCanvas(horizontal) {
            if (!canvas) return;
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
            tempCanvas.getContext('2d').putImageData(imgData, 0, 0);
            ctx.save();
            if (horizontal) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
            else { ctx.translate(0, canvas.height); ctx.scale(1, -1); }
            ctx.drawImage(tempCanvas, 0, 0);
            ctx.restore();
            drawHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }

        // Crop overlay
        function initCropOverlay() {
            const container = document.getElementById('img-crop-container');
            const box = document.getElementById('crop-box-el');
            if (!container || !box) return;
            container.classList.remove('hidden');
            // Set default crop box to 80% center
            box.style.left = '10%'; box.style.top = '10%';
            box.style.width = '80%'; box.style.height = '80%';
            updateCropDims();
            makeCropBoxDraggable(box, container);
        }

        function updateCropDims() {
            const container = document.getElementById('img-crop-container');
            const box = document.getElementById('crop-box-el');
            if (!container || !box) return;
            const cw = container.offsetWidth, ch = container.offsetHeight;
            const bl = box.offsetLeft, bt = box.offsetTop, bw = box.offsetWidth, bh = box.offsetHeight;
            const dt = document.getElementById('crop-dim-top');
            const db = document.getElementById('crop-dim-bottom');
            const dl = document.getElementById('crop-dim-left');
            const dr = document.getElementById('crop-dim-right');
            if (dt) { dt.style.left = '0'; dt.style.top = '0'; dt.style.width = '100%'; dt.style.height = bt + 'px'; }
            if (db) { db.style.left = '0'; db.style.top = (bt + bh) + 'px'; db.style.width = '100%'; db.style.height = (ch - bt - bh) + 'px'; }
            if (dl) { dl.style.left = '0'; dl.style.top = bt + 'px'; dl.style.width = bl + 'px'; dl.style.height = bh + 'px'; }
            if (dr) { dr.style.left = (bl + bw) + 'px'; dr.style.top = bt + 'px'; dr.style.width = (cw - bl - bw) + 'px'; dr.style.height = bh + 'px'; }
            const info = document.getElementById('crop-info-bar');
            if (info && canvas) {
                const sx = canvas.width / cw, sy = canvas.height / ch;
                info.textContent = `Crop: ${Math.round(bw * sx)} × ${Math.round(bh * sy)} px`;
            }
        }

        function makeCropBoxDraggable(box, container) {
            let dragging = false, resizing = false, resizeHandle = '';
            let startX, startY, startLeft, startTop, startW, startH;

            box.addEventListener('mousedown', (e) => {
                if (e.target.classList.contains('crop-h')) {
                    resizing = true; resizeHandle = e.target.dataset.h;
                } else {
                    dragging = true;
                }
                e.preventDefault();
                const pt = { x: e.clientX, y: e.clientY };
                startX = pt.x; startY = pt.y;
                startLeft = box.offsetLeft; startTop = box.offsetTop;
                startW = box.offsetWidth; startH = box.offsetHeight;
            });

            document.addEventListener('mousemove', (e) => {
                if (!dragging && !resizing) return;
                const dx = e.clientX - startX, dy = e.clientY - startY;
                if (dragging) {
                    box.style.left = Math.max(0, Math.min(startLeft + dx, container.offsetWidth - startW)) + 'px';
                    box.style.top = Math.max(0, Math.min(startTop + dy, container.offsetHeight - startH)) + 'px';
                } else if (resizing) {
                    applyCropResize(dx, dy);
                }
                updateCropDims();
            });
            document.addEventListener('mouseup', () => { dragging = false; resizing = false; });

            // Touch support
            box.addEventListener('touchstart', (e) => {
                const t = e.touches[0];
                if (e.target.classList.contains('crop-h')) {
                    resizing = true; resizeHandle = e.target.dataset.h;
                } else {
                    dragging = true;
                }
                startX = t.clientX; startY = t.clientY;
                startLeft = box.offsetLeft; startTop = box.offsetTop;
                startW = box.offsetWidth; startH = box.offsetHeight;
            }, { passive: true });
            document.addEventListener('touchmove', (e) => {
                if (!dragging && !resizing) return;
                e.preventDefault();
                const t = e.touches[0];
                const dx = t.clientX - startX, dy = t.clientY - startY;
                if (dragging) {
                    box.style.left = Math.max(0, Math.min(startLeft + dx, container.offsetWidth - startW)) + 'px';
                    box.style.top = Math.max(0, Math.min(startTop + dy, container.offsetHeight - startH)) + 'px';
                } else if (resizing) {
                    applyCropResize(dx, dy);
                }
                updateCropDims();
            }, { passive: false });
            document.addEventListener('touchend', () => { dragging = false; resizing = false; });

            function applyCropResize(dx, dy) {
                let nl = startLeft, nt = startTop, nw = startW, nh = startH;
                if (resizeHandle.includes('e')) nw = Math.max(30, startW + dx);
                if (resizeHandle.includes('w')) { nw = Math.max(30, startW - dx); nl = startLeft + dx; }
                if (resizeHandle.includes('s')) nh = Math.max(30, startH + dy);
                if (resizeHandle.includes('n')) { nh = Math.max(30, startH - dy); nt = startTop + dy; }
                box.style.left = nl + 'px'; box.style.top = nt + 'px';
                box.style.width = nw + 'px'; box.style.height = nh + 'px';
            }
        }

        // Crop ratios
        window.cropSetMode = function (mode) {
            const freeBtn = document.getElementById('crop-mode-free-btn');
            const ratioBtn = document.getElementById('crop-mode-ratio-btn');
            const presets = document.getElementById('crop-ratio-presets');
            if (mode === 'free') {
                if (freeBtn) freeBtn.className = 'glass-btn primary small';
                if (ratioBtn) ratioBtn.className = 'glass-btn secondary small';
                if (presets) presets.classList.add('hidden');
            } else {
                if (freeBtn) freeBtn.className = 'glass-btn secondary small';
                if (ratioBtn) ratioBtn.className = 'glass-btn primary small';
                if (presets) { presets.classList.remove('hidden'); presets.style.display = 'flex'; }
            }
        };

        document.querySelectorAll('.crop-ratio-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ratio = btn.dataset.ratio;
                const [w, h] = ratio.split(':').map(Number);
                const box = document.getElementById('crop-box-el');
                const container = document.getElementById('img-crop-container');
                if (!box || !container) return;
                const cw = container.offsetWidth, ch = container.offsetHeight;
                let bw, bh;
                if ((w / h) > (cw / ch)) {
                    bw = cw * 0.8; bh = bw * h / w;
                } else {
                    bh = ch * 0.8; bw = bh * w / h;
                }
                box.style.width = bw + 'px'; box.style.height = bh + 'px';
                box.style.left = (cw - bw) / 2 + 'px'; box.style.top = (ch - bh) / 2 + 'px';
                updateCropDims();
            });
        });

        // Apply crop
        const cropApplyBtn = document.getElementById('btn-crop-apply');
        if (cropApplyBtn) cropApplyBtn.addEventListener('click', () => {
            if (!canvas || !ctx) return;
            const container = document.getElementById('img-crop-container');
            const box = document.getElementById('crop-box-el');
            if (!container || !box) return;
            const sx = canvas.width / container.offsetWidth;
            const sy = canvas.height / container.offsetHeight;
            const cx = box.offsetLeft * sx, cy = box.offsetTop * sy;
            const cw = box.offsetWidth * sx, ch = box.offsetHeight * sy;
            const cropped = ctx.getImageData(cx, cy, cw, ch);
            canvas.width = cw; canvas.height = ch;
            ctx.putImageData(cropped, 0, 0);
            container.classList.add('hidden');
            drawHistory.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
            showToast('Crop applied!', 'success');
        });

        // Download edit
        const dlBtn = document.getElementById('btn-download-edit');
        if (dlBtn) dlBtn.addEventListener('click', () => {
            if (!canvas) return;
            canvas.toBlob(blob => downloadBlob(blob, 'edited_image.png'), 'image/png');
        });
    }

    // ===== 4. RESIZE IMAGE =====
    function initResize() {
        let resizeImg = null;
        setupDropZone('img-resize-drop-zone', 'img-resize-input', (file) => {
            loadImageFromFile(file).then(img => {
                resizeImg = img;
                const info = document.getElementById('img-resize-orig-info');
                if (info) info.textContent = `Original: ${img.width} × ${img.height} px`;
                document.getElementById('img-resize-w').value = img.width;
                document.getElementById('img-resize-h').value = img.height;
                document.getElementById('img-resize-options').classList.remove('hidden');
            });
        });

        // Toggle px/pct inputs
        document.querySelectorAll('input[name="resize-mode"]').forEach(r => {
            r.addEventListener('change', () => {
                document.getElementById('resize-px-inputs').style.display = r.value === 'px' ? 'flex' : 'none';
                document.getElementById('resize-pct-input').style.display = r.value === 'pct' ? 'block' : 'none';
            });
        });

        const btn = document.getElementById('btn-process-img-resize');
        if (btn) btn.addEventListener('click', () => {
            if (!resizeImg) return showToast('Load an image first.', 'warning');
            const mode = document.querySelector('input[name="resize-mode"]:checked').value;
            let w, h;
            if (mode === 'px') {
                w = parseInt(document.getElementById('img-resize-w').value);
                h = parseInt(document.getElementById('img-resize-h').value);
            } else {
                const pct = parseFloat(document.getElementById('img-resize-pct').value) / 100;
                w = Math.round(resizeImg.width * pct);
                h = Math.round(resizeImg.height * pct);
            }
            if (!w || !h || w <= 0 || h <= 0) return showToast('Invalid dimensions.', 'warning');
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(resizeImg, 0, 0, w, h);
            canvas.toBlob(blob => { downloadBlob(blob, 'resized.png'); showToast(`Resized to ${w}×${h}`, 'success'); }, 'image/png');
        });
    }

    // ===== 5. CONVERT IMAGE =====
    function initConvert() {
        let convertFile = null;
        setupDropZone('img-convert-drop-zone', 'img-convert-input', (file) => {
            convertFile = file;
            const name = document.getElementById('img-convert-file-name');
            if (name) name.textContent = file.name;
            document.getElementById('img-convert-options').classList.remove('hidden');
        });

        const btn = document.getElementById('btn-process-img-convert');
        if (btn) btn.addEventListener('click', async () => {
            if (!convertFile) return showToast('Select an image first.', 'warning');
            const format = document.getElementById('img-convert-format').value;
            const mimeMap = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', bmp: 'image/bmp' };
            try {
                const img = await loadImageFromFile(convertFile);
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                canvas.getContext('2d').drawImage(img, 0, 0);
                const blob = await canvasToBlob(canvas, mimeMap[format] || 'image/png', 0.92);
                downloadBlob(blob, convertFile.name.replace(/\.[^.]+$/, '') + '.' + format);
                showToast('Converted to ' + format.toUpperCase(), 'success');
            } catch (err) {
                showToast('Conversion failed: ' + err.message, 'error');
            }
        });
    }

    // ===== 6. WATERMARK IMAGE =====
    function initWatermark() {
        let wmImg = null;
        let wmMode = 'diagonal';
        const previewCanvas = document.getElementById('img-wm-preview-canvas');
        const previewCtx = previewCanvas ? previewCanvas.getContext('2d') : null;

        setupDropZone('img-watermark-drop-zone', 'img-watermark-input', (file) => {
            loadImageFromFile(file).then(img => {
                wmImg = img;
                const name = document.getElementById('img-watermark-file-name');
                if (name) name.textContent = file.name;
                document.getElementById('img-watermark-options').classList.remove('hidden');
                drawWmPreview();
            });
        });

        // Tab switching
        window.wmSwitchTab = function (mode) {
            wmMode = mode;
            const diagTab = document.getElementById('wm-tab-diagonal');
            const tiledTab = document.getElementById('wm-tab-tiled');
            const angleRow = document.getElementById('wm-angle-row');
            const tiledRows = document.getElementById('wm-tiled-rows');
            if (diagTab) diagTab.className = mode === 'diagonal' ? 'glass-btn primary' : 'glass-btn secondary';
            if (tiledTab) tiledTab.className = mode === 'tiled' ? 'glass-btn primary' : 'glass-btn secondary';
            if (angleRow) angleRow.style.display = mode === 'diagonal' ? '' : 'none';
            if (tiledRows) tiledRows.classList.toggle('hidden', mode !== 'tiled');
            drawWmPreview();
        };

        // Slider updates
        ['img-wm-size', 'img-wm-opacity', 'img-wm-angle', 'img-wm-hspace', 'img-wm-vspace', 'img-wm-tile-angle',
            'img-wm-text', 'img-wm-color', 'img-wm-font', 'img-wm-bold', 'img-wm-italic', 'img-wm-shadow', 'img-wm-outline', 'img-wm-outline-color'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.addEventListener('input', () => {
                    updateWmLabels();
                    drawWmPreview();
                });
            });

        function updateWmLabels() {
            const map = {
                'img-wm-size-val': document.getElementById('img-wm-size')?.value,
                'img-wm-opacity-val': document.getElementById('img-wm-opacity')?.value,
                'img-wm-angle-val': document.getElementById('img-wm-angle')?.value,
                'img-wm-hspace-val': document.getElementById('img-wm-hspace')?.value,
                'img-wm-vspace-val': document.getElementById('img-wm-vspace')?.value,
                'img-wm-tile-angle-val': document.getElementById('img-wm-tile-angle')?.value
            };
            Object.entries(map).forEach(([id, v]) => { const el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; });
        }

        function getWmParams() {
            return {
                text: document.getElementById('img-wm-text')?.value || 'WATERMARK',
                font: document.getElementById('img-wm-font')?.value || 'Impact',
                size: parseInt(document.getElementById('img-wm-size')?.value) || 60,
                opacity: parseInt(document.getElementById('img-wm-opacity')?.value) / 100 || 0.4,
                color: document.getElementById('img-wm-color')?.value || '#ffffff',
                angle: parseInt(document.getElementById('img-wm-angle')?.value) || -35,
                bold: document.getElementById('img-wm-bold')?.checked,
                italic: document.getElementById('img-wm-italic')?.checked,
                shadow: document.getElementById('img-wm-shadow')?.checked,
                outline: document.getElementById('img-wm-outline')?.checked,
                outlineColor: document.getElementById('img-wm-outline-color')?.value || '#000000',
                hspace: parseInt(document.getElementById('img-wm-hspace')?.value) || 120,
                vspace: parseInt(document.getElementById('img-wm-vspace')?.value) || 80,
                tileAngle: parseInt(document.getElementById('img-wm-tile-angle')?.value) || -25
            };
        }

        function drawWmPreview() {
            if (!wmImg || !previewCanvas || !previewCtx) return;
            previewCanvas.width = wmImg.width;
            previewCanvas.height = wmImg.height;
            previewCtx.drawImage(wmImg, 0, 0);
            applyWatermark(previewCtx, previewCanvas.width, previewCanvas.height);
        }

        function applyWatermark(ctx, w, h) {
            const p = getWmParams();
            ctx.globalAlpha = p.opacity;
            const fontStr = `${p.italic ? 'italic ' : ''}${p.bold ? 'bold ' : ''}${p.size}px ${p.font}`;
            ctx.font = fontStr;
            ctx.fillStyle = p.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (wmMode === 'diagonal') {
                ctx.save();
                ctx.translate(w / 2, h / 2);
                ctx.rotate(p.angle * Math.PI / 180);
                if (p.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; }
                if (p.outline) { ctx.strokeStyle = p.outlineColor; ctx.lineWidth = 2; ctx.strokeText(p.text, 0, 0); }
                ctx.fillText(p.text, 0, 0);
                ctx.restore();
            } else {
                // Tiled
                ctx.save();
                const angle = p.tileAngle * Math.PI / 180;
                for (let y = -h; y < h * 2; y += p.vspace + p.size) {
                    for (let x = -w; x < w * 2; x += p.hspace + ctx.measureText(p.text).width) {
                        ctx.save();
                        ctx.translate(x, y);
                        ctx.rotate(angle);
                        if (p.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4; }
                        if (p.outline) { ctx.strokeStyle = p.outlineColor; ctx.lineWidth = 2; ctx.strokeText(p.text, 0, 0); }
                        ctx.fillText(p.text, 0, 0);
                        ctx.restore();
                    }
                }
                ctx.restore();
            }
            ctx.globalAlpha = 1;
        }

        const prevBtn = document.getElementById('btn-wm-preview');
        if (prevBtn) prevBtn.addEventListener('click', drawWmPreview);

        const dlBtn = document.getElementById('btn-process-img-watermark');
        if (dlBtn) dlBtn.addEventListener('click', () => {
            if (!wmImg) return showToast('Load an image first.', 'warning');
            const canvas = document.createElement('canvas');
            canvas.width = wmImg.width; canvas.height = wmImg.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(wmImg, 0, 0);
            applyWatermark(ctx, canvas.width, canvas.height);
            canvas.toBlob(blob => { downloadBlob(blob, 'watermarked.png'); showToast('Watermark applied!', 'success'); }, 'image/png');
        });
    }

    // ===== 7. ROTATE & FLIP =====
    function initRotate() {
        let rotImg = null;
        let rotAngle = 0;
        let flipH = false, flipV = false;
        const preview = document.getElementById('img-rotate-preview');

        setupDropZone('img-rotate-drop-zone', 'img-rotate-input', (file) => {
            loadImageFromFile(file).then(img => {
                rotImg = img;
                rotAngle = 0; flipH = false; flipV = false;
                updateRotPreview();
                document.getElementById('img-rotate-workspace').classList.remove('hidden');
            });
        });

        function updateRotPreview() {
            if (!rotImg || !preview) return;
            const canvas = document.createElement('canvas');
            const swap = (rotAngle % 180 !== 0);
            canvas.width = swap ? rotImg.height : rotImg.width;
            canvas.height = swap ? rotImg.width : rotImg.height;
            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(rotAngle * Math.PI / 180);
            if (flipH) ctx.scale(-1, 1);
            if (flipV) ctx.scale(1, -1);
            ctx.drawImage(rotImg, -rotImg.width / 2, -rotImg.height / 2);
            ctx.restore();
            preview.src = canvas.toDataURL('image/png');
        }

        const cwBtn = document.getElementById('btn-rot-cw');
        const ccwBtn = document.getElementById('btn-rot-ccw');
        const r180Btn = document.getElementById('btn-rot-180');
        const fhBtn = document.getElementById('btn-flip-h');
        const fvBtn = document.getElementById('btn-flip-v');
        const dlBtn = document.getElementById('btn-download-rotate');

        if (cwBtn) cwBtn.addEventListener('click', () => { rotAngle = (rotAngle + 90) % 360; updateRotPreview(); });
        if (ccwBtn) ccwBtn.addEventListener('click', () => { rotAngle = (rotAngle - 90 + 360) % 360; updateRotPreview(); });
        if (r180Btn) r180Btn.addEventListener('click', () => { rotAngle = (rotAngle + 180) % 360; updateRotPreview(); });
        if (fhBtn) fhBtn.addEventListener('click', () => { flipH = !flipH; updateRotPreview(); });
        if (fvBtn) fvBtn.addEventListener('click', () => { flipV = !flipV; updateRotPreview(); });
        if (dlBtn) dlBtn.addEventListener('click', () => {
            if (!preview || !preview.src) return;
            const a = document.createElement('a');
            a.href = preview.src; a.download = 'rotated.png'; a.click();
            showToast('Downloaded!', 'success');
        });
    }

    // ===== 8. ADD TEXT TO IMAGE =====
    function initAddText() {
        let atImg = null;
        const canvas = document.getElementById('img-addtext-canvas');
        const ctx = canvas ? canvas.getContext('2d') : null;
        let textLayers = [];

        setupDropZone('img-addtext-drop-zone', 'img-addtext-input', (file) => {
            loadImageFromFile(file).then(img => {
                atImg = img;
                canvas.width = img.width; canvas.height = img.height;
                textLayers = [];
                redrawAddText();
                document.getElementById('img-addtext-workspace').classList.remove('hidden');
            });
        });

        function redrawAddText() {
            if (!atImg || !ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(atImg, 0, 0);
            textLayers.forEach(layer => {
                ctx.save();
                ctx.fillStyle = layer.color;
                ctx.font = `${layer.bold ? 'bold ' : ''}${layer.italic ? 'italic ' : ''}${layer.size}px ${layer.font}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(layer.text, layer.x, layer.y);
                ctx.restore();
            });
        }

        const addBtn = document.getElementById('btn-add-text-layer');
        if (addBtn) addBtn.addEventListener('click', () => {
            if (!atImg) return showToast('Load an image first.', 'warning');
            const text = document.getElementById('at-text').value || 'Text';
            const color = document.getElementById('at-color').value;
            const size = parseInt(document.getElementById('at-size').value) || 48;
            const font = document.getElementById('at-font').value;
            const bold = document.getElementById('at-bold').checked;
            const italic = document.getElementById('at-italic').checked;
            const xPct = parseFloat(document.getElementById('at-x').value) / 100;
            const yPct = parseFloat(document.getElementById('at-y').value) / 100;
            textLayers.push({ text, color, size, font, bold, italic, x: canvas.width * xPct, y: canvas.height * yPct });
            redrawAddText();
            showToast('Text added!', 'success');
        });

        const dlBtn = document.getElementById('btn-download-addtext');
        if (dlBtn) dlBtn.addEventListener('click', () => {
            if (!canvas) return;
            canvas.toBlob(blob => downloadBlob(blob, 'text_image.png'), 'image/png');
        });
    }


    // ===== UTILITY FUNCTIONS =====
    function loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }

    function canvasToBlob(canvas, type, quality) {
        return new Promise(resolve => canvas.toBlob(resolve, type, quality));
    }

    function downloadBlob(blob, filename) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
    }
})();
