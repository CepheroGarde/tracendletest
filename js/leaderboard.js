// ============================================================
//  leaderboard.js — Supabase sync and leaderboard UI
// ============================================================

// --------------- Sync result to leaderboard ---------------
async function syncScoresToLeaderboard(gameType, isWin, guessCount) {
  const pData     = allPersistentData[gameType];
  const submitKey = sessionState.sessionKey;

  // Guard 1: in-memory flag — prevents double-call within a single page load.
  if (sessionState._leaderboardSynced) return;

  // Guard 2: persistent flag — prevents re-submission after a page refresh.
  if (pData.lbSubmittedKey === submitKey) {
    console.log('Leaderboard: result already submitted for this session key, skipping.');
    return;
  }

  sessionState._leaderboardSynced = true;

  const userId   = getOrCreateUserId();
  const username = localStorage.getItem('tracendle_nickname') || 'Anonymous';
  const category = (sessionState.mode === 'easy' || sessionState.mode === 'unlimited' || sessionState.mode === 'daily')
    ? 'normal' : 'hard';

  let streakKey = 'dailyStreak';
  if (sessionState.mode === 'unlimited')   streakKey = 'unlimitedStreak';
  else if (sessionState.mode === 'easy')   streakKey = 'easyStreak';
  else if (category === 'hard')            streakKey = 'hardStreak';
  const currentStreak = pData[streakKey] ?? 0;

  try {
    console.log('Leaderboard sync: calling record_game_result', { userId, gameType, category, streak: currentStreak });
    const { error } = await supabaseClient.rpc('record_game_result', {
      p_user_id:      userId,
      p_username:     username,
      p_game_type:    gameType,
      p_category:     category,
      p_streak_value: currentStreak
    });

    if (error) {
      console.error('Leaderboard RPC error:', error.message);
      const fallbackSuccess = await fallbackLeaderboardSync(userId, username, gameType, category, currentStreak);
      if (fallbackSuccess) {
        pData.lbSubmittedKey = submitKey;
        savePersistentData();
      }
    } else {
      console.log('Leaderboard RPC succeeded');
      // The RPC may have inserted weekly/monthly rows with window_start = NULL.
      // Patch them now so they appear in the correct time-window queries.
      await fixWindowStartForUser(userId, username, gameType, category, currentStreak);
      pData.lbSubmittedKey = submitKey;
      savePersistentData();
    }
  } catch (err) {
    console.error('Failed to sync score to leaderboard:', err);
    const fallbackSuccess = await fallbackLeaderboardSync(userId, username, gameType, category, currentStreak);
    if (fallbackSuccess) {
      pData.lbSubmittedKey = submitKey;
      savePersistentData();
    }
  }
}

// --------------- Fix NULL window_start rows created by the RPC ---------------
async function fixWindowStartForUser(userId, username, gameType, category, scoreValue) {
  const windows = [
    { windowType: 'weekly',  windowStart: getLeaderboardWindowStart('weekly') },
    { windowType: 'monthly', windowStart: getLeaderboardWindowStart('monthly') }
  ];

  for (const { windowType, windowStart } of windows) {
    try {
      const { data: good } = await supabaseClient
        .from('leaderboard')
        .select('id, score_value')
        .eq('user_id', userId)
        .eq('game_type', gameType)
        .eq('category', category)
        .eq('window_type', windowType)
        .eq('window_start', windowStart)
        .maybeSingle();

      if (good) {
        if ((good.score_value ?? 0) < scoreValue) {
          await supabaseClient.from('leaderboard').update({ score_value: scoreValue, username, updated_at: new Date().toISOString() })
            .eq('user_id', userId).eq('game_type', gameType).eq('category', category)
            .eq('window_type', windowType).eq('window_start', windowStart);
        }
        continue;
      }

      const { data: broken } = await supabaseClient
        .from('leaderboard')
        .select('id, score_value')
        .eq('user_id', userId)
        .eq('game_type', gameType)
        .eq('category', category)
        .eq('window_type', windowType)
        .is('window_start', null)
        .maybeSingle();

      if (broken) {
        console.log(`Fixing NULL window_start for ${windowType}`);
        await supabaseClient.from('leaderboard').update({
          window_start: windowStart,
          score_value:  Math.max(broken.score_value ?? 0, scoreValue),
          username,
          updated_at:   new Date().toISOString()
        }).eq('id', broken.id);
      } else {
        console.log(`Inserting missing ${windowType} row`);
        await supabaseClient.from('leaderboard').insert({
          user_id: userId, username, game_type: gameType, category,
          window_type: windowType, window_start: windowStart,
          score_value: scoreValue, updated_at: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(`fixWindowStartForUser failed for ${windowType}:`, err);
    }
  }
}

async function ensureLeaderboardWindows(userId, username, gameType, category, scoreValue) {
  const windows = [
    { windowType: 'all_time', windowStart: null },
    { windowType: 'weekly', windowStart: getLeaderboardWindowStart('weekly') },
    { windowType: 'monthly', windowStart: getLeaderboardWindowStart('monthly') }
  ];
  let success = true;

  for (const window of windows) {
    try {
      const dbWindowStart = normalizeWindowStart(window.windowStart);
      const query = supabaseClient.from('leaderboard').select('score_value').eq('user_id', userId)
        .eq('game_type', gameType)
        .eq('category', category)
        .eq('window_type', window.windowType);

      if (dbWindowStart === null) {
        query.is('window_start', null);
      } else {
        query.eq('window_start', dbWindowStart);
      }

      const { data: existing, error: fetchError } = await query.maybeSingle();
      if (fetchError) {
        console.error(`Verify leaderboard row failed for ${window.windowType} (${window.windowStart}):`, fetchError);
        success = false;
        continue;
      }

      if (!existing) {
        console.log(`Verify leaderboard insert for ${window.windowType}`, window.windowStart);
        const { error: upsertError } = await supabaseClient.from('leaderboard').upsert([{
          user_id:      userId,
          username,
          game_type:    gameType,
          category,
          window_type:  window.windowType,
          window_start: normalizeWindowStart(window.windowStart),
          score_value:  scoreValue,
          updated_at:   new Date().toISOString()
        }], {
          onConflict: 'user_id,game_type,category,window_type,window_start',
          returning: 'minimal'
        });
        if (upsertError) {
          console.error(`Verify leaderboard upsert failed for ${window.windowType}:`, upsertError);
          success = false;
        }
      }
    } catch (err) {
      console.error(`Verify leaderboard row exception for ${window.windowType}:`, err);
      success = false;
    }
  }

  return success;
}

async function fallbackLeaderboardSync(userId, username, gameType, category, scoreValue) {
  let success = true;
  const windows = [
    { windowType: 'all_time', windowStart: null },
    { windowType: 'weekly', windowStart: getLeaderboardWindowStart('weekly') },
    { windowType: 'monthly', windowStart: getLeaderboardWindowStart('monthly') }
  ];

  for (const window of windows) {
    try {
      const dbWindowStart = normalizeWindowStart(window.windowStart);
      
      // Check if row exists first
      const query = supabaseClient.from('leaderboard').select('id, score_value').eq('user_id', userId)
        .eq('game_type', gameType)
        .eq('category', category)
        .eq('window_type', window.windowType);

      if (dbWindowStart === null) {
        query.is('window_start', null);
      } else {
        query.eq('window_start', dbWindowStart);
      }

      const { data: existing, error: fetchError } = await query.maybeSingle();
      if (fetchError) {
        console.error(`Failed to load existing leaderboard row for ${window.windowType}:`, fetchError);
        continue;
      }

      if (!existing) {
        // Row doesn't exist, insert it
        const { error: insertError } = await supabaseClient.from('leaderboard').insert({
          user_id:     userId,
          username,
          game_type:   gameType,
          category,
          window_type: window.windowType,
          window_start: dbWindowStart,
          score_value: scoreValue,
          updated_at:  new Date().toISOString()
        });
        
        if (insertError) {
          // If 23505 conflict, the row was created by RPC or concurrent request
          // Check if we need to update the score
          if (insertError.code === '23505') {
            const retryQuery = supabaseClient.from('leaderboard').select('score_value').eq('user_id', userId)
              .eq('game_type', gameType)
              .eq('category', category)
              .eq('window_type', window.windowType);
            
            if (dbWindowStart === null) {
              retryQuery.is('window_start', null);
            } else {
              retryQuery.eq('window_start', dbWindowStart);
            }
            
            const { data: retryExisting, error: retryError } = await retryQuery.maybeSingle();
            if (retryError) {
              console.error(`Conflict recovery check failed for ${window.windowType}:`, retryError);
              success = false;
            } else if (retryExisting && (retryExisting.score_value ?? 0) < scoreValue) {
              // Score was inserted by concurrent request but is lower than ours - update it
              const updateQuery = supabaseClient.from('leaderboard').update({
                username,
                score_value: scoreValue,
                updated_at:  new Date().toISOString()
              }).eq('user_id', userId)
                .eq('game_type', gameType)
                .eq('category', category)
                .eq('window_type', window.windowType);

              if (dbWindowStart === null) {
                updateQuery.is('window_start', null);
              } else {
                updateQuery.eq('window_start', dbWindowStart);
              }

              const { error: updateError } = await updateQuery;
              if (updateError) {
                console.error(`Conflict recovery update failed for ${window.windowType}:`, updateError);
                success = false;
              }
            }
          } else {
            console.error(`Fallback insert failed for ${window.windowType}:`, insertError);
            success = false;
          }
        }
      } else if ((existing.score_value ?? 0) < scoreValue) {
        // Row exists but score is lower, update it
        const updateQuery = supabaseClient.from('leaderboard').update({
          username,
          score_value: scoreValue,
          updated_at:  new Date().toISOString()
        }).eq('user_id', userId)
          .eq('game_type', gameType)
          .eq('category', category)
          .eq('window_type', window.windowType);

        if (dbWindowStart === null) {
          updateQuery.is('window_start', null);
        } else {
          updateQuery.eq('window_start', dbWindowStart);
        }

        const { error: updateError } = await updateQuery;
        if (updateError) {
          console.error(`Fallback update failed for ${window.windowType}:`, updateError);
          success = false;
        }
      }
    } catch (err) {
      console.error(`Fallback leaderboard sync failed for ${window.windowType}:`, err);
      success = false;
    }
  }
  return success;
}

// --------------- (Legacy) direct upsert — kept for backwards compat ---------------
async function submitGlobalScore(username, mode, scoreType, scoreValue) {
  const userId = getOrCreateUserId();
  const { error } = await supabaseClient
    .from('leaderboard')
    .upsert({
      user_id: userId, username: username || 'Anonymous',
      mode: mode, score_type: scoreType, score_value: scoreValue
    }, { onConflict: 'user_id,mode,score_type' });
  if (error) console.error('Error syncing score to global leaderboard:', error);
}

// --------------- Fetch leaderboard data ---------------
function getLeaderboardWindowStart(windowType) {
  if (windowType === 'alltime') return null;
  const now8 = getUTC8Time();
  if (windowType === 'weekly') {
    const weekStart = new Date(now8);
    const day = weekStart.getUTCDay();
    const diff = (day + 6) % 7; // Monday start
    weekStart.setUTCDate(weekStart.getUTCDate() - diff);
    weekStart.setUTCHours(0, 0, 0, 0);
    return `${weekStart.getUTCFullYear()}-${String(weekStart.getUTCMonth() + 1).padStart(2, '0')}-${String(weekStart.getUTCDate()).padStart(2, '0')}`;
  }
  const monthStart = new Date(Date.UTC(now8.getUTCFullYear(), now8.getUTCMonth(), 1));
  return `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}-${String(monthStart.getUTCDate()).padStart(2, '0')}`;
}

function getLeaderboardWindowBounds(windowType) {
  if (windowType === 'alltime') return null;
  const now8 = getUTC8Time();
  if (windowType === 'weekly') {
    const weekStart = new Date(now8);
    const day = weekStart.getUTCDay();
    const diff = (day + 6) % 7;
    weekStart.setUTCDate(weekStart.getUTCDate() - diff);
    weekStart.setUTCHours(0, 0, 0, 0);

    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);
    return {
      start: `${weekStart.getUTCFullYear()}-${String(weekStart.getUTCMonth() + 1).padStart(2, '0')}-${String(weekStart.getUTCDate()).padStart(2, '0')}T00:00:00Z`,
      end: `${nextWeekStart.getUTCFullYear()}-${String(nextWeekStart.getUTCMonth() + 1).padStart(2, '0')}-${String(nextWeekStart.getUTCDate()).padStart(2, '0')}T00:00:00Z`
    };
  }

  const monthStart = new Date(Date.UTC(now8.getUTCFullYear(), now8.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now8.getUTCFullYear(), now8.getUTCMonth() + 1, 1));
  return {
    start: `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}-${String(monthStart.getUTCDate()).padStart(2, '0')}T00:00:00Z`,
    end: `${nextMonthStart.getUTCFullYear()}-${String(nextMonthStart.getUTCMonth() + 1).padStart(2, '0')}-${String(nextMonthStart.getUTCDate()).padStart(2, '0')}T00:00:00Z`
  };
}

function normalizeWindowStart(windowStart) {
  if (windowStart === null) return null;
  return windowStart;
}

function toDbWindowType(windowType) {
  return windowType === 'alltime' ? 'all_time' : windowType;
}

function formatLeaderboardCountdown(windowType) {
  const now8 = getUTC8Time();
  let nextReset;

  if (windowType === 'weekly') {
    nextReset = new Date(now8);
    const day = nextReset.getUTCDay();
    const diff = (day + 6) % 7;
    nextReset.setUTCDate(nextReset.getUTCDate() - diff + 7);
    nextReset.setUTCHours(0, 0, 0, 0);
  } else if (windowType === 'monthly') {
    nextReset = new Date(Date.UTC(now8.getUTCFullYear(), now8.getUTCMonth() + 1, 1));
  } else {
    return 'All Time leaderboard does not reset.';
  }

  const diff = nextReset - now8;
  if (diff <= 0) return 'Resetting soon...';

  const hours = String(Math.floor(diff / 3600000)).padStart(2, '0');
  const minutes = String(Math.floor(diff / 60000) % 60).padStart(2, '0');
  const seconds = String(Math.floor(diff / 1000) % 60).padStart(2, '0');
  return `${windowType === 'weekly' ? 'Weekly' : 'Monthly'} reset in ${hours}:${minutes}:${seconds}`;
}

let leaderboardTimerInterval = null;
function startLeaderboardTimer() {
  stopLeaderboardTimer();
  updateLeaderboardTimer();
  leaderboardTimerInterval = setInterval(updateLeaderboardTimer, 1000);
}

function stopLeaderboardTimer() {
  if (leaderboardTimerInterval) {
    clearInterval(leaderboardTimerInterval);
    leaderboardTimerInterval = null;
  }
}

function updateLeaderboardTimer() {
  const timerEl = document.getElementById('leaderboard-reset-timer');
  if (!timerEl) return;
  timerEl.textContent = formatLeaderboardCountdown(activeLbTimeWindow);
}

async function fetchGlobalLeaderboard(gameType, category, timeWindow) {
  const scoreCol = 'score_value';
  const windowStart = getLeaderboardWindowStart(timeWindow);
  const dbWindowStart = normalizeWindowStart(windowStart);

  try {
    const dbWindowType = toDbWindowType(timeWindow);
    let topQuery = supabaseClient
      .from('leaderboard')
      .select(`username, ${scoreCol}, user_id`)
      .eq('game_type', gameType)
      .eq('category', category)
      .eq('window_type', dbWindowType);

    if (timeWindow === 'alltime') {
      topQuery = topQuery.is('window_start', null);
    } else {
      topQuery = topQuery.eq('window_start', dbWindowStart);
    }

    const { data, error } = await topQuery.order(scoreCol, { ascending: false }).limit(100);
    if (error) throw error;

    const topList = (data || []).map(e => ({
      ...e,
      score_value: e[scoreCol] != null ? e[scoreCol] : 0
    }));

    const userId = getOrCreateUserId();
    let myRowQuery = supabaseClient
      .from('leaderboard')
      .select(`username, ${scoreCol}, updated_at`)
      .eq('game_type', gameType)
      .eq('category', category)
      .eq('user_id', userId)
      .eq('window_type', dbWindowType);

    if (timeWindow === 'alltime') {
      myRowQuery = myRowQuery.is('window_start', null);
    } else {
      myRowQuery = myRowQuery.eq('window_start', dbWindowStart);
    }

    const { data: myRaw, error: myError } = await myRowQuery.maybeSingle();
    if (myError) throw myError;
    const myRow = myRaw ? { ...myRaw, score_value: myRaw[scoreCol] != null ? myRaw[scoreCol] : 0 } : null;

    let playerRank = null, totalPlayers = null;
    if (myRow) {
      let aboveQuery = supabaseClient
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .eq('game_type', gameType)
        .eq('category', category)
        .eq('window_type', dbWindowType)
        .gt(scoreCol, myRow.score_value);

      let totalQuery = supabaseClient
        .from('leaderboard')
        .select('*', { count: 'exact', head: true })
        .eq('game_type', gameType)
        .eq('category', category)
        .eq('window_type', dbWindowType);

      if (timeWindow === 'alltime') {
        aboveQuery = aboveQuery.is('window_start', null);
        totalQuery = totalQuery.is('window_start', null);
      } else {
        aboveQuery = aboveQuery.eq('window_start', dbWindowStart);
        totalQuery = totalQuery.eq('window_start', dbWindowStart);
      }

      const { count: above } = await aboveQuery;
      const { count: total } = await totalQuery;
      playerRank = (above ?? 0) + 1;
      totalPlayers = total ?? 1;
    }

    return { topList, myRow, playerRank, totalPlayers };
  } catch (err) {
    console.error('Error building dashboard slice:', err);
    return { topList: [], myRow: null, playerRank: null, totalPlayers: null };
  }
}

// --------------- Leaderboard modal UI ---------------
function getPercentileLabel(playerRank, totalPlayers) {
  if (!playerRank || !totalPlayers || totalPlayers < 2) return null;
  if (playerRank <= 100) return null;
  const pct = Math.floor(((totalPlayers - playerRank) / totalPlayers) * 100);
  return `Top ${100 - pct}%`;
}

function openLeaderboard() {
  currentLbTab = currentGameType;
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.classList.remove('hidden');
  const lbUsername = document.getElementById('lb-current-username');
  if (lbUsername) lbUsername.innerHTML = formatUsernameWithSuffix(
    localStorage.getItem('tracendle_nickname') || 'Anonymous',
    getOrCreateUserId()
  );
  startLeaderboardTimer();
  switchLeaderboardTab(currentLbTab);
}

function closeLeaderboard() {
  const modal = document.getElementById('leaderboard-modal');
  if (modal) modal.classList.add('hidden');
  stopLeaderboardTimer();
}

function switchLeaderboardTab(tab) {
  currentLbTab = tab;
  const tabUma    = document.getElementById('lb-tab-uma');
  const tabCourse = document.getElementById('lb-tab-course');
  if (tab === 'uma') {
    tabUma.className    = 'flex-1 py-1.5 rounded-lg font-bold text-sm transition-all bg-white shadow-sm text-green-700';
    tabCourse.className = 'flex-1 py-1.5 rounded-lg font-bold text-sm transition-all text-gray-500 hover:text-gray-700';
  } else {
    tabCourse.className = 'flex-1 py-1.5 rounded-lg font-bold text-sm transition-all bg-white shadow-sm text-green-700';
    tabUma.className    = 'flex-1 py-1.5 rounded-lg font-bold text-sm transition-all text-gray-500 hover:text-gray-700';
  }
  updateLeaderboardUI();
}

function switchLeaderboardType(type) {}  // reserved

function changeLbCategory(cat) {
  activeLbCategory = cat;
  document.getElementById('lbl-cat-normal').className = cat === 'normal'
    ? 'flex-1 py-2 rounded-lg bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white'
    : 'flex-1 py-2 rounded-lg text-gray-500';
  document.getElementById('lbl-cat-hard').className = cat === 'hard'
    ? 'flex-1 py-2 rounded-lg bg-white dark:bg-gray-700 shadow-sm text-gray-800 dark:text-white'
    : 'flex-1 py-2 rounded-lg text-gray-500';
  updateLeaderboardUI();
}

function changeLbTime(windowType) {
  activeLbTimeWindow = windowType;
  ['alltime', 'weekly', 'monthly'].forEach(type => {
    const btn = document.getElementById(`lbl-window-${type}`);
    if (!btn) return;
    btn.className = type === windowType
      ? 'flex-1 py-2 rounded-lg bg-white shadow-sm transition-all text-gray-800'
      : 'flex-1 py-2 rounded-lg text-gray-500 transition-all';
  });
  updateLeaderboardUI();
}

async function updateLeaderboardUI() {
  const container     = document.getElementById('leaderboard-entries');
  const myScoreFooter = document.getElementById('leaderboard-my-score');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm animate-pulse">Fetching high scores...</div>';
  if (myScoreFooter) myScoreFooter.innerHTML = '';

  const { topList, myRow, playerRank, totalPlayers } =
    await fetchGlobalLeaderboard(currentLbTab, activeLbCategory, activeLbTimeWindow);

  updateLeaderboardTimer();

  if (!topList || topList.length === 0) {
    container.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No entries yet for this category!</div>';
    return;
  }

  const userId = getOrCreateUserId();
  const medals = ['🥇', '🥈', '🥉'];

  container.innerHTML = topList.map((entry, i) => {
    const rankLabel = medals[i] || `#${i + 1}`;
    const isMe      = entry.user_id === userId;
    const highlight = isMe
      ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700'
      : 'bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700';
    return `
      <div class="flex items-center gap-3 px-3 py-2 rounded-xl border ${highlight} transition-all">
        <span class="text-md w-6 text-center">${rankLabel}</span>
        <span class="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate font-medium">
          ${formatUsernameWithSuffix(entry.username || 'Anonymous', entry.user_id)}${isMe ? ' <span class="text-[10px] text-green-500 font-bold">(You)</span>' : ''}
        </span>
        <span class="text-sm font-black text-yellow-600 dark:text-yellow-400">
          ${entry.score_value} <span class="text-[10px] font-normal text-gray-400">streak</span>
        </span>
      </div>`;
  }).join('');

  if (!myScoreFooter) return;

  if (myRow) {
    const percentileLabel = getPercentileLabel(playerRank, totalPlayers);
    const myUsername      = myRow.username || localStorage.getItem('tracendle_nickname') || 'Anonymous';
    const percentileBadge = percentileLabel
      ? `<span class="text-[10px] font-bold text-purple-500 bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300 px-1.5 py-0.5 rounded-full">${percentileLabel}</span>`
      : '';
    myScoreFooter.innerHTML = `
      <p class="text-[9px] text-gray-400 text-center mb-1 uppercase tracking-widest">Your Score</p>
      <div class="flex items-center gap-3 px-3 py-2 rounded-xl border bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700 transition-all">
        <span class="text-sm font-black text-gray-500 w-6 text-center">#${playerRank ?? '?'}</span>
        <span class="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate font-medium">${formatUsernameWithSuffix(myUsername, userId)}</span>
        <span class="flex items-center gap-1.5">
          ${percentileBadge}
          <span class="text-sm font-black text-yellow-600 dark:text-yellow-400">
            ${myRow.score_value} <span class="text-[10px] font-normal text-gray-400">streak</span>
          </span>
        </span>
      </div>`;
  } else {
    const myUsername  = localStorage.getItem('tracendle_nickname') || 'Anonymous';
    const modeKey     = activeLbCategory === 'hard' ? 'hardStreak' : 'dailyStreak';
    const localStreak = allPersistentData[currentLbTab]?.[modeKey] || 0;
    myScoreFooter.innerHTML = `
      <p class="text-[9px] text-gray-400 text-center mb-1 uppercase tracking-widest">Your Score</p>
      <div class="flex items-center gap-3 px-3 py-2 rounded-xl border bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 transition-all opacity-70">
        <span class="text-md w-6 text-center text-gray-400">—</span>
        <span class="flex-1 text-sm text-gray-500 dark:text-gray-400 truncate font-medium">${formatUsernameWithSuffix(myUsername, getOrCreateUserId())}</span>
        <span class="text-sm font-black text-gray-400">
          ${localStreak} <span class="text-[10px] font-normal text-gray-400">streak</span>
        </span>
      </div>
      <p class="text-[9px] text-gray-400 text-center mt-1 italic">Not yet ranked in this window</p>`;
  }
}

function applyLeaderboardDarkMode() {
  const modal = document.getElementById('leaderboard-modal');
  if (!modal) return;
  const inner = modal.querySelector('div');
  if (!inner) return;
  if (document.body.classList.contains('dark')) {
    inner.style.backgroundColor = '#1e293b';
    inner.style.color = '#e2e8f0';
  } else {
    inner.style.backgroundColor = '';
    inner.style.color = '';
  }
}

// --------------- Daily solver count ---------------
// leaderboard.js
async function recordDailySolve(gameType, guessCount, isWin) {
  const userId   = getOrCreateUserId();
  const dailyKey = getDailyString();
  try {
    await supabaseClient.from('daily_solvers').upsert({
      user_id:     userId,
      game_type:   gameType,
      daily_key:   dailyKey,
      guess_count: guessCount,
      result:      isWin ? 'win' : 'loss',     // ← NEW
      solved_at:   new Date().toISOString()
    }, { onConflict: 'user_id,game_type,daily_key' });
  } catch (err) {
    console.error('Failed to record daily solve:', err);
  }
}

async function recordDailySolve(gameType, guessCount, isWin) {
  const userId   = getOrCreateUserId();
  const dailyKey = getDailyString();
  try {
    await supabaseClient.from('daily_solvers').upsert({
      user_id:     userId,
      game_type:   gameType,
      daily_key:   dailyKey,
      guess_count: guessCount,
      result:      isWin ? 'win' : 'loss',
      solved_at:   new Date().toISOString()
    }, { onConflict: 'user_id,game_type,daily_key' });
  } catch (err) {
    console.error('Failed to record daily solve:', err);
  }
}

// --------------- Daily solver count ---------------
async function recordDailySolve(gameType, guessCount, isWin) {
  const userId   = getOrCreateUserId();
  const dailyKey = getDailyString();
  try {
    await supabaseClient.from('daily_solvers').upsert({
      user_id:     userId,
      game_type:   gameType,
      daily_key:   dailyKey,
      guess_count: guessCount,
      result:      isWin ? 'win' : 'loss',
      solved_at:   new Date().toISOString()
    }, { onConflict: 'user_id,game_type,daily_key' });
  } catch (err) {
    console.error('Failed to record daily solve:', err);
  }
}

async function updateDailySolverBadge() {
  const badge = document.getElementById('daily-solver-count');
  if (!badge) {
    console.warn("daily-solver-count element not found");
    return;
  }

  badge.textContent = '⏳ Loading...';

  const gameType = currentGameType;
  const dailyKey = getDailyString();

  try {
    const { data, error } = await supabaseClient
      .from('daily_solvers')
      .select('result')
      .eq('game_type', gameType)
      .eq('daily_key', dailyKey);

    if (error) throw error;

    const total = data?.length || 0;
    const wins  = data?.filter(r => r.result === 'win').length || 0;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    let html = '';
    if (total === 0) {
      html = `<strong>0 Total Player Answered</strong>`;
    } else if (total === 1) {
      html = `<strong>1 Total Player Answered</strong> • <span class="text-green-600 font-medium">${winRate}% Total Player got it right</span>`;
    } else {
      html = `<strong>${total} Total Players Answered</strong> • <span class="text-green-600 font-medium">${winRate}% Total Players got it right</span>`;
    }

    badge.innerHTML = html;
  } catch (err) {
    console.error('Failed to fetch daily solver count:', err);
    badge.innerHTML = `<strong>—</strong>`;
  }
}