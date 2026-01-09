const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const roundEl = document.getElementById("round");
const phaseEl = document.getElementById("phase");
const moneyEl = document.getElementById("money");
const weightEl = document.getElementById("weight");
const trayEl = document.getElementById("tray");
const speedEl = document.getElementById("speed");
const readyBtn = document.getElementById("ready");

const bounds = {
  width: canvas.width,
  height: canvas.height,
};

const layout = {
  shelfX: 50,
  shelfY: 110,
  shelfCols: 2,
  shelfGapX: 95,
  shelfGapY: 120,
  waiterY: 350,
  trayOffsetY: -70,
  trayLength: 150,
};

const shapes = ["square", "rect_h", "rect_v", "triangle", "circle"];
const values = [1, 5, 10, 20, 50];
const materials = [
  { name: "papel", weight: 1, base: "#ffffff", pattern: "dots" },
  { name: "madeira", weight: 2, base: "#d4a46a", pattern: "diagonal" },
  { name: "metal", weight: 3, base: "#b8bfc9", pattern: "lines" },
];

const waiter = {
  x: 240,
  y: layout.waiterY,
  startX: 240,
  targetX: bounds.width - 140,
  baseSpeed: 140,
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

const getTrayWeight = () => tray.reduce((sum, item) => sum + item.material.weight, 0);

const getTrayValue = () => tray.reduce((sum, item) => sum + item.value, 0);

const getSpeed = () => {
  const totalWeight = getTrayWeight();
  const capped = Math.min(totalWeight, 8);
  const factor = 1 - 0.5 * (capped / 8);
  return waiter.baseSpeed * factor;
};

const updateHud = () => {
  roundEl.textContent = round;
  phaseEl.textContent =
    phase === "select" ? "Selecao" : phase === "walk" ? "Travessia" : "Resultado";
  moneyEl.textContent = `$${totalMoney}`;
  weightEl.textContent = getTrayWeight();
  trayEl.textContent = `${tray.length}/5`;
  speedEl.textContent = `${Math.round(getSpeed())}`;
  readyBtn.disabled = phase !== "select";
};

const makeItem = () => {
  const shape = shapes[Math.floor(Math.random() * shapes.length)];
  const size = 1 + Math.floor(Math.random() * 4);
  const material = materials[Math.floor(Math.random() * materials.length)];
  const value = values[Math.floor(Math.random() * values.length)];
  return {
    id: nextId++,
    shape,
    size,
    material,
    value,
    box: null,
  };
};

const generateItems = () => {
  const count = 6 + Math.floor(Math.random() * 4);
  const items = [];
  for (let i = 0; i < count; i += 1) {
    items.push(makeItem());
  }
  return items;
};

const startRound = () => {
  phase = "select";
  available = generateItems();
  tray = [];
  waiter.x = waiter.startX;
  resultTimer = 0;
  updateHud();
};

const pointInBox = (pos, box) =>
  pos.x >= box.x && pos.x <= box.x + box.w && pos.y >= box.y && pos.y <= box.y + box.h;

const drawPattern = (material, box) => {
  ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
  ctx.lineWidth = 1;
  if (material.pattern === "diagonal") {
    for (let x = box.x - box.h; x < box.x + box.w + box.h; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, box.y + box.h);
      ctx.lineTo(x + box.h, box.y);
      ctx.stroke();
    }
  } else if (material.pattern === "lines") {
    for (let y = box.y + 4; y < box.y + box.h; y += 6) {
      ctx.beginPath();
      ctx.moveTo(box.x, y);
      ctx.lineTo(box.x + box.w, y);
      ctx.stroke();
    }
  } else if (material.pattern === "dots") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    for (let x = box.x + 4; x < box.x + box.w; x += 8) {
      for (let y = box.y + 4; y < box.y + box.h; y += 8) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
};

const getShapeDims = (shape, base) => {
  if (shape === "square") return { w: base, h: base };
  if (shape === "rect_h") return { w: base * 1.6, h: base * 0.8 };
  if (shape === "rect_v") return { w: base * 0.8, h: base * 1.6 };
  if (shape === "triangle") return { w: base * 1.5, h: base * 1.3 };
  return { w: base, h: base };
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

const drawItem = (item, x, y, showValue, scale = 1) => {
  const base = (16 + item.size * 6) * scale;
  const { w, h } = getShapeDims(item.shape, base);
  const box = { x: x - w / 2, y: y - h / 2, w, h };

  ctx.save();
  ctx.beginPath();
  drawShapePath(item.shape, x, y, w, h);
  ctx.clip();
  ctx.fillStyle = item.material.base;
  ctx.fillRect(box.x, box.y, box.w, box.h);
  drawPattern(item.material, box);
  ctx.restore();

  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2;
  ctx.beginPath();
  drawShapePath(item.shape, x, y, w, h);
  ctx.stroke();

  if (showValue) {
    ctx.fillStyle = "#111111";
    ctx.font = "12px Trebuchet MS";
    ctx.textAlign = "center";
    ctx.fillText(`$${item.value}`, x, y + h / 2 + 16);
  }

  item.box = box;
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
  const trayStart = handX;
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
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(trayStart, trayY);
  ctx.lineTo(trayEnd, trayY);
  ctx.stroke();

  tray.forEach((item, index) => {
    const itemX = trayStart + 22 + index * 24;
    const itemY = trayY - 18 - index * 4;
    drawItem(item, itemX, itemY, false, 0.8);
  });
};

const drawShelf = () => {
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 60);
  ctx.lineTo(40, bounds.height - 60);
  ctx.stroke();

  ctx.font = "12px Trebuchet MS";
  ctx.fillStyle = "#111111";
  ctx.textAlign = "left";
  ctx.fillText("Objetos", 50, 60);
};

const drawAvailable = () => {
  available.forEach((item, index) => {
    const col = index % layout.shelfCols;
    const row = Math.floor(index / layout.shelfCols);
    const x = layout.shelfX + col * layout.shelfGapX;
    const y = layout.shelfY + row * layout.shelfGapY;
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

const update = (dt) => {
  if (phase === "walk") {
    waiter.x += getSpeed() * dt;
    if (waiter.x >= waiter.targetX) {
      totalMoney += getTrayValue();
      phase = "result";
      resultTimer = 1.0;
      updateHud();
    }
  } else if (phase === "result") {
    resultTimer -= dt;
    if (resultTimer <= 0) {
      round += 1;
      startRound();
    }
  }
};

const render = () => {
  ctx.clearRect(0, 0, bounds.width, bounds.height);

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
};

const loop = (timestamp) => {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.04);
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
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
      if (tray.length >= 5) return;
      available.splice(i, 1);
      tray.push(item);
      updateHud();
      return;
    }
  }
};

readyBtn.addEventListener("click", () => {
  if (phase !== "select") return;
  phase = "walk";
  waiter.x = waiter.startX;
  updateHud();
});

canvas.addEventListener("click", onCanvasClick);

startRound();
requestAnimationFrame(loop);
