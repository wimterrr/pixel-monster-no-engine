function drawTile(ctx, sprites, tileName, dx, dy, scale) {
  const source = sprites.tiles[tileName];
  ctx.drawImage(
    sprites.sheet,
    source.x,
    source.y,
    sprites.tileSize,
    sprites.tileSize,
    dx,
    dy,
    scale,
    scale
  );
}

function drawSprite(ctx, sprites, spriteName, dx, dy, scale) {
  const source = sprites.sprites[spriteName];
  ctx.drawImage(
    sprites.sheet,
    source.x,
    source.y,
    sprites.tileSize,
    sprites.tileSize,
    dx,
    dy,
    scale,
    scale
  );
}

function drawWindow(ctx, x, y, w, h) {
  // Simple retro window: thick border + inner accent border.
  ctx.fillStyle = "rgba(247, 240, 207, 0.95)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(26, 36, 27, 0.95)";
  ctx.lineWidth = 4;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  ctx.strokeStyle = "rgba(214, 97, 59, 0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 8, y + 8, w - 16, h - 16);
}

export function drawGame(ctx, state) {
  const { bundle } = state;
  const { sprites } = state;
  const zoom = state.render?.zoom || 3;
  const scale = (bundle.tileSize || 16) * zoom;
  const view = state.render?.viewTiles || { width: bundle.map.width, height: bundle.map.height };
  const overlayHeight = Math.round(scale * 2.35);
  const fontSize = Math.max(12, Math.round(scale * 0.32));

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const maxCameraX = Math.max(0, bundle.map.width - view.width);
  const maxCameraY = Math.max(0, bundle.map.height - view.height);
  const cameraX = Math.min(
    maxCameraX,
    Math.max(0, state.playerTile.x - Math.floor(view.width / 2))
  );
  const cameraY = Math.min(
    maxCameraY,
    Math.max(0, state.playerTile.y - Math.floor(view.height / 2))
  );

  for (let sy = 0; sy < view.height; sy += 1) {
    const y = cameraY + sy;
    if (y < 0 || y >= bundle.map.height) continue;
    for (let sx = 0; sx < view.width; sx += 1) {
      const x = cameraX + sx;
      if (x < 0 || x >= bundle.map.width) continue;

      const index = y * bundle.map.width + x;
      const ground = bundle.map.ground[index];
      const tileName = ground === 1 ? "grass" : ground === 2 ? "wall" : "path";
      drawTile(ctx, sprites, tileName, sx * scale, sy * scale, scale);

      if (bundle.map.collision[index] === 1) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.20)";
        ctx.fillRect(sx * scale, sy * scale, scale, scale);
      }
    }
  }

  for (const checkpoint of bundle.checkpoints) {
    ctx.fillStyle = checkpoint.id === state.checkpointId ? "rgba(214, 97, 59, 0.55)" : "rgba(242, 233, 201, 0.35)";
    const cx = checkpoint.tile.x - cameraX;
    const cy = checkpoint.tile.y - cameraY;
    if (cx < 0 || cy < 0 || cx >= view.width || cy >= view.height) continue;
    ctx.fillRect(cx * scale + 4, cy * scale + 4, scale - 8, scale - 8);
  }

  drawSprite(
    ctx,
    sprites,
    `player_${state.playerFacing}_${state.playerStep}`,
    (state.playerTile.x - cameraX) * scale,
    (state.playerTile.y - cameraY) * scale,
    scale
  );

  // HUD window (top-left).
  drawWindow(ctx, 8, 8, Math.round(scale * 4.8), Math.round(scale * 1.35));
  ctx.fillStyle = "rgba(26, 36, 27, 0.92)";
  ctx.font = `${Math.max(12, Math.round(fontSize * 0.95))}px monospace`;
  ctx.fillText(
    `CP ${state.checkpointId}  ORB ${state.inventory.captureOrb}  R ${state.roster.length}`,
    18,
    Math.round(scale * 0.9)
  );

  if (state.battle) {
    // Battle dialog window (bottom).
    const wx = 8;
    const wy = ctx.canvas.height - overlayHeight - 8;
    const ww = ctx.canvas.width - 16;
    const wh = overlayHeight;
    drawWindow(ctx, wx, wy, ww, wh);
    ctx.fillStyle = "rgba(26, 36, 27, 0.92)";
    ctx.font = `${fontSize}px monospace`;
    ctx.fillText(`A wild ${state.battle.monsterName} appeared.`, wx + 18, wy + Math.round(scale * 0.75));

    const external = state.externalSprites?.sprout;
    const size = Math.round(scale * 1.4);
    const dx = ctx.canvas.width - size - Math.round(scale * 0.55);
    const dy = wy + Math.round(scale * 0.25);
    if (external) {
      ctx.drawImage(external, dx, dy, size, size);
    } else {
      drawSprite(ctx, sprites, "sprout_0", dx, dy, size);
    }
  } else {
    // Always-on hint window so it reads like a game, not a web dashboard.
    const wx = 8;
    const wh = Math.round(scale * 1.6);
    const wy = ctx.canvas.height - wh - 8;
    const ww = ctx.canvas.width - 16;
    drawWindow(ctx, wx, wy, ww, wh);
    ctx.fillStyle = "rgba(26, 36, 27, 0.92)";
    ctx.font = `${fontSize}px monospace`;
    ctx.fillText("Walk into tall grass to trigger an encounter.", wx + 18, wy + Math.round(scale * 0.85));
  }
}
