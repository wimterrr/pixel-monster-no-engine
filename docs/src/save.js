export const SAVE_KEY = "pixel-monster-no-engine.route01.save";

export function serializeSave(state) {
  return {
    routeId: state.bundle.routeId,
    checkpointId: state.checkpointId,
    roster: [...state.roster],
    inventory: { ...state.inventory },
    lastBattlePayload: state.lastBattlePayload
  };
}

function parseRoster(bundle, rawRoster) {
  if (!Array.isArray(rawRoster)) {
    return [];
  }

  const roster = [];
  const seen = new Set();
  for (const monsterId of rawRoster) {
    if (typeof monsterId !== "string" || !bundle.monsters[monsterId]) {
      throw new Error(`Unknown roster monster "${monsterId}".`);
    }
    if (seen.has(monsterId)) {
      throw new Error(`Duplicate roster monster "${monsterId}".`);
    }
    seen.add(monsterId);
    roster.push(monsterId);
  }

  return roster;
}

function parseLastBattlePayload(bundle, rawPayload, fallbackSave) {
  if (rawPayload == null) {
    return null;
  }

  if (typeof rawPayload !== "object") {
    throw new Error("Saved battle payload must be an object.");
  }

  if (rawPayload.routeId !== bundle.routeId) {
    throw new Error(
      `Saved battle payload route "${rawPayload.routeId ?? "unknown"}" does not match bundle "${bundle.routeId}".`
    );
  }

  const encounter = bundle.encounters[rawPayload.encounterId];
  if (!encounter) {
    throw new Error(`Unknown encounter "${rawPayload.encounterId}" in saved battle payload.`);
  }

  const outcome = rawPayload.outcome;
  if (outcome !== "captured" && outcome !== "escaped") {
    throw new Error(`Invalid battle outcome "${outcome}".`);
  }

  const checkpointId = rawPayload.checkpointId ?? fallbackSave.checkpointId;
  const checkpoint = bundle.checkpoints.find((candidate) => candidate.id === checkpointId);
  if (!checkpoint) {
    throw new Error(`Unknown checkpoint "${checkpointId}" in saved battle payload.`);
  }

  const captureOrbRemaining = Number(
    rawPayload.captureOrbRemaining ?? fallbackSave.inventory?.captureOrb
  );
  if (!Number.isInteger(captureOrbRemaining) || captureOrbRemaining < 0) {
    throw new Error(
      `Invalid saved capture orb count "${rawPayload.captureOrbRemaining}".`
    );
  }

  const payload = {
    routeId: bundle.routeId,
    encounterId: rawPayload.encounterId,
    outcome,
    checkpointId: checkpoint.id,
    captureOrbRemaining
  };

  if (rawPayload.rosterSize != null) {
    const rosterSize = Number(rawPayload.rosterSize);
    if (!Number.isInteger(rosterSize) || rosterSize < 0) {
      throw new Error(`Invalid saved roster size "${rawPayload.rosterSize}".`);
    }
    if (Array.isArray(fallbackSave.roster) && rosterSize !== fallbackSave.roster.length) {
      throw new Error(
        `Saved battle payload roster size "${rosterSize}" does not match saved roster length "${fallbackSave.roster.length}".`
      );
    }
    payload.rosterSize = rosterSize;
  }

  if (rawPayload.rosterDelta != null) {
    const rosterDelta = parseRoster(bundle, rawPayload.rosterDelta);
    if (Array.isArray(fallbackSave.roster) && rosterDelta.length !== fallbackSave.roster.length) {
      throw new Error(
        `Saved battle payload roster delta length "${rosterDelta.length}" does not match saved roster length "${fallbackSave.roster.length}".`
      );
    }

    if (
      Array.isArray(fallbackSave.roster) &&
      rosterDelta.some((monsterId, index) => monsterId !== fallbackSave.roster[index])
    ) {
      throw new Error("Saved battle payload roster delta does not match saved roster.");
    }

    payload.rosterDelta = rosterDelta;
  }

  if (captureOrbRemaining !== Number(fallbackSave.inventory?.captureOrb ?? 1)) {
    throw new Error(
      `Saved battle payload orb count "${captureOrbRemaining}" does not match saved inventory "${fallbackSave.inventory?.captureOrb ?? 1}".`
    );
  }

  return payload;
}

export function deserializeSave(bundle, rawSave) {
  if (!rawSave || typeof rawSave !== "object") {
    throw new Error("Save payload must be an object.");
  }

  if (rawSave.routeId !== bundle.routeId) {
    throw new Error(
      `Save route "${rawSave.routeId ?? "unknown"}" does not match bundle "${bundle.routeId}".`
    );
  }

  const checkpoint = bundle.checkpoints.find((candidate) => candidate.id === rawSave.checkpointId);
  if (!checkpoint) {
    throw new Error(`Unknown checkpoint "${rawSave.checkpointId}" in save.`);
  }

  const captureOrb = Number(rawSave.inventory?.captureOrb ?? 1);
  if (!Number.isInteger(captureOrb) || captureOrb < 0) {
    throw new Error(`Invalid capture orb count "${rawSave.inventory?.captureOrb}".`);
  }

  return {
    checkpointId: checkpoint.id,
    playerTile: { ...checkpoint.tile },
    roster: parseRoster(bundle, rawSave.roster),
    inventory: {
      captureOrb
    },
    lastBattlePayload: parseLastBattlePayload(bundle, rawSave.lastBattlePayload, rawSave),
    battle: null
  };
}
