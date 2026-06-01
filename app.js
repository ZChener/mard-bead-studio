(() => {
  const $ = (id) => document.getElementById(id);

  const state = {
    palette: [],
    originalImage: null,
    sourceCanvas: document.createElement('canvas'),
    sourceWidth: 0,
    sourceHeight: 0,
    previewUrl: '',
    previewDataUrl: '',
    originalCanvas: document.createElement('canvas'),
    cartoonCanvas: document.createElement('canvas'),
    beadCanvas: document.createElement('canvas'),
    pattern: [],
    stats: [],
    imageMeta: '',
    originalView: { scale: 1, x: 0, y: 0, dragging: false, px: 0, py: 0 },
    cartoonView: { scale: 1, x: 0, y: 0, dragging: false, px: 0, py: 0 },
    beadView: { scale: 1, x: 0, y: 0, dragging: false, px: 0, py: 0 },
    processToken: 0,
    regenTimer: null,
  };

  const controls = {
    gridWidth: $('gridWidth'),
    gridHeight: $('gridHeight'),
    maxBeads: $('maxBeads'),
    maxColors: $('maxColors'),
    cartoonStrength: $('cartoonStrength'),
    saturation: $('saturation'),
    contrast: $('contrast'),
    softEdge: $('softEdge'),
    showGrid: $('showGrid'),
  };

  const controlValueIds = {
    gridWidth: 'gridWidthValue',
    gridHeight: 'gridHeightValue',
    maxBeads: 'maxBeadsValue',
    maxColors: 'maxColorsValue',
    cartoonStrength: 'cartoonStrengthValue',
    saturation: 'saturationValue',
    contrast: 'contrastValue',
    softEdge: 'softEdgeValue',
  };

  const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

  function setStatus(message, type = 'muted') {
    const el = $('status');
    el.className = `result ${type}`;
    el.textContent = message;
  }

  function hexToRgb(hex) {
    const clean = String(hex || '').replace('#', '').trim();
    const value = clean.length === 3 ? clean.split('').map((x) => x + x).join('') : clean;
    if (!/^[0-9a-fA-F]{6}$/.test(value)) throw new Error(`Invalid HEX color: ${hex}`);
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
  }

  function rgbDistance(a, b) {
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  function findClosestMardColor(rgb, palette = state.palette) {
    let best = palette[0];
    let min = Number.POSITIVE_INFINITY;
    for (const color of palette) {
      const dist = rgbDistance(rgb, color.rgb);
      if (dist < min) {
        min = dist;
        best = color;
      }
    }
    return best;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fitSize(width, height, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  function isMobileViewport() {
    return window.matchMedia('(max-width: 600px)').matches;
  }

  function isMobileOrWeChat() {
    return isMobileViewport() || /MicroMessenger|iPhone|iPad|Android/i.test(navigator.userAgent);
  }

  function isWeChatBrowser() {
    return /MicroMessenger/i.test(navigator.userAgent);
  }

  function processingMaxSide() {
    if (isWeChatBrowser()) return 384;
    if (isMobileOrWeChat()) return 512;
    if (window.matchMedia('(max-width: 900px)').matches) return 680;
    return 1000;
  }

  function setControlValue(id, value) {
    const el = $(id);
    if (el) el.textContent = String(value);
  }

  function estimateGridHeight(width = Number(controls.gridWidth.value) || 120) {
    const ratio = state.sourceWidth && state.sourceHeight ? state.sourceWidth / state.sourceHeight : 1.5;
    return Math.max(8, Math.round(width / ratio));
  }

  function updateControlLabels() {
    const width = Number(controls.gridWidth.value) || 120;
    const height = Number(controls.gridHeight.value) || estimateGridHeight(width);
    setControlValue(controlValueIds.gridWidth, width);
    setControlValue(controlValueIds.gridHeight, height);
    setControlValue(controlValueIds.maxBeads, controls.maxBeads.value);
    setControlValue(controlValueIds.maxColors, controls.maxColors.value);
    setControlValue(controlValueIds.cartoonStrength, controls.cartoonStrength.value);
    setControlValue(controlValueIds.saturation, controls.saturation.value);
    setControlValue(controlValueIds.contrast, controls.contrast.value);
    setControlValue(controlValueIds.softEdge, controls.softEdge.value);
  }

  function releaseCanvas(canvas) {
    if (!canvas) return;
    canvas.width = 0;
    canvas.height = 0;
  }

  function yieldToBrowser() {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
      else setTimeout(resolve, 0);
    });
  }

  async function loadPalette() {
    try {
      const response = await fetch('./mardPalette.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.palette = await response.json();
    } catch (_err) {
      state.palette = JSON.parse($('embeddedPalette').textContent);
    }

    state.palette = state.palette.map((color) => ({
      brand: color.brand || 'MARD',
      code: color.code,
      hex: String(color.hex).toLowerCase(),
      rgb: Array.isArray(color.rgb) ? color.rgb : hexToRgb(color.hex),
      group: color.group || String(color.code || '').charAt(0),
    }));
  }

  function applySaturationContrast(data, saturation, contrast) {
    const sat = saturation / 100;
    const con = contrast / 100;
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * sat;
      g = gray + (g - gray) * sat;
      b = gray + (b - gray) * sat;
      data[i] = clamp((r - 128) * con + 128, 0, 255);
      data[i + 1] = clamp((g - 128) * con + 128, 0, 255);
      data[i + 2] = clamp((b - 128) * con + 128, 0, 255);
    }
  }

  async function smoothPreserveEdges(src, width, height, strength, token) {
    const iterations = Math.max(1, Math.round(strength / 2));
    let current = new Uint8ClampedArray(src);
    const next = new Uint8ClampedArray(src.length);
    const threshold = 42 + (10 - strength) * 5;

    for (let pass = 0; pass < iterations; pass += 1) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = (y * width + x) * 4;
          let totalWeight = 1;
          let r = current[idx];
          let g = current[idx + 1];
          let b = current[idx + 2];

          for (let oy = -1; oy <= 1; oy += 1) {
            for (let ox = -1; ox <= 1; ox += 1) {
              if (ox === 0 && oy === 0) continue;
              const nx = clamp(x + ox, 0, width - 1);
              const ny = clamp(y + oy, 0, height - 1);
              const ni = (ny * width + nx) * 4;
              const diff = Math.abs(current[idx] - current[ni]) + Math.abs(current[idx + 1] - current[ni + 1]) + Math.abs(current[idx + 2] - current[ni + 2]);
              if (diff < threshold * 3) {
                const weight = ox === 0 || oy === 0 ? 1 : 0.6;
                totalWeight += weight;
                r += current[ni] * weight;
                g += current[ni + 1] * weight;
                b += current[ni + 2] * weight;
              }
            }
          }

          next[idx] = r / totalWeight;
          next[idx + 1] = g / totalWeight;
          next[idx + 2] = b / totalWeight;
          next[idx + 3] = current[idx + 3];
        }
        if (y % 24 === 0) {
          await yieldToBrowser();
          if (token !== state.processToken) return current;
        }
      }
      current = new Uint8ClampedArray(next);
    }
    return current;
  }

  function quantizeChannel(value, levels) {
    const step = 255 / (levels - 1);
    return Math.round(value / step) * step;
  }

  function quantizeColors(data, strength) {
    const levels = Math.round(clamp(18 - strength, 6, 16));
    for (let i = 0; i < data.length; i += 4) {
      data[i] = quantizeChannel(data[i], levels);
      data[i + 1] = quantizeChannel(data[i + 1], levels);
      data[i + 2] = quantizeChannel(data[i + 2], levels);
    }
  }

  async function applySoftEdges(data, original, width, height, amount, token) {
    const edgeAmount = amount / 100;
    if (edgeAmount <= 0) return;
    const copy = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = (y * width + x) * 4;
        const left = idx - 4;
        const right = idx + 4;
        const up = idx - width * 4;
        const down = idx + width * 4;
        const gx = Math.abs(original[right] - original[left]) + Math.abs(original[right + 1] - original[left + 1]) + Math.abs(original[right + 2] - original[left + 2]);
        const gy = Math.abs(original[down] - original[up]) + Math.abs(original[down + 1] - original[up + 1]) + Math.abs(original[down + 2] - original[up + 2]);
        const edge = clamp((gx + gy) / 255, 0, 1) * edgeAmount;
        copy[idx] = clamp(data[idx] * (1 - edge * 0.16), 0, 255);
        copy[idx + 1] = clamp(data[idx + 1] * (1 - edge * 0.16), 0, 255);
        copy[idx + 2] = clamp(data[idx + 2] * (1 - edge * 0.16), 0, 255);
      }
      if (y % 32 === 0) {
        await yieldToBrowser();
        if (token !== state.processToken) return;
      }
    }
    data.set(copy);
  }

  function autoGridSize() {
    const mobile = isMobileOrWeChat();
    const maxGrid = mobile ? 120 : 200;
    let requestedW = clamp(Number(controls.gridWidth.value) || (mobile ? 80 : 120), 40, maxGrid);
    const maxBeads = clamp(Number(controls.maxBeads.value) || 5000, 1000, 20000);
    let reduced = false;

    if (mobile && Number(controls.gridWidth.value) > maxGrid) {
      controls.gridWidth.value = requestedW;
      setStatus('手机端建议使用较小图片和较低网格尺寸，避免浏览器自动刷新。已限制网格宽度不超过 120。', 'muted');
      reduced = true;
    }

    const ratio = state.sourceWidth && state.sourceHeight ? state.sourceWidth / state.sourceHeight : 1.5;
    let width = requestedW;
    let height = Math.max(1, Math.round(width / ratio));
    if (height > maxGrid) {
      height = maxGrid;
      width = Math.max(1, Math.round(height * ratio));
    }
    width = clamp(width, 40, maxGrid);
    height = clamp(height, 8, maxGrid);
    if (width !== requestedW) reduced = true;

    const total = width * height;
    if (total <= maxBeads) {
      controls.gridWidth.value = width;
      controls.gridHeight.value = height;
      updateControlLabels();
      return { width, height, reduced };
    }

    const scale = Math.sqrt(maxBeads / total);
    const adjusted = {
      width: Math.max(8, Math.floor(width * scale)),
      height: Math.max(8, Math.floor(height * scale)),
      reduced: true,
    };
    controls.gridHeight.value = adjusted.height;
    updateControlLabels();
    return adjusted;
  }

  async function cartoonize(token) {
    if (!state.sourceCanvas.width) return;
    const strength = 1 + (Number(controls.cartoonStrength.value) / 100) * 9;
    const saturation = Number(controls.saturation.value);
    const contrast = Number(controls.contrast.value);
    const softEdge = Number(controls.softEdge.value);
    const size = { width: state.sourceWidth, height: state.sourceHeight };
    const canvas = state.cartoonCanvas;
    canvas.width = size.width;
    canvas.height = size.height;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.sourceCanvas, 0, 0, size.width, size.height);
    await yieldToBrowser();
    if (token !== state.processToken) return;

    const imageData = ctx.getImageData(0, 0, size.width, size.height);
    const original = new Uint8ClampedArray(imageData.data);
    applySaturationContrast(imageData.data, saturation, contrast);
    await yieldToBrowser();
    if (token !== state.processToken) return;

    const smoothed = await smoothPreserveEdges(imageData.data, size.width, size.height, strength, token);
    if (token !== state.processToken) return;
    imageData.data.set(smoothed);
    quantizeColors(imageData.data, strength);
    await applySoftEdges(imageData.data, original, size.width, size.height, softEdge, token);
    if (token !== state.processToken) return;
    ctx.putImageData(imageData, 0, 0);
    renderCartoonPreview();
  }

  function renderOriginalPreview() {
    if (!state.sourceCanvas.width) return;
    const size = fitSize(state.sourceWidth, state.sourceHeight, processingMaxSide());
    const canvas = state.originalCanvas;
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(state.sourceCanvas, 0, 0, size.width, size.height);
    setCanvasInHost('originalContent', canvas, state.originalView);
  }

  async function generateCartoonImage(token) {
    await cartoonize(token);
  }

  function averageCell(data, sourceW, sourceH, x0, y0, x1, y1) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    const startX = Math.floor(x0);
    const endX = Math.max(startX + 1, Math.ceil(x1));
    const startY = Math.floor(y0);
    const endY = Math.max(startY + 1, Math.ceil(y1));

    for (let y = startY; y < endY; y += 1) {
      if (y < 0 || y >= sourceH) continue;
      for (let x = startX; x < endX; x += 1) {
        if (x < 0 || x >= sourceW) continue;
        const idx = (y * sourceW + x) * 4;
        r += data[idx];
        g += data[idx + 1];
        b += data[idx + 2];
        n += 1;
      }
    }
    return n ? [r / n, g / n, b / n] : [255, 255, 255];
  }

  async function generatePattern(token) {
    if (!state.cartoonCanvas.width || !state.palette.length) return;
    const grid = autoGridSize();
    const maxColors = clamp(Number(controls.maxColors.value) || 32, 8, 80);
    const ctx = state.cartoonCanvas.getContext('2d', { willReadFrequently: true });
    const source = ctx.getImageData(0, 0, state.cartoonCanvas.width, state.cartoonCanvas.height);
    const cellW = state.cartoonCanvas.width / grid.width;
    const cellH = state.cartoonCanvas.height / grid.height;
    const firstPass = [];
    const counts = new Map();

    for (let y = 0; y < grid.height; y += 1) {
      const row = [];
      for (let x = 0; x < grid.width; x += 1) {
        const rgb = averageCell(source.data, source.width, source.height, x * cellW, y * cellH, (x + 1) * cellW, (y + 1) * cellH);
        const color = findClosestMardColor(rgb);
        row.push({ code: color.code, hex: color.hex, rgb: color.rgb, group: color.group });
        counts.set(color.code, (counts.get(color.code) || 0) + 1);
      }
      firstPass.push(row);
      if (y % (isMobileOrWeChat() ? 4 : 12) === 0) await yieldToBrowser();
      if (token !== state.processToken) return;
    }

    const limitedPalette = counts.size > maxColors
      ? [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxColors)
        .map(([code]) => state.palette.find((color) => color.code === code))
        .filter(Boolean)
      : [];

    state.pattern = limitedPalette.length
      ? firstPass.map((row) => row.map((bead) => {
        const color = findClosestMardColor(bead.rgb, limitedPalette);
        return { code: color.code, hex: color.hex, rgb: color.rgb, group: color.group };
      }))
      : firstPass;
    await yieldToBrowser();

    recomputeStats();
    drawBeadPattern();
    renderStats(grid.reduced);
    return grid.reduced;
  }

  async function generateBeadPattern(token) {
    return await generatePattern(token);
  }

  function updateBeadStats(wasReduced = false) {
    recomputeStats();
    renderStats(wasReduced);
  }

  function recomputeStats() {
    const counts = new Map();
    for (const row of state.pattern) {
      for (const bead of row) counts.set(bead.code, (counts.get(bead.code) || 0) + 1);
    }
    const total = state.pattern.length * (state.pattern[0]?.length || 0);
    state.stats = [...counts.entries()].map(([code, count]) => {
      const color = state.palette.find((item) => item.code === code) || { code, hex: '#ffffff', rgb: [255, 255, 255], group: '' };
      return { ...color, count, percent: total ? (count / total) * 100 : 0 };
    }).sort((a, b) => b.count - a.count);
  }

  function drawBeadPattern() {
    if (!state.pattern.length) return;
    const rows = state.pattern.length;
    const cols = state.pattern[0].length;
    const cell = Math.max(5, Math.min(16, Math.floor(980 / Math.max(cols, rows))));
    const canvas = state.beadCanvas;
    canvas.width = cols * cell;
    canvas.height = rows * cell;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const bead = state.pattern[y][x];
        ctx.fillStyle = bead.hex;
        ctx.beginPath();
        ctx.arc(x * cell + cell / 2, y * cell + cell / 2, Math.max(2, cell * 0.42), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawBeadGrid(ctx, cols, rows, cell, 0, 0);
    setCanvasInHost('beadContent', canvas, state.beadView);
  }

  function drawBeadGrid(ctx, cols, rows, beadSize, offsetX = 0, offsetY = 0, force = false) {
    if (!force && !controls.showGrid.checked) return;

    ctx.save();
    ctx.lineCap = 'butt';

    for (let x = 0; x <= cols; x += 1) {
      const strong = x % 10 === 0;
      ctx.beginPath();
      ctx.strokeStyle = strong ? 'rgba(15,23,42,.72)' : 'rgba(15,23,42,.16)';
      ctx.lineWidth = strong ? 1.4 : 0.55;
      const px = offsetX + x * beadSize + 0.5;
      ctx.moveTo(px, offsetY);
      ctx.lineTo(px, offsetY + rows * beadSize);
      ctx.stroke();
    }

    for (let y = 0; y <= rows; y += 1) {
      const strong = y % 10 === 0;
      ctx.beginPath();
      ctx.strokeStyle = strong ? 'rgba(15,23,42,.72)' : 'rgba(15,23,42,.16)';
      ctx.lineWidth = strong ? 1.4 : 0.55;
      const py = offsetY + y * beadSize + 0.5;
      ctx.moveTo(offsetX, py);
      ctx.lineTo(offsetX + cols * beadSize, py);
      ctx.stroke();
    }

    ctx.restore();
  }

  function renderCartoonPreview() {
    if ($('cartoonContent')) {
      setCanvasInHost('cartoonContent', state.cartoonCanvas, state.cartoonView);
    }
  }

  function setCanvasInHost(hostId, canvas, view) {
    const host = $(hostId);
    if (!host.contains(canvas)) {
      host.innerHTML = '';
      host.appendChild(canvas);
    }
    canvas.className = 'preview-canvas';
    applyTransform(hostId, view);
  }

  function applyTransform(hostId, view) {
    const host = $(hostId);
    if (!host) return;
    host.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
  }

  function resetZoom(kind) {
    const view = kind === 'original' ? state.originalView : kind === 'cartoon' ? state.cartoonView : state.beadView;
    view.scale = 1;
    view.x = 0;
    view.y = 0;
    view.dragging = false;
    applyTransform(kind === 'original' ? 'originalContent' : kind === 'cartoon' ? 'cartoonContent' : 'beadContent', view);
  }

  function setupZoomPan(viewportId, hostId, view) {
    const viewport = $(viewportId);
    if (!viewport) return;
    const pointers = new Map();
    let pinchStartDistance = 0;
    let pinchStartScale = 1;

    const pointerDistance = () => {
      const pts = [...pointers.values()];
      if (pts.length < 2) return 0;
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    };

    viewport.addEventListener('wheel', (event) => {
      event.preventDefault();
      view.scale = clamp(view.scale * (event.deltaY < 0 ? 1.12 : 0.88), 0.3, 8);
      applyTransform(hostId, view);
    }, { passive: false });

    viewport.addEventListener('pointerdown', (event) => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 2) {
        view.dragging = false;
        pinchStartDistance = pointerDistance();
        pinchStartScale = view.scale;
      } else {
        view.dragging = true;
        view.px = event.clientX;
        view.py = event.clientY;
      }
      viewport.setPointerCapture(event.pointerId);
    });

    viewport.addEventListener('pointermove', (event) => {
      if (pointers.has(event.pointerId)) {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (pointers.size >= 2 && pinchStartDistance > 0) {
        event.preventDefault();
        view.scale = clamp(pinchStartScale * (pointerDistance() / pinchStartDistance), 0.3, 8);
        applyTransform(hostId, view);
        return;
      }
      if (!view.dragging) return;
      view.x += event.clientX - view.px;
      view.y += event.clientY - view.py;
      view.px = event.clientX;
      view.py = event.clientY;
      applyTransform(hostId, view);
    });

    const endPointer = (event) => {
      pointers.delete(event.pointerId);
      view.dragging = false;
      pinchStartDistance = 0;
      if (pointers.size === 1) {
        const remaining = [...pointers.values()][0];
        view.dragging = true;
        view.px = remaining.x;
        view.py = remaining.y;
      }
    };
    viewport.addEventListener('pointerup', endPointer);
    viewport.addEventListener('pointercancel', endPointer);
  }

  function renderStats(wasReduced = false) {
    const total = state.stats.reduce((sum, row) => sum + row.count, 0);
    const cols = state.pattern[0]?.length || 0;
    const rows = state.pattern.length || 0;
    $('beadMeta').textContent = total
      ? `${cols} × ${rows} = ${total} beads / ${total}颗 · ${state.stats.length} colors / ${state.stats.length}色${wasReduced ? ' · auto-reduced / 已自动减量' : ''}`
      : 'No bead pattern yet / 尚无拼豆图';
    $('statsList').innerHTML = state.stats.map((row) => `
      <div class="stat-row">
        <span class="mini-dot" style="background:${row.hex}"></span>
        <strong>${row.code}</strong>
        <span>${row.hex}</span>
        <span>${row.count} beads</span>
      </div>
    `).join('');
  }

  async function processAll(statusLabel = '正在生成，请稍候… / Generating, please wait...') {
    if (!state.sourceCanvas.width) return;
    const token = ++state.processToken;
    setStatus(statusLabel, 'muted');
    await yieldToBrowser();
    renderOriginalPreview();
    setStatus('正在生成，请稍候… 正在卡通化图片...', 'muted');
    await generateCartoonImage(token);
    if (token !== state.processToken) return;
    setStatus('正在生成，请稍候… 正在生成拼豆图...', 'muted');
    const wasReduced = await generateBeadPattern(token);
    if (token !== state.processToken) return;
    updateBeadStats(Boolean(wasReduced));
    $('workspace')?.classList.remove('hidden');
    setStatus('Ready. All processing stayed inside this browser. / 已完成，全部在浏览器本地处理。', 'success');
  }

  async function handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      setStatus('Please choose an image file. / 请选择图片文件。', 'error');
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      releaseCanvas(state.sourceCanvas);
      releaseCanvas(state.originalCanvas);
      releaseCanvas(state.cartoonCanvas);
      releaseCanvas(state.beadCanvas);
      state.pattern = [];
      state.stats = [];
      state.originalImage = img;
      const sourceSize = fitSize(img.naturalWidth, img.naturalHeight, processingMaxSide());
      state.sourceCanvas.width = sourceSize.width;
      state.sourceCanvas.height = sourceSize.height;
      state.sourceWidth = sourceSize.width;
      state.sourceHeight = sourceSize.height;
      const sourceCtx = state.sourceCanvas.getContext('2d');
      sourceCtx.imageSmoothingEnabled = true;
      sourceCtx.imageSmoothingQuality = 'high';
      sourceCtx.drawImage(img, 0, 0, sourceSize.width, sourceSize.height);
      state.originalImage = null;
      img.onload = null;
      img.onerror = null;
      img.src = '';
      state.imageMeta = `${file.name} · original ${sourceSize.width} × ${sourceSize.height}px processing / 本地处理尺寸 ${sourceSize.width} × ${sourceSize.height}px · ${(file.size / 1024 / 1024).toFixed(2)} MB`;
      $('imageInfo').textContent = state.imageMeta;
      $('workspace')?.classList.remove('hidden');
      $('statsList').innerHTML = '';
      $('beadMeta').textContent = 'Generating bead pattern... / 正在生成拼豆图...';
      resetZoom('original');
      resetZoom('cartoon');
      resetZoom('bead');
      renderOriginalPreview();
      if (isMobileOrWeChat()) {
        controls.gridWidth.value = Math.min(Number(controls.gridWidth.value) || 80, 120);
        controls.maxBeads.value = Math.min(Number(controls.maxBeads.value) || 5000, 20000);
        controls.gridHeight.value = estimateGridHeight(Number(controls.gridWidth.value));
        updateControlLabels();
        setStatus('手机端建议使用较小图片和较低网格尺寸，避免浏览器自动刷新。正在生成，请稍候…', 'muted');
      }
      await processAll();
    };
    img.onerror = () => setStatus('Could not load this image. / 无法读取这张图片。', 'error');
    img.src = url;
  }

  function exportCsv() {
    if (!state.stats.length) {
      setStatus('Generate a bead pattern first. / 请先生成拼豆图。', 'error');
      return;
    }
    const lines = ['Code,Hex,Count', ...state.stats.map((row) => `${row.code},${row.hex},${row.count}`)];
    downloadBlob(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }), 'mard-bead-counts.csv');
  }

  function roundedRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function renderExportCanvasWithLegend(options = {}) {
    const compact = options.compact === true;
    const includeLegend = options.includeLegend !== false;
    const includeGrid = options.includeGrid !== false;
    const highRes = options.highRes !== false;
    const padding = compact ? 20 : 28;
    const cols = state.pattern[0].length;
    const rows = state.pattern.length;
    const maxPatternSide = compact ? 900 : highRes ? 1600 : 1150;
    const cell = Math.max(4, Math.min(compact ? 14 : highRes ? 24 : 18, Math.floor(maxPatternSide / Math.max(cols, rows))));
    const patternW = cols * cell;
    const patternH = rows * cell;
    const legendItemW = compact ? 150 : 180;
    const contentW = compact
      ? Math.max(patternW, Math.min(960, Math.max(640, patternW)))
      : Math.max(patternW, Math.min(720, Math.max(360, patternW)));
    const legendCols = compact
      ? clamp(Math.floor(contentW / legendItemW), 2, 4)
      : Math.max(1, Math.floor(contentW / legendItemW));
    const legendRows = Math.ceil(state.stats.length / legendCols);
    const legendTop = padding + (compact ? 44 : 54) + patternH + (compact ? 18 : 28);
    const legendRowH = compact ? 18 : 26;
    const legendH = includeLegend ? (compact ? 48 : 62) + legendRows * legendRowH : 0;
    const out = document.createElement('canvas');
    out.width = padding * 2 + contentW;
    out.height = includeLegend ? legendTop + legendH + padding : padding + 54 + patternH + padding;
    const ctx = out.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.fillStyle = '#0f172a';
    ctx.font = compact ? '700 18px system-ui, sans-serif' : '700 22px system-ui, sans-serif';
    ctx.fillText('MARD Bead Pattern Studio', padding, padding + 4);
    ctx.font = compact ? '11px system-ui, sans-serif' : '13px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`${cols} × ${rows} · ${cols * rows} beads`, padding, padding + (compact ? 24 : 28));

    const py = padding + (compact ? 44 : 54);
    const patternX = padding + Math.floor((contentW - patternW) / 2);
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const bead = state.pattern[y][x];
        ctx.fillStyle = bead.hex;
        ctx.beginPath();
        ctx.arc(patternX + x * cell + cell / 2, py + y * cell + cell / 2, Math.max(2, cell * 0.42), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (includeGrid) drawBeadGrid(ctx, cols, rows, cell, patternX, py, true);

    if (!includeLegend) return out;

    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    roundedRectPath(ctx, padding, legendTop, contentW, legendH, compact ? 10 : 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = compact ? '700 13px system-ui, sans-serif' : '700 16px system-ui, sans-serif';
    ctx.fillText('Color Legend / 颜色图例', padding + (compact ? 12 : 18), legendTop + (compact ? 22 : 28));
    ctx.font = compact ? '10px system-ui, sans-serif' : '12px system-ui, sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText('Code · HEX · count / 色号 · 数量', padding + (compact ? 12 : 18), legendTop + (compact ? 38 : 46));

    ctx.font = compact ? '10px system-ui, sans-serif' : '12px system-ui, sans-serif';
    state.stats.forEach((row, i) => {
      const col = i % legendCols;
      const line = Math.floor(i / legendCols);
      const x = padding + (compact ? 12 : 18) + col * legendItemW;
      const y = legendTop + (compact ? 58 : 74) + line * legendRowH;
      ctx.fillStyle = row.hex;
      ctx.fillRect(x, y - (compact ? 10 : 13), compact ? 12 : 16, compact ? 12 : 16);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(x, y - (compact ? 10 : 13), compact ? 12 : 16, compact ? 12 : 16);
      ctx.fillStyle = '#0f172a';
      ctx.fillText(`${row.code} ${row.hex} ${row.count}`, x + (compact ? 18 : 24), y);
    });

    return out;
  }

  function exportPng() {
    if (!state.pattern.length) {
      setStatus('Generate a bead pattern first. / 请先生成拼豆图。', 'error');
      return;
    }

    const out = renderExportCanvasWithLegend({ highRes: true, includeLegend: true, includeGrid: true });
    const mobilePreviewWindow = isMobileOrWeChat() ? window.open('', '_blank') : null;
    out.toBlob((blob) => {
      releaseCanvas(out);
      downloadBlob(blob, 'mard-bead-pattern.png', mobilePreviewWindow);
    }, 'image/png');
  }

  function downloadBlob(blob, filename, previewWindow = null) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    if (isMobileOrWeChat() && blob.type.startsWith('image/')) {
      if (previewWindow) {
        previewWindow.location.href = url;
      }
      if (!previewWindow) {
        setStatus('PNG is ready. If download did not start, allow pop-ups or use CSV. / PNG 已生成。如果没有下载，请允许弹窗或使用 CSV。', 'muted');
      } else {
        setStatus('PNG opened. On mobile or WeChat, long-press the full image to save. / PNG 已打开。手机或微信中，请长按下方完整图片保存到相册。', 'success');
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      return;
    }

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openMobileSaveModal() {
    if (!state.pattern.length) return;
    const modal = $('saveModal');
    const image = $('savePreviewImage');
    if (!modal || !image) return;
    const out = renderExportCanvasWithLegend({ compact: true, highRes: true, includeLegend: true, includeGrid: true });
    out.toBlob((blob) => {
      releaseCanvas(out);
      if (!blob) return;
      if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = '';
      const reader = new FileReader();
      reader.onload = () => {
        state.previewDataUrl = reader.result;
        image.src = state.previewDataUrl;
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
      };
      reader.readAsDataURL(blob);
    }, 'image/png');
  }

  function closeBeadPreviewModal() {
    const modal = $('saveModal');
    modal?.classList.add('hidden');
    if (modal) modal.style.display = '';
    const image = $('savePreviewImage');
    if (image) image.removeAttribute('src');
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = '';
    }
    state.previewDataUrl = '';
  }

  function debounce(fn, delay = 320) {
    let timer;
    return (...args) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), delay);
    };
  }

  function debouncedRegeneratePattern() {
    window.clearTimeout(state.regenTimer);
    state.regenTimer = window.setTimeout(async () => {
      if (!state.sourceCanvas.width) return;
      setStatus('正在重新生成... / Regenerating...', 'muted');
      await processAll('正在重新生成... / Regenerating...');
    }, 400);
  }

  function handleParameterInput() {
    controls.gridHeight.value = estimateGridHeight(Number(controls.gridWidth.value));
    updateControlLabels();
    debouncedRegeneratePattern();
  }

  function bindEvents() {
    const fileInput = $('imageInput');
    const dropzone = $('dropzone');
    $('uploadBtn').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (event) => handleImageUpload(event.target.files[0]));

    ['dragenter', 'dragover'].forEach((name) => dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.add('dragging');
    }));
    ['dragleave', 'drop'].forEach((name) => dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      dropzone.classList.remove('dragging');
    }));
    dropzone.addEventListener('drop', (event) => handleImageUpload(event.dataTransfer.files[0]));

    setupZoomPan('originalViewport', 'originalContent', state.originalView);
    setupZoomPan('beadViewport', 'beadContent', state.beadView);
    $('resetOriginal').addEventListener('click', () => resetZoom('original'));
    $('resetBeads').addEventListener('click', () => resetZoom('bead'));
    state.beadCanvas.addEventListener('click', (event) => {
      event.stopPropagation();
      openMobileSaveModal();
    });
    $('closeSaveModal')?.addEventListener('click', closeBeadPreviewModal);
    $('openFullImage')?.addEventListener('click', () => {
      if (state.previewDataUrl || state.previewUrl) window.open(state.previewDataUrl || state.previewUrl, '_blank');
    });
    $('saveModal')?.addEventListener('click', (event) => {
      if (event.target.id === 'saveModal') closeBeadPreviewModal();
    });

    [
      controls.gridWidth,
      controls.maxBeads,
      controls.maxColors,
      controls.cartoonStrength,
      controls.saturation,
      controls.contrast,
      controls.softEdge,
      controls.showGrid,
    ].forEach((control) => {
      control.addEventListener('input', handleParameterInput);
      control.addEventListener('change', handleParameterInput);
    });

    $('exportPng').addEventListener('click', exportPng);
    $('exportCsv').addEventListener('click', exportCsv);
  }

  document.addEventListener('DOMContentLoaded', async () => {
    bindEvents();
    if (isMobileOrWeChat()) {
      $('advancedSettings')?.removeAttribute('open');
      controls.gridWidth.value = 80;
      controls.gridHeight.value = 53;
      controls.maxBeads.value = 5000;
      controls.gridWidth.max = 120;
      controls.gridHeight.max = 120;
      controls.maxBeads.max = 20000;
      controls.maxColors.value = 32;
      controls.cartoonStrength.value = 40;
      controls.saturation.value = 115;
      controls.contrast.value = 110;
      controls.softEdge.value = 30;
    } else {
      controls.gridWidth.value = 120;
      controls.gridHeight.value = 80;
      controls.maxBeads.value = 5000;
      controls.gridWidth.max = 200;
      controls.gridHeight.max = 200;
      controls.maxBeads.max = 20000;
      controls.maxColors.value = 32;
      controls.cartoonStrength.value = 40;
      controls.saturation.value = 115;
      controls.contrast.value = 110;
      controls.softEdge.value = 30;
    }
    updateControlLabels();
    await loadPalette();
    setStatus('Upload an image to begin. / 上传图片开始。');
  });
})();
