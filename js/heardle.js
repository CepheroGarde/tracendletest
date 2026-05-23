// ============================================================
//  heardle.js — Voice-line audio player and Heardle UI
// ============================================================

const HEARDLE_CLIP_MAX = 2.0;
const HEARDLE_UNLOCK = [0.5, 1.0, 1.5, 1.75, 2.0];
const HEARDLE_HARD_UNLOCK = [0.5, 1.0];
const HEARDLE_VOLUME_KEY = 'heardle_volume';

let heardleAudio = null;
let heardlePlayTimer = null;
let heardleProgressRaf = null;
let heardleVolumeBound = false;

function nameToVoicePath(name) {
  return `audio/voices/${name.replace(/\s+/g, '_')}.mp3`;
}

function getHeardleMaxGuesses() {
  const mode = sessionState.mode;
  if (mode === 'easy') return Infinity;
  if (mode === 'hard') return 2;
  return 5;
}

function getHeardleClipDuration() {
  if (sessionState.mode === 'easy') return HEARDLE_CLIP_MAX;
  const idx = sessionState.guesses.length;
  const unlock = sessionState.mode === 'hard' ? HEARDLE_HARD_UNLOCK : HEARDLE_UNLOCK;
  return unlock[Math.min(idx, unlock.length - 1)];
}

function formatHeardleDuration(seconds) {
  return seconds % 1 === 0 ? `${seconds.toFixed(0)}s` : `${seconds.toFixed(1)}s`;
}

function getHeardleVolume() {
  const stored = localStorage.getItem(HEARDLE_VOLUME_KEY);
  if (stored !== null) {
    const v = parseFloat(stored);
    if (!Number.isNaN(v)) return Math.min(1, Math.max(0, v));
  }
  return 1;
}

function setHeardleVolume(level) {
  const v = Math.min(1, Math.max(0, level));
  localStorage.setItem(HEARDLE_VOLUME_KEY, String(v));
  if (heardleAudio) heardleAudio.volume = v;
  const slider = document.getElementById('heardle-volume');
  if (slider) slider.value = String(Math.round(v * 100));
  updateHeardleVolumeIcon(v);
}

function updateHeardleVolumeIcon(level) {
  const icon = document.getElementById('heardle-volume-icon');
  if (!icon) return;
  if (level <= 0) {
    icon.innerHTML = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45h.05zm-4.5 4.5v2.06L9.12 15H6v-2h3.12l2.37-2.37V7.41 4.41 2.86 3.27 1.73 2 4 3.73l1.27 1.27L7.41 7.41 9.12 9.12 12 12.01v4.49zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25 1.27-1.27L4.27 3z"/>';
  } else if (level < 0.5) {
    icon.innerHTML = '<path d="M7 9v6h4l5 5V4l-5 5H7zm-4 0h2.83L12 4.83V19.17L5.83 15H3V9z"/>';
  } else {
    icon.innerHTML = '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>';
  }
}

function initHeardleVolumeControl() {
  const slider = document.getElementById('heardle-volume');
  if (!slider) return;
  const vol = getHeardleVolume();
  slider.value = String(Math.round(vol * 100));
  updateHeardleVolumeIcon(vol);
  if (heardleVolumeBound) return;
  heardleVolumeBound = true;
  slider.addEventListener('input', () => {
    setHeardleVolume(Number(slider.value) / 100);
  });
}

function initHeardleAudio() {
  stopHeardleAudio();
  if (!sessionState.target) return;
  const src = sessionState.target.voice || nameToVoicePath(sessionState.target.name);
  heardleAudio = new Audio(src);
  heardleAudio.preload = 'auto';
  heardleAudio.volume = getHeardleVolume();
}

function stopHeardleAudio() {
  if (heardlePlayTimer) {
    clearTimeout(heardlePlayTimer);
    heardlePlayTimer = null;
  }
  if (heardleProgressRaf) {
    cancelAnimationFrame(heardleProgressRaf);
    heardleProgressRaf = null;
  }
  if (heardleAudio) {
    heardleAudio.pause();
    heardleAudio.currentTime = 0;
    heardleAudio = null;
  }
  setHeardleProgressBar(0);
  setHeardlePlayingState(false);
}

function buildHeardleWaveform() {
  const wave = document.getElementById('heardle-wave');
  if (!wave || wave.childElementCount > 0) return;
  for (let i = 0; i < 16; i++) {
    const bar = document.createElement('span');
    bar.className = 'heardle-wave-bar';
    bar.style.animationDelay = `${(i * 0.04).toFixed(2)}s`;
    wave.appendChild(bar);
  }
}

function setHeardlePlayingState(isPlaying) {
  const card = document.getElementById('heardle-player-card');
  if (card) card.classList.toggle('heardle-player-card--playing', isPlaying);
}

function updateHeardleUnlockUI() {
  const duration = getHeardleClipDuration();
  const unlockPct = (duration / HEARDLE_CLIP_MAX) * 100;
  const unlockEl = document.getElementById('heardle-progress-unlock');
  if (unlockEl) unlockEl.style.width = `${unlockPct}%`;

  const steps = document.querySelectorAll('.heardle-step');
  const unlockList = sessionState.mode === 'hard' ? HEARDLE_HARD_UNLOCK : HEARDLE_UNLOCK;
  const guessCount = sessionState.guesses.length;

  steps.forEach((step, i) => {
    step.classList.remove(
      'heardle-step--active',
      'heardle-step--current',
      'heardle-step--correct',
      'heardle-step--wrong'
    );

    if (sessionState.mode === 'hard' && i >= unlockList.length) {
      step.style.opacity = '0.35';
      return;
    }
    step.style.opacity = '1';

    const guess = sessionState.guesses[i];
    if (guess && sessionState.target) {
      if (guess.skipped) {
        step.classList.add('heardle-step--skipped');
      } else {
        const isCorrect = guess.name === sessionState.target.name;
        step.classList.add(isCorrect ? 'heardle-step--correct' : 'heardle-step--wrong');
      }
    } else if (!sessionState.isGameOver && i === guessCount) {
      step.classList.add('heardle-step--current');
    } else if (sessionState.mode === 'easy' && i > guessCount) {
      step.classList.add('heardle-step--active');
    }
  });

  setHeardleProgressBar(0, 0);
}

function setHeardleProgressBar(ratio, elapsedSec = null) {
  const duration = getHeardleClipDuration();
  const unlockPct = duration / HEARDLE_CLIP_MAX;
  const bar = document.getElementById('heardle-progress-bar');
  if (bar) {
    bar.style.width = `${Math.min(100, Math.max(0, ratio * unlockPct * 100))}%`;
  }
  const timeEl = document.getElementById('heardle-time-display');
  if (timeEl) {
    const shown = elapsedSec != null ? elapsedSec : 0;
    timeEl.textContent = `${shown.toFixed(1)} / ${formatHeardleDuration(duration)}`;
  }
}

function updateHeardleUnlockHint() {
  const hint = document.getElementById('heardle-unlock-hint');
  if (!hint) return;
  const duration = getHeardleClipDuration();
  const guessNum = sessionState.guesses.length + 1;
  if (sessionState.mode === 'easy') {
    hint.textContent = `Easy Mode — full ${formatHeardleDuration(HEARDLE_CLIP_MAX)} clip available`;
  } else if (sessionState.isGameOver) {
    hint.textContent = 'Game over';
  } else {
    hint.textContent = `Guess ${guessNum}: hear up to ${formatHeardleDuration(duration)} of the voice line`;
  }
}

function updateHeardlePlayButton() {
  const disabled = sessionState.isGameOver;
  const playBtn = document.getElementById('heardle-play-btn');
  if (playBtn) {
    playBtn.disabled = disabled;
    playBtn.classList.toggle('heardle-play-btn--disabled', disabled);
  }
  const skipBtn = document.getElementById('heardle-skip-btn');
  if (skipBtn) {
    skipBtn.disabled = disabled;
    skipBtn.classList.toggle('heardle-skip-btn--disabled', disabled);
  }
  if (disabled) setHeardlePlayingState(false);
}

function createHeardleSkipGuess() {
  return { name: 'Skipped', image: '', skipped: true };
}

function skipHeardleGuess() {
  if (currentGameType !== 'heardle' || sessionState.isGameOver || !sessionState.target) return;
  submitHeardleGuess(createHeardleSkipGuess());
}

function playHeardleClipForDuration(seconds) {
  if (!sessionState.target) return;
  stopHeardleAudio();
  initHeardleAudio();
  if (!heardleAudio) return;

  const duration = Math.min(Math.max(seconds, 0.1), HEARDLE_CLIP_MAX);
  setHeardlePlayingState(true);

  heardleAudio.currentTime = 0;
  const startTime = performance.now();

  function tickProgress() {
    if (!heardleAudio) return;
    const elapsed = (performance.now() - startTime) / 1000;
    const ratio = Math.min(1, elapsed / duration);
    setHeardleProgressBar(ratio, Math.min(elapsed, duration));
    if (elapsed < duration) heardleProgressRaf = requestAnimationFrame(tickProgress);
  }

  heardleAudio.play().catch(() => setHeardlePlayingState(false));

  heardleProgressRaf = requestAnimationFrame(tickProgress);
  heardlePlayTimer = setTimeout(() => {
    if (heardleAudio) {
      heardleAudio.pause();
      heardleAudio.currentTime = 0;
    }
    setHeardleProgressBar(0, 0);
    setHeardlePlayingState(false);
    heardlePlayTimer = null;
  }, duration * 1000);
}

function playHeardleClip() {
  if (currentGameType !== 'heardle' || sessionState.isGameOver || !sessionState.target) return;

  playHeardleClipForDuration(getHeardleClipDuration());
}

function showHeardlePanel(show) {
  const panel = document.getElementById('heardle-panel');
  const tableWrap = document.querySelector('.table-wrapper');
  const guessHead = document.getElementById('guess-head');
  if (panel) panel.classList.toggle('hidden', !show);
  if (tableWrap) tableWrap.classList.toggle('hidden', show);
  if (guessHead && show) guessHead.innerHTML = '';
}

function renderHeardleLayout() {
  showHeardlePanel(true);
  buildHeardleWaveform();
  initHeardleVolumeControl();
  document.getElementById('heardle-guess-history').innerHTML = '';
  updateHeardleUnlockUI();
  updateHeardleUnlockHint();
  updateHeardlePlayButton();
  initHeardleAudio();
  setHeardlePlayingState(false);
}

function hideHeardlePanel() {
  showHeardlePanel(false);
  stopHeardleAudio();
}

function addHeardleGuessRow(guessItem, animate = true) {
  const history = document.getElementById('heardle-guess-history');
  if (!history) return 0;

  const row = document.createElement('div');
  if (guessItem.skipped) {
    row.className = 'heardle-guess-row heardle-guess-row--skip';
    if (animate) row.classList.add('heardle-guess-row--animate');
    row.innerHTML = `
      <span class="heardle-guess-skip-icon" aria-hidden="true">⏭</span>
      <span class="heardle-guess-name">Skipped</span>
      <span class="heardle-guess-badge">—</span>
    `;
  } else {
    const isCorrect = guessItem.name === sessionState.target.name;
    row.className = `heardle-guess-row ${isCorrect ? 'heardle-guess-row--correct' : 'heardle-guess-row--wrong'}`;
    if (animate) row.classList.add('heardle-guess-row--animate');
    row.innerHTML = `
      <img src="${guessItem.image}" alt="${guessItem.name}" class="heardle-guess-img">
      <span class="heardle-guess-name">${guessItem.name}</span>
      <span class="heardle-guess-badge">${isCorrect ? '✓' : '✗'}</span>
    `;
  }
  history.appendChild(row);

  updateHeardleUnlockHint();
  updateHeardleUnlockUI();
  return animate ? 400 : 0;
}

function replayHeardleGuesses() {
  const history = document.getElementById('heardle-guess-history');
  if (history) history.innerHTML = '';
  sessionState.guesses.forEach(g => addHeardleGuessRow(g, false));
  updateHeardleUnlockHint();
  updateHeardleUnlockUI();
  updateHeardlePlayButton();
}

function submitHeardleGuess(guessItem) {
  if (sessionState.isGameOver) return;
  if (!guessItem.skipped && sessionState.guesses.some(g => !g.skipped && g.name === guessItem.name)) return;

  const pData = allPersistentData.heardle;
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

  const animDuration = addHeardleGuessRow(guessItem, true);
  updateGuessCountUI();
  stopHeardleAudio();

  if (!guessItem.skipped && guessItem.name === sessionState.target.name) {
    handleWin(animDuration);
  } else if (sessionState.guesses.length >= sessionState.maxGuesses) {
    handleLoss(animDuration);
  } else {
    updateHeardleUnlockHint();
    setTimeout(() => playHeardleClip(), animDuration + 150);
  }
}

function heardleGuessWasCorrect(guess) {
  return !guess.skipped && sessionState.target && guess.name === sessionState.target.name;
}

function getHeardleUnlockList() {
  return sessionState.mode === 'hard' ? HEARDLE_HARD_UNLOCK : HEARDLE_UNLOCK;
}

function resetHeardleResultPanel() {
  const panel = document.getElementById('heardle-result-panel');
  const genericGrid = document.getElementById('target-stats-grid');
  const targetCard = document.getElementById('result-target-card');
  const band = document.getElementById('modal-header-band');
  const shareCardWrap = document.getElementById('share-card-wrap');
  if (panel) panel.classList.add('hidden');
  if (genericGrid) genericGrid.classList.remove('hidden');
  if (targetCard) targetCard.classList.remove('heardle-result-card');
  if (band) band.className = 'h-2 w-full bg-green-600';
  if (shareCardWrap) shareCardWrap.classList.remove('hidden');
}

function playHeardleResultReveal() {
  if (!sessionState.target) return;
  playHeardleClipForDuration(HEARDLE_CLIP_MAX);
}

function renderHeardleResultContent(isWin) {
  const panel = document.getElementById('heardle-result-panel');
  const genericGrid = document.getElementById('target-stats-grid');
  const targetCard = document.getElementById('result-target-card');
  const band = document.getElementById('modal-header-band');
  const shareCardWrap = document.getElementById('share-card-wrap');
  if (!panel) return;

  if (genericGrid) genericGrid.classList.add('hidden');
  panel.classList.remove('hidden');
  if (targetCard) targetCard.classList.add('heardle-result-card');
  if (band) band.className = `h-2 w-full ${isWin ? 'heardle-result-band heardle-result-band--win' : 'heardle-result-band heardle-result-band--loss'}`;
  if (shareCardWrap) shareCardWrap.classList.add('hidden');

  const targetLabel = document.getElementById('target-label');
  if (targetLabel) targetLabel.textContent = 'Voice answer';

  const unlockList = getHeardleUnlockList();
  const stepsEl = document.getElementById('heardle-result-steps');
  if (stepsEl) {
    stepsEl.innerHTML = '';
    sessionState.guesses.forEach((guess, i) => {
      const tier = unlockList[Math.min(i, unlockList.length - 1)];
      const pill = document.createElement('span');
      pill.className = 'heardle-result-step';
      if (guess.skipped) pill.classList.add('heardle-result-step--skip');
      else if (heardleGuessWasCorrect(guess)) pill.classList.add('heardle-result-step--correct');
      else pill.classList.add('heardle-result-step--wrong');
      pill.textContent = formatHeardleDuration(tier);
      stepsEl.appendChild(pill);
    });
  }

  const historyEl = document.getElementById('heardle-result-guesses');
  if (historyEl) {
    historyEl.innerHTML = '';
    sessionState.guesses.forEach((guess) => {
      const row = document.createElement('div');
      if (guess.skipped) {
        row.className = 'heardle-result-guess heardle-result-guess--skip';
        row.innerHTML = '<span class="heardle-result-guess-icon" aria-hidden="true">⏭</span><span>Skipped</span>';
      } else {
        const correct = heardleGuessWasCorrect(guess);
        row.className = `heardle-result-guess ${correct ? 'heardle-result-guess--correct' : 'heardle-result-guess--wrong'}`;
        row.innerHTML = `
          <img src="${guess.image}" alt="" class="heardle-result-guess-img">
          <span class="heardle-result-guess-name">${guess.name}</span>
          <span class="heardle-result-guess-mark" aria-hidden="true">${correct ? '✓' : '✗'}</span>
        `;
      }
      historyEl.appendChild(row);
    });
  }

  const summaryEl = document.getElementById('heardle-result-summary');
  if (summaryEl) {
    const used = sessionState.guesses.length;
    const skips = sessionState.guesses.filter(g => g.skipped).length;
    const maxG = sessionState.maxGuesses === Infinity ? null : sessionState.maxGuesses;
    const skipNote = skips ? ` · ${skips} skipped` : '';
    if (isWin) {
      summaryEl.textContent = `Solved in ${used} guess${used === 1 ? '' : 'es'}${skipNote}`;
      summaryEl.classList.remove('heardle-result-summary--loss');
      summaryEl.classList.add('heardle-result-summary--win');
    } else {
      summaryEl.textContent = maxG != null
        ? `Out of guesses (${used} / ${maxG})${skipNote}`
        : `No correct guess${skipNote}`;
      summaryEl.classList.remove('heardle-result-summary--win');
      summaryEl.classList.add('heardle-result-summary--loss');
    }
  }

  const playBtn = document.getElementById('heardle-result-play-btn');
  if (playBtn) playBtn.onclick = playHeardleResultReveal;
}

function renderHeardleShareEmojis(preview) {
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

function renderHeardleShareEmojisText() {
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
