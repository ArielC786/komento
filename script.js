document.addEventListener('DOMContentLoaded', function () {
    // DOM elements
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const textBtn = document.getElementById('textBtn');
    const drawBtn = document.getElementById('drawBtn');
    const cameraBtn = document.getElementById('cameraBtn');
    const eraseBtn = document.getElementById('eraseBtn');

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

    // Add drawnElements array to track drawings
    let drawnElements = [];

    // Set initial canvas size
    function initCanvas() {
        const displayWidth = window.innerWidth * 0.8;
        const displayHeight = window.innerHeight * 0.8;
        
        // Set both CSS and canvas dimensions
        canvas.style.width = `${displayWidth}px`;
        canvas.style.height = `${displayHeight}px`;
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        
        // Change stroke color to neon red
        ctx.strokeStyle = '#FF0044';  // Neon red color
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
    }

    // Mouse position calculation
    function getMousePos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    // Drawing handlers
    drawBtn.addEventListener('click', () => {
        drawing = true;
        textMode = false;
        eraseMode = false;
        canvas.style.cursor = 'crosshair';
    });

    canvas.addEventListener('mousedown', (e) => {
        if (eraseMode) {
            isDrawing = true;
            erase(e);
        } else if (drawing) {
            isDrawing = true;
            const pos = getMousePos(e);
            [lastX, lastY] = [pos.x, pos.y];
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        
        if (eraseMode) {
            erase(e);
        } else if (drawing) {
            const pos = getMousePos(e);
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
            
            // Store the drawn line
            drawnElements.push({
                type: 'line',
                x1: lastX,
                y1: lastY,
                x2: pos.x,
                y2: pos.y
            });
            
            [lastX, lastY] = [pos.x, pos.y];
        }
    });

    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseout', () => isDrawing = false);

    // Upload functionality
    uploadBtn.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        drawnElements = []; // Reset drawings
        bgImage = new Image();
        bgImage.onload = () => {
            resizeCanvas(bgImage);
        };
        bgImage.src = URL.createObjectURL(file);
    });

    // Text functionality
    textBtn.addEventListener('click', () => {
        drawing = false;
        textMode = true;
        eraseMode = false;
        canvas.style.cursor = 'text';
    });

    // Add this function to create custom text input UI
    function createTextInput(x, y) {
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

        // Create text input
        const textInput = document.createElement('input');
        textInput.type = 'text';
        textInput.style.cssText = `
            width: 300px;
            height: 30px;
            border: 1px solid #ccc;
            padding: 5px;
        `;

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

        // Add container to document
        document.body.appendChild(inputContainer);

        // Focus the input
        textInput.focus();

        // Return promise for handling the result
        return new Promise((resolve, reject) => {
            okButton.onclick = () => {
                const text = textInput.value;
                document.body.removeChild(inputContainer);
                resolve(text);
            };

            cancelButton.onclick = () => {
                document.body.removeChild(inputContainer);
                resolve(null);
            };

            // Handle Enter key
            textInput.onkeyup = (e) => {
                if (e.key === 'Enter') {
                    okButton.click();
                }
            };

            // Handle Escape key
            textInput.onkeydown = (e) => {
                if (e.key === 'Escape') {
                    cancelButton.click();
                }
            };
        });
    }

    // Modify the text click handler
    canvas.addEventListener('click', async (e) => {
        if (!textMode) return;
        const pos = getMousePos(e);
        const text = await createTextInput(e.clientX, e.clientY);
        if (text) {
            ctx.font = '20px Arial';
            ctx.fillStyle = '#FF0044';
            // Add 5px to the Y position
            ctx.fillText(text, pos.x, pos.y + 5);
            drawnElements.push({
                type: 'text',
                text: text,
                x: pos.x,
                y: pos.y + 5  // Store the offset position
            });
            redrawCanvas();
        }
    });

    // Modify the camera/download button functionality
    cameraBtn.addEventListener('click', () => {
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
        let originalFilename = fileInput.files[0] ? fileInput.files[0].name.split('.')[0] : 'image';
        
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
        const stampText = `${originalFilename}.jpg ${dateStr} edg`;
        
        // Set text style
        tempCtx.font = '16px Arial';
        tempCtx.fillStyle = '#FF0044';
        
        // Position text at bottom right corner with padding
        const padding = 20;
        const textWidth = tempCtx.measureText(stampText).width;
        const textX = tempCanvas.width - textWidth - padding;
        const textY = tempCanvas.height - padding;
        
        // Add text to canvas
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
        drawing = false;
        textMode = false;
        eraseMode = true;
        // Use a cell cursor which looks similar to an eraser
        canvas.style.cursor = 'cell';
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
                ctx.strokeStyle = '#FF0044';  // Neon red color
                ctx.beginPath();
                ctx.moveTo(element.x1, element.y1);
                ctx.lineTo(element.x2, element.y2);
                ctx.stroke();
            } else if (element.type === 'text') {
                ctx.font = '20px Arial';
                ctx.fillStyle = '#FF0044';  // Make text neon red too
                ctx.fillText(element.text, element.x, element.y);
            }
        });
    }

    // Modify erase function to better handle text elements
    function erase(e) {
        const pos = getMousePos(e);
        const eraseRadius = 10;
        
        // Filter out elements near the eraser
        drawnElements = drawnElements.filter(element => {
            if (element.type === 'line') {
                const dist = pointToLineDistance(pos, element);
                return dist > eraseRadius;
            } else if (element.type === 'text') {
                // Get text width to calculate bounding box
                ctx.font = '20px Arial';
                const textWidth = ctx.measureText(element.text).width;
                const textHeight = 20; // Approximate text height
                
                // Check if click is within text bounding box
                const textLeft = element.x;
                const textRight = element.x + textWidth;
                const textTop = element.y - textHeight;
                const textBottom = element.y;
                
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
        ctx.strokeStyle = '#FF0044';
        ctx.lineWidth = 2;
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
                        // Clear existing drawings
                        drawnElements = [];
                        bgImage = img;
                        resizeCanvas(img);
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
                                    drawnElements = [];
                                    bgImage = img;
                                    resizeCanvas(img);
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
    initCanvas();
});


    // Initialize canvas
    initCanvas();
});

