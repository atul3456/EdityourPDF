/* ============================================
   generate-image.js
   AI Image Generation using Pollinations.AI
   Free • No API key • CORS-friendly
   Standalone file — does not modify other files
   ============================================ */

(function () {
    'use strict';

    // ── Pollinations.AI config ───────────────────────────
    // Free, no key required, browser-friendly (no CORS issues)
    const POLL_BASE = 'https://image.pollinations.ai/prompt/';

    const MODELS = [
        { id: 'flux', label: 'Flux', desc: 'Best quality (default)' },
        { id: 'flux-realism', label: 'Flux Realism', desc: 'Photorealistic' },
        { id: 'flux-anime', label: 'Flux Anime', desc: 'Anime / manga style' },
        { id: 'flux-3d', label: 'Flux 3D', desc: '3D render look' },
        { id: 'turbo', label: 'Turbo', desc: 'Fastest generation' },
        { id: 'any-dark', label: 'Dark Art', desc: 'Dark / moody aesthetic' },
    ];

    // Width × Height presets for each aspect ratio
    const RATIO_SIZES = {
        '1:1': [1024, 1024],
        '16:9': [1280, 720],
        '9:16': [720, 1280],
        '4:3': [1024, 768],
        '3:4': [768, 1024],
        '3:2': [1200, 800],
        '2:3': [800, 1200],
    };

    const PROMPT_SUGGESTIONS = [
        'cinematic portrait, soft golden hour light',
        'fantasy castle on a floating island, cloud ocean',
        'galaxy swirling inside a glass sphere, macro',
        'neon-lit cyberpunk street, rain reflections',
        'anime girl with glowing wings, sakura trees',
        'underwater city with bioluminescent plants',
        'studio product shot on soft white linen',
        'dragon made of crystal, rainbow refractions',
        'cozy autumn bookstore interior, warm light',
        'hyper-realistic wolf in snowy forest, sunset',
    ];

    let selectedModel = MODELS[0].id;
    let imageHistory = [];
    let latestImageUrl = null;
    let latestPrompt = '';

    // ── Entry point ──────────────────────────────────────
    function init() {
        const card = document.getElementById('img-card-generate');
        if (!card) return;
        card.addEventListener('click', openGenImgTool);

        wireSection();
        buildStyleChips();
        buildPromptSuggestions();
    }

    // ── Show / hide view helpers ─────────────────────────
    function openGenImgTool() {
        document.querySelectorAll('.img-tool-section').forEach(s => s.classList.add('hidden'));
        document.getElementById('img-editor-dashboard')?.classList.add('hidden');
        document.getElementById('home-dashboard')?.classList.add('hidden');
        document.querySelectorAll('[id$="-section"]').forEach(s => s.classList.add('hidden'));
        document.getElementById('gen-img-section')?.classList.remove('hidden');
    }

    function goBackToImgDash() {
        document.getElementById('gen-img-section')?.classList.add('hidden');
        document.getElementById('img-editor-dashboard')?.classList.remove('hidden');
        document.querySelectorAll('.img-tool-section').forEach(s => s.classList.add('hidden'));
    }

    // ── Wire all interactive elements ────────────────────
    function wireSection() {
        document.getElementById('gen-img-back-btn')?.addEventListener('click', goBackToImgDash);
        document.getElementById('btn-generate-image')?.addEventListener('click', handleGenerate);
        document.getElementById('btn-gen-img-download')?.addEventListener('click', downloadCurrentImage);
        document.getElementById('btn-gen-img-copy-prompt')?.addEventListener('click', copyPrompt);
        document.getElementById('btn-gen-img-regen')?.addEventListener('click', handleGenerate);
        document.getElementById('btn-enhance-prompt')?.addEventListener('click', enhancePrompt);

        // Ctrl/Cmd + Enter shortcut
        document.getElementById('gen-img-prompt')?.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleGenerate();
        });

        // Toggle negative prompt
        const negToggle = document.getElementById('gen-img-neg-toggle');
        const negBox = document.getElementById('gen-img-neg-box');
        if (negToggle && negBox) {
            negToggle.addEventListener('click', () => {
                const open = negBox.style.display !== 'none';
                negBox.style.display = open ? 'none' : 'block';
                negToggle.innerHTML = open
                    ? '<i class="fa-solid fa-chevron-down"></i> Negative prompt'
                    : '<i class="fa-solid fa-chevron-up"></i> Hide negative prompt';
            });
        }
    }

    // ── Style chips ──────────────────────────────────────
    function buildStyleChips() {
        const container = document.getElementById('gen-img-model-chips');
        if (!container) return;
        container.innerHTML = '';

        MODELS.forEach((m, idx) => {
            const chip = document.createElement('span');
            chip.className = 'style-chip' + (idx === 0 ? ' active' : '');
            chip.title = m.desc;
            chip.textContent = m.label;
            chip.addEventListener('click', () => {
                document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                selectedModel = m.id;
            });
            container.appendChild(chip);
        });
    }

    // ── Prompt suggestion chips ──────────────────────────
    function buildPromptSuggestions() {
        const container = document.getElementById('gen-img-suggestions');
        if (!container) return;
        container.innerHTML = '';

        PROMPT_SUGGESTIONS.forEach(text => {
            const chip = document.createElement('span');
            chip.className = 'prompt-suggestion-chip';
            chip.textContent = text;
            chip.addEventListener('click', () => {
                const promptEl = document.getElementById('gen-img-prompt');
                if (promptEl) {
                    const existing = promptEl.value.trim();
                    promptEl.value = existing ? existing + ', ' + text : text;
                    promptEl.focus();
                }
            });
            container.appendChild(chip);
        });
    }

    // ── Core: generate via Pollinations.AI ──────────────
    async function handleGenerate() {
        const promptEl = document.getElementById('gen-img-prompt');
        const prompt = promptEl ? promptEl.value.trim() : '';

        if (!prompt) {
            showGIToast('Please enter a prompt to generate an image.', 'warning');
            promptEl?.focus();
            return;
        }

        const ratio = document.getElementById('gen-img-aspect')?.value || '1:1';
        const steps = parseInt(document.getElementById('gen-img-steps')?.value) || 30;
        const negProm = document.getElementById('gen-img-neg-prompt')?.value.trim() || '';
        const [w, h] = RATIO_SIZES[ratio] || [1024, 1024];
        const seed = Math.floor(Math.random() * 999999);

        setGenerating(true, 'Sending to Pollinations AI…');
        latestPrompt = prompt;

        try {
            // Build Pollinations URL
            // Docs: https://image.pollinations.ai/prompt/{prompt}?model=...&width=...&height=...
            const params = new URLSearchParams({
                model: selectedModel,
                width: w,
                height: h,
                steps: steps,
                seed: seed,
                nologo: 'true',
                enhance: 'false',
            });
            if (negProm) params.set('negative_prompt', negProm);

            const encodedPrompt = encodeURIComponent(prompt);
            const imgUrl = `${POLL_BASE}${encodedPrompt}?${params.toString()}`;

            setGenerating(true, 'Generating… this takes ~10–30 seconds ⏳');

            // Pre-load the image to detect errors
            await preloadImage(imgUrl);

            displayResult(imgUrl, prompt);
            addToHistory(imgUrl, prompt);
            showGIToast('Image generated! ✨', 'success');

        } catch (err) {
            console.error('[GenerateImage]', err);
            setGenerating(false);
            setStatus('');
            showGIToast('Generation failed: ' + err.message, 'error');
        }
    }

    // ── Preload image (validates it actually loaded) ─────
    function preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeout = setTimeout(() => reject(new Error('Timed out after 60s')), 60000);
            img.onload = () => { clearTimeout(timeout); resolve(url); };
            img.onerror = () => { clearTimeout(timeout); reject(new Error('Image failed to load from API')); };
            img.src = url;
        });
    }

    // ── Display the generated image ──────────────────────
    function displayResult(url, prompt) {
        latestImageUrl = url;

        setGenerating(false);
        setStatus('');

        const resultBox = document.getElementById('gen-img-result-box');
        const shimmer = document.getElementById('gen-img-shimmer');
        const img = document.getElementById('gen-img-output-img');
        const promptLbl = document.getElementById('gen-img-result-prompt');

        if (shimmer) shimmer.style.display = 'none';
        if (resultBox) resultBox.style.display = 'block';

        if (img) {
            img.style.opacity = '0';
            img.style.transition = 'opacity 0.5s ease';
            img.src = url;
            img.alt = prompt;
            img.style.display = 'block';
            img.onload = () => { img.style.opacity = '1'; };
        }

        if (promptLbl) {
            promptLbl.textContent = '"' + prompt.substring(0, 100) + (prompt.length > 100 ? '…' : '') + '"';
        }

        document.getElementById('gen-img-result-actions-row')?.classList.remove('hidden');
        document.getElementById('btn-generate-image').disabled = false;
        document.getElementById('btn-generate-image').innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Image';
    }

    // ── History ──────────────────────────────────────────
    function addToHistory(url, prompt) {
        imageHistory.unshift({ url, prompt });
        if (imageHistory.length > 12) imageHistory.pop();
        renderHistory();
    }

    function renderHistory() {
        const container = document.getElementById('gen-img-history');
        if (!container) return;
        document.getElementById('gen-img-history-section')?.classList.remove('hidden');
        container.innerHTML = '';
        imageHistory.forEach(({ url, prompt }) => {
            const img = document.createElement('img');
            img.className = 'gen-img-history-thumb';
            img.src = url;
            img.title = prompt;
            img.alt = prompt;
            img.addEventListener('click', () => displayResult(url, prompt));
            container.appendChild(img);
        });
    }

    // ── Download ──────────────────────────────────────────
    async function downloadCurrentImage() {
        if (!latestImageUrl) return;
        showGIToast('Preparing download…', 'info');
        try {
            const res = await fetch(latestImageUrl);
            const blob = await res.blob();
            const ext = blob.type.includes('png') ? 'png' : 'jpg';
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'ai_generated_' + Date.now() + '.' + ext;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(a.href);
        } catch {
            window.open(latestImageUrl, '_blank');
        }
    }

    // ── Copy prompt ───────────────────────────────────────
    function copyPrompt() {
        if (!latestPrompt) return;
        navigator.clipboard.writeText(latestPrompt)
            .then(() => showGIToast('Prompt copied!', 'success'))
            .catch(() => showGIToast('Could not copy.', 'warning'));
    }

    // ── Enhance prompt ─────────────────────────────────────
    function enhancePrompt() {
        const promptEl = document.getElementById('gen-img-prompt');
        if (!promptEl || !promptEl.value.trim()) {
            showGIToast('Enter a base prompt first, then enhance it.', 'warning');
            return;
        }
        const enhancements = [
            'highly detailed', 'photorealistic', '8k resolution',
            'cinematic lighting', 'masterpiece', 'sharp focus',
            'professional photography', 'stunning composition',
            'dramatic atmosphere', 'vibrant colors',
        ];
        const random3 = enhancements.sort(() => Math.random() - 0.5).slice(0, 3);
        promptEl.value = promptEl.value.trim() + ', ' + random3.join(', ');
        showGIToast('Prompt enhanced! ✏️', 'success');
    }

    // ── UI helpers ────────────────────────────────────────
    function setGenerating(isGenerating, statusMsg = '') {
        const btn = document.getElementById('btn-generate-image');
        const shimmer = document.getElementById('gen-img-shimmer');
        const result = document.getElementById('gen-img-result-box');

        if (isGenerating) {
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating…'; }
            if (shimmer) shimmer.style.display = 'flex';
            if (result) result.style.display = 'none';
            setStatus(statusMsg);
        } else {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Image'; }
            if (shimmer) shimmer.style.display = 'none';
        }
    }

    function setStatus(msg) {
        const el = document.getElementById('gen-img-status');
        if (el) el.textContent = msg;
    }

    function showGIToast(message, type) {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    // ── Bootstrap ──────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
