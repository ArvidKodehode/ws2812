const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreElement = document.getElementById("score"); // Ekstra visning (valgfritt)
const startButton = document.getElementById("startButton"); // Start-knapp

const WLED_IP = "http://192.168.1.94"; // ESP32 med WLED

// **Tall i pikselformat (8x4 grid)**
const pixelNumbers = {
  "0": [[1,1,1,1], [1,0,0,1], [1,0,0,1], [1,1,1,1]],
  "1": [[0,1,1,0], [0,1,1,0], [0,1,1,0], [0,1,1,0]],
  "2": [[1,1,1,1], [0,0,1,1], [1,1,0,0], [1,1,1,1]],
  "3": [[1,1,1,1], [0,0,1,1], [0,0,1,1], [1,1,1,1]],
  "4": [[1,0,0,1], [1,0,0,1], [1,1,1,1], [0,0,0,1]],
  "5": [[1,1,1,1], [1,0,0,0], [1,1,1,1], [0,0,0,1]],
  "6": [[1,1,1,1], [1,0,0,0], [1,1,1,1], [1,0,0,1]],
  "7": [[1,1,1,1], [0,0,1,0], [0,0,1,0], [0,0,1,0]],
  "8": [[1,1,1,1], [1,0,0,1], [1,1,1,1], [1,0,0,1]],
  "9": [[1,1,1,1], [1,0,0,1], [1,1,1,1], [0,0,0,1]]
};

// 🎮 **Spillvariabler**
const COLS = 16;
const ROWS = 48;
const SCALE = 10;
const GAME_AREA_START = 15; // Spillområdet starter fra rad 15 (øverste rader kan brukes til score)
const BASE_FALL_INTERVAL = 20;

let board = Array(ROWS).fill().map(() => Array(COLS).fill(0));
let gameRunning = false;
let score = 0;
let fallCounter = 0;
let currentFallInterval = BASE_FALL_INTERVAL;
let currentPiece = null;

// 🎮 **Tetromino-brikker**
const TETROMINOES = [
  { shape: [[1, 1, 1, 1]], color: 0x00FFFF },  // Cyan (I)
  { shape: [[1, 1], [1, 1]], color: 0xFFFF00 },  // Gul (O)
  { shape: [[0, 1, 0], [1, 1, 1]], color: 0xFFFFFF }, // Hvit (T)
  { shape: [[1, 1, 0], [0, 1, 1]], color: 0xFF0000 }, // Rød (Z)
  { shape: [[0, 1, 1], [1, 1, 0]], color: 0x00FF00 }  // Grønn (S)
];

// 🎮 **Start spill**
function startGame() {
  if (gameRunning) return;
  gameRunning = true;
  score = 0;
  if (scoreElement) scoreElement.textContent = "0";
  currentFallInterval = BASE_FALL_INTERVAL;
  initGame();
  currentPiece = generateNewPiece();
  canvas.focus();
  gameLoop();
  sendBoardToWLED();
}

// 🎮 **Initialiser spillbrett**
function initGame() {
  canvas.width = COLS * SCALE;
  canvas.height = ROWS * SCALE;
  // Eksempel: rad 9 settes til rød – tilpass etter behov
  board = Array(ROWS).fill().map((_, y) =>
    y === 9 ? Array(COLS).fill(0xFF0000) : Array(COLS).fill(0)
  );
}

// 🎮 **Sjekk om brikken kan flyttes**
function canMove(piece, dx, dy) {
  return piece.shape.every((row, y) =>
    row.every((cell, x) => {
      if (!cell) return true;
      const newX = piece.x + x + dx;
      const newY = piece.y + y + dy;
      return (
        newX >= 0 &&
        newX < COLS &&
        newY < ROWS &&
        (board[newY][newX] === 0 || board[newY][newX] === 0xFF0000)
      );
    })
  );
}

// 🎮 **Generer ny brikke**
function generateNewPiece() {
  const piece = JSON.parse(JSON.stringify(
    TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)]
  ));
  piece.x = Math.floor(COLS / 2) - Math.floor(piece.shape[0].length / 2);
  piece.y = GAME_AREA_START;

  if (!canMove(piece, 0, 0)) {
    gameOver();
    return null;
  }
  return piece;
}

// 🎮 **Lås brikke på brettet**
function lockPiece() {
  let gameOverDetected = false;

  currentPiece.shape.forEach((row, dy) => {
    row.forEach((cell, dx) => {
      if (cell) {
        const y = currentPiece.y + dy;
        const x = currentPiece.x + dx;
        if (y < GAME_AREA_START) gameOverDetected = true;
        board[y][x] = currentPiece.color;
      }
    });
  });

  if (gameOverDetected) {
    gameOver();
    return;
  }

  removeFullLines();
  currentPiece = generateNewPiece();
  sendBoardToWLED();
}

// 🎮 **Fjerner fulle linjer**
function removeFullLines() {
  let linesCleared = 0;

  for (let y = ROWS - 1; y >= GAME_AREA_START; y--) {
    if (board[y].every(cell => cell !== 0)) {
      board.splice(y, 1);
      board.splice(GAME_AREA_START, 0, Array(COLS).fill(0));
      linesCleared++;
      y++; // juster indeksen etter fjerning
    }
  }

  if (linesCleared > 0) {
    score += linesCleared * 100;
    if (scoreElement) scoreElement.textContent = score;

    if (score >= 1000) {
      alert("GRATULERER! Du har vunnet!");
      gameRunning = false;
      return;
    }

    currentFallInterval = Math.max(10, BASE_FALL_INTERVAL - (linesCleared * 2));
  }
}

// 🎮 **Flytt brikken ned**
function moveDown() {
  if (canMove(currentPiece, 0, 1)) {
    currentPiece.y++;
  } else {
    lockPiece();
  }
}

// 🎮 **Spill-loop**
function gameLoop() {
  if (!gameRunning) return;

  fallCounter++;
  if (fallCounter >= currentFallInterval) {
    moveDown();
    fallCounter = 0;
  }

  drawBoard();
  requestAnimationFrame(gameLoop);
}

// 🎮 **Game Over**
function gameOver() {
  gameRunning = false;
  alert("GAME OVER! Brikken nådde linje 15.");
}

// 🎮 **Tegn brett**
function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Tegn brettet (LED-matrise)
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x] !== 0) {
        ctx.fillStyle = `#${board[y][x].toString(16).padStart(6, "0")}`;
        ctx.fillRect(x * SCALE, y * SCALE, SCALE - 1, SCALE - 1);
      }
    }
  }

  // Tegn den aktive brikken
  if (currentPiece) {
    ctx.fillStyle = `#${currentPiece.color.toString(16).padStart(6, "0")}`;
    currentPiece.shape.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          ctx.fillRect(
            (currentPiece.x + x) * SCALE,
            (currentPiece.y + y) * SCALE,
            SCALE - 1,
            SCALE - 1
          );
        }
      });
    });
  }

  // Tegn poengsummen i pikselformat øverst (utenfor spillområdet)
  updateScoreDisplay();
}

// 🎮 **Tegn poengsum med pikselformat**
function updateScoreDisplay() {
  let scoreStr = score.toString().padStart(3, "0");
  let colors = [0xFF0000, 0x00FF00, 0x0000FF]; // Rød, grønn, blå

  // For hvert siffer plasserer vi det med et lite mellomrom (her bruker vi x-offset = i * 5)
  for (let i = 0; i < scoreStr.length; i++) {
    drawPixelNumber(scoreStr[i], i * 5, 2, colors[i]);
  }
}

// 🎮 **Tegn et tall med pikseldata**
function drawPixelNumber(num, xOffset, yOffset, color) {
  let pixels = pixelNumbers[num];
  if (!pixels) return;
  pixels.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (cell) {
        let x = xOffset + colIndex;
        let y = yOffset + rowIndex;
        // Tegn kun innenfor det øverste området (her bruker vi GAME_AREA_START for å holde score atskilt)
        if (x < COLS && y < GAME_AREA_START) {
          board[y][x] = color;
        }
      }
    });
  });
}

// 🎮 **Hjelpefunksjon: roter en matrise 90° med klokka**
function rotateMatrix(matrix) {
  return matrix[0].map((_, index) =>
    matrix.map(row => row[index]).reverse()
  );
}

// 🎮 **Rotasjon av brikke (brukes nå med "W")**
function rotatePiece() {
  if (!currentPiece) return;
  const rotatedShape = rotateMatrix(currentPiece.shape);
  const testPiece = { ...currentPiece, shape: rotatedShape };

  if (canMove(testPiece, 0, 0)) {
    currentPiece.shape = rotatedShape;
  }
  drawBoard();
}

// 🎮 **Send brett til WLED**
function sendBoardToWLED() {
  let ledData = [];

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      let idx = y * COLS + x;
      let color = board[y][x];
      let hexColor = color.toString(16).padStart(6, "0").toUpperCase();
      ledData.push(idx, hexColor);
    }
  }

  let requestData = { seg: [{ i: ledData, bri: 255, fx: 0 }] };

  fetch(WLED_IP + "/json/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestData)
  })
    .then(res => res.json())
    .then(data => console.log("WLED Response:", data))
    .catch(error => console.error("Feil ved sending til WLED:", error));
}

// 🎮 **Kontroller**
document.addEventListener("keydown", (e) => {
  if (!gameRunning || !currentPiece) return;

  switch (e.key.toLowerCase()) {
    case "a":
      if (canMove(currentPiece, -1, 0)) currentPiece.x--;
      break;
    case "d":
      if (canMove(currentPiece, 1, 0)) currentPiece.x++;
      break;
    case "s":
      currentFallInterval = Math.max(2, BASE_FALL_INTERVAL / 4);
      break;
    case "w":  // Bruk "W" for å rotere brikken
      rotatePiece();
      break;
  }
  drawBoard();
});

document.addEventListener("keyup", (e) => {
  if (e.key.toLowerCase() === "s") currentFallInterval = BASE_FALL_INTERVAL;
});

// 🎮 **Start Spill-knapp**
if (startButton) {
  startButton.addEventListener("click", () => {
    if (!gameRunning) {
      startGame();
    } else {
      // Om spillet allerede er i gang, kan du velge å resette spillet:
      gameRunning = false;
      setTimeout(() => {
        startGame();
      }, 100);
    }
  });
}

// Start initialisering slik at brettet vises før spillet starter
initGame();
drawBoard();
