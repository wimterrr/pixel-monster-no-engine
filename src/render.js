const TILE_COLORS = {
  0: "#b49363",
  1: "#74b86d",
  2: "#3b5a46"
};

function mixHex(base, mix, amount) {
  const normalizedBase = base.length === 4
    ? `#${base[1]}${base[1]}${base[2]}${base[2]}${base[3]}${base[3]}`
    : base;
  const normalizedMix = mix.length === 4
    ? `#${mix[1]}${mix[1]}${mix[2]}${mix[2]}${mix[3]}${mix[3]}`
    : mix;

  const baseValue = Number.parseInt(normalizedBase.replace("#", ""), 16);
  const mixValue = Number.parseInt(normalizedMix.replace("#", ""), 16);

  const baseR = (baseValue >> 16) & 0xff;
  const baseG = (baseValue >> 8) & 0xff;
  const baseB = baseValue & 0xff;

  const mixR = (mixValue >> 16) & 0xff;
  const mixG = (mixValue >> 8) & 0xff;
  const mixB = mixValue & 0xff;

  const r = Math.round(baseR + (mixR - baseR) * amount);
  const g = Math.round(baseG + (mixG - baseG) * amount);
  const b = Math.round(baseB + (mixB - baseB) * amount);

  return `rgb(${r}, ${g}, ${b})`;
}

export function drawGame(ctx, state) {
  const { bundle } = state;
  const scale = 32;

  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (let y = 0; y < bundle.map.height; y += 1) {
    for (let x = 0; x < bundle.map.width; x += 1) {
      const index = y * bundle.map.width + x;
      const base = TILE_COLORS[bundle.map.ground[index]] ?? "#555";
      // Tiny per-tile variance so the map doesn't collapse into a flat dark block on mobile.
      const variance = (index % 7) * 0.014;
      ctx.fillStyle = mixHex(base, "#ffffff", variance);
      ctx.fillRect(x * scale, y * scale, scale, scale);

      if (bundle.map.ground[index] === 1) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
        ctx.fillRect(x * scale + 4, y * scale + 6, 6, 10);
        ctx.fillRect(x * scale + 18, y * scale + 4, 5, 12);
      }

      if (bundle.map.collision[index] === 1) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }

      ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
      ctx.strokeRect(x * scale + 0.5, y * scale + 0.5, scale - 1, scale - 1);
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
