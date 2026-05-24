// ============================================================
//  storage.js — Persistence, checksums, ranked stats, migration
// ============================================================

// --------------- User identity ---------------
function getOrCreateUserId() {
  let userId = localStorage.getItem('tracendle_user_id');
  if (!userId) {
    userId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('tracendle_user_id', userId);
  }
  return userId;
}

function getShortUserSuffix(userId) {
  if (!userId) userId = localStorage.getItem('tracendle_user_id');
  if (!userId) userId = getOrCreateUserId();
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return String(Math.abs(hash) % 10000).padStart(4, '0');
}

function formatUsernameWithSuffix(username, userId) {
  const name = (username || 'Anonymous').trim() || 'Anonymous';
  const suffix = getShortUserSuffix(userId);
  return `${name}<span class="username-suffix">#${suffix}</span>`;
}

function formatUsernameWithSuffixText(username, userId) {
  const name = (username || 'Anonymous').trim() || 'Anonymous';
  return `${name}#${getShortUserSuffix(userId)}`;
}

// --------------- Checksum (anti-tamper) ---------------
function generateChecksum(obj) {
  const salt = "Satono Diamond";
  const str = JSON.stringify(obj) + salt;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(16);
}

// --------------- Heardle ? Voicedle migration ---------------
function migrateHeardleToVoicedle() {
  const legacy = allPersistentData.heardle || allPersistentData.VOICEDLE;
  if (legacy && !allPersistentData.voicedle) {
    allPersistentData.voicedle = legacy;
  }
  if (allPersistentData.heardle || allPersistentData.VOICEDLE) {
    delete allPersistentData.heardle;
    delete allPersistentData.VOICEDLE;
    savePersistentData();
  }
  const oldVol = localStorage.getItem('heardle_volume');
  if (oldVol !== null && localStorage.getItem('voicedle_volume') === null) {
    localStorage.setItem('voicedle_volume', oldVol);
    localStorage.removeItem('heardle_volume');
  }
}

// --------------- Save / load allPersistentData ---------------
function savePersistentData() {
  const wrapper = {
    data: allPersistentData,
    checksum: generateChecksum(allPersistentData)
  };
  localStorage.setItem('uma_wordle_v2_stats', JSON.stringify(wrapper));
}

function loadPersistentData() {
  const saved = localStorage.getItem('uma_wordle_v2_stats');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.data && parsed.checksum) {
        const actualChecksum = generateChecksum(parsed.data);
        if (actualChecksum === parsed.checksum) {
          allPersistentData = parsed.data;
        } else {
          console.warn("Stats tampering detected. Resetting to default. Three Goddesses will curse you.");
        }
      } else {
        allPersistentData = parsed;
        savePersistentData();
      }
    } catch (e) {
      console.error("Failed to parse persistent data:", e);
    }
  }

  migrateHeardleToVoicedle();

  if (!allPersistentData.voicedle) {
    allPersistentData.voicedle = {
      dailyStreak: 0, easyStreak: 0, unlimitedStreak: 0, hardStreak: 0,
      lastPlayedDate: null,
      dailyGuesses: [], dailyStatus: 'playing',
      rankedGuesses: [], rankedStatus: 'playing', rankedTargetName: null,
      unlimitedSession: null, hardSession: null, easySession: null, lbSubmittedKey: null
    };
    savePersistentData();
  }

  ['uma', 'course', 'voicedle'].forEach(type => {
    if (allPersistentData[type] && allPersistentData[type].easySession === undefined) {
      allPersistentData[type].easySession = null;
    }
  });

  maybeScheduleLegacyLeaderboardMigration();
}

// --------------- Legacy streak migration ---------------
let _legacyLbMigrationPromise = null;

function isUsernamePendingForMigration() {
  const nickname = localStorage.getItem('tracendle_nickname');
  return !nickname || nickname.trim() === '' || nickname.startsWith('Anonymous');
}

function getLegacyMigrationStreaks(pData) {
  const normalCurrent = Math.max(
    pData.dailyStreak || 0,
    pData.easyStreak || 0,
    pData.unlimitedStreak || 0
  );
  const normalBest = Math.max(
    pData.bestDailyStreak || 0,
    pData.bestEasyStreak || 0,
    pData.bestUnlimitedStreak || 0,
    normalCurrent
  );
  const hardCurrent = pData.hardStreak || 0;
  const hardBest = Math.max(pData.bestHardStreak || 0, hardCurrent);
  return [
    { category: 'normal', value: normalBest },
    { category: 'hard',   value: hardBest }
  ];
}

async function migrateLegacyStreakEntry(userId, username, gameType, category, value) {
  const { error } = await supabaseClient.rpc('record_game_result', {
    p_user_id:      userId,
    p_username:     username,
    p_game_type:    gameType,
    p_category:     category,
    p_streak_value: value
  });

  if (!error) {
    await fixWindowStartForUser(userId, username, gameType, category, value);
    return true;
  }

  console.warn(`Migration RPC failed for ${gameType}/${category}, using fallback:`, error.message);
  return fallbackLeaderboardSync(userId, username, gameType, category, value);
}

function scheduleLegacyLeaderboardMigration() {
  if (localStorage.getItem('tracendle_lb_migrated')) return _legacyLbMigrationPromise;
  if (_legacyLbMigrationPromise) return _legacyLbMigrationPromise;

  _legacyLbMigrationPromise = migrateLegacyStreaks()
    .then(() => {
      localStorage.setItem('tracendle_lb_migrated', '1');
      console.log('Tracendle: legacy streak migration complete.');
    })
    .catch(err => {
      console.warn('Migration failed, will retry next load:', err);
    })
    .finally(() => {
      _legacyLbMigrationPromise = null;
    });

  return _legacyLbMigrationPromise;
}

function maybeScheduleLegacyLeaderboardMigration() {
  if (localStorage.getItem('tracendle_lb_migrated')) return;
  if (isUsernamePendingForMigration()) return;
  scheduleLegacyLeaderboardMigration();
}

async function migrateLegacyStreaks() {
  const userId   = getOrCreateUserId();
  const username = localStorage.getItem('tracendle_nickname') || 'Anonymous';
  let anyFailed = false;

  for (const gameType of ['uma', 'course', 'voicedle']) {
    const pData = allPersistentData[gameType];
    if (!pData) continue;

    for (const { category, value } of getLegacyMigrationStreaks(pData)) {
      if (value <= 0) continue;
      try {
        const ok = await migrateLegacyStreakEntry(userId, username, gameType, category, value);
        if (!ok) anyFailed = true;
      } catch (err) {
        console.error(`Migration failed for ${gameType}/${category}:`, err);
        anyFailed = true;
      }
    }
  }

  if (anyFailed) throw new Error('One or more migration entries failed');
}

// --------------- Ranked stats ---------------
function getTier(points) {
  if (points >= 1500) return "SS";
  const gradeIndex = Math.floor(points / POINTS_PER_TIER);
  const baseGrade  = GRADES[gradeIndex] || "G";
  const suffix     = (points % POINTS_PER_TIER) >= DIV_THRESHOLD ? "+" : "";
  return `${baseGrade}${suffix}`;
}

function getVerifiedRankedStats(mode) {
  const storageKey = `${mode}_ranked_stats`;
  const saved = localStorage.getItem(storageKey);
  const blank = { points: 0, winStreak: 0, lossStreak: 0, placements: 0, rankProtection: 0 };

  if (!saved) return blank;
  try {
    const parsed = JSON.parse(saved);
    if (parsed.data && parsed.checksum === generateChecksum(parsed.data)) return parsed.data;
    console.warn(`Tampering detected in ${mode} ranked stats! Goldship is watching you...`);
  } catch (e) {
    console.error("Failed to parse ranked stats", e);
  }
  return blank;
}

function updateRankedStats(isWin, mode) {
  const storageKey = `${mode}_ranked_stats`;
  const saved = localStorage.getItem(storageKey);
  const blank = { points: 0, winStreak: 0, lossStreak: 0, placements: 0, rankProtection: 0 };
  let stats;

  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      stats = (parsed.data && parsed.checksum === generateChecksum(parsed.data)) ? parsed.data : { ...blank };
    } catch (e) {
      stats = { ...blank };
    }
  } else {
    stats = { ...blank };
  }

  const isRanked = localStorage.getItem('is_ranked_session') === 'true';
  if (!isRanked) return stats;

  if (isWin) {
    const guessCount = sessionState.guesses.length;

    if (stats.placements < 5) {
      let placementGain = guessCount <= 2 ? 200 : guessCount === 3 ? 130 : guessCount === 4 ? 80 : 40;
      stats.points += placementGain;
    } else {
      stats.winStreak++;
      stats.lossStreak = 0;
      const oldTierIndex = Math.floor(stats.points / 200);
      const gain = 20 + (guessCount <= 2 ? 15 : 0) + Math.min(stats.winStreak * 5, 30);
      stats.points += gain;
      if (Math.floor(stats.points / 200) > oldTierIndex) stats.rankProtection = 2;
    }
  } else {
    stats.winStreak = 0;
    stats.lossStreak++;

    if (stats.placements >= 5) {
      if (stats.rankProtection > 0) {
        stats.rankProtection--;
      } else {
        let lossPenalty = 0;
        if (stats.points >= 800)      lossPenalty = 15 + Math.min((stats.lossStreak - 1) * 5, 5);
        else if (stats.points >= 400) lossPenalty = 5  + Math.min((stats.lossStreak - 1) * 5, 5);
        stats.points = Math.max(0, stats.points - lossPenalty);
      }
    }
  }

  if (stats.placements < 5) stats.placements++;

  localStorage.setItem(storageKey, JSON.stringify({
    data: stats,
    checksum: generateChecksum(stats)
  }));

  return stats;
}
