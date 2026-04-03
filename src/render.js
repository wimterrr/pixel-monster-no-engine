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

export function drawGame(ctx, state) {
  const { bundle } = state;
  const { sprites } = state;
  const zoom = state.render?.zoom || 3;
  const scale = (bundle.tileSize || 16) * zoom;
  const overlayHeight = Math.round(scale * 2.25);
  const fontSize = Math.max(12, Math.round(scale * 0.35));

  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let y = 0; y < bundle.map.height; y += 1) {
    for (let x = 0; x < bundle.map.width; x += 1) {
      const index = y * bundle.map.width + x;
      const ground = bundle.map.ground[index];
      const tileName = ground === 1 ? "grass" : ground === 2 ? "wall" : "path";
      drawTile(ctx, sprites, tileName, x * scale, y * scale, scale);

      if (bundle.map.collision[index] === 1) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.20)";
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
  }

  for (const checkpoint of bundle.checkpoints) {
    ctx.fillStyle = checkpoint.id === state.checkpointId ? "rgba(214, 97, 59, 0.55)" : "rgba(242, 233, 201, 0.35)";
    ctx.fillRect(checkpoint.tile.x * scale + 4, checkpoint.tile.y * scale + 4, scale - 8, scale - 8);
  }

  drawSprite(
    ctx,
    sprites,
    `player_${state.playerFacing}_${state.playerStep}`,
    state.playerTile.x * scale,
    state.playerTile.y * scale,
    scale
  );

  if (state.battle) {
    ctx.fillStyle = "rgba(8, 12, 10, 0.72)";
    ctx.fillRect(0, ctx.canvas.height - overlayHeight, ctx.canvas.width, overlayHeight);
    ctx.fillStyle = "#f2e9c9";
    ctx.font = `${fontSize}px monospace`;
    ctx.fillText(
      `Encounter: ${state.battle.monsterName}`,
      Math.round(scale * 0.35),
      ctx.canvas.height - Math.round(overlayHeight * 0.42)
    );
    const external = state.externalSprites?.sprout;
    const size = Math.round(scale * 1.4);
    const dx = ctx.canvas.width - size - Math.round(scale * 0.35);
    const dy = ctx.canvas.height - size - Math.round(scale * 0.35);
    if (external) {
      ctx.drawImage(external, dx, dy, size, size);
    } else {
      drawSprite(ctx, sprites, "sprout_0", dx, dy, size);
    }
  }
}
