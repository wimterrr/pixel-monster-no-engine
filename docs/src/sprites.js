function putPixel(imageData, x, y, r, g, b, a = 255) {
  const idx = (y * imageData.width + x) * 4;
  imageData.data[idx] = r;
  imageData.data[idx + 1] = g;
  imageData.data[idx + 2] = b;
  imageData.data[idx + 3] = a;
}

function fillRect(imageData, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      putPixel(imageData, x, y, color[0], color[1], color[2], color[3] ?? 255);
    }
  }
}

function strokeRect(imageData, x0, y0, w, h, color) {
  for (let x = x0; x < x0 + w; x += 1) {
    putPixel(imageData, x, y0, color[0], color[1], color[2], color[3] ?? 255);
    putPixel(imageData, x, y0 + h - 1, color[0], color[1], color[2], color[3] ?? 255);
  }
  for (let y = y0; y < y0 + h; y += 1) {
    putPixel(imageData, x0, y, color[0], color[1], color[2], color[3] ?? 255);
    putPixel(imageData, x0 + w - 1, y, color[0], color[1], color[2], color[3] ?? 255);
  }
}

function makeSpriteSheetCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export function createSprites() {
  const tile = 16;
  // 16px grid: keep tiles in the first row, then allocate room for basic sprite frames.
  const sheet = makeSpriteSheetCanvas(128, 64);
  const imageData = sheet.ctx.createImageData(sheet.canvas.width, sheet.canvas.height);

  // Palette (soft Pokemon-like, limited).
  const ink = [30, 34, 28];
  const grassA = [94, 178, 92];
  const grassB = [75, 150, 79];
  const pathA = [206, 170, 110];
  const pathB = [180, 140, 85];
  const wallA = [70, 88, 76];
  const wallB = [52, 68, 58];
  const playerA = [255, 214, 102];
  const playerB = [214, 97, 59];
  const monsterA = [155, 229, 100];
  const monsterB = [51, 92, 51];

  // Tile 0: path
  fillRect(imageData, 0, 0, tile, tile, pathA);
  for (let i = 0; i < 40; i += 1) {
    const x = (i * 7) % tile;
    const y = (i * 11) % tile;
    putPixel(imageData, x, y, pathB[0], pathB[1], pathB[2]);
  }
  strokeRect(imageData, 0, 0, tile, tile, ink);

  // Tile 1: grass
  fillRect(imageData, tile, 0, tile, tile, grassA);
  for (let y = 2; y < tile; y += 4) {
    for (let x = 1; x < tile; x += 5) {
      putPixel(imageData, tile + x, y, grassB[0], grassB[1], grassB[2]);
      putPixel(imageData, tile + x + 1, y + 1, grassB[0], grassB[1], grassB[2]);
    }
  }
  strokeRect(imageData, tile, 0, tile, tile, ink);

  // Tile 2: wall
  fillRect(imageData, tile * 2, 0, tile, tile, wallA);
  for (let y = 2; y < tile; y += 6) {
    for (let x = 1; x < tile; x += 7) {
      fillRect(imageData, tile * 2 + x, y, 5, 2, wallB);
    }
  }
  strokeRect(imageData, tile * 2, 0, tile, tile, ink);

  function drawPlayerFrame(x0, y0, facing, step) {
    fillRect(imageData, x0, y0, tile, tile, [0, 0, 0, 0]);

    const headX = x0 + 6;
    const headY = y0 + 3;
    fillRect(imageData, headX, headY, 4, 4, playerA); // head
    fillRect(imageData, x0 + 5, y0 + 7, 6, 5, playerB); // body

    // Legs: toggle one pixel to imply walking.
    const stepOffset = step === 1 ? 1 : 0;
    const leftLegX = x0 + 5 + (facing === "left" ? -stepOffset : 0);
    const rightLegX = x0 + 9 + (facing === "right" ? stepOffset : 0);
    fillRect(imageData, leftLegX, y0 + 12, 2, 3, ink);
    fillRect(imageData, rightLegX, y0 + 12, 2, 3, ink);

    // Facing hint: a tiny accent pixel on the side you're facing.
    if (facing === "left") putPixel(imageData, x0 + 4, y0 + 9, playerA[0], playerA[1], playerA[2]);
    if (facing === "right") putPixel(imageData, x0 + 11, y0 + 9, playerA[0], playerA[1], playerA[2]);
    if (facing === "up") putPixel(imageData, x0 + 8, y0 + 2, playerA[0], playerA[1], playerA[2]);
    if (facing === "down") putPixel(imageData, x0 + 8, y0 + 14, playerA[0], playerA[1], playerA[2]);

    strokeRect(imageData, x0 + 4, y0 + 2, 8, 11, ink);
  }

  const playerRowY = tile;
  drawPlayerFrame(tile * 0, playerRowY, "down", 0);
  drawPlayerFrame(tile * 1, playerRowY, "down", 1);
  drawPlayerFrame(tile * 2, playerRowY, "up", 0);
  drawPlayerFrame(tile * 3, playerRowY, "up", 1);
  drawPlayerFrame(tile * 4, playerRowY, "left", 0);
  drawPlayerFrame(tile * 5, playerRowY, "left", 1);
  drawPlayerFrame(tile * 6, playerRowY, "right", 0);
  drawPlayerFrame(tile * 7, playerRowY, "right", 1);

  // Monster (sprout) frame 0.
  const mx = 0;
  const my = tile * 2;
  fillRect(imageData, mx, my, tile, tile, [0, 0, 0, 0]);
  fillRect(imageData, mx + 6, my + 8, 4, 4, monsterA);
  fillRect(imageData, mx + 5, my + 11, 6, 2, monsterB);
  putPixel(imageData, mx + 7, my + 9, ink[0], ink[1], ink[2]);
  putPixel(imageData, mx + 9, my + 9, ink[0], ink[1], ink[2]);
  putPixel(imageData, mx + 8, my + 10, ink[0], ink[1], ink[2]);
  strokeRect(imageData, mx + 4, my + 7, 8, 7, ink);

  // UI window corner (tiny 9-slice seed)
  const ux = tile * 2;
  const uy = tile * 2;
  fillRect(imageData, ux, uy, tile, tile, [0, 0, 0, 0]);
  fillRect(imageData, ux + 2, uy + 2, 12, 12, [242, 233, 201]);
  strokeRect(imageData, ux + 1, uy + 1, 14, 14, ink);
  strokeRect(imageData, ux + 3, uy + 3, 10, 10, [214, 97, 59]);

  sheet.ctx.putImageData(imageData, 0, 0);

  return {
    sheet: sheet.canvas,
    tileSize: tile,
    tiles: {
      path: { x: 0, y: 0 },
      grass: { x: tile, y: 0 },
      wall: { x: tile * 2, y: 0 }
    },
    sprites: {
      // Player: 4 directions x 2 steps.
      player_down_0: { x: tile * 0, y: tile },
      player_down_1: { x: tile * 1, y: tile },
      player_up_0: { x: tile * 2, y: tile },
      player_up_1: { x: tile * 3, y: tile },
      player_left_0: { x: tile * 4, y: tile },
      player_left_1: { x: tile * 5, y: tile },
      player_right_0: { x: tile * 6, y: tile },
      player_right_1: { x: tile * 7, y: tile },
      // Monsters.
      sprout_0: { x: 0, y: tile * 2 }
    }
  };
}
