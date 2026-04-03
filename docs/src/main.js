import { drawGame } from "./render.js";
import { SAVE_KEY, deserializeSave, serializeSave } from "./save.js";
import { createSprites } from "./sprites.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const receiptNode = document.querySelector("#receipt");
const battleTextNode = document.querySelector("#battle-text");
const payloadNode = document.querySelector("#payload");
const logNode = document.querySelector("#log");
const fightButton = document.querySelector("#fight-btn");
const captureButton = document.querySelector("#capture-btn");
const saveButton = document.querySelector("#save-btn");
const reloadButton = document.querySelector("#reload-btn");
const moveButtons = Array.from(document.querySelectorAll("[data-move]"));
const hudNode = document.querySelector("#hud");
const menuButton = document.querySelector("#menu-btn");
const panelNode = document.querySelector(".panel");
const panelCloseButton = document.querySelector("#panel-close");
const panelBackdrop = document.querySelector("#panel-backdrop");

function createInitialState(bundle) {
  const startCheckpoint = bundle.checkpoints.find(
    (checkpoint) => checkpoint.id === bundle.startCheckpointId
  );

  return {
    bundle,
    sprites: createSprites(),
    checkpointId: startCheckpoint.id,
    playerTile: { ...startCheckpoint.tile },
    roster: [],
    inventory: {
      captureOrb: 1
    },
    battle: null,
    lastBattlePayload: null,
    log: [
      "Compiled Route01 loaded.",
      "Move with arrow keys or WASD.",
      "The first capture proves the reload receipt."
    ]
  };
}

function tileIndex(bundle, x, y) {
  return y * bundle.map.width + x;
}

function isBlocked(bundle, x, y) {
  if (x < 0 || y < 0 || x >= bundle.map.width || y >= bundle.map.height) {
    return true;
  }

  return bundle.map.collision[tileIndex(bundle, x, y)] === 1;
}

function findCheckpoint(state) {
  return state.bundle.checkpoints.find(
    (checkpoint) =>
      checkpoint.tile.x === state.playerTile.x && checkpoint.tile.y === state.playerTile.y
  );
}

function findEncounter(state) {
  return state.bundle.encounterZones.find((zone) => {
    const withinX =
      state.playerTile.x >= zone.rect.x && state.playerTile.x < zone.rect.x + zone.rect.width;
    const withinY =
      state.playerTile.y >= zone.rect.y && state.playerTile.y < zone.rect.y + zone.rect.height;
    return withinX && withinY;
  });
}

function pushLog(state, message) {
  state.log = [message, ...state.log].slice(0, 6);
}

function syncUi(state) {
  const rosterNames =
    state.roster.map((monsterId) => state.bundle.monsters[monsterId]?.name ?? monsterId).join(", ") ||
    "none";

  receiptNode.innerHTML = `
    <dt>Checkpoint</dt><dd>${state.checkpointId}</dd>
    <dt>Roster Delta</dt><dd>${rosterNames}</dd>
    <dt>Capture Orbs</dt><dd>${state.inventory.captureOrb}</dd>
    <dt>Bundle Source</dt><dd>${state.bundle.source.map}</dd>
  `;

  if (state.battle) {
    battleTextNode.textContent = `${state.battle.monsterName} blocked the route.`;
  } else {
    battleTextNode.textContent = "Step into grass to trigger the first encounter.";
  }

  payloadNode.textContent = state.lastBattlePayload
    ? JSON.stringify(state.lastBattlePayload, null, 2)
    : "No battle payload yet.";

  fightButton.disabled = !state.battle;
  captureButton.disabled = !state.battle;

  logNode.innerHTML = state.log.map((item) => `<li>${item}</li>`).join("");

  hudNode.innerHTML = `
    <span><strong>CP</strong> ${state.checkpointId}</span>
    <span><strong>Orbs</strong> ${state.inventory.captureOrb}</span>
    <span><strong>Roster</strong> ${state.roster.length}</span>
  `;
  drawGame(ctx, state);
}

function triggerEncounter(state, zone) {
  const encounter = state.bundle.encounters[zone.encounterId];
  const monster = state.bundle.monsters[encounter.monsterId];
  state.battle = {
    encounterId: zone.encounterId,
    monsterId: encounter.monsterId,
    monsterName: monster.name
  };
  pushLog(state, `Encounter started: ${monster.name}.`);
}

function movePlayer(state, dx, dy) {
  if (state.battle) {
    return;
  }

  const nextX = state.playerTile.x + dx;
  const nextY = state.playerTile.y + dy;

  if (isBlocked(state.bundle, nextX, nextY)) {
    pushLog(state, "Blocked by collision in the compiled bundle.");
    return;
  }

  state.playerTile = { x: nextX, y: nextY };

  const checkpoint = findCheckpoint(state);
  if (checkpoint) {
    state.checkpointId = checkpoint.id;
    pushLog(state, `Checkpoint aligned: ${checkpoint.id}.`);
  }

  const zone = findEncounter(state);
  if (zone) {
    triggerEncounter(state, zone);
  }
}

function attemptMove(state, dx, dy) {
  movePlayer(state, dx, dy);
  syncUi(state);
}

function resolveFight(state) {
  if (!state.battle) {
    return;
  }

  state.lastBattlePayload = {
    routeId: state.bundle.routeId,
    encounterId: state.battle.encounterId,
    outcome: "escaped",
    checkpointId: state.checkpointId,
    rosterSize: state.roster.length,
    captureOrbRemaining: state.inventory.captureOrb
  };
  pushLog(state, `Fight resolved without capture: ${state.battle.monsterName}.`);
  state.battle = null;
}

function resolveCapture(state) {
  if (!state.battle) {
    return;
  }

  if (state.inventory.captureOrb <= 0) {
    pushLog(state, "No capture orbs left to spend.");
    return;
  }

  state.inventory.captureOrb -= 1;
  if (!state.roster.includes(state.battle.monsterId)) {
    state.roster.push(state.battle.monsterId);
  }
  state.lastBattlePayload = {
    routeId: state.bundle.routeId,
    encounterId: state.battle.encounterId,
    outcome: "captured",
    checkpointId: state.checkpointId,
    rosterDelta: [...state.roster],
    captureOrbRemaining: state.inventory.captureOrb
  };
  pushLog(state, `Captured ${state.battle.monsterName}; orb spend persisted.`);
  state.battle = null;
}

function saveState(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(serializeSave(state)));
  pushLog(state, `Saved reload receipt at ${state.checkpointId}.`);
}

function reloadState(state) {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) {
    pushLog(state, "No save file found for Route01.");
    return;
  }

  try {
    const loaded = deserializeSave(state.bundle, JSON.parse(raw));
    state.checkpointId = loaded.checkpointId;
    state.playerTile = loaded.playerTile;
    state.roster = loaded.roster;
    state.inventory = loaded.inventory;
    state.lastBattlePayload = loaded.lastBattlePayload;
    state.battle = null;
    pushLog(state, `Reloaded receipt at ${state.checkpointId}.`);
  } catch (error) {
    pushLog(state, `Save reload blocked: ${error.message}`);
  }
}

let bundle;
try {
  const primaryUrl = new URL("./generated/Route01.bundle.json", window.location.href);
  primaryUrl.searchParams.set("v", "2");
  let response = await fetch(primaryUrl.toString(), { cache: "no-store" });
  let attempted = response.url || primaryUrl.toString();

  if (!response.ok) {
    const owner = (window.location.hostname || "").split(".")[0];
    const repo = (window.location.pathname || "").split("/").filter(Boolean)[0];

    if (owner && repo) {
      const fallbackUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/docs/generated/Route01.bundle.json`;
      response = await fetch(fallbackUrl, { cache: "no-store" });
      attempted = `${attempted} -> ${fallbackUrl}`;
    }
  }

  if (!response.ok) {
    throw new Error(`Bundle fetch failed: ${response.status} (${attempted})`);
  }

  bundle = await response.json();
} catch (error) {
  battleTextNode.textContent = "Failed to load the compiled bundle.";
  payloadNode.textContent = String(error?.message || error);
  throw error;
}

const state = createInitialState(bundle);

window.addEventListener("keydown", (event) => {
  const moves = {
    ArrowUp: [0, -1],
    w: [0, -1],
    W: [0, -1],
    ArrowDown: [0, 1],
    s: [0, 1],
    S: [0, 1],
    ArrowLeft: [-1, 0],
    a: [-1, 0],
    A: [-1, 0],
    ArrowRight: [1, 0],
    d: [1, 0],
    D: [1, 0]
  };

  const move = moves[event.key];
  if (!move) {
    return;
  }

  event.preventDefault();
  attemptMove(state, move[0], move[1]);
});

const buttonMoves = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0]
};

let moveInterval = null;

function stopMoveRepeat() {
  if (moveInterval) {
    clearInterval(moveInterval);
    moveInterval = null;
  }
}

function startMoveRepeat(dx, dy) {
  stopMoveRepeat();
  attemptMove(state, dx, dy);
  moveInterval = setInterval(() => attemptMove(state, dx, dy), 140);
}

for (const button of moveButtons) {
  const dir = button.dataset.move;
  const move = buttonMoves[dir];
  if (!move) {
    continue;
  }

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    startMoveRepeat(move[0], move[1]);
  });

  button.addEventListener("pointerup", stopMoveRepeat);
  button.addEventListener("pointercancel", stopMoveRepeat);
  button.addEventListener("pointerleave", stopMoveRepeat);
}

fightButton.addEventListener("click", () => {
  resolveFight(state);
  syncUi(state);
});

captureButton.addEventListener("click", () => {
  resolveCapture(state);
  syncUi(state);
});

saveButton.addEventListener("click", () => {
  saveState(state);
  syncUi(state);
});

reloadButton.addEventListener("click", () => {
  reloadState(state);
  syncUi(state);
});

syncUi(state);

function setPanelOpen(open) {
  if (!panelNode || !panelBackdrop) {
    return;
  }
  panelNode.classList.toggle("open", open);
  panelBackdrop.hidden = !open;
}

menuButton?.addEventListener("click", () => setPanelOpen(true));
panelCloseButton?.addEventListener("click", () => setPanelOpen(false));
panelBackdrop?.addEventListener("click", () => setPanelOpen(false));
