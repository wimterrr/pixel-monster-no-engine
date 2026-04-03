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
  const sheet = makeSpriteSheetCanvas(64, 64);
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

  // Sprite 3: player (simple chibi)
  const px = 0;
  const py = tile;
  fillRect(imageData, px, py, tile, tile, [0, 0, 0, 0]);
  fillRect(imageData, px + 6, py + 3, 4, 4, playerA); // head
  fillRect(imageData, px + 5, py + 7, 6, 5, playerB); // body
  fillRect(imageData, px + 5, py + 12, 2, 3, ink); // left leg
  fillRect(imageData, px + 9, py + 12, 2, 3, ink); // right leg
  strokeRect(imageData, px + 4, py + 2, 8, 11, ink);

  // Sprite 4: monster (sprout)
  const mx = tile;
  const my = tile;
  fillRect(imageData, mx, my, tile, tile, [0, 0, 0, 0]);
  fillRect(imageData, mx + 6, my + 8, 4, 4, monsterA);
  fillRect(imageData, mx + 5, my + 11, 6, 2, monsterB);
  putPixel(imageData, mx + 7, my + 9, ink[0], ink[1], ink[2]);
  putPixel(imageData, mx + 9, my + 9, ink[0], ink[1], ink[2]);
  putPixel(imageData, mx + 8, my + 10, ink[0], ink[1], ink[2]);
  strokeRect(imageData, mx + 4, my + 7, 8, 7, ink);

  // Sprite 5: UI window corner (tiny 9-slice seed)
  const ux = tile * 2;
  const uy = tile;
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
      player: { x: 0, y: tile },
      sprout: { x: tile, y: tile }
    }
  };
}

