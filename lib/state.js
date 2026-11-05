'use strict';
// Extracts the facts the rule engine needs from a decoded save slot.

const QUEST_RE = /\/PBZQuest\/([^/]+)\/([^./]+)\./;

function questInfo(q) {
  const m = QUEST_RE.exec(q.QuestClass || '');
  const id = m ? m[2] : (q.QuestClass || '?');
  const folder = m ? m[1] : '?';
  const completion = String(q.QuestCompletion || '').replace('EQuestCompletion::QC_', '');
  const branches = {};
  let progress = null;
  for (const b of q.QuestBranches || []) {
    const type = String(b.BranchType || '').replace('EBranchType::', '').replace(/^Branch/, '');
    branches[b.BranchID] = type;
    // Counter arrays (e.g. [1,1,0,0,0]) on the active branch: completed slots / total.
    if (type === 'Activating' && Array.isArray(b.TasksProgress) && b.TasksProgress.length > 1) {
      const done = b.TasksProgress.filter((x) => x > 0).length;
      if (!progress || done > 0) progress = { done, total: b.TasksProgress.length };
    }
  }
  return { id, folder, completion, branches, progress };
}

function extract(data) {
  const sys = data.PBZGameSystem || {};
  const bell = data.BellManager || {};
  const quests = new Map();
  for (const q of data.Narrative?.NarrativeSavedQuests || []) {
    const qi = questInfo(q);
    quests.set(qi.id, qi);
  }
  const bosses = new Map();
  for (const [k, v] of Object.entries(data.BossRecord || {})) {
    let attempts = 0, kills = 0;
    for (const r of Object.values(v?.Records || {})) { attempts += r.AttemptCount || 0; kills += r.KillCount || 0; }
    bosses.set(k, { attempts, kills });
  }
  // Level names appear as "PBZ_<Name>_WP" prefixes on saved actors.
  const levels = new Set();
  const addLevel = (s) => { const m = /^PBZ_([A-Za-z0-9]+)_WP/.exec(s || ''); if (m) levels.add(m[1].toLowerCase()); };
  addLevel(sys.CurrentLevelName);
  for (const k of Object.keys(data.LevelActorManager || {})) addLevel(k);
  for (const k of data.MapSubsystem?.EndedLockObjGuids || []) addLevel(k);

  return {
    dateTime: sys.DateTimeString || '',
    playSeconds: sys.HasGameTime || 0,
    currentLevel: (/^PBZ_([A-Za-z0-9]+)_WP/.exec(sys.CurrentLevelName || '') || [])[1] || sys.CurrentLevelName || '',
    cycle: sys.CycleCount || 0,
    finished: !!sys.bIsFinishGame,
    maps: new Set(bell.UnLockBigMapMaskWidgetNames || []),
    bells: new Set(bell.ActivateBellIDs || []),
    levels,
    bosses,
    quests,
  };
}

module.exports = { extract };
