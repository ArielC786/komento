document.addEventListener('DOMContentLoaded', function () {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const upload = document.getElementById('fileInput');
    const textInput = document.getElementById('textInput');
    let drawing = false;
    let textMode = false;
    let erasing = false;
    let drawnElements = [];
    let img = null;
    let canvasRatio = 1;
    let currentText = '';
    let textX = 0;
    let textY = 0;
    let isTextMode = false;
    let textStarted = false;
    let textArea = null;
    let textPosition = { x: 0, y: 0 };
    let isTyping = false;
    let textLines = [];
    let currentLine = '';
    let lastEnterTime = 0;
    const LINE_HEIGHT = 24;

    // Resize the canvas to fit screen
    function resizeCanvas(image) {
        const maxWidth = window.innerWidth * 0.95; // 95% of the window width
        const maxHeight = window.innerHeight * 0.9; // 90% of the window height
        const ratio = Math.min(maxWidth / image.width, maxHeight / image.height);

        canvas.width = image.width * ratio;
        canvas.height = image.height * ratio;
        canvasRatio = ratio;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }

    upload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            alert('No file selected!');
            return;
        }
        const reader = new FileReader();
        reader.onload = function (e) {
            const image = new Image();
            image.onload = function () {
                resizeCanvas(image);
            };
            image.onerror = function () {
                alert('Failed to load image!');
            };
            image.src = e.target.result;
        };
        reader.onerror = function () {
            alert('Failed to read file!');
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('pencil').addEventListener('click', () => {
        drawing = true;
        textMode = false;
        erasing = false;
        setActiveTool('pencil');
    });

    document.getElementById('eraser').addEventListener('click', () => {
        drawing = false;
        textMode = false;
        erasing = true;
        setActiveTool('eraser');
    });

    document.getElementById('text').addEventListener('click', () => {
        drawing = false;
        textMode = true;
        erasing = false;
        setActiveTool('text');
    });

    document.getElementById('clear').addEventListener('click', () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawnElements = [];
        img = null; // Clear the image
    });

    document.getElementById('save').addEventListener('click', () => {
        const timestamp = new Date().toISOString().replace(/[-:]/g, '-').split('.')[0];
        const filename = `komento-${timestamp}.png`;

        const link = document.createElement('a');
        link.href = canvas.toDataURL();
        link.download = filename;
        link.click();
    });

    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const offsetX = (e.clientX - rect.left) / canvasRatio;
        const offsetY = (e.clientY - rect.top) / canvasRatio;

        if (drawing) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(offsetX, offsetY);
            drawnElements.push({ type: 'draw', path: [{ x: offsetX, y: offsetY }] });
            canvas.addEventListener('mousemove', draw);
        } else if (textMode) {
            ctx.font = '20px Arial';
            ctx.fillStyle = 'red';
            const text = prompt("Enter text:");
            if (text) {
                ctx.fillText(text, offsetX, offsetY);
                drawnElements.push({ type: 'text', text, x: offsetX, y: offsetY });
            }
        }
    });

    canvas.addEventListener('mouseup', () => {
        if (drawing) {
            canvas.removeEventListener('mousemove', draw);
        }
    });

    function draw(e) {
        const rect = canvas.getBoundingClientRect();
        const offsetX = (e.clientX - rect.left) / canvasRatio;
        const offsetY = (e.clientY - rect.top) / canvasRatio;

        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
        drawnElements[drawnElements.length - 1].path.push({ x: offsetX, y: offsetY });
    }

    function drawAllElements() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (img) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        drawnElements.forEach((element) => {
            if (element.type === 'draw') {
                ctx.beginPath();
                ctx.moveTo(element.path[0].x, element.path[0].y);
                element.path.forEach(point => {
                    ctx.lineTo(point.x, point.y);
                });
                ctx.stroke();
            } else if (element.type === 'text') {
                ctx.font = '20px Arial';
                ctx.fillStyle = 'red';
                ctx.fillText(element.text, element.x, element.y);
            }
        });
    }

    function setActiveTool(buttonId) {
        const buttons = document.querySelectorAll('.icon-button');
        buttons.forEach(button => button.classList.remove('active'));
        document.getElementById(buttonId).classList.add('active');
    }

    // Handle text input
    document.getElementById('text').addEventListener('click', () => {
        textMode = true;
        canvas.style.cursor = 'text';
    });

    canvas.addEventListener('click', (event) => {
        if (textMode) {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            createTextArea(x, y);
        }
    });

    function handleTextInput(event) {
        if (event.key === 'Enter') {
            if (currentText === '') {
                textMode = false;
                canvas.style.cursor = 'default';
                canvas.removeEventListener('keydown', handleTextInput);
            } else {
                currentText += '\n';
            }
        } else {
            currentText += event.key;
            drawText();
        }
    }

    function drawText() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (img) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        ctx.font = '20px Arial';
        ctx.fillStyle = 'red';
        const lines = currentText.split('\n');
        lines.forEach((line, index) => {
            ctx.fillText(line, textX, textY + index * 20);
        });
    }

    canvas.addEventListener('click', function(e) {
        if (isTextMode && !textStarted) {
            textStarted = true;
            const textInput = document.getElementById('textInput');
            textInput.style.display = 'block';
            textInput.style.left = e.clientX + 'px';
            textInput.style.top = e.clientY + 'px';
            textInput.focus();
        }
    });

    textInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.shiftKey) {
            // Allow new line with Shift+Enter
            return;
        }
        
        if (e.key === 'Enter' && !textInput.value.trim()) {
            // Exit text mode on double Enter
            finishTextInput();
            return;
        }
    });

    function finishTextInput() {
        const text = textInput.value.trim();
        if (text) {
            ctx.font = '20px Arial';
            ctx.fillStyle = 'red';
            ctx.fillText(text, textX, textY);
            drawnElements.push({ type: 'text', text, x: textX, y: textY });
        }
        textInput.style.display = 'none';
        textInput.value = '';
        textStarted = false;
        isTextMode = false;
    }

    function createTextArea(x, y) {
        // Remove existing textarea if any
        if (textArea) textArea.remove();
        
        textArea = document.createElement('textarea');
        textArea.style.position = 'absolute';
        textArea.style.left = x + 'px';
        textArea.style.top = y + 'px';
        textArea.style.background = 'transparent';
        textArea.style.border = '1px solid #999';
        textArea.style.color = 'red';
        textArea.style.padding = '0px';
        textArea.style.margin = '0px';
        textArea.style.overflow = 'hidden';
        textArea.style.resize = 'none';
        textArea.style.whiteSpace = 'pre';
        textArea.style.outline = 'none';
        textArea.style.font = '20px Arial';
        document.body.appendChild(textArea);
        textArea.focus();
    }

    function finalizeText() {
        if (!textArea) return;
        
        const lines = textArea.value.split('\n');
        const x = parseInt(textArea.style.left);
        const y = parseInt(textArea.style.top);
        
        ctx.font = '20px Arial';
        ctx.fillStyle = 'red';
        
        lines.forEach((line, index) => {
            const yPos = y + (index * 24); // line height
            drawnElements.push({
                type: 'text',
                text: line,
                x: x,
                y: yPos
            });
            ctx.fillText(line, x, yPos);
        });
        
        textArea.remove();
        textArea = null;
        textMode = false;
    }

    document.addEventListener('keydown', function(e) {
        if (!textArea) return;
        
        if (e.key === 'Enter') {
            // Track consecutive empty enters
            if (textArea.value.trim().endsWith('\n\n')) {
                e.preventDefault();
                finalizeText();
                return;
            }
            // Allow regular enter for new line
            return;
        }
        
        if (e.key === 'Escape') {
            // Cancel text input
            textArea.remove();
            textArea = null;
            textMode = false;
        }
    });

    textBtn.addEventListener('click', () => {
        textMode = !textMode;
        if (!textMode && textArea) {
            finalizeText();
        }
        canvas.style.cursor = textMode ? 'text' : 'default';
    });

    canvas.addEventListener('click', function(e) {
        if (textMode) {
            const rect = canvas.getBoundingClientRect();
            textPosition.x = e.clientX - rect.left;
            textPosition.y = e.clientY - rect.top;
            currentText = '';
            isTyping = true;
            canvas.focus();
        }
    });

    canvas.addEventListener('keydown', function(e) {
        if (!isTyping) return;

        e.preventDefault();

        if (e.key === 'Enter') {
            finishText();
        } else if (e.key === 'Backspace') {
            currentText = currentText.slice(0, -1);
            redrawWithCurrentText();
        } else if (e.key === 'Escape') {
            isTyping = false;
            currentText = '';
            redraw();
        } else if (e.key.length === 1) {
            currentText += e.key;
            redrawWithCurrentText();
        }
    });

    function finishText() {
        if (currentText) {
            drawnElements.push({
                type: 'text',
                text: currentText,
                x: textPosition.x,
                y: textPosition.y
            });
        }
        isTyping = false;
        currentText = '';
        redraw();
    }

    function redrawWithCurrentText() {
        redraw();
        if (currentText) {
            ctx.font = '20px Arial';
            ctx.fillStyle = 'red';
            ctx.fillText(currentText, textPosition.x, textPosition.y);
        }
    }

    function redraw() {
        drawAllElements();
    }

    function handleTextInput(e) {
        if (!isTyping) return;
        e.preventDefault();

        const now = Date.now();
        if (e.key === 'Enter') {
            if (now - lastEnterTime < 500) {
                // Double Enter detected - finish text input
                finalizeText();
                return;
            }
            // Single Enter - add new line
            textLines.push(currentLine);
            currentLine = '';
            lastEnterTime = now;
        } else if (e.key === 'Backspace') {
            if (currentLine.length > 0) {
                currentLine = currentLine.slice(0, -1);
            } else if (textLines.length > 0) {
                currentLine = textLines.pop();
            }
        } else if (e.key.length === 1) {
            currentLine += e.key;
        }
        
        redrawText();
    }

    function redrawText() {
        redraw();
        ctx.font = '20px Arial';
        ctx.fillStyle = 'red';
        
        // Draw completed lines
        textLines.forEach((line, index) => {
            ctx.fillText(line, textX, textY + (index * LINE_HEIGHT));
        });
        
        // Draw current line
        ctx.fillText(currentLine, textX, textY + (textLines.length * LINE_HEIGHT));
    }

    function finalizeText() {
        if (currentLine) {
            textLines.push(currentLine);
        }
        
        if (textLines.length > 0) {
            drawnElements.push({
                type: 'multilineText',
                lines: [...textLines],
                x: textX,
                y: textY,
                lineHeight: LINE_HEIGHT
            });
        }
        
        // Reset text state
        textLines = [];
        currentLine = '';
        isTyping = false;
        redraw();
    }

    canvas.addEventListener('click', function(e) {
        if (textMode) {
            const rect = canvas.getBoundingClientRect();
            textX = e.clientX - rect.left;
            textY = e.clientY - rect.top;
            isTyping = true;
            textLines = [];
            currentLine = '';
            canvas.focus();
        }
    });

    canvas.addEventListener('keydown', handleTextInput);
});
