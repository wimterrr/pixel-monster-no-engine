const TILE_COLORS = {
  0: "#8a724b",
  1: "#5c8a53",
  2: "#304437"
};

export function drawGame(ctx, state) {
  const { bundle } = state;
  const scale = 32;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let y = 0; y < bundle.map.height; y += 1) {
    for (let x = 0; x < bundle.map.width; x += 1) {
      const index = y * bundle.map.width + x;
      ctx.fillStyle = TILE_COLORS[bundle.map.ground[index]] ?? "#555";
      ctx.fillRect(x * scale, y * scale, scale, scale);

      if (bundle.map.ground[index] === 1) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
        ctx.fillRect(x * scale + 4, y * scale + 6, 6, 10);
        ctx.fillRect(x * scale + 18, y * scale + 4, 5, 12);
      }
    }
  }

  for (const checkpoint of bundle.checkpoints) {
    ctx.fillStyle = checkpoint.id === state.checkpointId ? "#d6613b" : "#f2e9c9";
    ctx.fillRect(checkpoint.tile.x * scale + 8, checkpoint.tile.y * scale + 8, 16, 16);
  }

  ctx.fillStyle = "#ffd166";
  ctx.fillRect(state.playerTile.x * scale + 7, state.playerTile.y * scale + 7, 18, 18);

  if (state.battle) {
    ctx.fillStyle = "rgba(8, 12, 10, 0.72)";
    ctx.fillRect(0, ctx.canvas.height - 68, ctx.canvas.width, 68);
    ctx.fillStyle = "#f2e9c9";
    ctx.font = "16px monospace";
    ctx.fillText(`Encounter: ${state.battle.monsterName}`, 16, ctx.canvas.height - 28);
  }
}
