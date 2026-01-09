"use strict";

(() => {
  const rounds = Array.isArray(window.ROUNDS) ? window.ROUNDS : [];
  const round = rounds[0] || { id: 1, label: "Dia 1", dayLengthHours: 8, tasks: [] };

  const phaseTabs = Array.from(document.querySelectorAll(".phase-tab"));
  const phases = Array.from(document.querySelectorAll(".phase"));
  const taskPoolEl = document.getElementById("task-pool");
  const timelineEl = document.getElementById("timeline");
  const timelineSummary = document.getElementById("timeline-summary");
  const startDayBtn = document.getElementById("start-day");
  const clearPlanBtn = document.getElementById("clear-plan");
  const dayLabel = document.getElementById("day-label");
  const currentTask = document.getElementById("current-task");
  const currentProgress = document.getElementById("current-progress");
  const resultSummary = document.getElementById("result-summary");
  const restartDayBtn = document.getElementById("restart-day");
  const nextDayBtn = document.getElementById("next-day");
  const canvas = document.getElementById("game");

  const state = {
    phase: "plan",
    day: round,
    tasks: round.tasks.map((task) => ({ ...task })),
    plannedSlots: Array(round.dayLengthHours || 8).fill(null),
    placements: new Map(),
    plannedOrder: [],
    execution: {
      schedule: [],
      totalHours: round.dayLengthHours || 8,
      elapsedHours: 0,
      taskIndex: 0,
      taskElapsed: 0,
      productivity: 0,
      running: false,
      lastTimestamp: 0,
    },
  };

  const TIME_SCALE = 0.25;
  const TIMELINE_UNIT = 50;

  const setPhase = (phase) => {
    state.phase = phase;
    phaseTabs.forEach((tab) => {
      tab.classList.toggle("is-active", tab.dataset.phase === phase);
    });
    phases.forEach((section) => {
      section.classList.toggle("is-active", section.id === `phase-${phase}`);
    });
  };

  const renderTaskPool = () => {
    if (!taskPoolEl) return;
    taskPoolEl.innerHTML = "";
    state.tasks.forEach((task) => {
      const item = document.createElement("li");
      item.className = "task-item";
      if (state.placements.has(task.id)) {
        item.classList.add("is-assigned");
      }
      item.style.setProperty("--task-hours", `${task.duration}`);
      item.innerHTML = `
        <div class="task-title">${task.title}</div>
      `;
      if (task.relevance === 3) {
        item.classList.add("is-urgent");
        const alert = document.createElement("span");
        alert.className = "task-alert";
        alert.textContent = "!";
        const tooltip = document.createElement("span");
        tooltip.className = "task-tooltip";
        tooltip.textContent = "Tarefa Importante";
        alert.appendChild(tooltip);
        item.appendChild(alert);
      }
      item.draggable = true;
      item.dataset.taskId = task.id;
      item.addEventListener("dragstart", (event) => {
        item.classList.add("is-dragging");
        event.dataTransfer?.setData("text/plain", task.id);
      });
      item.addEventListener("dragend", () => {
        item.classList.remove("is-dragging");
      });
      taskPoolEl.appendChild(item);
    });
    fitTaskTitles();
  };

  const flashInvalid = (slotEl) => {
    if (!slotEl) return;
    slotEl.classList.add("is-invalid");
    window.setTimeout(() => slotEl.classList.remove("is-invalid"), 300);
  };

  const rebuildPlannedSlots = () => {
    state.plannedSlots = Array(state.day.dayLengthHours || 8).fill(null);
    state.placements.clear();
    let cursor = 0;
    state.plannedOrder.forEach((taskId) => {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) return;
      for (let i = cursor; i < cursor + task.duration; i += 1) {
        if (i >= state.plannedSlots.length) return;
        state.plannedSlots[i] = taskId;
      }
      state.placements.set(taskId, cursor);
      cursor += task.duration;
    });
  };

  const removeTaskFromTimeline = (taskId) => {
    const index = state.plannedOrder.indexOf(taskId);
    if (index === -1) return;
    state.plannedOrder.splice(index, 1);
    rebuildPlannedSlots();
  };

  const canAppendTask = (task) => {
    const totalSlots = state.day.dayLengthHours || 8;
    const usedSlots = state.plannedOrder.reduce((sum, id) => {
      const plannedTask = state.tasks.find((item) => item.id === id);
      return sum + (plannedTask ? plannedTask.duration : 0);
    }, 0);
    return usedSlots + task.duration <= totalSlots;
  };

  const appendTask = (taskId, slotEl) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    removeTaskFromTimeline(taskId);
    if (!canAppendTask(task)) {
      flashInvalid(slotEl);
      return;
    }
    state.plannedOrder.push(taskId);
    rebuildPlannedSlots();
  };

  const renderTimeline = () => {
    if (!timelineEl) return;
    timelineEl.innerHTML = "";
    const totalSlots = state.day.dayLengthHours || 8;
    timelineEl.style.minWidth = `${totalSlots * TIMELINE_UNIT}px`;
    let cursor = 0;
    state.plannedOrder.forEach((taskId) => {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) return;
      const slot = document.createElement("div");
      slot.className = "timeline-slot";
      slot.classList.add("is-span");
      slot.style.setProperty("--task-hours", `${task.duration}`);
      if (cursor > 0) {
        slot.classList.add("is-joined-left");
      }
      if (cursor + task.duration < totalSlots) {
        slot.classList.add("is-joined-right");
      }
      const taskCard = document.createElement("div");
      taskCard.className = "timeline-task";
      taskCard.draggable = true;
      taskCard.dataset.taskId = taskId;
      taskCard.innerHTML = `
        <div class="task-title">${task.title}</div>
      `;
      if (task.relevance === 3) {
        taskCard.classList.add("is-urgent");
        const alert = document.createElement("span");
        alert.className = "task-alert";
        alert.textContent = "!";
        const tooltip = document.createElement("span");
        tooltip.className = "task-tooltip";
        tooltip.textContent = "Tarefa Importante";
        alert.appendChild(tooltip);
        taskCard.appendChild(alert);
      }
      taskCard.addEventListener("dragstart", (event) => {
        taskCard.classList.add("is-dragging");
        event.dataTransfer?.setData("text/plain", taskId);
      });
      taskCard.addEventListener("dragend", () => {
        taskCard.classList.remove("is-dragging");
      });
      slot.appendChild(taskCard);
      timelineEl.appendChild(slot);
      cursor += task.duration;
    });
    fitTaskTitles();
  };

  const fitTaskTitles = () => {
    const titles = document.querySelectorAll(".task-title");
    titles.forEach((title) => {
      title.style.fontSize = "";
      const baseSize = parseFloat(window.getComputedStyle(title).fontSize);
      let size = Number.isFinite(baseSize) ? baseSize : 14;
      while (title.scrollWidth > title.clientWidth && size > 10) {
        size -= 1;
        title.style.fontSize = `${size}px`;
      }
    });
  };

  const updatePlanningSummary = () => {
    const usedSlots = state.plannedOrder.reduce((sum, taskId) => {
      const task = state.tasks.find((item) => item.id === taskId);
      return sum + (task ? task.duration : 0);
    }, 0);
    const totalSlots = state.day.dayLengthHours || 8;
    const allPlaced = state.tasks.every((task) => state.plannedOrder.includes(task.id));
    if (timelineSummary) {
      timelineSummary.textContent = `Horas planejadas: ${usedSlots}/${totalSlots}`;
    }
    if (startDayBtn) {
      startDayBtn.disabled = !(usedSlots === totalSlots && allPlaced);
    }
  };

  const resetPlanning = () => {
    state.plannedOrder = [];
    rebuildPlannedSlots();
    renderTaskPool();
    renderTimeline();
    updatePlanningSummary();
  };

  const buildSchedule = () => {
    const schedule = [];
    state.plannedSlots.forEach((taskId, index) => {
      if (!taskId) return;
      const isStart = state.placements.get(taskId) === index;
      if (!isStart) return;
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) return;
      schedule.push(task);
    });
    return schedule;
  };

  const startExecution = () => {
    state.execution.schedule = buildSchedule();
    state.execution.totalHours = state.day.dayLengthHours || 8;
    state.execution.elapsedHours = 0;
    state.execution.taskIndex = 0;
    state.execution.taskElapsed = 0;
    state.execution.productivity = 0;
    state.execution.running = true;
    state.execution.lastTimestamp = 0;
    setPhase("execute");
  };

  const finishExecution = () => {
    state.execution.running = false;
    const productivity = Math.round(state.execution.productivity * 10) / 10;
    if (resultSummary) {
      resultSummary.textContent = `Produtividade total: ${productivity} pontos.`;
    }
    setPhase("result");
  };

  const updateExecution = (dt) => {
    const exec = state.execution;
    if (!exec.running) return;
    let remaining = dt * TIME_SCALE;
    while (remaining > 0 && exec.taskIndex < exec.schedule.length) {
      const task = exec.schedule[exec.taskIndex];
      const taskRemaining = task.duration - exec.taskElapsed;
      const step = Math.min(taskRemaining, remaining);
      exec.taskElapsed += step;
      exec.elapsedHours += step;
      exec.productivity += step * task.relevance;
      remaining -= step;
      if (exec.taskElapsed >= task.duration - 1e-6) {
        exec.taskIndex += 1;
        exec.taskElapsed = 0;
      }
    }

    if (exec.elapsedHours >= exec.totalHours || exec.taskIndex >= exec.schedule.length) {
      finishExecution();
    }
  };

  const updateExecutionStatus = () => {
    const exec = state.execution;
    if (dayLabel) dayLabel.textContent = state.day.label || "Dia 1";
    const task = exec.schedule[exec.taskIndex];
    if (currentTask) currentTask.textContent = task ? task.title : "-";
    if (currentProgress) {
      if (task) {
        const pct = Math.min(100, Math.round((exec.taskElapsed / task.duration) * 100));
        currentProgress.textContent = `${pct}%`;
      } else {
        currentProgress.textContent = "0%";
      }
    }
  };

  const drawSketchLine = (ctx, x1, y1, x2, y2) => {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };

  const drawSketchRect = (ctx, x, y, w, h) => {
    drawSketchLine(ctx, x, y, x + w, y);
    drawSketchLine(ctx, x + w, y, x + w, y + h);
    drawSketchLine(ctx, x + w, y + h, x, y + h);
    drawSketchLine(ctx, x, y + h, x, y);
  };

  const drawStickFigure = (ctx, x, y, scale, tick) => {
    const head = 10 * scale;
    ctx.strokeStyle = "#3b312a";
    ctx.lineWidth = 1.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.arc(x, y - 22 * scale, head, 0, Math.PI * 2);
    ctx.stroke();
    drawSketchLine(ctx, x, y - 12 * scale, x, y + 18 * scale, 0.9);
    const armOffset = Math.sin(tick * 6) * 4 * scale;
    drawSketchLine(ctx, x, y - 2 * scale, x - 14 * scale, y + 6 * scale + armOffset, 0.9);
    drawSketchLine(ctx, x, y - 2 * scale, x + 14 * scale, y + 6 * scale - armOffset, 0.9);
    drawSketchLine(ctx, x, y + 18 * scale, x - 10 * scale, y + 36 * scale, 0.9);
    drawSketchLine(ctx, x, y + 18 * scale, x + 10 * scale, y + 36 * scale, 0.9);
  };

  const renderOffice = (tick) => {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fcf7f1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(77, 66, 58, 0.12)";
    ctx.lineWidth = 1;
    for (let y = 24; y < canvas.height; y += 28) {
      drawSketchLine(ctx, 12, y, canvas.width - 12, y, 0.6, 1);
    }
    ctx.strokeStyle = "rgba(219, 160, 156, 0.35)";
    drawSketchLine(ctx, 80, 12, 80, canvas.height - 12, 0.6, 1);

    ctx.strokeStyle = "#7d6a5d";
    ctx.lineWidth = 1.6;
    const floorY = canvas.height - 90;
    drawSketchLine(ctx, 40, floorY+50, canvas.width - 40, floorY+50, 1.4);

    const deskX = canvas.width * 0.35;
    const deskY = floorY - 28;
    const deskW = canvas.width * 0.28;
    const deskH = 18;
    drawSketchRect(ctx, deskX, deskY, deskW, deskH);
    drawSketchLine(ctx, deskX + 20, deskY + deskH, deskX + 20, floorY + 52);
    drawSketchLine(ctx, deskX + deskW - 20, deskY + deskH, deskX + deskW - 20, floorY + 52);

    const towerX = deskX + deskW - 34;
    const towerY = deskY - 62;
    drawSketchRect(ctx, towerX, towerY, 32, 58);
    drawSketchLine(ctx, towerX + 8, towerY + 16, towerX + 24, towerY + 16);
    drawSketchLine(ctx, towerX + 8, towerY + 30, towerX + 24, towerY + 30);

    const monitorX = deskX + deskW - 130;
    const monitorY = deskY - 74;
    drawSketchRect(ctx, monitorX, monitorY, 90, 54);
    drawSketchLine(ctx, monitorX + 36, monitorY + 54, monitorX + 54, monitorY + 72);
    drawSketchLine(ctx, monitorX + 24, monitorY + 72, monitorX + 66, monitorY + 72);

    // const chairX = deskX + deskW / 2;
    // drawSketchRect(ctx, chairX - 16, floorY - 26, 32, 16);
    // drawSketchRect(ctx, chairX - 20, floorY - 58, 40, 28);

    drawStickFigure(ctx, deskX + 80, floorY -20, 2, tick);
  };

  const updateStatus = () => {
    if (resultSummary) {
      resultSummary.textContent = "Finalize o dia para ver o resumo.";
    }
  };

  const loop = (timestamp) => {
    const exec = state.execution;
    if (!exec.lastTimestamp) exec.lastTimestamp = timestamp;
    const dt = Math.min((timestamp - exec.lastTimestamp) / 1000, 0.1);
    exec.lastTimestamp = timestamp;
    if (state.phase === "execute") {
      updateExecution(dt);
      updateExecutionStatus();
    }
    renderOffice(timestamp / 1000);
    requestAnimationFrame(loop);
  };

  phaseTabs.forEach((tab) => {
    tab.addEventListener("click", () => setPhase(tab.dataset.phase));
  });

  if (taskPoolEl) {
    taskPoolEl.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    taskPoolEl.addEventListener("drop", (event) => {
      event.preventDefault();
      const taskIdDropped = event.dataTransfer?.getData("text/plain");
      if (!taskIdDropped) return;
      removeTaskFromTimeline(taskIdDropped);
      renderTaskPool();
      renderTimeline();
      updatePlanningSummary();
    });
  }

  if (timelineEl) {
    timelineEl.addEventListener("dragover", (event) => {
      event.preventDefault();
      timelineEl.classList.add("is-drop");
    });
    timelineEl.addEventListener("dragleave", () => {
      timelineEl.classList.remove("is-drop");
    });
    timelineEl.addEventListener("drop", (event) => {
      event.preventDefault();
      timelineEl.classList.remove("is-drop");
      const taskIdDropped = event.dataTransfer?.getData("text/plain");
      if (!taskIdDropped) return;
      appendTask(taskIdDropped, timelineEl);
      renderTaskPool();
      renderTimeline();
      updatePlanningSummary();
    });
  }

  if (startDayBtn) {
    startDayBtn.disabled = true;
    startDayBtn.addEventListener("click", () => {
      startExecution();
    });
  }

  if (clearPlanBtn) {
    clearPlanBtn.addEventListener("click", () => {
      resetPlanning();
    });
  }

  if (restartDayBtn) {
    restartDayBtn.addEventListener("click", () => {
      resetPlanning();
      updateStatus();
      setPhase("plan");
    });
  }

  if (nextDayBtn) {
    nextDayBtn.addEventListener("click", () => {
      resetPlanning();
      updateStatus();
      setPhase("plan");
    });
  }

  renderTaskPool();
  renderTimeline();
  updatePlanningSummary();
  renderOffice(0);
  updateStatus();
  updateExecutionStatus();
  requestAnimationFrame(loop);
})();
