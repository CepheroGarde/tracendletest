// ============================================================
//  game.js — Core game logic: start, guess, win/loss
// ============================================================

// --------------- Date helpers ---------------
function getUTC8Time() {
  return new Date(Date.now() + 28800000);
}

function getDailyString(offsetDays = 0) {
  const date8 = getUTC8Time();
  if (offsetDays !== 0) date8.setDate(date8.getDate() + offsetDays);
  return `${date8.getUTCFullYear()}-${date8.getUTCMonth()}-${date8.getUTCDate()}`;
}

function getTargetForDate(dateStr, dataList, gameType = 'uma') {
  if (!dataList || dataList.length === 0) return null;
  let bestItem = dataList[0];
  let maxScore = -Infinity;
  for (const item of dataList) {
    const combinedStr = gameType === 'uma'
      ? dateStr + item.name
      : `${dateStr}|${gameType}|${item.name}`;
    let score = 0;
    for (let i = 0; i < combinedStr.length; i++) {
      score = ((score << 5) - score) + combinedStr.charCodeAt(i);
      score |= 0;
    }
    if (score > maxScore) { maxScore = score; bestItem = item; }
  }
  return bestItem;
}

// --------------- Archive mode game starter ---------------
function startArchiveGame(dateString) {
  const config   = GAME_CONFIG[currentGameType];
  const dataList = config.data();

  // Build UTC midnight dates for today and yesterday (UTC+8 calendar day)
  const now8      = getUTC8Time();
  const todayUTC  = new Date(Date.UTC(now8.getUTCFullYear(), now8.getUTCMonth(), now8.getUTCDate()));
  const yesterdayUTC = new Date(todayUTC);
  yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);

  // Parse the input date (YYYY-MM-DD) as UTC midnight
  const selectedUTC = new Date(dateString + 'T00:00:00Z');

  // Block Today and Yesterday
  if (selectedUTC >= todayUTC) {
    showModal("Archive Unavailable", "You cannot play Today's puzzle in Archive Mode.", true);
    return;
  }
  if (selectedUTC.getTime() === yesterdayUTC.getTime()) {
    showModal("Archive Unavailable", "Yesterday's puzzle is not yet available in Archive Mode.", true);
    return;
  }

  // Convert to the internal date-key format used by getDailyString / getTargetForDate
  // getDailyString returns "YYYY-M-D" with 0-indexed month
  const parts = dateString.split('-');
  const archiveDate = `${parts[0]}-${parseInt(parts[1]) - 1}-${parseInt(parts[2])}`;

  localStorage.setItem('is_ranked_session', 'false');

  sessionState.active   = true;
  sessionState.mode     = 'archive';
  sessionState.archiveDate = archiveDate;
  sessionState.guesses  = [];
  sessionState.clues    = [];
  sessionState.isGameOver = false;
  sessionState.knownStats = {};
  sessionState.sessionKey = `archive:${archiveDate}`;
  sessionState._leaderboardSynced = false;
  sessionState.maxGuesses = currentGameType === 'voicedle' ? getVoicedleMaxGuesses() : 5;

  sessionState.target = getTargetForDate(archiveDate, dataList, currentGameType);

  renderGameLayout();
}

// --------------- Start a game ---------------
function startGame(mode) {
  if (mode === 'ranked') {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('silencesuzuka') !== 'true') return;
  }

  const config   = GAME_CONFIG[currentGameType];
  const dataList = config.data();
  const today    = getDailyString();

  localStorage.setItem('is_ranked_session', mode === 'ranked' ? 'true' : 'false');

  sessionState.active   = true;
  sessionState.mode     = mode;
  sessionState.guesses  = [];
  sessionState.clues    = [];
  sessionState.isGameOver = false;
  sessionState.knownStats = {};
  sessionState.sessionKey = mode === 'daily'
    ? getDailyString()
    : `${mode}:${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  sessionState._leaderboardSynced = false;

  if (mode !== 'daily') {
    const pData = allPersistentData[currentGameType];
    pData.lbSubmittedKey = null;
    savePersistentData();
  }

  if (currentGameType === 'voicedle') {
    sessionState.maxGuesses = getVoicedleMaxGuesses();
  } else {
    sessionState.maxGuesses = mode === 'daily' ? 5 : mode === 'hard' ? 2 : mode === 'easy' ? Infinity : 5;
  }

  // ---- Restore or create session target ----
  if (mode === 'daily') {
    sessionState.target = getTargetForDate(today, dataList, currentGameType);
    const pData = allPersistentData[currentGameType];
    if (pData.lastPlayedDate === today) {
      sessionState.guesses = [...pData.dailyGuesses];
      if (pData.dailyStatus !== 'playing') sessionState.isGameOver = true;
    } else {
      pData.lastPlayedDate = today;
      pData.dailyGuesses   = [];
      pData.dailyStatus    = 'playing';
      savePersistentData();
    }

  } else if (mode === 'ranked') {
    const pData = allPersistentData[currentGameType];
    if (pData.rankedStatus === 'playing' && pData.rankedTargetName && pData.rankedGuesses?.length > 0) {
      const savedTarget = dataList.find(item => item.name === pData.rankedTargetName);
      if (savedTarget) {
        sessionState.target  = savedTarget;
        sessionState.guesses = [...pData.rankedGuesses];
      } else {
        _initFreshRankedSession(dataList, pData);
      }
    } else {
      _initFreshRankedSession(dataList, pData);
    }

  } else if (mode === 'easy' || mode === 'unlimited' || mode === 'hard') {
    restoreOrCreateModeSession(mode, dataList, allPersistentData[currentGameType]);
  }

  // ---- Hard-mode: generate clues if needed (Umamusume / G1 only) ----
  if (currentGameType !== 'voicedle' && mode === 'hard' && sessionState.clues.length === 0) {
    const pData      = allPersistentData[currentGameType];
    const otherItems = dataList.filter(item => item.name !== sessionState.target.name);
    sessionState.clues = otherItems.sort(() => 0.5 - Math.random()).slice(0, 3);
    if (pData.hardSession) {
      pData.hardSession.clues = sessionState.clues.map(c => ({ name: c.name }));
      savePersistentData();
    }
  }

  renderGameLayout();

  // ---- Replay saved guesses ----
  const modesWithHistory = ['daily', 'ranked', 'easy', 'unlimited', 'hard'];
  if (modesWithHistory.includes(mode) && sessionState.guesses.length > 0) {
    if (currentGameType === 'voicedle') {
      replayVoicedleGuesses();
    } else {
      sessionState.guesses.forEach(g => { updateKnownStats(g); addGuessRow(g, false); });
    }
    updateGuessCountUI();

    if (mode === 'daily' && sessionState.isGameOver) {
      document.getElementById('input-container').classList.add('hidden');
      const pData = allPersistentData[currentGameType];
      const msg = pData.dailyStatus === 'won'
        ? showModal("Goal In!", `You found the answer!`, false)
        : showModal("Retired...", `The correct answer was ${sessionState.target.name}. Try again tomorrow!`, false);
    }
  }

  if (mode === 'hard' && currentGameType !== 'voicedle') {
    sessionState.clues.forEach(c => addGuessRow(c, true));
    setTimeout(() => {
      const inp = document.getElementById('uma-input');
      if (inp) inp.focus();
      renderSuggestions('');
    }, 200);
  }

  if (currentGameType === 'voicedle' && !sessionState.isGameOver) {
    setTimeout(() => playVoicedleClip(), 300);
  }
}

function getModeSessionKey(mode) {
  if (mode === 'hard') return 'hardSession';
  if (mode === 'unlimited') return 'unlimitedSession';
  if (mode === 'easy') return 'easySession';
  return null;
}

function persistActiveSession() {
  if (!sessionState.active || sessionState.isGameOver || !sessionState.target) return;
  const mode  = sessionState.mode;
  const pData = allPersistentData[currentGameType];
  if (!pData) return;

  if (mode === 'daily') {
    pData.dailyGuesses = [...sessionState.guesses];
    pData.dailyStatus  = 'playing';
  } else if (mode === 'ranked') {
    pData.rankedGuesses    = [...sessionState.guesses];
    pData.rankedTargetName = sessionState.target.name;
    pData.rankedStatus     = 'playing';
  } else {
    const sessionKey = getModeSessionKey(mode);
    if (!sessionKey) return;
    pData[sessionKey] = {
      targetName: sessionState.target.name,
      guesses:    [...sessionState.guesses],
      clues:      mode === 'hard'
        ? sessionState.clues.map(c => ({ name: c.name }))
        : [],
      isGameOver: false
    };
  }
  savePersistentData();
}

function restoreOrCreateModeSession(mode, dataList, pData) {
  const sessionKey = getModeSessionKey(mode);
  if (!sessionKey) return;

  const saved = pData[sessionKey];
  if (saved && saved.targetName && !saved.isGameOver) {
    const savedTarget = dataList.find(item => item.name === saved.targetName);
    if (savedTarget) {
      sessionState.target  = savedTarget;
      sessionState.guesses = [...(saved.guesses || [])];
      if (mode === 'hard' && saved.clues?.length) {
        sessionState.clues = saved.clues
          .map(c => dataList.find(item => item.name === c.name))
          .filter(Boolean);
      }
      return;
    }
  }
  _initFreshSession(mode, dataList, pData, sessionKey);
}

function _initFreshRankedSession(dataList, pData) {
  sessionState.target = dataList[Math.floor(Math.random() * dataList.length)];
  pData.rankedGuesses    = [];
  pData.rankedStatus     = 'playing';
  pData.rankedTargetName = sessionState.target.name;
  savePersistentData();
}

function _initFreshSession(mode, dataList, pData, sessionKey) {
  sessionState.target = dataList[Math.floor(Math.random() * dataList.length)];
  pData[sessionKey]   = { targetName: sessionState.target.name, guesses: [], clues: [], isGameOver: false };
  savePersistentData();
}

// --------------- Guess submission ---------------
function updateKnownStats(item) {
  const config = GAME_CONFIG[currentGameType];
  config.keys.forEach(key => {
    if (item[key] === sessionState.target[key]) sessionState.knownStats[key] = item[key];
  });
}

function submitGuess(guessItem) {
  if (sessionState.isGameOver) return;
  if (sessionState.guesses.some(g => g.name === guessItem.name)) return;

  if (currentGameType === 'voicedle') {
    submitVoicedleGuess(guessItem);
    return;
  }

  const pData = allPersistentData[currentGameType];
  sessionState.guesses.push(guessItem);
  updateKnownStats(guessItem);

  // Persist guess
  if (sessionState.mode === 'daily') {
    pData.dailyGuesses = [...sessionState.guesses];
    savePersistentData();
  }
  if (sessionState.mode === 'ranked') {
    pData.rankedGuesses = [...sessionState.guesses];
    savePersistentData();
  }
  const sessionKey = getModeSessionKey(sessionState.mode);
  if (sessionKey && pData[sessionKey]) {
    pData[sessionKey].guesses = [...sessionState.guesses];
    savePersistentData();
  }

  const animDuration = addGuessRow(guessItem, false, true);
  updateGuessCountUI();

  if (sessionState.mode === 'hard' && guessItem.name !== sessionState.target.name) {
    const totalCells  = GAME_CONFIG[currentGameType].keys.length;
    const reopenDelay = (totalCells - 1) * 300 + 500 + 200;
    setTimeout(() => {
      const inp = document.getElementById('uma-input');
      if (inp && !sessionState.isGameOver) { inp.value = ''; inp.focus(); renderSuggestions(''); }
    }, reopenDelay);
  }

  if (guessItem.name === sessionState.target.name) {
    handleWin(animDuration);
  } else if (sessionState.guesses.length >= sessionState.maxGuesses) {
    handleLoss(animDuration);
  }
}

// --------------- Win ---------------
function handleWin(animDuration = 0) {
  sessionState.isGameOver = true;
  if (currentGameType === 'voicedle') {
    stopVoicedleAudio();
    updateVoicedlePlayButton();
  }
  const pData = allPersistentData[currentGameType];
  const mode  = sessionState.mode;

  // Archive mode: don't update official stats
  if (mode === 'archive') {
    setTimeout(launchConfetti, animDuration + 100);
    document.getElementById('input-container').classList.add('hidden');
    setTimeout(() => {
      showModal("Goal In! 📅", `Archive Mode: You identified ${sessionState.target.name} from ${sessionState.archiveDate}!\n\nThis result does not affect your official stats.`, true);
    }, animDuration + 600);
    return;
  }

  if (mode === 'daily') {
    pData.dailyPlayed = (pData.dailyPlayed || 0) + 1;
    pData.dailyWins   = (pData.dailyWins   || 0) + 1;
    pData.dailyStatus = 'won';
    pData.dailyStreak++;
    pData.bestDailyStreak = Math.max(pData.bestDailyStreak || 0, pData.dailyStreak);
    recordDailySolve(currentGameType, sessionState.guesses.length, true); //  isWin = true
  } else if (mode === 'easy') {
    pData.easyPlayed    = (pData.easyPlayed  || 0) + 1;
    pData.easyWins      = (pData.easyWins    || 0) + 1;
    pData.easyStreak    = (pData.easyStreak  || 0) + 1;
    pData.bestEasyStreak = Math.max(pData.bestEasyStreak || 0, pData.easyStreak);
    pData.easySession    = null;
  } else if (mode === 'unlimited') {
    pData.unlimitedPlayed  = (pData.unlimitedPlayed  || 0) + 1;
    pData.unlimitedWins    = (pData.unlimitedWins    || 0) + 1;
    pData.unlimitedStreak  = (pData.unlimitedStreak  || 0) + 1;
    pData.bestUnlimitedStreak = Math.max(pData.bestUnlimitedStreak || 0, pData.unlimitedStreak);
    pData.unlimitedSession = null;
  } else if (mode === 'hard') {
    pData.hardPlayed    = (pData.hardPlayed  || 0) + 1;
    pData.hardWins      = (pData.hardWins    || 0) + 1;
    pData.hardStreak    = (pData.hardStreak  || 0) + 1;
    pData.bestHardStreak = Math.max(pData.bestHardStreak || 0, pData.hardStreak);
    pData.hardSession   = null;
  } else if (mode === 'ranked') {
    pData.rankedStatus  = 'won';
    pData.rankedGuesses = [...sessionState.guesses];
  }

  updateRankedStats(true, currentGameType);
  updateStatsUI();
  savePersistentData();
  syncScoresToLeaderboard(currentGameType, true, sessionState.guesses.length);

  setTimeout(launchConfetti, animDuration + 100);
  document.getElementById('input-container').classList.add('hidden');
  setTimeout(() => {
    showModal("Goal In!", `Excellent work! You've identified ${sessionState.target.name}!`, true);
    updateScoreUI();
    updateStatsUI();
  }, animDuration + 600);
}

// --------------- Loss ---------------
function handleLoss(animDuration = 0) {
  sessionState.isGameOver = true;
  if (currentGameType === 'voicedle') {
    stopVoicedleAudio();
    updateVoicedlePlayButton();
  }
  const pData = allPersistentData[currentGameType];
  const mode  = sessionState.mode;

  // Archive mode: don't update official stats
  if (mode === 'archive') {
    document.getElementById('input-container').classList.add('hidden');
    setTimeout(() => {
      showModal("RETIRED... 📅", `Archive Mode: The correct answer was ${sessionState.target.name} from ${sessionState.archiveDate}.\n\nThis result does not affect your official stats.`, true);
    }, animDuration + 600);
    return;
  }

  if (mode === 'daily') {
    pData.dailyPlayed  = (pData.dailyPlayed || 0) + 1;
    pData.dailyStatus  = 'lost';
    pData.dailyStreak  = 0;
    pData.dailyGuesses = [...sessionState.guesses];
    pData.lastPlayedDate = getDailyString();
    sessionState.pendingStreakReset = false;
    sessionState.streakAtLoss = 0;
    recordDailySolve(currentGameType, sessionState.guesses.length, false);
  }else if (mode === 'ranked') {
    pData.rankedStatus  = 'lost';
    pData.rankedGuesses = [...sessionState.guesses];
    sessionState.pendingStreakReset = false;
    sessionState.streakAtLoss = 0;
  } else {
    if (mode === 'easy')      pData.easyPlayed      = (pData.easyPlayed      || 0) + 1;
    else if (mode === 'unlimited') pData.unlimitedPlayed = (pData.unlimitedPlayed || 0) + 1;
    else if (mode === 'hard') pData.hardPlayed       = (pData.hardPlayed      || 0) + 1;

    const modeKey = `${mode}Streak`;
    sessionState.streakAtLoss      = pData[modeKey] || 0;
    sessionState.pendingStreakReset = true;

    const sessionKey = getModeSessionKey(mode);
    if (sessionKey) pData[sessionKey] = null;
  }

  updateRankedStats(false, currentGameType);
  updateStatsUI();
  savePersistentData();
  syncScoresToLeaderboard(currentGameType, false, sessionState.guesses.length);

  document.getElementById('input-container').classList.add('hidden');
  setTimeout(() => {
    showModal("LOST...", `The correct answer was ${sessionState.target.name}.`, true);
    updateScoreUI();
    updateStatsUI();
  }, animDuration + 600);
}