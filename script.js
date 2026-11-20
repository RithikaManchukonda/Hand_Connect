
// ==========================================
// HANDCONNECT 3.0 - ADVANCED HAND TRACKING
// ==========================================


// 1. HTML ELEMENTS
const video = document.getElementById("webcam");
const button = document.getElementById("startButton");
const status = document.getElementById("status");

const handStatus = document.getElementById("handStatus");

const canvas = document.getElementById("handCanvas");
const ctx = canvas.getContext("2d");

// Dashboard elements
const hudHands = document.getElementById("hudHands");
const hudGestures = document.getElementById("hudGestures");
const hudFPS = document.getElementById("hudFPS");


// 2. AIR DRAWING ELEMENTS
const drawingCanvas = document.getElementById("drawingCanvas");
const drawCtx = drawingCanvas.getContext("2d");

const drawToggle = document.getElementById("drawToggle");
const brushColorInput = document.getElementById("brushColor");
const eraserToggle = document.getElementById("eraserToggle");

const clearDrawing = document.getElementById("clearDrawing");
const saveDrawing = document.getElementById("saveDrawing");

// Drawing settings
let drawingEnabled = false;
let isErasing = false;
let brushColor = "#00ffff";

let lastDrawPoints = [];
let smoothedDrawPoints = [];
let drawGraceFrames = [];

const DRAW_GRACE = 4;
// Reset drawing tracking
function resetDrawingTracking() {

    lastDrawPoints = [];
    smoothedDrawPoints = [];
    drawGraceFrames = [];

}
// 3. HAND CONNECTIONS
const connections = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [5,9],[9,10],[10,11],[11,12],
    [9,13],[13,14],[14,15],[15,16],
    [13,17],[17,18],[18,19],[19,20],
    [0,17]
];

// Fingertip landmark numbers
const tips = [4, 8, 12, 16, 20];


// 4. HAND COLOURS
const handColors = [
    "#ff4fd8",
    "#ffe83a",
    "#3ad7ff",
    "#a875ff"
];

// Rainbow beam colours
const beamColors = [
    "#ff3b3b",
    "#ff9a2e",
    "#7dff5a",
    "#3ad7ff",
    "#c46bff"
];


// 5. PARTICLE SETTINGS
let sparks = [];

let lastTime = performance.now();
let fps = 0;


// 6. AIR DRAWING BUTTONS

// Enable or disable drawing
drawToggle.addEventListener("click", function() {

    drawingEnabled = !drawingEnabled;

    drawToggle.textContent =
        drawingEnabled ? "Drawing: ON" : "Drawing: OFF";

   resetDrawingTracking();

});

// Change brush colour
brushColorInput.addEventListener("input", function() {

    brushColor = brushColorInput.value;

});

// Enable or disable eraser
eraserToggle.addEventListener("click", function() {

    isErasing = !isErasing;

    eraserToggle.textContent =
        isErasing ? "Disable Eraser" : "Enable Eraser";

    lastDrawPoint = null;

});

// Clear drawing
clearDrawing.addEventListener("click", function() {

    drawCtx.clearRect(
        0,
        0,
        drawingCanvas.width,
        drawingCanvas.height
    );

    lastDrawPoint = null;

});

// Save drawing
saveDrawing.addEventListener("click", function() {

    const link = document.createElement("a");

    link.download = "HandConnect-Drawing.png";

    link.href = drawingCanvas.toDataURL("image/png");

    link.click();

});


// 7. DISTANCE CALCULATION
function distance(a, b) {

    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );

}


// 8. GESTURE RECOGNITION
function detectGesture(lm) {

    // Pinch detection
    if (distance(lm[4], lm[8]) < 0.05) {
        return "Pinch";
    }

    // Finger detection
    const openFingers = [8, 12, 16, 20].filter(
        tip => distance(lm[tip], lm[0]) >
               distance(lm[tip - 2], lm[0])
    ).length;

    if (openFingers >= 4) return "Open Hand";

    if (openFingers === 0) return "Fist";

    if (openFingers === 1) return "Point";

    return "Partial";

}


// 9. GLOWING LINE FUNCTION
function glowLine(a, b, color, width) {

    // Outer glow
    ctx.beginPath();

    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);

    ctx.strokeStyle = color;
    ctx.lineWidth = width;

    ctx.shadowColor = color;
    ctx.shadowBlur = 15;

    ctx.stroke();

    // White inner line
    ctx.beginPath();

    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = width / 3;

    ctx.shadowBlur = 0;

    ctx.stroke();

}


// 10. ADD PARTICLE SPARKS
function addSpark(point, color) {

    sparks.push({

        x: point.x,
        y: point.y,

        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,

        life: 1,
        color: color

    });

}


// 11. ANIMATE PARTICLES
function drawSparks() {

    sparks = sparks.filter(
        spark => spark.life > 0
    );

    sparks.forEach(spark => {

        spark.x += spark.vx;
        spark.y += spark.vy;

        spark.life -= 0.035;

        ctx.globalAlpha = Math.max(0, spark.life);

        ctx.beginPath();

        ctx.moveTo(spark.x, spark.y);

        ctx.lineTo(
            spark.x - spark.vx * 2,
            spark.y - spark.vy * 2
        );

        ctx.strokeStyle = spark.color;
        ctx.lineWidth = 3;

        ctx.stroke();

    });

    ctx.globalAlpha = 1;

}


// 12. MAIN HAND DRAWING FUNCTION
function drawHands(results) {

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) return;


    // Resize hand canvas only when necessary
    if (
        canvas.width !== width ||
        canvas.height !== height
    ) {

        canvas.width = width;
        canvas.height = height;

    }

    // Resize air drawing canvas
    if (
        drawingCanvas.width !== width ||
        drawingCanvas.height !== height
    ) {

        drawingCanvas.width = width;
        drawingCanvas.height = height;

        lastDrawPoint = null;

    }


    // Clear previous hand skeleton
    ctx.clearRect(0, 0, width, height);


    // Get detected hands
    const detectedHands =
        results.multiHandLandmarks || [];

    const gestures = [];


    // Reset drawing connection if no hands detected
    if (detectedHands.length === 0) {

        lastDrawPoint = null;

    }


    // Process every detected hand
    detectedHands.forEach((landmarks, index) => {

        const color =
            handColors[index % handColors.length];


        // Convert landmarks into canvas pixels
        const points = landmarks.map(point => ({

            x: point.x * width,
            y: point.y * height

        }));


        // Recognize gesture
        const gesture = detectGesture(landmarks);
        // Stabilize gesture detection
if (gesture === "Point") {
    drawGraceFrames[index] = DRAW_GRACE;
} else {
    drawGraceFrames[index] = Math.max(
        0,
        (drawGraceFrames[index] || 0) - 1
    );
}
const shouldDraw =
    drawingEnabled &&
    drawGraceFrames[index] > 0;



        // ==================================
        // 13. AIR DRAWING
        // ==================================

        // ==================================
// 13. AIR DRAWING WITH BOTH HANDS
// ==================================

// ==================================
// AIR DRAWING - SMOOTH HANDWRITING
// ==================================

if (shouldDraw) {

    const currentPoint = points[8];

    const previousPoint = smoothedDrawPoints[index];

    // Smooth fingertip movement
    let smoothPoint;

    if (previousPoint) {

        const smoothing = 0.35;

        smoothPoint = {
            x: previousPoint.x +
                (currentPoint.x - previousPoint.x) * smoothing,

            y: previousPoint.y +
                (currentPoint.y - previousPoint.y) * smoothing
        };

    } else {

        smoothPoint = {
            x: currentPoint.x,
            y: currentPoint.y
        };

    }

    drawCtx.globalCompositeOperation =
        isErasing ? "destination-out" : "source-over";

    drawCtx.beginPath();

    if (previousPoint) {

        drawCtx.moveTo(
            previousPoint.x,
            previousPoint.y
        );

        drawCtx.lineTo(
            smoothPoint.x,
            smoothPoint.y
        );

    } else {

        drawCtx.arc(
            smoothPoint.x,
            smoothPoint.y,
            isErasing ? 15 : 4,
            0,
            Math.PI * 2
        );

    }

    drawCtx.strokeStyle =
        isErasing ? "#000000" : brushColor;

    drawCtx.fillStyle =
        isErasing ? "#000000" : brushColor;

    drawCtx.lineWidth = isErasing ? 30 : 8;

    drawCtx.lineCap = "round";
    drawCtx.lineJoin = "round";

    if (previousPoint) {
        drawCtx.stroke();
    } else {
        drawCtx.fill();
    }

    drawCtx.globalCompositeOperation = "source-over";

    // Save smoothed position
    smoothedDrawPoints[index] = smoothPoint;
    lastDrawPoints[index] = smoothPoint;

} else {

    smoothedDrawPoints[index] = null;
    lastDrawPoints[index] = null;

}



        // Add gesture information
        gestures.push(
            `Hand ${index + 1}: ${gesture}`
        );


        // ==================================
        // 14. DRAW HAND SKELETON
        // ==================================

        connections.forEach(([start, end]) => {

            glowLine(
                points[start],
                points[end],
                color,
                4
            );

        });


        // Draw landmark points
        points.forEach(point => {

            ctx.beginPath();

            ctx.arc(
                point.x,
                point.y,
                5,
                0,
                Math.PI * 2
            );

            ctx.fillStyle = color;

            ctx.shadowColor = color;
            ctx.shadowBlur = 15;

            ctx.fill();

        });


        // Generate fingertip sparks
        tips.forEach(tip => {

            if (Math.random() < 0.12) {

                addSpark(
                    points[tip],
                    color
                );

            }

        });

    });


    // ==================================
    // 15. RAINBOW FINGERTIP CONNECTIONS
    // ==================================

    if (detectedHands.length >= 2) {

        const firstHand = detectedHands[0];
        const secondHand = detectedHands[1];

        tips.forEach((tip, index) => {

            const point1 = {

                x: firstHand[tip].x * width,
                y: firstHand[tip].y * height

            };

            const point2 = {

                x: secondHand[tip].x * width,
                y: secondHand[tip].y * height

            };


            glowLine(
                point1,
                point2,
                beamColors[index],
                5
            );


            // Add rainbow sparks
            if (Math.random() < 0.2) {

                addSpark(
                    point1,
                    beamColors[index]
                );

                addSpark(
                    point2,
                    beamColors[index]
                );

            }

        });

    }


    // ==================================
    // 16. DRAW PARTICLES
    // ==================================

    drawSparks();


    // ==================================
    // 17. UPDATE DASHBOARD
    // ==================================

    hudHands.textContent =
        detectedHands.length;

    hudGestures.textContent =
        gestures.length ? gestures.join(" | ") : "-";

    handStatus.textContent =
        "Hands detected: " + detectedHands.length;


    // Calculate FPS
    const now = performance.now();

    const currentFPS =
        1000 / (now - lastTime);

    fps = fps * 0.9 + currentFPS * 0.1;

    lastTime = now;

    hudFPS.textContent =
        Math.round(fps);

}


// 18. INITIALIZE MEDIAPIPE
const hands = new Hands({

    locateFile: (file) => {

        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;

    }

});


// 19. MODEL CONFIGURATION
hands.setOptions({

    maxNumHands: 2,

    modelComplexity: 0,

    minDetectionConfidence: 0.7,

    minTrackingConfidence: 0.7

});


// 20. RECEIVE AI RESULTS
hands.onResults(drawHands);


// 21. START WEBCAM
button.addEventListener("click", async function() {

    try {

        status.textContent =
            "Loading AI model...";

        const camera = new Camera(video, {

            onFrame: async function() {

                await hands.send({

                    image: video

                });

            },

            width: 640,
            height: 480

        });


        await camera.start();

        status.textContent =
            "AI Hand Tracking Started!";

        button.disabled = true;


    } catch (error) {

        console.error(error);

        status.textContent =
            "Error: " + error.message;

    }

});
