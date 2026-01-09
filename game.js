const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const roundEl = document.getElementById("round");
const phaseEl = document.getElementById("phase");
const moneyEl = document.getElementById("money");
const weightEl = document.getElementById("weight");
const trayEl = document.getElementById("tray");
const speedEl = document.getElementById("speed");
const tooltipEl = document.getElementById("tooltip");
const warningEl = document.getElementById("warning");

const bounds = {
  width: canvas.width,
  height: canvas.height,
};

const layout = {
  shelfMarginX: 50,
  shelfY: 110,
  shelfGapX: 75,
  shelfGapY: 80,
  shelfLineY: 60,
  waiterY: 450,
  trayOffsetY: -70,
  trayItemScale: 0.8,
  traySlot: 16,
  trayLineWidth: 4,
  trayLength: 16 * 9,
};

const shapes = ["rect", "triangle", "circle"];
const values = [1, 5, 10, 20, 50];
const shapeColors = {
  rect: "#778beb",
  triangle: "#e77f67",
  circle: "#cf6a87",
};

const waiter = {
  x: 60,
  y: layout.waiterY,
  startX: 60,
  targetX: bounds.width - 140,
  baseSpeed: 90,
  sprintSpeed: 160,
};

const waiterImg = new Image();
let waiterImgReady = false;
const waiterSpriteHeight = 184;
waiterImg.onload = () => {
  waiterImgReady = true;
};
waiterImg.src = "assets/waiter.png";

let round = 1;
let totalMoney = 0;
let phase = "select";
let available = [];
let tray = [];
let lastTime = 0;
let resultTimer = 0;
let nextId = 1;
let movingRight = false;
let lastGain = 0;
let ignoreRightUntilRelease = false;
const pressedKeys = new Set();
let warningTimer = 0;
let warningMessage = "";
let warningFlashTimer = 0;
let speedLines = [];
let speedLinesReady = false;
let heavyLimit = null;
let veryHeavyLimit = null;

const getItemWeight = (item) => {
  if (typeof item.weight === "number") return item.weight;
  return getShapeWeight(item.shape, item.size, item.height).weight;
};

const getTrayWeight = () => tray.reduce((sum, item) => sum + getItemWeight(item), 0);

const getTrayValue = () => tray.reduce((sum, item) => sum + item.value, 0);

const getTraySlots = () => tray.reduce((sum, item) => sum + item.size, 0);

const getTrayShake = () => {
  if (phase !== "select") return 0;
  if (typeof heavyLimit !== "number") return 0;
  const total = getTrayWeight();
  if (typeof veryHeavyLimit === "number" && total > veryHeavyLimit) return 2;
  if (total > heavyLimit) return 0.8;
  return 0;
};

const isSprinting = () =>
  phase === "walk" && movingRight && (pressedKeys.has("ShiftLeft") || pressedKeys.has("ShiftRight"));

const getSpeed = () => {
  if (isSprinting()) {
    return waiter.sprintSpeed;
  }
  return waiter.baseSpeed;
};

const updateHud = () => {
  roundEl.textContent = round;
  phaseEl.textContent =
    phase === "select" ? "Selecao" : phase === "walk" ? "Travessia" : "Resultado";
  moneyEl.textContent = `$${totalMoney}`;
  weightEl.textContent = getTrayWeight();
  trayEl.textContent = `${getTraySlots()}/9`;
};

const updateSpeedDisplay = () => {
  speedEl.textContent = `${Math.round(getSpeed())}`;
};

const makeItem = (preset = null) => {
  const shape = preset?.shape ?? shapes[Math.floor(Math.random() * shapes.length)];
  const size = preset?.size ?? (Math.random() < 0.5 ? 1 : 3);
  let height = preset?.height ?? (1 + Math.floor(Math.random() * 3));
  if (shape === "circle") {
    height = 1;
  }
  const value = preset?.value ?? values[Math.floor(Math.random() * values.length)];
  const weight = typeof preset?.weight === "number" ? preset.weight : null;
  return {
    id: nextId++,
    shape,
    size,
    height,
    value,
    weight,
    box: null,
  };
};

const generateItems = (roundConfig = null) => {
  if (roundConfig?.items?.length) {
    return roundConfig.items.map((item) => makeItem(item));
  }
  const count = 9;
  const items = [];
  for (let i = 0; i < count; i += 1) {
    items.push(makeItem());
  }
  return items;
};

const startRound = () => {
  const roundIdx = round - 1;
  const roundConfig =
    Array.isArray(window.ROUNDS) && window.ROUNDS.length
      ? window.ROUNDS[roundIdx % window.ROUNDS.length]
      : null;
  phase = "select";
  available = generateItems(roundConfig);
  tray = [];
  waiter.x = waiter.startX;
  resultTimer = 0;
  movingRight = false;
  ignoreRightUntilRelease = pressedKeys.has("ArrowRight");
  heavyLimit = roundConfig?.heavyLimit ?? null;
  veryHeavyLimit = roundConfig?.veryHeavyLimit ?? null;
  updateHud();
};

const showWarning = (message) => {
  warningMessage = message;
  warningTimer = 1.5;
  if (warningEl) {
    warningEl.textContent = message;
    warningEl.classList.add("is-visible");
    warningEl.classList.remove("flash");
    void warningEl.offsetWidth;
    warningEl.classList.add("flash");
    warningFlashTimer = 0.2;
  }
};

const pointInBox = (pos, box) =>
  pos.x >= box.x && pos.x <= box.x + box.w && pos.y >= box.y && pos.y <= box.y + box.h;

const getHoveredItem = (pos) => {
  for (let i = tray.length - 1; i >= 0; i -= 1) {
    const item = tray[i];
    if (item.box && pointInBox(pos, item.box)) {
      return item;
    }
  }
  for (let i = available.length - 1; i >= 0; i -= 1) {
    const item = available[i];
    if (item.box && pointInBox(pos, item.box)) {
      return item;
    }
  }
  return null;
};

const formatTooltip = (item) => {
  const weight = getItemWeight(item);
  return `Forma: ${item.shape}\nTamanho: ${item.size}\nAltura: ${item.height}\nPeso: ${weight}\nValor: $${item.value}`;
};

const showTooltip = (item, event) => {
  if (!tooltipEl) return;
  tooltipEl.textContent = formatTooltip(item);
  tooltipEl.classList.add("is-visible");
  tooltipEl.setAttribute("aria-hidden", "false");

  const rect = canvas.getBoundingClientRect();
  const offsetX = 12;
  const offsetY = 12;
  let x = event.clientX - rect.left + offsetX;
  let y = event.clientY - rect.top + offsetY;
  const maxX = rect.width - tooltipEl.offsetWidth - 8;
  const maxY = rect.height - tooltipEl.offsetHeight - 8;
  if (Number.isFinite(maxX)) {
    x = Math.min(Math.max(8, x), Math.max(8, maxX));
  }
  if (Number.isFinite(maxY)) {
    y = Math.min(Math.max(8, y), Math.max(8, maxY));
  }
  tooltipEl.style.left = `${x}px`;
  tooltipEl.style.top = `${y}px`;
};

const hideTooltip = () => {
  if (!tooltipEl) return;
  tooltipEl.classList.remove("is-visible");
  tooltipEl.setAttribute("aria-hidden", "true");
};

const getShapeDims = (shape, base, height) => {
  const scale = 16;
  if (shape === "rect") return { w: base * scale, h: height * scale };
  if (shape === "triangle") return { w: base * scale, h: height * scale };
  return { w: base * scale, h: height * scale };
};

const getShapeWeight = (shape, base, height) => {
  if (shape === "circle") return { weight: 0.75 * base * height };
  if (shape === "triangle") return { weight: 0.5 * base * height };
  return { weight: base * height };
};

const drawShapePath = (shape, x, y, w, h) => {
  if (shape === "triangle") {
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x - w / 2, y + h / 2);
    ctx.lineTo(x + w / 2, y + h / 2);
    ctx.closePath();
    return;
  }
  if (shape === "circle") {
    ctx.arc(x, y, w / 2, 0, Math.PI * 2);
    return;
  }
  ctx.rect(x - w / 2, y - h / 2, w, h);
};

const getItemDims = (item, scale = 1) => {
  return getShapeDims(item.shape, item.size, item.height);
};

const drawItemAt = (item, x, y, dims, showValue) => {
  const { w, h } = dims;
  const box = { x: x - w / 2, y: y - h / 2, w, h };

  ctx.beginPath();
  drawShapePath(item.shape, x, y, w, h);
  ctx.fillStyle = shapeColors[item.shape] || "#ffffff";
  ctx.fill();

  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2;
  ctx.beginPath();
  drawShapePath(item.shape, x, y, w, h);
  ctx.stroke();

  if (showValue) {
    ctx.fillStyle = "#111111";
    ctx.font = "bold 16px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(`$${item.value}`, x, y + h / 2 + 16);
  }

  item.box = box;
};

const drawItem = (item, x, y, showValue, scale = 1) => {
  const dims = getItemDims(item, scale);
  drawItemAt(item, x, y, dims, showValue);
};

const drawItemFromBottomLeft = (item, x, y, showValue, scale = 1) => {
  const dims = getItemDims(item, scale);
  drawItemAt(item, x + dims.w / 2, y - dims.h / 2, dims, showValue);
};

const getWaiterSprite = () => {
  if (!waiterImgReady || !waiterImg.naturalHeight) {
    return { w: 140, h: waiterSpriteHeight };
  }
  const scale = waiterSpriteHeight / waiterImg.naturalHeight;
  return { w: waiterImg.naturalWidth * scale, h: waiterSpriteHeight };
};

const drawWaiter = () => {
  const sprite = getWaiterSprite();
  const floorY = layout.waiterY + 40;
  const footY = floorY;
  const trayY = footY - sprite.h * 0.7 - 32;
  const handX = waiter.x + sprite.w * 0.12;
  const trayStart = handX - 17;
  const trayEnd = trayStart + layout.trayLength;

  if (waiterImgReady) {
    ctx.save();
    ctx.translate(waiter.x, footY);
    ctx.scale(-1, 1);
    ctx.drawImage(waiterImg, -sprite.w / 2, -sprite.h, sprite.w, sprite.h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 2;
    ctx.strokeRect(waiter.x - sprite.w / 2, footY - sprite.h, sprite.w, sprite.h);
  }

  ctx.strokeStyle = "#111111";
  ctx.lineWidth = layout.trayLineWidth;
  ctx.beginPath();
  ctx.moveTo(trayStart, trayY);
  ctx.lineTo(trayEnd, trayY);
  ctx.stroke();

  let slotCursor = 0;
  const shake = getTrayShake();
  tray.forEach((item) => {
    const itemX = trayStart + slotCursor * layout.traySlot;
    const trayTop = trayY - layout.trayLineWidth / 2;
    const jitterX = shake ? (Math.random() * 2 - 1) * shake : 0;
    const jitterY = shake ? (Math.random() * 2 - 1) * shake : 0;
    drawItemFromBottomLeft(
      item,
      itemX + jitterX,
      trayTop + jitterY,
      false,
      layout.trayItemScale
    );
    slotCursor += item.size;
  });
};

const drawShelf = () => {
};

const drawAvailable = () => {
  const usable = bounds.width - layout.shelfMarginX * 2;
  const cols = Math.max(1, Math.floor(usable / layout.shelfGapX));
  const sorted = [...available].sort((a, b) => {
    const areaA = a.size * a.height;
    const areaB = b.size * b.height;
    if (areaA !== areaB) return areaB - areaA;
    return b.height - a.height;
  });
  const rowMaxHeights = [];
  sorted.forEach((item, index) => {
    const row = Math.floor(index / cols);
    const dims = getItemDims(item, 1);
    rowMaxHeights[row] = Math.max(rowMaxHeights[row] ?? 0, dims.h);
  });
  sorted.forEach((item, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = layout.shelfMarginX + col * layout.shelfGapX;
    const dims = getItemDims(item, 1);
    const rowTop = layout.shelfY + row * layout.shelfGapY;
    const rowBottom = rowTop + (rowMaxHeights[row] ?? 0);
    const y = rowBottom - dims.h / 2;
    drawItem(item, x, y, true);
  });
};

const drawPhaseLabel = () => {
  if (phase === "select") return;
  ctx.fillStyle = "#111111";
  ctx.font = "14px Trebuchet MS";
  ctx.textAlign = "right";
  const label = phase === "walk" ? "Travessia em andamento" : "Rodada concluida";
  ctx.fillText(label, bounds.width - 20, 30);
};

const drawResultCelebration = () => {
  if (phase !== "result") return;
  const alpha = Math.min(1, resultTimer * 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2;
  const boxW = 260;
  const boxH = 70;
  const x = bounds.width / 2 - boxW / 2;
  const y = 70;
  ctx.fillRect(x, y, boxW, boxH);
  ctx.strokeRect(x, y, boxW, boxH);
  ctx.fillStyle = "#111111";
  ctx.textAlign = "center";
  ctx.font = "16px Trebuchet MS";
  ctx.fillText("Rodada concluida!", bounds.width / 2, y + 30);
  ctx.font = "14px Trebuchet MS";
  ctx.fillText(`Voce ganhou $${lastGain}`, bounds.width / 2, y + 52);
  ctx.restore();
};

const update = (dt) => {
  if (phase === "walk") {
    if (movingRight) {
      waiter.x += getSpeed() * dt;
    }
    if (waiter.x >= waiter.targetX) {
      lastGain = getTrayValue();
      totalMoney += lastGain;
      phase = "result";
      resultTimer = 1.0;
      movingRight = false;
      updateHud();
    }
  } else if (phase === "result") {
    resultTimer -= dt;
    if (resultTimer <= 0) {
      round += 1;
      startRound();
    }
  }
  if (warningTimer > 0) {
    warningTimer -= dt;
    if (warningTimer <= 0) {
      warningTimer = 0;
      warningMessage = "";
      if (warningEl) {
        warningEl.textContent = "";
        warningEl.classList.remove("is-visible");
      }
    }
  }
  if (warningFlashTimer > 0) {
    warningFlashTimer -= dt;
    if (warningFlashTimer <= 0 && warningEl) {
      warningEl.classList.remove("flash");
    }
  }
  if (isSprinting()) {
    if (!speedLinesReady) {
      speedLines = Array.from({ length: 22 }, () => ({
        x: Math.random() * bounds.width,
        y: 30 + Math.random() * (bounds.height - 140),
        len: 50 + Math.random() * 70,
        speed: 520 + Math.random() * 180,
      }));
      speedLinesReady = true;
    }
    speedLines.forEach((line) => {
      line.x -= line.speed * dt;
      if (line.x + line.len < 0) {
        line.x = bounds.width + Math.random() * 80;
        line.y = 30 + Math.random() * (bounds.height - 140);
        line.len = 50 + Math.random() * 70;
        line.speed = 520 + Math.random() * 180;
      }
    });
  }
  updateSpeedDisplay();
};

const render = () => {
  ctx.clearRect(0, 0, bounds.width, bounds.height);

  if (isSprinting() && speedLinesReady) {
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.18)";
    ctx.lineWidth = 1;
    speedLines.forEach((line) => {
      ctx.beginPath();
      ctx.moveTo(line.x, line.y);
      ctx.lineTo(line.x + line.len, line.y);
      ctx.stroke();
    });
    ctx.restore();
  }

  const floorY = layout.waiterY + 40;
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, floorY);
  ctx.lineTo(bounds.width, floorY);
  ctx.stroke();

  if (phase === "select") {
    drawShelf();
    drawAvailable();
  }

  drawWaiter();
  drawPhaseLabel();
  drawResultCelebration();
};

const loop = (timestamp) => {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.04);
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
};

const startWalk = () => {
  if (phase !== "select") return;
  phase = "walk";
  waiter.x = waiter.startX;
  updateHud();
};

const onCanvasClick = (event) => {
  if (phase !== "select") return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const pos = {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };

  for (let i = tray.length - 1; i >= 0; i -= 1) {
    const item = tray[i];
    if (item.box && pointInBox(pos, item.box)) {
      tray.splice(i, 1);
      available.push(item);
      updateHud();
      return;
    }
  }

  for (let i = 0; i < available.length; i += 1) {
    const item = available[i];
    if (item.box && pointInBox(pos, item.box)) {
      if (getTraySlots() + item.size > 9) {
        showWarning("Bandeja muito cheia!");
        return;
      }
      available.splice(i, 1);
      tray.push(item);
      updateHud();
      return;
    }
  }
};

const onKeyDown = (event) => {
  pressedKeys.add(event.code);
  if (event.code !== "ArrowRight") return;
  event.preventDefault();
  if (ignoreRightUntilRelease) return;
  if (phase === "select") {
    startWalk();
  }
  if (phase === "walk") {
    movingRight = true;
  }
};

const onKeyUp = (event) => {
  pressedKeys.delete(event.code);
  if (event.code !== "ArrowRight") return;
  event.preventDefault();
  movingRight = false;
  if (ignoreRightUntilRelease) {
    ignoreRightUntilRelease = false;
  }
};

const onCanvasMove = (event) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const pos = {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
  const item = getHoveredItem(pos);
  if (!item) {
    hideTooltip();
    return;
  }
  showTooltip(item, event);
};

canvas.addEventListener("click", onCanvasClick);
canvas.addEventListener("mousemove", onCanvasMove);
canvas.addEventListener("mouseleave", hideTooltip);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("blur", () => {
  pressedKeys.clear();
  movingRight = false;
  ignoreRightUntilRelease = false;
});

startRound();
requestAnimationFrame(loop);
