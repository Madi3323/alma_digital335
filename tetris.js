"use strict";

(function () {
  const COLS = 10;
  const ROWS = 20;
  const BLOCK = 30;

  const COLORS = [
    null,
    "#7c6dfa", // I - purple
    "#fa6d9a", // O - pink
    "#6dfadb", // T - teal
    "#facc15", // S - yellow
    "#4ade80", // Z - green
    "#f97316", // J - orange
    "#38bdf8", // L - blue
  ];

  const SHAPES = [
    null,
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
    [[2,2],[2,2]],                               // O
    [[0,3,0],[3,3,3],[0,0,0]],                   // T
    [[0,4,4],[4,4,0],[0,0,0]],                   // S
    [[5,5,0],[0,5,5],[0,0,0]],                   // Z
    [[6,0,0],[6,6,6],[0,0,0]],                   // J
    [[0,0,7],[7,7,7],[0,0,0]],                   // L
  ];

  let canvas, ctx, nextCanvas, nextCtx;
  let board, currentPiece, nextPiece;
  let score, level, lines;
  let dropInterval, lastTime, rafId;
  let gameRunning, gamePaused;
  let keyHandler;

  function initTetris() {
    canvas = document.getElementById("tetrisCanvas");
    ctx = canvas.getContext("2d");
    nextCanvas = document.getElementById("nextPieceCanvas");
    nextCtx = nextCanvas.getContext("2d");
    gameRunning = false;
    gamePaused = false;
    drawIdleBoard();
  }

  function drawIdleBoard() {
    if (!ctx) return;
    ctx.fillStyle = "#16161f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
  }

  function drawGrid() {
    ctx.strokeStyle = "rgba(30,30,46,0.5)";
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * BLOCK);
      ctx.lineTo(COLS * BLOCK, r * BLOCK);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * BLOCK, 0);
      ctx.lineTo(c * BLOCK, ROWS * BLOCK);
      ctx.stroke();
    }
  }

  function tetrisStart() {
    if (gameRunning) {
      stopGame();
    }
    startGame();
  }

  function startGame() {
    hideOverlay();
    board = createBoard();
    score = 0; level = 1; lines = 0;
    dropInterval = 800;
    updateScoreUI();
    currentPiece = spawnPiece();
    nextPiece = spawnPiece();
    drawNextPiece();
    gameRunning = true;
    gamePaused = false;
    lastTime = 0;

    if (keyHandler) document.removeEventListener("keydown", keyHandler);
    keyHandler = handleKey;
    document.addEventListener("keydown", keyHandler);

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(gameLoop);
  }

  function stopGame() {
    gameRunning = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (keyHandler) { document.removeEventListener("keydown", keyHandler); keyHandler = null; }
  }

  function gameOver() {
    stopGame();
    showOverlay("Game Over", `Score: ${score}`, "Play Again");
  }

  function createBoard() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function randomPieceIndex() {
    return Math.floor(Math.random() * 7) + 1;
  }

  function spawnPiece() {
    const type = randomPieceIndex();
    const shape = SHAPES[type].map(row => [...row]);
    return {
      type,
      shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
    };
  }

  function gameLoop(timestamp) {
    if (!gameRunning) return;
    const delta = timestamp - lastTime;
    if (delta > dropInterval) {
      lastTime = timestamp;
      if (!moveDown()) {
        placePiece();
        clearLines();
        currentPiece = nextPiece;
        nextPiece = spawnPiece();
        drawNextPiece();
        if (collides(currentPiece, currentPiece.x, currentPiece.y)) {
          gameOver();
          return;
        }
      }
    }
    render();
    rafId = requestAnimationFrame(gameLoop);
  }

  function render() {
    ctx.fillStyle = "#16161f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawBoard();
    drawGhost();
    drawPiece(currentPiece, ctx);
  }

  function drawBoard() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          drawBlock(ctx, c, r, COLORS[board[r][c]]);
        }
      }
    }
  }

  function drawGhost() {
    let ghostY = currentPiece.y;
    while (!collides(currentPiece, currentPiece.x, ghostY + 1)) ghostY++;
    if (ghostY === currentPiece.y) return;
    for (let r = 0; r < currentPiece.shape.length; r++) {
      for (let c = 0; c < currentPiece.shape[r].length; c++) {
        if (currentPiece.shape[r][c]) {
          const bx = (currentPiece.x + c) * BLOCK;
          const by = (ghostY + r) * BLOCK;
          ctx.strokeStyle = COLORS[currentPiece.type];
          ctx.lineWidth = 1;
          ctx.strokeRect(bx + 1, by + 1, BLOCK - 2, BLOCK - 2);
        }
      }
    }
  }

  function drawPiece(piece, context) {
    piece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) drawBlock(context, piece.x + c, piece.y + r, COLORS[piece.type]);
      });
    });
  }

  function drawBlock(context, x, y, color) {
    const px = x * BLOCK, py = y * BLOCK;
    context.fillStyle = color;
    context.fillRect(px + 1, py + 1, BLOCK - 2, BLOCK - 2);
    context.fillStyle = "rgba(255,255,255,0.15)";
    context.fillRect(px + 1, py + 1, BLOCK - 2, 4);
    context.fillStyle = "rgba(0,0,0,0.25)";
    context.fillRect(px + 1, py + BLOCK - 4, BLOCK - 2, 3);
  }

  function drawNextPiece() {
    nextCtx.fillStyle = "#16161f";
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    const s = nextPiece.shape;
    const offX = Math.floor((4 - s[0].length) / 2);
    const offY = Math.floor((4 - s.length) / 2);
    const bs = 20;
    s.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) {
          const px = (offX + c) * bs, py = (offY + r) * bs;
          nextCtx.fillStyle = COLORS[nextPiece.type];
          nextCtx.fillRect(px + 1, py + 1, bs - 2, bs - 2);
        }
      });
    });
  }

  function collides(piece, nx, ny) {
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const newC = nx + c, newR = ny + r;
        if (newC < 0 || newC >= COLS || newR >= ROWS) return true;
        if (newR >= 0 && board[newR][newC]) return true;
      }
    }
    return false;
  }

  function moveDown() {
    if (collides(currentPiece, currentPiece.x, currentPiece.y + 1)) return false;
    currentPiece.y++;
    return true;
  }

  function placePiece() {
    currentPiece.shape.forEach((row, r) => {
      row.forEach((val, c) => {
        if (val) {
          const br = currentPiece.y + r;
          const bc = currentPiece.x + c;
          if (br >= 0) board[br][bc] = currentPiece.type;
        }
      });
    });
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(c => c !== 0)) {
        board.splice(r, 1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    if (!cleared) return;
    lines += cleared;
    const pts = [0, 100, 300, 500, 800];
    score += (pts[cleared] || 800) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 800 - (level - 1) * 70);
    updateScoreUI();
  }

  function rotate(piece) {
    const s = piece.shape;
    const rows = s.length, cols = s[0].length;
    const rotated = Array.from({ length: cols }, () => new Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        rotated[c][rows - 1 - r] = s[r][c];
      }
    }
    return rotated;
  }

  function handleKey(e) {
    if (!gameRunning) return;
    switch (e.code) {
      case "ArrowLeft":
        e.preventDefault();
        if (!collides(currentPiece, currentPiece.x - 1, currentPiece.y)) currentPiece.x--;
        break;
      case "ArrowRight":
        e.preventDefault();
        if (!collides(currentPiece, currentPiece.x + 1, currentPiece.y)) currentPiece.x++;
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!moveDown()) {
          placePiece(); clearLines();
          currentPiece = nextPiece;
          nextPiece = spawnPiece();
          drawNextPiece();
          if (collides(currentPiece, currentPiece.x, currentPiece.y)) { gameOver(); return; }
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        const rotated = rotate(currentPiece);
        const prev = currentPiece.shape;
        currentPiece.shape = rotated;
        if (collides(currentPiece, currentPiece.x, currentPiece.y)) {
          if (!collides(currentPiece, currentPiece.x + 1, currentPiece.y)) currentPiece.x++;
          else if (!collides(currentPiece, currentPiece.x - 1, currentPiece.y)) currentPiece.x--;
          else currentPiece.shape = prev;
        }
        break;
      case "Space":
        e.preventDefault();
        while (moveDown()) {}
        placePiece(); clearLines();
        currentPiece = nextPiece;
        nextPiece = spawnPiece();
        drawNextPiece();
        if (collides(currentPiece, currentPiece.x, currentPiece.y)) { gameOver(); return; }
        break;
    }
    render();
  }

  function updateScoreUI() {
    const s = document.getElementById("tetrisScore");
    const l = document.getElementById("tetrisLevel");
    const ln = document.getElementById("tetrisLines");
    if (s) s.textContent = score;
    if (l) l.textContent = level;
    if (ln) ln.textContent = lines;
  }

  function showOverlay(title, msg, btnLabel) {
    const overlay = document.getElementById("tetrisOverlay");
    const t = document.getElementById("tetrisOverlayTitle");
    const m = document.getElementById("tetrisOverlayMsg");
    const btn = document.getElementById("tetrisStartBtn");
    if (overlay) overlay.style.display = "flex";
    if (t) t.textContent = title;
    if (m) m.textContent = msg;
    if (btn) btn.textContent = btnLabel;
  }

  function hideOverlay() {
    const overlay = document.getElementById("tetrisOverlay");
    if (overlay) overlay.style.display = "none";
  }

  window.initTetris = initTetris;
  window.tetrisStart = tetrisStart;
})();
