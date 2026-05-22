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

  // One-time migration: upload existing streaks to the leaderboard
  const migrated = localStorage.getItem('tracendle_lb_migrated');
  if (!migrated) {
    setTimeout(() => migrateLegacyStreaks(), 1500);
    localStorage.setItem('tracendle_lb_migrated', '1');
  }
}

// --------------- Legacy streak migration ---------------
async function migrateLegacyStreaks() {
  const userId   = getOrCreateUserId();
  const username = localStorage.getItem('tracendle_nickname') || 'Anonymous';

  for (const gameType of ['uma', 'course']) {
    const pData = allPersistentData[gameType];
    if (!pData) continue;

    const streaks = [
      { category: 'normal', value: Math.max(pData.dailyStreak || 0, pData.easyStreak || 0, pData.unlimitedStreak || 0) },
      { category: 'hard',   value: pData.hardStreak || 0 }
    ];

    for (const { category, value } of streaks) {
      if (value <= 0) continue;
      try {
        const { data: existing } = await supabaseClient
          .from('leaderboard')
          .select('id, score_value')
          .eq('user_id', userId)
          .eq('game_type', gameType)
          .eq('category', category)
          .maybeSingle();

        if (!existing || existing.score_value < value) {
          await supabaseClient.from('leaderboard').upsert({
            user_id:       userId,
            username:      username,
            game_type:     gameType,
            category:      category,
            streak_type:   category,
            score_value:   value,
            all_time_best: value,
            updated_at:    new Date().toISOString()
          }, { onConflict: 'user_id,game_type,category' });
        }
      } catch (err) {
        console.error(`Migration failed for ${gameType}/${category}:`, err);
      }
    }
  }
  console.log('Tracendle: legacy streak migration complete.');
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
