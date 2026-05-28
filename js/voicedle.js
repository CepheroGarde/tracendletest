// ============================================================
//  voicedle.js — Voice-line audio player and Voicedle UI
// ============================================================

const VOICEDLE_CLIP_MAX = 3.0;
const VOICEDLE_UNLOCK = [0.6, 1.2, 1.8, 2.4, 3.0];
const VOICEDLE_HARD_UNLOCK = [0.6, 1.8];
const VOICEDLE_VOLUME_KEY = 'voicedle_volume';

let voicedleAudio = null;
let voicedlePlayTimer = null;
let voicedleProgressRaf = null;
let voicedleVolumeBound = false;

function nameToVoicePath(name) {
  return `audio/voices/${name.replace(/\s+/g, '_')}.mp3`;
}

function getVoicedleMaxGuesses() {
  const mode = sessionState.mode;
  if (mode === 'easy') return Infinity;
  if (mode === 'hard') return 2;
  return 5;
}

function getVoicedleClipDuration() {
  if (sessionState.mode === 'easy') return VOICEDLE_CLIP_MAX;
  const idx = sessionState.guesses.length;
  const unlock = sessionState.mode === 'hard' ? VOICEDLE_HARD_UNLOCK : VOICEDLE_UNLOCK;
  return unlock[Math.min(idx, unlock.length - 1)];
}

function formatVoicedleDuration(seconds) {
  return seconds % 1 === 0 ? `${seconds.toFixed(0)}s` : `${seconds.toFixed(1)}s`;
}

function getVoicedleVolume() {
  const stored = localStorage.getItem(VOICEDLE_VOLUME_KEY);
  if (stored !== null) {
    const v = parseFloat(stored);
    if (!Number.isNaN(v)) return Math.min(1, Math.max(0, v));
  }
  return 1;
}

function setVoicedleVolume(level) {
  const v = Math.min(1, Math.max(0, level));
  localStorage.setItem(VOICEDLE_VOLUME_KEY, String(v));
  if (voicedleAudio) voicedleAudio.volume = v;
  const slider = document.getElementById('voicedle-volume');
  if (slider) slider.value = String(Math.round(v * 100));
  updateVoicedleVolumeIcon(v);
}

function updateVoicedleVolumeIcon(level) {
  const icon = document.getElementById('voicedle-volume-icon');
  if (!icon) return;
  if (level <= 0) {
    icon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45h.05zm-4.5 4.5v2.06L9.12 15H6v-2h3.12l2.37-2.37V7.41 4.41 2.86 3.27 1.73 2 4 3.73l1.27 1.27L7.41 7.41 9.12 9.12 12 12.01v4.49zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25 1.27-1.27L4.27 3z"/>';
  } else if (level < 0.5) {
    icon.innerHTML = '<path d="M7 9v6h4l5 5V4l-5 5H7zm-4 0h2.83L12 4.83V19.17L5.83 15H3V9z"/>';
  } else {
    icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
  }
}

function initVoicedleVolumeControl() {
  const slider = document.getElementById('voicedle-volume');
  if (!slider) return;
  const vol = getVoicedleVolume();
  slider.value = String(Math.round(vol * 100));
  updateVoicedleVolumeIcon(vol);
  if (voicedleVolumeBound) return;
  voicedleVolumeBound = true;
  slider.addEventListener('input', () => {
    setVoicedleVolume(Number(slider.value) / 100);
  });
}

function initVoicedleAudio() {
  stopVoicedleAudio();
  if (!sessionState.target) return;
  const src = sessionState.target.voice || nameToVoicePath(sessionState.target.name);
  voicedleAudio = new Audio(src);
  voicedleAudio.preload = 'auto';
  voicedleAudio.volume = getVoicedleVolume();
}

function stopVoicedleAudio() {
  if (voicedlePlayTimer) {
    clearTimeout(voicedlePlayTimer);
    voicedlePlayTimer = null;
  }
  if (voicedleProgressRaf) {
    cancelAnimationFrame(voicedleProgressRaf);
    voicedleProgressRaf = null;
  }
  if (voicedleAudio) {
    voicedleAudio.pause();
    voicedleAudio.currentTime = 0;
    voicedleAudio = null;
  }
  setVoicedleProgressBar(0);
  setVoicedlePlayingState(false);
}

function buildVoicedleWaveform() {
  const wave = document.getElementById('voicedle-wave');
  if (!wave || wave.childElementCount > 0) return;
  for (let i = 0; i < 16; i++) {
    const bar = document.createElement('span');
    bar.className = 'voicedle-wave-bar';
    bar.style.animationDelay = `${(i * 0.04).toFixed(2)}s`;
    wave.appendChild(bar);
  }
}

function setVoicedlePlayingState(isPlaying) {
  const card = document.getElementById('voicedle-player-card');
  if (card) card.classList.toggle('voicedle-player-card--playing', isPlaying);
}

function updateVoicedleUnlockUI() {
  const duration = getVoicedleClipDuration();
  const unlockPct = (duration / VOICEDLE_CLIP_MAX) * 100;
  const unlockEl = document.getElementById('voicedle-progress-unlock');
  if (unlockEl) unlockEl.style.width = `${unlockPct}%`;

  const steps = document.querySelectorAll('.voicedle-step');
  const unlockList = sessionState.mode === 'hard' ? VOICEDLE_HARD_UNLOCK : VOICEDLE_UNLOCK;
  const guessCount = sessionState.guesses.length;

  steps.forEach((step, i) => {
    step.classList.remove(
      'voicedle-step--active',
      'voicedle-step--current',
      'voicedle-step--correct',
      'voicedle-step--wrong'
    );

    if (sessionState.mode === 'hard' && i >= unlockList.length) {
      step.style.opacity = '0.35';
      return;
    }
    step.style.opacity = '1';

    const guess = sessionState.guesses[i];
    if (guess && sessionState.target) {
      if (guess.skipped) {
        step.classList.add('voicedle-step--skipped');
      } else {
        const isCorrect = guess.name === sessionState.target.name;
        step.classList.add(isCorrect ? 'voicedle-step--correct' : 'voicedle-step--wrong');
      }
    } else if (!sessionState.isGameOver && i === guessCount) {
      step.classList.add('voicedle-step--current');
    } else if (sessionState.mode === 'easy' && i > guessCount) {
      step.classList.add('voicedle-step--active');
    }
  });

  setVoicedleProgressBar(0, 0);
}

function setVoicedleProgressBar(ratio, elapsedSec = null) {
  const duration = getVoicedleClipDuration();
  const unlockPct = duration / VOICEDLE_CLIP_MAX;
  const bar = document.getElementById('voicedle-progress-bar');
  if (bar) {
    bar.style.width = `${Math.min(100, Math.max(0, ratio * unlockPct * 100))}%`;
  }
  const timeEl = document.getElementById('voicedle-time-display');
  if (timeEl) {
    const shown = elapsedSec != null ? elapsedSec : 0;
    timeEl.textContent = `${shown.toFixed(1)} / ${formatVoicedleDuration(duration)}`;
  }
}

function updateVoicedleUnlockHint() {
  const hint = document.getElementById('voicedle-unlock-hint');
  if (!hint) return;
  const duration = getVoicedleClipDuration();
  const guessNum = sessionState.guesses.length + 1;
  if (sessionState.mode === 'easy') {
    hint.textContent = `Easy Mode — full ${formatVoicedleDuration(VOICEDLE_CLIP_MAX)} clip available`;
  } else if (sessionState.isGameOver) {
    hint.textContent = 'Game over';
  } else {
    hint.textContent = `Guess ${guessNum}: hear up to ${formatVoicedleDuration(duration)} of the voice line`;
  }
}

function updateVoicedlePlayButton() {
  const disabled = sessionState.isGameOver;
  const playBtn = document.getElementById('voicedle-play-btn');
  if (playBtn) {
    playBtn.disabled = disabled;
    playBtn.classList.toggle('voicedle-play-btn--disabled', disabled);
  }
  const skipBtn = document.getElementById('voicedle-skip-btn');
  if (skipBtn) {
    skipBtn.disabled = disabled;
    skipBtn.classList.toggle('voicedle-skip-btn--disabled', disabled);
  }
  if (disabled) setVoicedlePlayingState(false);
}

function createVoicedleSkipGuess() {
  return { name: 'Skipped', image: '', skipped: true };
}

function skipVoicedleGuess() {
  if (currentGameType !== 'voicedle' || sessionState.isGameOver || !sessionState.target) return;
  submitVoicedleGuess(createVoicedleSkipGuess());
}

function playVoicedleClipForDuration(seconds) {
  if (!sessionState.target) return;
  stopVoicedleAudio();
  initVoicedleAudio();
  if (!voicedleAudio) return;

  const duration = Math.min(Math.max(seconds, 0.1), VOICEDLE_CLIP_MAX);
  setVoicedlePlayingState(true);

  voicedleAudio.currentTime = 0;
  const startTime = performance.now();

  function tickProgress() {
  if (!voicedleAudio) return;
  const elapsed = (performance.now() - startTime) / 1000;
  const ratio = elapsed / duration;
  setVoicedleProgressBar(Math.min(1, ratio), Math.min(elapsed, duration));
  if (ratio < 1) voicedleProgressRaf = requestAnimationFrame(tickProgress);
  }

  voicedleAudio.play().catch(() => setVoicedlePlayingState(false));

  voicedleProgressRaf = requestAnimationFrame(tickProgress);
  voicedlePlayTimer = setTimeout(() => {
    if (voicedleAudio) {
      voicedleAudio.pause();
      voicedleAudio.currentTime = 0;
    }
    setVoicedleProgressBar(0, 0);
    setVoicedlePlayingState(false);
    voicedlePlayTimer = null;
  }, duration * 1000);
}

function playVoicedleClip() {
  if (currentGameType !== 'voicedle' || sessionState.isGameOver || !sessionState.target) return;

  playVoicedleClipForDuration(getVoicedleClipDuration());
}

function showVoicedlePanel(show) {
  const panel = document.getElementById('voicedle-panel');
  const tableWrap = document.querySelector('.table-wrapper');
  const guessHead = document.getElementById('guess-head');
  if (panel) panel.classList.toggle('hidden', !show);
  if (tableWrap) tableWrap.classList.toggle('hidden', show);
  if (guessHead && show) guessHead.innerHTML = '';
}

function renderVoicedleLayout() {
  showVoicedlePanel(true);
  buildVoicedleWaveform();
  initVoicedleVolumeControl();
  document.getElementById('voicedle-guess-history').innerHTML = '';
  updateVoicedleUnlockUI();
  updateVoicedleUnlockHint();
  updateVoicedlePlayButton();
  initVoicedleAudio();
  setVoicedlePlayingState(false);
}

function hideVoicedlePanel() {
  showVoicedlePanel(false);
  stopVoicedleAudio();
}

function addVoicedleGuessRow(guessItem, animate = true) {
  const history = document.getElementById('voicedle-guess-history');
  if (!history) return 0;

  const row = document.createElement('div');
  if (guessItem.skipped) {
    row.className = 'voicedle-guess-row voicedle-guess-row--skip';
    if (animate) row.classList.add('voicedle-guess-row--animate');
    row.innerHTML = `
      <span class="voicedle-guess-skip-icon" aria-hidden="true">⏭</span>
      <span class="voicedle-guess-name">Skipped</span>
      <span class="voicedle-guess-badge">—</span>
    `;
  } else {
    const isCorrect = guessItem.name === sessionState.target.name;
    row.className = `voicedle-guess-row ${isCorrect ? '✓' : '✗'}`;
    if (animate) row.classList.add('voicedle-guess-row--animate');
    row.innerHTML = `
      <img src="${guessItem.image}" alt="${guessItem.name}" class="voicedle-guess-img">
      <span class="voicedle-guess-name">${guessItem.name}</span>
      <span class="voicedle-guess-badge">${isCorrect ? '✓' : '✗'}</span>
    `;
  }
  history.appendChild(row);

  updateVoicedleUnlockHint();
  updateVoicedleUnlockUI();
  return animate ? 400 : 0;
}

function replayVoicedleGuesses() {
  const history = document.getElementById('voicedle-guess-history');
  if (history) history.innerHTML = '';
  sessionState.guesses.forEach(g => addVoicedleGuessRow(g, false));
  updateVoicedleUnlockHint();
  updateVoicedleUnlockUI();
  updateVoicedlePlayButton();
}

function submitVoicedleGuess(guessItem) {
  if (sessionState.isGameOver) return;
  if (!guessItem.skipped && sessionState.guesses.some(g => !g.skipped && g.name === guessItem.name)) return;

  const pData = allPersistentData.voicedle;
  sessionState.guesses.push(guessItem);

  if (sessionState.mode === 'daily') {
    pData.dailyGuesses = [...sessionState.guesses];
    savePersistentData();
  }
  if (sessionState.mode === 'ranked') {
    pData.rankedGuesses = [...sessionState.guesses];
    savePersistentData();
  }
  const sessionKey = typeof getModeSessionKey === 'function'
    ? getModeSessionKey(sessionState.mode)
    : null;
  if (sessionKey && pData[sessionKey]) {
    pData[sessionKey].guesses = [...sessionState.guesses];
    savePersistentData();
  }

  const animDuration = addVoicedleGuessRow(guessItem, true);
  updateGuessCountUI();
  stopVoicedleAudio();

  if (!guessItem.skipped && guessItem.name === sessionState.target.name) {
    handleWin(animDuration);
  } else if (sessionState.guesses.length >= sessionState.maxGuesses) {
    handleLoss(animDuration);
  } else {
    updateVoicedleUnlockHint();
    setTimeout(() => playVoicedleClip(), animDuration + 150);
  }
}

function voicedleGuessWasCorrect(guess) {
  return !guess.skipped && sessionState.target && guess.name === sessionState.target.name;
}

function getVoicedleUnlockList() {
  return sessionState.mode === 'hard' ? VOICEDLE_HARD_UNLOCK : VOICEDLE_UNLOCK;
}

function resetVoicedleResultPanel() {
  const panel = document.getElementById('voicedle-result-panel');
  const genericGrid = document.getElementById('target-stats-grid');
  const targetCard = document.getElementById('result-target-card');
  const band = document.getElementById('modal-header-band');
  const shareCardWrap = document.getElementById('share-card-wrap');
  if (panel) panel.classList.add('hidden');
  if (genericGrid) genericGrid.classList.remove('hidden');
  if (targetCard) targetCard.classList.remove('voicedle-result-card');
  if (band) band.className = 'h-2 w-full bg-green-600';
  if (shareCardWrap) shareCardWrap.classList.remove('hidden');
}

function playVoicedleResultReveal() {
  if (!sessionState.target) return;
  playVoicedleClipForDuration(VOICEDLE_CLIP_MAX);
}

function renderVoicedleResultContent(isWin) {
  const panel = document.getElementById('voicedle-result-panel');
  const genericGrid = document.getElementById('target-stats-grid');
  const targetCard = document.getElementById('result-target-card');
  const band = document.getElementById('modal-header-band');
  const shareCardWrap = document.getElementById('share-card-wrap');
  if (!panel) return;

  if (genericGrid) genericGrid.classList.add('hidden');
  panel.classList.remove('hidden');
  if (targetCard) targetCard.classList.add('voicedle-result-card');
  if (band) band.className = `h-2 w-full ${isWin ? 'voicedle-result-band voicedle-result-band--win' : 'voicedle-result-band voicedle-result-band--loss'}`;
  if (shareCardWrap) shareCardWrap.classList.add('hidden');

  const targetLabel = document.getElementById('target-label');
  if (targetLabel) targetLabel.textContent = 'Voice answer';

  const unlockList = getVoicedleUnlockList();
  const stepsEl = document.getElementById('voicedle-result-steps');
  if (stepsEl) {
    stepsEl.innerHTML = '';
    sessionState.guesses.forEach((guess, i) => {
      const tier = unlockList[Math.min(i, unlockList.length - 1)];
      const pill = document.createElement('span');
      pill.className = 'voicedle-result-step';
      if (guess.skipped) pill.classList.add('voicedle-result-step--skip');
      else if (voicedleGuessWasCorrect(guess)) pill.classList.add('voicedle-result-step--correct');
      else pill.classList.add('voicedle-result-step--wrong');
      pill.textContent = formatVoicedleDuration(tier);
      stepsEl.appendChild(pill);
    });
  }

  const historyEl = document.getElementById('voicedle-result-guesses');
  if (historyEl) {
    historyEl.innerHTML = '';
    sessionState.guesses.forEach((guess) => {
      const row = document.createElement('div');
      if (guess.skipped) {
        row.className = 'voicedle-result-guess voicedle-result-guess--skip';
        row.innerHTML = '<span class="voicedle-result-guess-icon" aria-hidden="true">⏭</span><span>Skipped</span>';
      } else {
        const correct = voicedleGuessWasCorrect(guess);
        row.className = `voicedle-result-guess ${correct ? '✓' : '✗'}`;
        row.innerHTML = `
          <img src="${guess.image}" alt="" class="voicedle-result-guess-img">
          <span class="voicedle-result-guess-name">${guess.name}</span>
          <span class="voicedle-result-guess-mark" aria-hidden="true">${correct ? '✓' : '✗'}</span>
        `;
      }
      historyEl.appendChild(row);
    });
  }

  const summaryEl = document.getElementById('voicedle-result-summary');
  if (summaryEl) {
    const used = sessionState.guesses.length;
    const skips = sessionState.guesses.filter(g => g.skipped).length;
    const maxG = sessionState.maxGuesses === Infinity ? null : sessionState.maxGuesses;
    const skipNote = skips ? ` · ${skips} skipped` : '';
    if (isWin) {
      summaryEl.textContent = `Solved in ${used} guess${used === 1 ? '' : 'es'}${skipNote}`;
      summaryEl.classList.remove('voicedle-result-summary--loss');
      summaryEl.classList.add('voicedle-result-summary--win');
    } else {
      summaryEl.textContent = maxG != null
        ? `Out of guesses (${used} / ${maxG})${skipNote}`
        : `No correct guess${skipNote}`;
      summaryEl.classList.remove('voicedle-result-summary--win');
      summaryEl.classList.add('voicedle-result-summary--loss');
    }
  }

  const playBtn = document.getElementById('voicedle-result-play-btn');
  if (playBtn) playBtn.onclick = playVoicedleResultReveal;
}

function renderVoicedleShareEmojis(preview) {
  preview.innerHTML = '';
  sessionState.guesses.forEach(guess => {
    const div = document.createElement('div');
    if (guess.skipped) {
      div.innerText = '⬜'.repeat(5);
    } else {
      div.innerText = guess.name === sessionState.target.name ? '🟩'.repeat(5) : '⬛'.repeat(5);
    }
    preview.appendChild(div);
  });
}

function renderVoicedleShareEmojisText() {
  let result = '';
  sessionState.guesses.forEach(guess => {
    if (guess.skipped) {
      result += '⬜'.repeat(5) + '\n';
    } else {
      result += (guess.name === sessionState.target.name ? '🟩'.repeat(5) : '⬛'.repeat(5)) + '\n';
    }
  });
  return result.trim();
}