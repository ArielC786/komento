document.addEventListener('DOMContentLoaded', function () {
    // DOM elements
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const selectBtn = document.getElementById('selectBtn');
    const textBtn = document.getElementById('textBtn');
    const drawBtn = document.getElementById('drawBtn');
    const cameraBtn = document.getElementById('cameraBtn');
    const eraseBtn = document.getElementById('eraseBtn');
    const sizePicker = document.getElementById('sizePicker');
    const colorPalette = document.getElementById('colorPalette');
    const strokeSize = document.getElementById('strokeSize');
    const strokeSizeValue = document.getElementById('strokeSizeValue');
    const undoBtn = document.getElementById('undoBtn');
    const defaultStrokeWidth = strokeSize ? Number(strokeSize.value) : 2;

    // State variables
    let drawing = false;
    let textMode = false;
    let isDrawing = false;
    let lastX = 0;
    let lastY = 0;
    const currentFileName = "canvas";
    let saveCounter = 1;
    let bgImage = null;
    let eraseMode = false;
    let strokeColor = '#FF0044';
    let strokeWidth = defaultStrokeWidth;
    let fontSize = 20;
    const activeClass = 'active';
    let draggingText = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let textInputOpen = false;
    let currentTextInputContainer = null;
    let importedFileBaseName = 'image';

    // Add drawnElements array to track drawings
    let drawnElements = [];
    let currentStroke = null;
    let selectMode = false;
    let draggingSelection = null;
    let selectionOffsetX = 0;
    let selectionOffsetY = 0;
    let lastDragX = 0;
    let lastDragY = 0;

    function getTextMetrics(text, size) {
        const lines = String(text).split('\n');
        ctx.font = `${size}px Arial`;
        let maxWidth = 0;
        for (const line of lines) {
            const width = ctx.measureText(line).width;
            if (width > maxWidth) maxWidth = width;
        }
        const lineHeight = Math.round(size * 1.25);
        const height = size + (lines.length - 1) * lineHeight;
        return { lines, maxWidth, height, lineHeight };
    }

    function drawTextElement(element) {
        const size = element.size || fontSize;
        const color = element.color || strokeColor;
        const { lines, lineHeight } = getTextMetrics(element.text, size);
        ctx.font = `${size}px Arial`;
        ctx.fillStyle = color;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], element.x, element.y + i * lineHeight);
        }
    }

    // Set initial canvas size
    function initCanvas() {
        const displayWidth = window.innerWidth * 0.8;
        const displayHeight = window.innerHeight * 0.8;
        
        // Set both CSS and canvas dimensions
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';
    }

    // Mouse position calculation
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    // Drawing handlers
    function setActiveTool(btn) {
        [selectBtn, uploadBtn, drawBtn, textBtn, eraseBtn, cameraBtn].forEach(b => {
            if (b) b.classList.remove(activeClass);
        });
        if (btn) btn.classList.add(activeClass);
    }

    function translateElement(element, dx, dy) {
        if (!element) return;
        if (element.type === 'path') {
            const pts = element.points || [];
            for (const p of pts) {
                p.x += dx;
                p.y += dy;
            }
            return;
        }
        if (element.type === 'dot') {
            element.x += dx;
            element.y += dy;
            return;
        }
        if (element.type === 'text') {
            element.x += dx;
            element.y += dy;
        }
    }

    function findDrawableAtPos(pos) {
        for (let i = drawnElements.length - 1; i >= 0; i--) {
            const element = drawnElements[i];

            if (element.type === 'text') {
                const size = element.size || fontSize;
                const { maxWidth, height } = getTextMetrics(element.text, size);
                const left = element.x;
                const right = element.x + maxWidth;
                const top = element.y - size;
                const bottom = element.y - size + height;
                if (pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom) return element;
                continue;
            }

            const width = element.width || strokeWidth;
            const threshold = Math.max(10, width * 1.25);

            if (element.type === 'dot') {
                if (Math.hypot(pos.x - element.x, pos.y - element.y) <= threshold) return element;
                continue;
            }

            if (element.type === 'path') {
                const points = element.points || [];
                if (points.length <= 1) {
                    const p = points[0];
                    if (!p) continue;
                    if (Math.hypot(pos.x - p.x, pos.y - p.y) <= threshold) return element;
                    continue;
                }
                for (let j = 0; j < points.length - 1; j++) {
                    const segment = { x1: points[j].x, y1: points[j].y, x2: points[j + 1].x, y2: points[j + 1].y };
                    if (pointToLineDistance(pos, segment) <= threshold) return element;
                }
            }
        }
        return null;
    }

    function setSelectMode() {
        selectMode = true;
        drawing = false;
        textMode = false;
        eraseMode = false;
        isDrawing = false;
        currentStroke = null;
        draggingText = null;
        draggingSelection = null;
        setActiveTool(selectBtn);
        canvas.style.cursor = 'default';
    }

    if (selectBtn) {
        selectBtn.addEventListener('click', setSelectMode);
    }

    function undoLastAction() {
        if (isDrawing && currentStroke) {
            currentStroke = null;
            isDrawing = false;
            return;
        }
        if (drawnElements.length === 0) return;
        drawnElements.pop();
        redrawCanvas();
    }

    if (undoBtn) undoBtn.addEventListener('click', undoLastAction);

    function setStrokeColor(color) {
        strokeColor = color;
        ctx.strokeStyle = strokeColor;

        if (colorPalette) {
            const swatches = colorPalette.querySelectorAll('.color-swatch');
            swatches.forEach((btn) => {
                const isSelected = (btn.getAttribute('data-color') || '').toLowerCase() === String(color).toLowerCase();
                btn.classList.toggle('selected', isSelected);
            });
        }
    }

    if (colorPalette) {
        const swatches = colorPalette.querySelectorAll('.color-swatch');
        swatches.forEach((btn) => {
            const color = btn.getAttribute('data-color');
            if (color) btn.style.backgroundColor = color;
            btn.addEventListener('click', () => {
                if (!color) return;
                setStrokeColor(color);
            });
        });
        setStrokeColor(strokeColor);
    }

    function setStrokeWidth(width) {
        const next = Math.max(1, Math.min(30, Number(width) || 1));
        strokeWidth = next;
        ctx.lineWidth = strokeWidth;
        if (strokeSizeValue) strokeSizeValue.textContent = String(strokeWidth);
        if (strokeSize) strokeSize.value = String(strokeWidth);
    }

    if (strokeSize) {
        strokeSize.addEventListener('input', () => setStrokeWidth(strokeSize.value));
        setStrokeWidth(strokeSize.value);
    } else {
        setStrokeWidth(strokeWidth);
    }

    drawBtn.addEventListener('click', () => {
        selectMode = false;
        drawing = true;
        textMode = false;
        eraseMode = false;
        setActiveTool(drawBtn);
        canvas.style.cursor = 'crosshair';
        if (colorPalette) colorPalette.classList.remove('palette-disabled');
        setStrokeWidth(defaultStrokeWidth);
    });

    function finalizeCurrentStroke() {
        if (!currentStroke) return;
        if (currentStroke.points.length <= 1) {
            const p = currentStroke.points[0];
            drawnElements.push({
                type: 'dot',
                x: p.x,
                y: p.y,
                color: currentStroke.color,
                width: currentStroke.width
            });
        } else {
            drawnElements.push(currentStroke);
        }
        currentStroke = null;
        redrawCanvas();
    }

    canvas.addEventListener('mousedown', (e) => {
        if (selectMode) {
            const pos = getMousePos(e);
            const target = findDrawableAtPos(pos);
            if (target) {
                draggingSelection = target;
                if (target.type === 'text') {
                    selectionOffsetX = pos.x - target.x;
                    selectionOffsetY = pos.y - target.y;
                } else {
                    lastDragX = pos.x;
                    lastDragY = pos.y;
                }
            }
            return;
        }
        if (eraseMode) {
            isDrawing = true;
            erase(e);
        } else if (drawing) {
            isDrawing = true;
            const pos = getMousePos(e);
            currentStroke = {
                type: 'path',
                points: [{ x: pos.x, y: pos.y }],
                color: strokeColor,
                width: strokeWidth
            };
            [lastX, lastY] = [pos.x, pos.y];
        } else if (textMode) {
            const pos = getMousePos(e);
            const target = findTextAtPos(pos);
            if (target) {
                draggingText = target;
                dragOffsetX = pos.x - target.x;
                dragOffsetY = pos.y - target.y;
            }
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing && !draggingText && !draggingSelection) return;

        if (draggingSelection) {
            const pos = getMousePos(e);
            if (draggingSelection.type === 'text') {
                draggingSelection.x = pos.x - selectionOffsetX;
                draggingSelection.y = pos.y - selectionOffsetY;
            } else {
                const dx = pos.x - lastDragX;
                const dy = pos.y - lastDragY;
                translateElement(draggingSelection, dx, dy);
                lastDragX = pos.x;
                lastDragY = pos.y;
            }
            redrawCanvas();
            return;
        }
        
        if (eraseMode) {
            erase(e);
        } else if (drawing) {
            const pos = getMousePos(e);
            if (!currentStroke) {
                currentStroke = {
                    type: 'path',
                    points: [{ x: lastX, y: lastY }],
                    color: strokeColor,
                    width: strokeWidth
                };
            }
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            currentStroke.points.push({ x: pos.x, y: pos.y });
            
            [lastX, lastY] = [pos.x, pos.y];
        } else if (textMode && draggingText) {
            const pos = getMousePos(e);
            draggingText.x = pos.x - dragOffsetX;
            draggingText.y = pos.y - dragOffsetY;
            redrawCanvas();
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (drawing && isDrawing) finalizeCurrentStroke();
        isDrawing = false;
        draggingText = null;
        draggingSelection = null;
    });
    canvas.addEventListener('mouseout', () => {
        if (drawing && isDrawing) finalizeCurrentStroke();
        isDrawing = false;
        draggingSelection = null;
    });

    // Upload functionality
    uploadBtn.addEventListener('click', () => {
        selectMode = false;
        setActiveTool(uploadBtn);
        fileInput.value = '';
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        importedFileBaseName = file.name ? file.name.split('.')[0] : 'image';
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            handleImportedImage(img);
        };
        img.src = url;
    });

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function createFittedCoverTransform(image, targetWidth, targetHeight) {
        const baseScale = Math.min(targetWidth / image.width, targetHeight / image.height);
        const scaledWidth = image.width * baseScale;
        const scaledHeight = image.height * baseScale;
        return {
            baseScale,
            zoom: 1,
            panX: (targetWidth - scaledWidth) / 2,
            panY: (targetHeight - scaledHeight) / 2
        };
    }

    function clampPan(image, targetWidth, targetHeight, scale, panX, panY) {
        const scaledWidth = image.width * scale;
        const scaledHeight = image.height * scale;

        if (scaledWidth <= targetWidth) {
            panX = (targetWidth - scaledWidth) / 2;
        } else {
            panX = clamp(panX, targetWidth - scaledWidth, 0);
        }

        if (scaledHeight <= targetHeight) {
            panY = (targetHeight - scaledHeight) / 2;
        } else {
            panY = clamp(panY, targetHeight - scaledHeight, 0);
        }

        return { panX, panY };
    }

    function createCommittedBackgroundCanvas(image, targetWidth, targetHeight, scale, panX, panY) {
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = targetWidth;
        bgCanvas.height = targetHeight;
        const bgCtx = bgCanvas.getContext('2d');
        bgCtx.fillStyle = '#FFFFFF';
        bgCtx.fillRect(0, 0, targetWidth, targetHeight);
        bgCtx.drawImage(image, panX, panY, image.width * scale, image.height * scale);
        return bgCanvas;
    }

    function openImageZoomDialog(image) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.55);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: #FFFFFF;
            border-radius: 10px;
            padding: 14px;
            width: min(920px, calc(100vw - 28px));
            box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        `;

        const previewCanvas = document.createElement('canvas');
        previewCanvas.width = canvas.width;
        previewCanvas.height = canvas.height;
        previewCanvas.style.cssText = `
            width: 100%;
            height: auto;
            max-height: min(70vh, 640px);
            background: #FFFFFF;
            border: 1px solid #D0D0D0;
            display: block;
            cursor: grab;
            user-select: none;
        `;
        const pctx = previewCanvas.getContext('2d');

        const controls = document.createElement('div');
        controls.style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 12px;
        `;

        const zoomLabel = document.createElement('div');
        zoomLabel.textContent = 'Zoom';
        zoomLabel.style.cssText = `
            font-family: Arial, sans-serif;
            font-size: 12px;
            color: #333;
            width: 40px;
        `;

        const zoomSlider = document.createElement('input');
        zoomSlider.type = 'range';
        zoomSlider.min = '1';
        zoomSlider.max = '6';
        zoomSlider.step = '0.01';
        zoomSlider.value = '1';
        zoomSlider.style.cssText = `
            flex: 1;
        `;

        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.style.cssText = `
            padding: 6px 12px;
            cursor: pointer;
            border: none;
            border-radius: 6px;
            background: #000;
            color: #fff;
            font-size: 12px;
        `;

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'CANCEL';
        cancelButton.style.cssText = `
            padding: 6px 12px;
            cursor: pointer;
            border: 1px solid #C0C0C0;
            border-radius: 6px;
            background: #fff;
            color: #111;
            font-size: 12px;
        `;

        controls.appendChild(zoomLabel);
        controls.appendChild(zoomSlider);
        controls.appendChild(okButton);
        controls.appendChild(cancelButton);

        modal.appendChild(previewCanvas);
        modal.appendChild(controls);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        let { baseScale, zoom, panX, panY } = createFittedCoverTransform(image, previewCanvas.width, previewCanvas.height);
        let isPanning = false;
        let lastClientX = 0;
        let lastClientY = 0;

        function getPreviewPos(evt) {
            const rect = previewCanvas.getBoundingClientRect();
            const scaleX = previewCanvas.width / rect.width;
            const scaleY = previewCanvas.height / rect.height;
            return {
                x: (evt.clientX - rect.left) * scaleX,
                y: (evt.clientY - rect.top) * scaleY
            };
        }

        function render() {
            const scale = baseScale * zoom;
            const clamped = clampPan(image, previewCanvas.width, previewCanvas.height, scale, panX, panY);
            panX = clamped.panX;
            panY = clamped.panY;

            pctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            pctx.fillStyle = '#FFFFFF';
            pctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
            pctx.drawImage(image, panX, panY, image.width * scale, image.height * scale);
        }

        function cleanup() {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }

        function onKeyDown(e) {
            if (e.key === 'Escape') {
                cancelButton.click();
            }
        }

        window.addEventListener('keydown', onKeyDown);

        previewCanvas.addEventListener('mousedown', (e) => {
            isPanning = true;
            previewCanvas.style.cursor = 'grabbing';
            lastClientX = e.clientX;
            lastClientY = e.clientY;
        });

        function onMouseMove(e) {
            if (!isPanning) return;
            const dx = e.clientX - lastClientX;
            const dy = e.clientY - lastClientY;
            lastClientX = e.clientX;
            lastClientY = e.clientY;

            const rect = previewCanvas.getBoundingClientRect();
            const scaleX = previewCanvas.width / rect.width;
            const scaleY = previewCanvas.height / rect.height;

            panX += dx * scaleX;
            panY += dy * scaleY;
            render();
        }

        function onMouseUp() {
            if (!isPanning) return;
            isPanning = false;
            previewCanvas.style.cursor = 'grab';
        }

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);

        previewCanvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const pos = getPreviewPos(e);
            const previousZoom = zoom;
            const delta = e.deltaY > 0 ? 0.92 : 1.08;
            zoom = clamp(zoom * delta, 1, 6);
            zoomSlider.value = String(zoom);

            const prevScale = baseScale * previousZoom;
            const nextScale = baseScale * zoom;
            const imgX = (pos.x - panX) / prevScale;
            const imgY = (pos.y - panY) / prevScale;
            panX = pos.x - imgX * nextScale;
            panY = pos.y - imgY * nextScale;

            render();
        }, { passive: false });

        zoomSlider.addEventListener('input', () => {
            const pos = { x: previewCanvas.width / 2, y: previewCanvas.height / 2 };
            const previousZoom = zoom;
            zoom = Number(zoomSlider.value);

            const prevScale = baseScale * previousZoom;
            const nextScale = baseScale * zoom;
            const imgX = (pos.x - panX) / prevScale;
            const imgY = (pos.y - panY) / prevScale;
            panX = pos.x - imgX * nextScale;
            panY = pos.y - imgY * nextScale;

            render();
        });

        render();

        return new Promise((resolve) => {
            okButton.onclick = () => {
                const scale = baseScale * zoom;
                const clamped = clampPan(image, canvas.width, canvas.height, scale, panX, panY);
                const bgCanvas = createCommittedBackgroundCanvas(image, canvas.width, canvas.height, scale, clamped.panX, clamped.panY);
                cleanup();
                resolve(bgCanvas);
            };

            cancelButton.onclick = () => {
                cleanup();
                resolve(null);
            };

            overlay.addEventListener('mousedown', (e) => {
                if (e.target === overlay) {
                    cancelButton.click();
                }
            });
        });
    }

    async function handleImportedImage(image) {
        initCanvas();
        const committedCanvas = await openImageZoomDialog(image);
        if (!committedCanvas) return;

        drawnElements = [];
        const committedImage = new Image();
        committedImage.onload = () => {
            bgImage = committedImage;
            redrawCanvas();
        };
        committedImage.src = committedCanvas.toDataURL('image/png');
    }

    // Text functionality
    textBtn.addEventListener('click', () => {
        selectMode = false;
        drawing = false;
        textMode = true;
        eraseMode = false;
        setActiveTool(textBtn);
        canvas.style.cursor = 'text';
        if (colorPalette) colorPalette.classList.remove('palette-disabled');
    });

    // Add this function to create custom text input UI
    function createTextInput(x, y, initialValue = '') {
        // Create container div for the text input UI
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            background: white;
            border: 1px solid black;
            padding: 5px;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 5px;
        `;

        const textInput = document.createElement('textarea');
        textInput.rows = 2;
        textInput.style.cssText = `
            width: 320px;
            height: 60px;
            border: 1px solid #ccc;
            padding: 6px;
            resize: both;
            font-family: Arial, sans-serif;
            font-size: 14px;
            line-height: 18px;
        `;
        textInput.value = initialValue;

        // Create OK button
        const okButton = document.createElement('button');
        okButton.textContent = 'OK';
        okButton.style.cssText = `
            padding: 5px 10px;
            cursor: pointer;
            height: 30px;
        `;

        // Create Cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'CANCEL';
        cancelButton.style.cssText = `
            padding: 5px 10px;
            cursor: pointer;
            height: 30px;
        `;

        // Add elements to input container
        inputContainer.appendChild(textInput);
        inputContainer.appendChild(okButton);
        inputContainer.appendChild(cancelButton);

        document.body.appendChild(inputContainer);
        textInput.focus();
        textInputOpen = true;
        currentTextInputContainer = inputContainer;

        // Return promise for handling the result
        return new Promise((resolve, reject) => {
            function hasNonWhitespace(value) {
                return /\S/.test(value);
            }

            okButton.disabled = !hasNonWhitespace(textInput.value);
            textInput.addEventListener('input', () => {
                okButton.disabled = !hasNonWhitespace(textInput.value);
            });
            okButton.onclick = () => {
                const rawText = textInput.value.replace(/\r\n/g, '\n');
                if (!hasNonWhitespace(rawText)) return;
                document.body.removeChild(inputContainer);
                textInputOpen = false;
                currentTextInputContainer = null;
                resolve(rawText);
            };

            cancelButton.onclick = () => {
                document.body.removeChild(inputContainer);
                textInputOpen = false;
                currentTextInputContainer = null;
                resolve(null);
            };

        textInput.onkeydown = (e) => {
            if (e.key === 'Escape') {
                cancelButton.click();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                okButton.click();
            }
        };
        });
    }

    // Modify the text click handler
    canvas.addEventListener('click', async (e) => {
        if (!textMode) return;
        if (textInputOpen) return;
        const pos = getMousePos(e);
        if (findTextAtPos(pos)) return;
        const text = await createTextInput(e.clientX, e.clientY);
        if (text) {
            drawnElements.push({
                type: 'text',
                text: text,
                x: pos.x,
                y: pos.y + 5,
                color: strokeColor,
                size: fontSize
            });
            redrawCanvas();
        }
    });

    canvas.addEventListener('dblclick', async (e) => {
        if (textInputOpen) return;
        const pos = getMousePos(e);
        const target = findTextAtPos(pos);
        if (!target) return;

        draggingText = null;
        const updatedText = await createTextInput(e.clientX, e.clientY, target.text);
        if (updatedText === null) return;

        target.text = updatedText;
        redrawCanvas();
    });

    // Modify the camera/download button functionality
    cameraBtn.addEventListener('click', () => {
        selectMode = false;
        setActiveTool(cameraBtn);
        const commentTitleInput = window.prompt('COMMENT TITLE ?', '');
        if (commentTitleInput === null) return;
        const commentTitle = commentTitleInput.trim();

        // Create a temporary canvas to add the text stamp
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        // Set temp canvas size to match main canvas
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        
        // Fill with white background
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Copy current canvas content to temp canvas
        tempCtx.drawImage(canvas, 0, 0);
        
        // Get original filename but force jpg extension
        let originalFilename = importedFileBaseName || 'image';
        
        // Limit filename length to 25 characters
        if (originalFilename.length > 25) {
            originalFilename = originalFilename.substring(0, 25) + '...';
        }
        
        // Format date
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit'
        });
        
        // Create stamp text with 'edg' suffix
        const stampText = `${commentTitle ? `${commentTitle} ` : ''}${originalFilename}.jpg ${dateStr} edg`;
        
        // Set text style
        const stampFontSize = 16;
        tempCtx.font = `${stampFontSize}px Arial`;
        tempCtx.fillStyle = strokeColor;
        
        // Position text at bottom right corner with padding
        const padding = 20;
        const textWidth = tempCtx.measureText(stampText).width;
        const textX = tempCanvas.width - textWidth - padding;
        const textY = tempCanvas.height - padding;
        const textHeight = stampFontSize;
        const boxPadX = 6;
        const boxPadY = 4;
        const boxX = textX - boxPadX;
        const boxY = textY - textHeight - boxPadY;
        const boxW = textWidth + boxPadX * 2;
        const boxH = textHeight + boxPadY * 2;

        // Draw white rectangle behind stamp text for readability
        tempCtx.save();
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(boxX, boxY, boxW, boxH);
        tempCtx.restore();
        
        // Add text to canvas on top of white background
        tempCtx.fillText(stampText, textX, textY);
        
        // Create download link with jpg extension
        const link = document.createElement('a');
        link.download = `${originalFilename}-K${saveCounter}.jpg`;
        link.href = tempCanvas.toDataURL('image/jpeg', 0.9);
        link.click();
        
        saveCounter++;
    });

    // Add eraser button handler
    eraseBtn.addEventListener('click', () => {
        selectMode = false;
        drawing = false;
        textMode = false;
        eraseMode = true;
        setActiveTool(eraseBtn);
        canvas.style.cursor = 'cell';
        if (colorPalette) colorPalette.classList.remove('palette-disabled');
        setStrokeWidth(defaultStrokeWidth);
        // Alternative cursors you could use:
        // canvas.style.cursor = 'crosshair';
        // canvas.style.cursor = 'pointer';
    });

    // Add redraw function
    function redrawCanvas() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw background image if exists
        if (bgImage) {
            ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
        }
        
        // Redraw all elements
        drawnElements.forEach(element => {
            if (element.type === 'line') {
                ctx.strokeStyle = element.color || strokeColor;
                ctx.lineWidth = element.width || strokeWidth;
                ctx.beginPath();
                ctx.moveTo(element.x1, element.y1);
                ctx.lineTo(element.x2, element.y2);
                ctx.stroke();
            } else if (element.type === 'path') {
                ctx.strokeStyle = element.color || strokeColor;
                ctx.lineWidth = element.width || strokeWidth;
                ctx.beginPath();
                const pts = element.points || [];
                if (pts.length > 0) {
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) {
                        ctx.lineTo(pts[i].x, pts[i].y);
                    }
                    ctx.stroke();
                }
            } else if (element.type === 'dot') {
                ctx.fillStyle = element.color || strokeColor;
                const radius = Math.max(1, (element.width || strokeWidth) / 2);
                ctx.beginPath();
                ctx.arc(element.x, element.y, radius, 0, Math.PI * 2);
                ctx.fill();
            } else if (element.type === 'text') {
                drawTextElement(element);
            }
        });
    }

    // Modify erase function to better handle text elements
    function erase(e) {
        const pos = getMousePos(e);
        const eraseRadius = Math.max(6, strokeWidth * 2.5);
        
        // Filter out elements near the eraser
        drawnElements = drawnElements.filter(element => {
            if (element.type === 'line') {
                const dist = pointToLineDistance(pos, element);
                return dist > eraseRadius;
            } else if (element.type === 'path') {
                const points = element.points || [];
                if (points.length <= 1) {
                    const p = points[0];
                    if (!p) return true;
                    return Math.hypot(pos.x - p.x, pos.y - p.y) > eraseRadius;
                }
                for (let i = 0; i < points.length - 1; i++) {
                    const segment = { x1: points[i].x, y1: points[i].y, x2: points[i + 1].x, y2: points[i + 1].y };
                    if (pointToLineDistance(pos, segment) <= eraseRadius) return false;
                }
                return true;
            } else if (element.type === 'dot') {
                return Math.hypot(pos.x - element.x, pos.y - element.y) > eraseRadius;
            } else if (element.type === 'text') {
                const size = element.size || fontSize;
                const { maxWidth, height } = getTextMetrics(element.text, size);
                
                // Check if click is within text bounding box
                const textLeft = element.x;
                const textRight = element.x + maxWidth;
                const textTop = element.y - size;
                const textBottom = element.y - size + height;
                
                // If click is within text bounds, remove the text
                if (pos.x >= textLeft && pos.x <= textRight && 
                    pos.y >= textTop && pos.y <= textBottom) {
                    return false; // Remove text element
                }
                return true; // Keep text element
            }
            return true;
        });
        
        // Redraw canvas
        redrawCanvas();
    }

    // Add helper function for line distance calculation
    function pointToLineDistance(point, line) {
        const A = point.x - line.x1;
        const B = point.y - line.y1;
        const C = line.x2 - line.x1;
        const D = line.y2 - line.y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = line.x1;
            yy = line.y1;
        } else if (param > 1) {
            xx = line.x2;
            yy = line.y2;
        } else {
            xx = line.x1 + param * C;
            yy = line.y1 + param * D;
        }
        
        return Math.hypot(point.x - xx, point.y - yy);
    }

    function resizeCanvas(image) {
        if (!image) return;

        // Get container and toolbar elements
        const container = document.querySelector('.container');
        const toolbar = document.querySelector('.toolbar');
        
        // Calculate available space
        const containerPadding = 20; // Account for container padding
        const maxWidth = window.innerWidth * 0.8;
        const maxHeight = window.innerHeight - toolbar.offsetHeight - containerPadding;
        
        let width = image.width;
        let height = image.height;

        // Calculate scaling ratio while preserving aspect ratio
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        
        // Reset context properties
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.lineCap = 'round';

        // Draw the image
        ctx.drawImage(image, 0, 0, width, height);
    }

    // Add restart button functionality
    const restartBtn = document.getElementById('restartBtn');
    restartBtn.addEventListener('click', () => {
        location.reload();
    });

    // Add clipboard paste handler
    document.addEventListener('paste', (e) => {
        e.preventDefault();
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        
        for (let item of items) {
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        importedFileBaseName = 'pasted-image';
                        handleImportedImage(img);
                    };
                    img.src = event.target.result;
                };
                
                reader.readAsDataURL(blob);
                break;
            }
        }
    });

    // Add context menu handler
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();  // Prevent default context menu
        
        // Remove any existing context menu
        const existingMenu = document.querySelector('.context-menu');
        if (existingMenu) {
            document.body.removeChild(existingMenu);
        }
        
        // Create custom context menu
        const contextMenu = document.createElement('div');
        contextMenu.className = 'context-menu';
        contextMenu.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            background: white;
            border: 1px solid #ccc;
            padding: 2px;
            cursor: pointer;
            z-index: 1000;
            box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
            transform: scale(0.8);
            transform-origin: top left;
        `;
        
        // Add Paste option
        const pasteOption = document.createElement('div');
        pasteOption.textContent = 'Paste';
        pasteOption.style.cssText = `
            padding: 3px 6px;
            font-size: 12px;
            font-family: Arial, sans-serif;
        `;
        
        pasteOption.onmouseover = () => {
            pasteOption.style.backgroundColor = '#f0f0f0';
        };
        
        pasteOption.onmouseout = () => {
            pasteOption.style.backgroundColor = 'white';
        };
        
        pasteOption.onclick = () => {
            navigator.clipboard.read().then(data => {
                for (const item of data) {
                    if (item.types.includes('image/png')) {
                        item.getType('image/png').then(blob => {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const img = new Image();
                                img.onload = () => {
                                    importedFileBaseName = 'pasted-image';
                                    handleImportedImage(img);
                                };
                                img.src = event.target.result;
                            };
                            reader.readAsDataURL(blob);
                        });
                    }
                }
            });
            removeContextMenu();
        };
        
        contextMenu.appendChild(pasteOption);
        document.body.appendChild(contextMenu);
        
        // Function to remove context menu
        function removeContextMenu() {
            if (contextMenu && contextMenu.parentNode) {
                document.body.removeChild(contextMenu);
            }
        }
        
        // Remove menu on any click outside
        setTimeout(() => {
            const clickHandler = (event) => {
                if (!contextMenu.contains(event.target)) {
                    removeContextMenu();
                    document.removeEventListener('click', clickHandler);
                    document.removeEventListener('contextmenu', clickHandler);
                }
            };
            
            document.addEventListener('click', clickHandler);
            document.addEventListener('contextmenu', clickHandler);
        }, 0);
    });

    // Initialize canvas

    

    
    function findTextAtPos(pos) {
        for (let i = drawnElements.length - 1; i >= 0; i--) {
            const element = drawnElements[i];
            if (element.type !== 'text') continue;
            const size = element.size || fontSize;
            const { maxWidth, height } = getTextMetrics(element.text, size);
            const left = element.x;
            const right = element.x + maxWidth;
            const top = element.y - size;
            const bottom = element.y - size + height;
            if (pos.x >= left && pos.x <= right && pos.y >= top && pos.y <= bottom) {
                return element;
            }
        }
        return null;
    }

    

    initCanvas();
});
