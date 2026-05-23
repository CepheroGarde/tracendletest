// ============================================================
//  ui.js — Rendering, modals, picker, share, stats, changelog
// ============================================================

// --------------- Theme ---------------
function toggleTheme() {
  document.body.classList.toggle('dark');
  localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
}

function loadTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === null || savedTheme === 'dark') {
    document.body.classList.add('dark');
    if (savedTheme === null) localStorage.setItem('theme', 'dark');
  }
}

// --------------- Clock ---------------
let pendingUsernameModal = false;
let pendingChangelogModal = false;
let pendingChangelogAfterUsername = false;

function startClock() {
  const clockEl = document.getElementById('server-time');
  if (!clockEl) return;
  setInterval(() => {
    const now8 = getUTC8Time();
    const nextMidnight8 = new Date(now8);
    nextMidnight8.setUTCDate(nextMidnight8.getUTCDate() + 1);
    nextMidnight8.setUTCHours(0, 0, 0, 0);
    const diff = nextMidnight8 - now8;
    if (diff <= 0) { location.reload(); return; }
    const h = String(Math.floor((diff / (1000 * 60 * 60)) % 24)).padStart(2, '0');
    const m = String(Math.floor((diff / (1000 * 60)) % 60)).padStart(2, '0');
    const s = String(Math.floor((diff / 1000) % 60)).padStart(2, '0');
    clockEl.innerText = `NEXT DAILY IN: ${h}:${m}:${s}`;
  }, 1000);
}

// --------------- Archive Mode ---------------
function openArchiveMode() {
  const modal = document.getElementById('archive-modal');
  const dateInput = document.getElementById('archive-date-input');
  if (modal && dateInput) {
    const today = getUTC8Time();

    // Max selectable date = 2 days ago (Today and Yesterday are blocked)
    const maxDate = new Date(today);
    maxDate.setUTCDate(maxDate.getUTCDate() - 2);
    const maxDateStr = `${maxDate.getUTCFullYear()}-${String(maxDate.getUTCMonth() + 1).padStart(2, '0')}-${String(maxDate.getUTCDate()).padStart(2, '0')}`;

    // Min selectable date = 30 days ago
    const minDate = new Date(today);
    minDate.setUTCDate(minDate.getUTCDate() - 30);
    const minDateStr = `${minDate.getUTCFullYear()}-${String(minDate.getUTCMonth() + 1).padStart(2, '0')}-${String(minDate.getUTCDate()).padStart(2, '0')}`;

    dateInput.max = maxDateStr;
    dateInput.min = minDateStr;
    dateInput.value = maxDateStr; // Default to the most recent available date
    modal.classList.remove('hidden');
  }
}

function closeArchiveMode() {
  const modal = document.getElementById('archive-modal');
  if (modal) modal.classList.add('hidden');
}

function validateAndStartArchive() {
  const dateInput = document.getElementById('archive-date-input');
  if (!dateInput.value) {
    alert('Please select a date');
    return;
  }

  const today = getUTC8Time();
  today.setUTCHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const selected = new Date(dateInput.value + 'T00:00:00Z');

  if (selected >= today) {
    alert("You cannot play Today's puzzle in Archive Mode!");
    return;
  }
  if (selected.getTime() === yesterday.getTime()) {
    alert("Yesterday's puzzle is not yet available in Archive Mode!");
    return;
  }

  closeArchiveMode();
  startArchiveGame(dateInput.value);
}

// --------------- Username modal ---------------
function checkOrCreateUsername() {
  const nickname = localStorage.getItem('tracendle_nickname');
  const isFirstTime = !nickname || nickname.trim() === '' || nickname.startsWith('Anonymous');
  if (isFirstTime) {
    if (document.body.classList.contains('intro-complete')) {
      showUsernameModal(false);
    } else {
      pendingUsernameModal = true;
    }
  }
  getOrCreateUserId();
}

function showUsernameModal(isChange = false) {
  const modal = document.getElementById('username-modal');
  const title = document.getElementById('username-modal-title');
  const input = document.getElementById('username-input');
  const err   = document.getElementById('username-error');
  if (!modal) return;
  title.textContent = isChange ? 'Change Username' : 'Welcome, Trainer!';
  input.value = isChange ? (localStorage.getItem('tracendle_nickname') || '') : '';
  err.classList.add('hidden');
  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 100);
  modal._allowClose = isChange;
  modal.onclick = (e) => { if (e.target === modal && modal._allowClose) closeUsernameModal(); };
}

function closeUsernameModal() {
  const modal = document.getElementById('username-modal');
  if (modal) modal.classList.add('hidden');
  if (pendingChangelogAfterUsername) {
    pendingChangelogAfterUsername = false;
    openChangelog();
  }
}

async function saveUsername() {
  const input = document.getElementById('username-input');
  if (!input) return;
  let val = input.value.trim();
  if (!val) val = 'Anonymous';
  localStorage.setItem('tracendle_nickname', val);
  const lbUsername = document.getElementById('lb-my-username');
  if (lbUsername) lbUsername.innerHTML = formatUsernameWithSuffix(val, getOrCreateUserId());
  closeUsernameModal();

  const userId = getOrCreateUserId();
  try {
    const { error } = await supabaseClient
      .from('leaderboard')
      .update({ username: val })
      .eq('user_id', userId);
    if (error) console.error('Error updating leaderboard username:', error);
    else console.log('Leaderboard usernames successfully updated across all modes!');
  } catch (err) {
    console.error('Supabase update failed:', err);
  }
}

function openChangeUsername() { showUsernameModal(true); }

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('username-input');
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveUsername(); });
});

function playIntroAnimation() {
  const overlay = document.getElementById('intro-logo-overlay');
  const introLogo = document.getElementById('intro-logo');
  const introCredit = document.getElementById('intro-credit');
  const headerLogo = document.getElementById('header-logo');
  if (!overlay || !introLogo || !headerLogo) return;

  headerLogo.style.opacity = '0';
  overlay.classList.add('visible');

  requestAnimationFrame(() => {
    introLogo.classList.add('popup');
    if (introCredit) introCredit.classList.add('show');
  });
  // Move the intro logo to the header, and the credit to the footer
  setTimeout(() => {
    const overlayRect = introLogo.getBoundingClientRect();
    const targetRect = headerLogo.getBoundingClientRect();
    const dx = (targetRect.left + targetRect.width / 2) - (overlayRect.left + overlayRect.width / 2);
    const dy = (targetRect.top + targetRect.height / 2) - (overlayRect.top + overlayRect.height / 2);
    const scale = Math.min(targetRect.width / overlayRect.width, targetRect.height / overlayRect.height) * 0.94;

    introLogo.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    introLogo.classList.add('move-to-header');

    if (introCredit) {
      const creditRect = introCredit.getBoundingClientRect();
      const footerTarget = document.getElementById('made-by-footer');
      if (footerTarget) {
        const footerRect = footerTarget.getBoundingClientRect();
        const cdx = (footerRect.left + footerRect.width / 2) - (creditRect.left + creditRect.width / 2);
        const cdy = (footerRect.top + footerRect.height / 2) - (creditRect.top + creditRect.height / 2);
        const cscale = Math.min(footerRect.width / creditRect.width, footerRect.height / creditRect.height) * 0.9;
        introCredit.style.transform = `translate(${cdx}px, ${cdy}px) scale(${cscale})`;
        introCredit.classList.add('move-to-footer');
      }
    }
  }, 900);

  setTimeout(() => {
    introLogo.style.opacity = '0';
    headerLogo.style.opacity = '1';
    if (introCredit) introCredit.style.opacity = '0';
  }, 1450);

  setTimeout(() => {
    overlay.classList.remove('visible');
    introLogo.classList.remove('popup', 'move-to-header');
    introLogo.style.transform = '';
    introLogo.style.opacity = '';
    if (introCredit) {
      introCredit.classList.remove('show', 'move-to-footer');
      introCredit.style.transform = '';
      introCredit.style.opacity = '';
    }
    document.body.classList.add('intro-complete');

    const peeking = document.getElementById('peeking-character');
    if (peeking) {
      peeking.classList.add('peek-start');
    }

    if (pendingUsernameModal) {
      pendingUsernameModal = false;
      showUsernameModal(false);
      if (pendingChangelogModal) {
        pendingChangelogModal = false;
        pendingChangelogAfterUsername = true;
      }
    } else if (pendingChangelogModal) {
      pendingChangelogModal = false;
      openChangelog();
    }
  }, 1750);
}

function animateSelection(element) {
  if (!element) return;
  element.classList.add('animate-flip');
  element.addEventListener('animationend', () => {
    element.classList.remove('animate-flip');
  }, { once: true });
}

// --------------- Game type switcher ---------------
function switchGameType(type) {
  currentGameType = type;
  sessionState.knownStats = {};
  const config = GAME_CONFIG[type];

  const tabUma    = document.getElementById('tab-uma');
  const tabCourse = document.getElementById('tab-course');
  if (type === 'uma') {
    tabUma.className    = "flex-1 py-2 rounded-lg font-bold transition-all bg-white shadow-sm text-green-700";
    tabCourse.className = "flex-1 py-2 rounded-lg font-bold transition-all text-gray-500 hover:text-gray-700";
    animateSelection(tabUma);
  } else {
    tabCourse.className = "flex-1 py-2 rounded-lg font-bold transition-all bg-white shadow-sm text-green-700";
    tabUma.className    = "flex-1 py-2 rounded-lg font-bold transition-all text-gray-500 hover:text-gray-700";
    animateSelection(tabCourse);
  }

  const menuDescription = document.getElementById('menu-description');
  if (menuDescription) {
    menuDescription.classList.add('animate-fade-in');
    menuDescription.addEventListener('animationend', () => {
      menuDescription.classList.remove('animate-fade-in');
    }, { once: true });
  }
  document.getElementById('menu-description').innerText = config.helpDesc;

  const today     = getDailyString();
  const yesterday = getDailyString(-1);
  const pData     = allPersistentData[type];
  if (pData.lastPlayedDate !== today) {
    pData.dailyGuesses = [];
    pData.dailyStatus  = 'playing';
    if (pData.lastPlayedDate !== yesterday) pData.dailyStreak = 0;
    savePersistentData();
  }

  updateStatsUI();
  checkDailyStatus();
  displayYesterdayAnswer();

  // Rebuild column headers
  const headRow = document.createElement('tr');
  headRow.className = "text-[10px] md:text-xs font-bold uppercase";
  const nameTh = document.createElement('th');
  nameTh.className = "name-col p-1 bg-gray-100 text-gray-600 rounded-t-lg text-[9px]";
  nameTh.innerText = "Name";
  headRow.appendChild(nameTh);
  config.headers.forEach((header, index) => {
    const th = document.createElement('th');
    th.className = `p-2 ${index === 0 ? 'rounded-tl-lg' : ''} ${index === config.headers.length - 1 ? 'rounded-tr-lg cell-group-end' : ''}`;
    if (type === 'uma') {
      if (index < 4)      th.className += " head-dist";
      else if (index < 8) th.className += " head-strat";
      else                th.className += " head-track";
    } else {
      th.className += " head-course";
    }
    th.innerText = header;
    headRow.appendChild(th);
  });
  document.getElementById('guess-head').innerHTML = '';
  document.getElementById('guess-head').appendChild(headRow);
  document.getElementById('uma-input').placeholder = config.placeholder;
  if (typeof updateDailySolverBadge === 'function') {
    updateDailySolverBadge();
  } else {
    // leaderboard.js may not be parsed yet — try shortly after
    setTimeout(() => { if (typeof updateDailySolverBadge === 'function') updateDailySolverBadge(); }, 500);
  }
}

// --------------- Game screen ---------------
function renderGameLayout() {
  document.getElementById('menu-screen').classList.add('hidden');
  const gameScreen = document.getElementById('game-screen');
  if (gameScreen) {
    gameScreen.classList.remove('hidden');
    gameScreen.classList.add('animate-fade-in');
  }
  
  // Display mode indicator with archive date if applicable
  let modeDisplay = currentGameType + " / " + sessionState.mode;
  if (sessionState.mode === 'archive' && sessionState.archiveDate) {
    modeDisplay = `${currentGameType} / <span style="color:#7c3aed; font-weight:900;">ARCHIVE 📅 ${sessionState.archiveDate}</span>`;
  }
  document.getElementById('mode-indicator').innerHTML = modeDisplay;   // ← Changed to innerHTML
  
  document.getElementById('guess-grid').innerHTML = '';
  document.getElementById('uma-input').value = '';
  document.getElementById('input-container').classList.remove('hidden');

  const nameCols = document.querySelectorAll('.name-col');
  nameCols.forEach(col => {
    if (sessionState.mode === 'hard') col.classList.add('hidden');
    else col.classList.remove('hidden');
  });

  updateGuessCountUI();
  updateScoreUI();
  renderSuggestions('');
}

function updateGuessCountUI() {
  const el = document.getElementById('remaining-guesses');
  if (!el) return;

  const maxAttempts = sessionState.mode === 'daily' ? 5
    : sessionState.mode === 'hard'  ? 2
    : sessionState.mode === 'archive' ? 5
    : sessionState.mode === 'easy'  ? null
    : 5;

  if (maxAttempts === null) {
    // Unlimited / easy mode — show a small ∞ badge
    el.innerHTML = `<span style="
      display:inline-flex; align-items:center; justify-content:center;
      font-size:18px; line-height:1; color:#16a34a; font-weight:900;
      letter-spacing:-1px;
    ">∞</span><span style="font-size:10px;color:#9ca3af;margin-left:4px;">unlimited</span>`;
    return;
  }

  const used      = sessionState.guesses.length;
  const remaining = Math.max(0, maxAttempts - used);
  let dots = '';

  for (let i = 0; i < maxAttempts; i++) {
    const isUsed = i < used;
    const isLast = !isUsed && i === used; // next dot to be consumed

    if (isUsed) {
      dots += `<span style="
        display:inline-block; width:9px; height:9px; border-radius:50%;
        background:#ef4444; box-shadow:0 0 0 1.5px #fca5a5;
        transition:all .3s;
      "></span>`;
    } else {
      const pulse = isLast ? 'animation:dot-pulse 1.4s ease-in-out infinite;' : '';
      dots += `<span style="
        display:inline-block; width:9px; height:9px; border-radius:50%;
        background:#16a34a; box-shadow:0 0 0 1.5px #bbf7d0;
        transition:all .3s; ${pulse}
      "></span>`;
    }
  }

  // inject keyframes once
  if (!document.getElementById('dot-pulse-style')) {
    const s = document.createElement('style');
    s.id = 'dot-pulse-style';
    s.textContent = `@keyframes dot-pulse {
      0%,100%{transform:scale(1);opacity:1}
      50%{transform:scale(1.25);opacity:.7}
    }`;
    document.head.appendChild(s);
  }

  el.innerHTML = dots;
}

function showMenu() {
  localStorage.setItem('is_ranked_session', 'false');
  document.getElementById('menu-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('input-container').classList.add('hidden');
  checkDailyStatus();
}

function checkDailyStatus() {
  const today     = getDailyString();
  const statusDiv = document.getElementById('daily-status');
  const pData     = allPersistentData[currentGameType];
  if (pData.lastPlayedDate === today && pData.dailyStatus !== 'playing') {
    statusDiv.innerText = `Daily ${currentGameType.toUpperCase()} Wordle completed for today!`;
    statusDiv.classList.add('text-green-600');
  } else {
    statusDiv.innerText = "";
    statusDiv.classList.remove('text-green-600');
  }
  updateDailySolverBadge();
}

function updateScoreUI() {
  const el    = document.getElementById('score-display');
  const pData = allPersistentData[currentGameType];
  const mode  = sessionState.mode;

  const modeKey    = mode === 'daily' ? 'dailyStreak' : `${mode}Streak`;
  const streak     = pData[modeKey] || 0;
  const modeLabel  = mode === 'daily' ? 'Daily'
    : mode === 'easy'      ? 'Easy Streak'
    : mode === 'hard'      ? 'Hard Streak'
    : mode === 'unlimited' ? 'Normal Streak'
    : mode.charAt(0).toUpperCase() + mode.slice(1);

  
  const color  = streak >= 3 ? '#f97316' : streak >= 1 ? '#16a34a' : '#9ca3af';
  const bg     = streak >= 3 ? '#fff7ed' : streak >= 1 ? '#f0fdf4' : '#f9fafb';
  const border = streak >= 3 ? '#fed7aa' : streak >= 1 ? '#bbf7d0' : '#e5e7eb';

  el.innerHTML = `
    <div style="
      display:inline-flex; align-items:center; gap:5px;
      background:${bg}; border:1.5px solid ${border};
      border-radius:999px; padding:3px 10px 3px 7px;
      font-size:12px; font-weight:800; color:${color};
      line-height:1; white-space:nowrap;
    ">
      <span style="font-size:10px; font-weight:600; color:#6b7280; margin-right:1px;">${modeLabel}</span>
      <span style="font-size:15px; font-weight:900; color:${color};">${streak}</span>
    </div>`;
}

function updateStatsUI() {
  const pData  = allPersistentData[currentGameType];
  const streak = pData.dailyStreak || 0;
  const fire   = streak >= 3 ? '🔥' : streak >= 1 ? '⚡' : '〰️';
  const color  = streak >= 3 ? '#ea580c' : streak >= 1 ? '#16a34a' : '#9ca3af';

  document.getElementById('stats-summary').innerHTML = `
    <span style="font-size:14px; line-height:1;">${fire}</span>
    <span style="font-size:10px; font-weight:700; color:#9ca3af; letter-spacing:.05em; text-transform:uppercase;">Daily</span>
    <span style="font-size:15px; font-weight:900; color:${color};">${streak}</span>`;

  const rankedData    = getVerifiedRankedStats(currentGameType);
  const tierNameEl    = document.getElementById('menu-tier-name');
  const tierPointsEl  = document.getElementById('menu-tier-points');
  const placementEl   = document.getElementById('menu-placements');
  const streakBadge   = document.getElementById('streak-badge');

  if (rankedData.placements < 5) {
    tierNameEl.innerText   = "UNRANKED";
    tierPointsEl.innerText = "Complete placement matches";
    placementEl.innerText  = `Placements: ${rankedData.placements}/5`;
    streakBadge.classList.add('hidden');
  } else {
    tierNameEl.innerText   = `${getTier(rankedData.points)} TIER`;
    tierPointsEl.innerText = `${rankedData.points} Points`;
    placementEl.innerText  = "Rank Active";
    if (rankedData.winStreak >= 2) {
      streakBadge.innerText = `🔥 ${rankedData.winStreak} STREAK`;
      streakBadge.classList.remove('hidden');
    } else {
      streakBadge.classList.add('hidden');
    }
  }
}

function displayYesterdayAnswer() {
  const config          = GAME_CONFIG[currentGameType];
  const dataList        = config.data();
  const yesterdayTarget = getTargetForDate(getDailyString(-1), dataList);
  document.getElementById('yesterday-info').innerText = `Yesterday's Answer: ${yesterdayTarget.name}`;
}

// --------------- Picker / suggestions ---------------
const input = document.getElementById('uma-input');

function renderSuggestions(filterText = "") {
  const val       = filterText.toLowerCase().trim();
  const pickerGrid = document.getElementById('picker-grid');
  if (!pickerGrid) return;
  pickerGrid.innerHTML = '';

  const config        = GAME_CONFIG[currentGameType];
  const dataList      = config.data();
  const guessedNames  = sessionState.guesses.map(g => g.name);
  const activeKnownStats = Object.entries(sessionState.knownStats);
  const MATCH_THRESHOLD  = currentGameType === 'uma' ? 999 : 2;

  let matches = dataList.filter(u =>
    !guessedNames.includes(u.name) &&
    (val === '' || u.name.toLowerCase().includes(val))
  );
  matches.sort((a, b) => a.name.localeCompare(b.name));

  if (matches.length === 0 && val !== '') {
    pickerGrid.innerHTML = `<p class="picker-empty">No matches for "<strong>${filterText}</strong>"</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  matches.forEach(match => {
    let matchCount = 0;
    for (const [key, value] of activeKnownStats) {
      if (match[key] === value) matchCount++;
    }
    const displayBadge = currentGameType === 'uma' && matchCount >= MATCH_THRESHOLD;
    const card = document.createElement('div');
    card.className    = 'picker-card' + (displayBadge ? ' potential-match' : '');
    card.dataset.name = match.name;
    card.innerHTML = `
      <img src="${match.image}" alt="${match.name}" class="picker-card-img">
      <span class="picker-card-name">${match.name}</span>
      ${displayBadge ? `<span class="picker-card-badge">⭐</span>` : ''}
    `;
    card.onclick = () => {
      submitGuess(match);
      const inp = document.getElementById('uma-input');
      if (inp) inp.value = '';
      renderSuggestions('');
    };
    fragment.appendChild(card);
  });
  pickerGrid.appendChild(fragment);
}

input.addEventListener('input', (e) => renderSuggestions(e.target.value));

// --------------- Guess row rendering ---------------
function addGuessRow(item, isClue = false, animate = true) {
  const grid   = document.getElementById('guess-grid');
  const row    = document.createElement('tr');
  const config = GAME_CONFIG[currentGameType];
  if (isClue) row.classList.add('clue-row');

  const nameCell = document.createElement('td');
  nameCell.className = "name-col p-2 bg-white/80 font-bold border-b border-gray-200";
  if (sessionState.mode === 'hard') nameCell.classList.add('hidden');
  if (!isClue) {
    const imgClass = currentGameType === 'course'
      ? 'course-img w-14 h-14 object-contain mx-auto rounded-md shadow-sm'
      : 'w-10 h-10 object-cover mx-auto rounded-full shadow-sm';
    nameCell.innerHTML = `<img src="${item.image}" alt="${item.name}" title="${item.name}" class="${imgClass}" />`;
  } else {
    nameCell.textContent = '???';
  }
  row.appendChild(nameCell);

  const isAnswer  = !isClue && item.name === sessionState.target.name;
  const FLIP_MS   = 500;
  const STAGGER_MS = 300;

  const cellData = config.keys.map(key => {
    const val       = item[key];
    const targetVal = sessionState.target[key];
    let status = 'absent';
    let arrow  = '';
    if (currentGameType === 'uma') {
      const tRank = RANK_MAP[targetVal] ?? -2;
      const gRank = RANK_MAP[val]       ?? -2;
      if (val === targetVal)                  status = 'correct';
      else if (Math.abs(tRank - gRank) <= 1) status = 'present';
      if (gRank < tRank)      arrow = ' ↑';
      else if (gRank > tRank) arrow = ' ↓';
    } else {
      if (val === targetVal) {
        status = 'correct';
      } else if (key === 'length' && Math.abs(parseInt(val) - parseInt(targetVal)) <= 400) {
        status = 'present';
      }
    }
    return { val, arrow, status };
  });

  cellData.forEach(({ val, arrow, status }, i) => {
    const cell = document.createElement('td');
    cell.className = `p-2 wordle-cell font-black tracking-wide${isAnswer ? ' answer-cell' : ''}`;
    cell.innerText = val + arrow;
    if (animate && !isClue) {
      const delay = i * STAGGER_MS;
      cell.style.animationDelay = `${delay}ms`;
      cell.classList.add('wordle-flip');
      setTimeout(() => cell.classList.add(status), delay + FLIP_MS / 2);
    } else {
      cell.classList.add(status);
    }
    row.appendChild(cell);
  });

  grid.appendChild(row);

  if (isAnswer) {
    const lastDelay = animate && !isClue ? (cellData.length - 1) * STAGGER_MS + FLIP_MS : 0;
    setTimeout(() => { row.classList.add('correct-answer'); nameCell.classList.add('correct'); }, lastDelay);
  }

  return animate && !isClue ? (cellData.length - 1) * STAGGER_MS + FLIP_MS : 0;
}

// --------------- Confetti ---------------
function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  const COLORS = ['#6aaa64','#c9b458','#f59e0b','#3b82f6','#ec4899','#8b5cf6','#ffffff'];
  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -10 - Math.random() * 200,
    w: 8 + Math.random() * 8, h: 5 + Math.random() * 5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.15,
    vx: (Math.random() - 0.5) * 3,
    vy: 2.5 + Math.random() * 3.5,
    opacity: 1
  }));
  let frame;
  const start = performance.now();
  function draw(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    pieces.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.rotation += p.rotSpeed;
      if (elapsed > 1800) p.opacity = Math.max(0, p.opacity - 0.012);
      if (p.y < canvas.height + 20 && p.opacity > 0) alive = true;
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (alive && elapsed < 4000) frame = requestAnimationFrame(draw);
    else { cancelAnimationFrame(frame); canvas.remove(); }
  }
  frame = requestAnimationFrame(draw);
}

// --------------- Result modal ---------------
function showModal(title, msg, isNewGameOver = true) {
  const modal  = document.getElementById('result-modal');
  const config = GAME_CONFIG[currentGameType];

  document.getElementById('result-title').innerText = title;
  document.getElementById('result-msg').innerText   = msg;

  const targetNameElement = document.getElementById('target-name');
  const targetLabel       = document.getElementById('target-label');
  const shareTitleText    = document.getElementById('share-title-text');

  if (targetNameElement) {
    targetNameElement.innerHTML = `<span class="text-lg font-black text-green-700">${sessionState.target.name}</span>`;
    const imgWrap = document.getElementById('target-img-wrap');
    if (imgWrap) {
      imgWrap.innerHTML = sessionState.target.image
        ? `<img src="${sessionState.target.image}" alt="${sessionState.target.name}" class="result-target-thumb">`
        : '';
    }
  }

  if (targetLabel)    targetLabel.innerText    = config.resultTitle;
  if (shareTitleText) shareTitleText.innerText = config.shareTitle;

  // Target stats grid
  const targetGrid = document.getElementById('target-stats-grid');
  if (targetGrid) {
    targetGrid.innerHTML = '';
    config.sections.forEach(section => {
      const sectionDiv = document.createElement('div');
      sectionDiv.className = "result-stat-section";
      const h4 = document.createElement('h4');
      h4.className = `result-stat-section-title text-${section.color}-600`;
      h4.innerText = section.title;
      sectionDiv.appendChild(h4);
      const statsDiv = document.createElement('div');
      statsDiv.className = "result-stat-row";
      section.keys.forEach(key => {
        const statBox = document.createElement('div');
        statBox.className = "result-stat-pill";
        const label = document.createElement('span');
        label.className = "result-stat-pill-label";
        label.innerText = key;
        const val = document.createElement('span');
        val.className = "result-stat-pill-value";
        val.innerText = sessionState.target[key];
        statBox.appendChild(label);
        statBox.appendChild(val);
        statsDiv.appendChild(statBox);
      });
      sectionDiv.appendChild(statsDiv);
      targetGrid.appendChild(sectionDiv);
    });
  }

  // Ranked profile
  const rankedProfileContainer = document.getElementById('ranked-result-profile');
  const isRankedSession = localStorage.getItem('is_ranked_session') === 'true';
  if (isRankedSession && rankedProfileContainer) {
    const saved = localStorage.getItem(`${currentGameType}_ranked_stats`);
    let stats = { points: 0, placements: 0 };
    if (saved) { try { stats = JSON.parse(saved).data || stats; } catch (e) {} }
    rankedProfileContainer.classList.remove('hidden');
    if (stats.placements < 5) {
      rankedProfileContainer.innerHTML = `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center mb-4">
          <div class="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Current Rank</div>
          <div class="text-2xl font-black text-blue-800 uppercase">UNRANKED</div>
          <div class="text-xs font-bold text-blue-700 mt-1">Placement: ${stats.placements} / 5 Matches</div>
        </div>`;
    } else {
      rankedProfileContainer.innerHTML = `
        <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200 rounded-lg p-3 text-center mb-4 shadow-sm">
          <div class="text-[10px] font-bold text-orange-600 uppercase tracking-widest">Current Rank</div>
          <div class="text-2xl font-black text-orange-900">${getTier(stats.points)} TIER</div>
          <div class="text-xs font-bold text-orange-700">${stats.points} Rating Points</div>
        </div>`;
    }
  } else if (rankedProfileContainer) {
    rankedProfileContainer.classList.add('hidden');
  }

  const shareInfo = document.getElementById('share-info-text');
  if (shareInfo) shareInfo.innerText = `${sessionState.mode} | ${getDailyString()} | Guesses: ${sessionState.guesses.length}`;

  // Loss streak banner
  const streakBanner = document.getElementById('loss-streak-banner');
  const isLoss = !sessionState.guesses.some(g => g.name === sessionState.target.name);
  if (streakBanner) {
    if (isLoss && sessionState.pendingStreakReset && (sessionState.mode === 'unlimited' || sessionState.mode === 'hard')) {
      const modeName = sessionState.mode === 'hard' ? 'Hard' : 'Normal';
      streakBanner.innerHTML = `
        <div class="flex flex-col items-center gap-1">
          <span class="streak-banner-label">Final Streak Score</span>
          <span class="streak-banner-score">${sessionState.streakAtLoss}</span>
          <span class="streak-banner-sub">${modeName} Mode Streak Lost</span>
        </div>`;
      streakBanner.classList.remove('hidden');
    } else {
      streakBanner.classList.add('hidden');
    }
  }

  const actionBtn = document.getElementById('modal-action-btn');
  if (actionBtn) actionBtn.textContent = 'Continue';

  renderShareEmojis();
  modal.classList.remove('hidden');
}

function closeModal() {
  const modal = document.getElementById('result-modal');
  modal.classList.add('hidden');

  if (sessionState.pendingStreakReset) {
    const pData   = allPersistentData[currentGameType];
    const modeKey = `${sessionState.mode}Streak`;
    pData[modeKey] = 0;
    sessionState.pendingStreakReset = false;
    savePersistentData();
    updateStatsUI();
    updateScoreUI();
  }

  const isWin = sessionState.guesses.some(g => g.name === sessionState.target.name);
  if (sessionState.isGameOver && (sessionState.mode === 'unlimited' || sessionState.mode === 'hard') && isWin) {
    startGame(sessionState.mode);
    return;
  }
  if (sessionState.isGameOver && sessionState.mode === 'ranked') {
    const pData = allPersistentData[currentGameType];
    pData.rankedGuesses    = [];
    pData.rankedStatus     = 'playing';
    pData.rankedTargetName = null;
    savePersistentData();
    if (isWin) startGame('ranked');
  }
}

// --------------- Share ---------------
function renderShareEmojis() {
  const preview = document.getElementById('share-block-preview');
  preview.innerHTML = '';
  const config = GAME_CONFIG[currentGameType];
  sessionState.guesses.forEach(guess => {
    let rowStr = '';
    config.keys.forEach(key => {
      const val       = guess[key];
      const targetVal = sessionState.target[key];
      if (val === targetVal) rowStr += '🟩';
      else if (currentGameType === 'uma') {
        rowStr += Math.abs(RANK_MAP[val] - RANK_MAP[targetVal]) <= 1 ? '🟨' : '⬛';
      } else if (key === 'length' && Math.abs(parseInt(val) - parseInt(targetVal)) <= 400) {
        rowStr += '🟨';
      } else {
        rowStr += '⬛';
      }
    });
    const div = document.createElement('div');
    div.innerText = rowStr;
    preview.appendChild(div);
  });
}

function renderShareEmojisText() {
  let result = '';
  const config = GAME_CONFIG[currentGameType];
  sessionState.guesses.forEach(guess => {
    config.keys.forEach(key => {
      const val       = guess[key];
      const targetVal = sessionState.target[key];
      if (val === targetVal) result += '🟩';
      else if (currentGameType === 'uma') {
        result += Math.abs(RANK_MAP[val] - RANK_MAP[targetVal]) <= 1 ? '🟨' : '⬛';
      } else if (key === 'length' && Math.abs(parseInt(val) - parseInt(targetVal)) <= 400) {
        result += '🟨';
      } else {
        result += '⬛';
      }
    });
    result += '\n';
  });
  return result.trim();
}

function shareToTwitter() {
  const config    = GAME_CONFIG[currentGameType];
  const shareText = `${config.shareTitle}\n${sessionState.mode} | ${getDailyString()} | Guesses: ${sessionState.guesses.length}\n${renderShareEmojisText()}\n\nPlay UmaWordle!`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`, '_blank');
}

function shareToFacebook() {
  const config    = GAME_CONFIG[currentGameType];
  const shareText = `${config.shareTitle}\n${sessionState.mode} | ${getDailyString()} | Guesses: ${sessionState.guesses.length}\n${renderShareEmojisText()}\n\nPlay UmaWordle!`;
  window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(shareText)}`, '_blank');
}

function copyShareResults() {
  const config    = GAME_CONFIG[currentGameType];
  const shareText = `${config.shareTitle}\n${sessionState.mode} | ${getDailyString()} | Guesses: ${sessionState.guesses.length}\n${renderShareEmojisText()}\n\nPlay TracenDle: Pretty Wordle!\nhttps://tracendle.pages.dev/`;
  
  navigator.clipboard.writeText(shareText).then(() => {
    const button = event.target;
    const originalTitle = button.getAttribute('aria-label');
    button.setAttribute('aria-label', 'Copied!');
    button.style.backgroundColor = '#10b981';
    setTimeout(() => {
      button.setAttribute('aria-label', originalTitle);
      button.style.backgroundColor = '';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}

// --------------- Help modal ---------------
function toggleHelp(show) {
  const modal       = document.getElementById('help-modal');
  const helpContent = document.getElementById('help-content');
  if (show) {
    if (currentGameType === 'uma') {
      helpContent.innerHTML = `
        <p>Identify the hidden Umamusume by their base Aptitudes (A to G).</p>
        <div>
          <h3 class="font-bold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">Color Indicators</h3>
          <div class="space-y-2">
            <div class="flex items-center"><span class="help-dot bg-[#6aaa64]"></span> <strong>Green:</strong> Exact match!</div>
            <div class="flex items-center"><span class="help-dot bg-[#c9b458]"></span> <strong>Yellow:</strong> Near match (within 1 rank, e.g., A vs B).</div>
            <div class="flex items-center"><span class="help-dot bg-[#787c7e]"></span> <strong>Gray:</strong> Far match.</div>
          </div>
        </div>
        <div>
          <h3 class="font-bold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">Rank Hints (Arrows)</h3>
          <p>↑: Target rank is higher. ↓: Target rank is lower.</p>
        </div>
        <div>
          <h3 class="font-bold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">Game Modes</h3>
          <ul class="list-disc list-inside text-sm space-y-2 ml-1">
            <li><strong>Daily Mode:</strong> A new puzzle every day at midnight JST!</li>
            <li><strong>Unlimited Mode:</strong> Play as many puzzles as you want!</li>
            <li><strong>Easy Mode:</strong> A more forgiving difficulty level for new players!</li>
            <li><strong>Normal Mode:</strong> The classic experience!</li>
            <li><strong>Hard Mode:</strong> no names, only 3 clues, and just 2 attempts! Good Luck!</li>
          </ul>
        </div>`;
    } else {
      helpContent.innerHTML = `
        <p>Identify the hidden G1 Race by its course features.</p>
        <div>
          <h3 class="font-bold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">Color Indicators</h3>
          <div class="space-y-2">
            <div class="flex items-center"><span class="help-dot bg-[#6aaa64]"></span> <strong>Green:</strong> Exact match!</div>
            <div class="flex items-center"><span class="help-dot bg-[#c9b458]"></span> <strong>Yellow:</strong> Close (Length within 400m).</div>
            <div class="flex items-center"><span class="help-dot bg-[#787c7e]"></span> <strong>Gray:</strong> Incorrect.</div>
          </div>
        </div>
        <div>
          <h3 class="font-bold text-gray-800 dark:text-gray-200 border-b pb-1 mb-2">Game Modes</h3>
          <ul class="list-disc list-inside text-sm space-y-2 ml-1">
            <li><strong>Daily Mode:</strong> A new puzzle every day at midnight JST!</li>
            <li><strong>Unlimited Mode:</strong> Play as many puzzles as you want!</li>
            <li><strong>Easy Mode:</strong> A more forgiving difficulty level for new players!</li>
            <li><strong>Normal Mode:</strong> The classic experience!</li>
            <li><strong>Hard Mode:</strong> no names, only 3 clues, and just 2 attempts! Good Luck!</li>
          </ul>
        </div>`;
    }
  }
  modal.classList.toggle('hidden', !show);
}

// --------------- Dev mode / ranked visibility ---------------
function checkDevMode() {
  const isDev = new URLSearchParams(window.location.search).get('silencesuzuka') === 'true';
  const rankedView    = document.getElementById('ranked-profile-view');
  const rankedBtn     = document.querySelector("button[onclick=\"startGame('ranked')\"]");
  const rankedWarning = document.querySelector(".text-purple-500.italic");
  if (!isDev) {
    if (rankedView)    rankedView.classList.add('hidden');
    if (rankedBtn)     rankedBtn.classList.add('hidden');
    if (rankedWarning) rankedWarning.classList.add('hidden');
  } else {
    if (rankedView)    rankedView.classList.remove('hidden');
    if (rankedBtn)     rankedBtn.classList.remove('hidden');
    if (rankedWarning) rankedWarning.classList.remove('hidden');
  }
}

// --------------- Changelog modal ---------------
function openChangelog()  { document.getElementById('changelog-modal').classList.remove('hidden'); }
function closeChangelog() {
  document.getElementById('changelog-modal').classList.add('hidden');
  if (localStorage.getItem('uma_wordle_version') !== CURRENT_VERSION)
    localStorage.setItem('uma_wordle_version', CURRENT_VERSION);
}
function checkChangelog() {
  if (localStorage.getItem('uma_wordle_version') !== CURRENT_VERSION) {
    if (document.body.classList.contains('intro-complete')) {
      openChangelog();
    } else if (pendingUsernameModal) {
      pendingChangelogAfterUsername = true;
    } else {
      pendingChangelogModal = true;
    }
  }
}
window.addEventListener('load', () => setTimeout(checkChangelog, 500));

// --------------- Stats modal ---------------
function openStats() {
  currentStatsTab = currentGameType;
  renderStatsModal();
  const modal = document.getElementById('stats-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeStats() {
  const modal = document.getElementById('stats-modal');
  if (modal) modal.classList.add('hidden');
}

function renderStatsModal() { switchStatsTab(currentStatsTab); }

function switchStatsTab(type) {
  if (type !== 'uma' && type !== 'course') return;
  currentStatsTab = type;
  const tabUma    = document.getElementById('stats-tab-uma')    || document.getElementById('tab-btn-uma');
  const tabCourse = document.getElementById('stats-tab-course') || document.getElementById('tab-btn-course');
  const resetBtn  = document.getElementById('reset-tab-btn');

  if (tabUma && type === 'uma') {
    tabUma.className    = 'flex-1 py-1.5 rounded-lg font-bold text-sm transition-all bg-green-600 text-white shadow-sm';
    if (tabCourse) tabCourse.className = 'flex-1 py-1.5 rounded-lg font-bold text-sm transition-all text-gray-500 hover:text-gray-700 dark:text-gray-400';
  } else if (tabCourse && type === 'course') {
    tabCourse.className = 'flex-1 py-1.5 rounded-lg font-bold text-sm transition-all bg-green-600 text-white shadow-sm';
    if (tabUma) tabUma.className = 'flex-1 py-1.5 rounded-lg font-bold text-sm transition-all text-gray-500 hover:text-gray-700 dark:text-gray-400';
  }
  if (resetBtn) resetBtn.textContent = `Reset ${type === 'uma' ? 'Umamusume' : 'G1 Race'} Stats`;
  renderStatsContent();
}

function renderStatsContent() {
  const pData     = allPersistentData[currentStatsTab];
  const container = document.getElementById('stats-content');
  if (!container || !pData) return;

  const dailyStreak     = pData.dailyStreak     || 0;
  const easyStreak      = pData.easyStreak      || 0;
  const unlimitedStreak = pData.unlimitedStreak  || 0;
  const hardStreak      = pData.hardStreak       || 0;

  const pill = (value, label) => `
    <div class="stats-pill p-2 border rounded-xl dark:border-gray-700">
      <span class="stats-pill-value block font-black text-lg">${value}</span>
      <span class="stats-pill-label text-gray-400 text-[10px]">${label}</span>
    </div>`;

  container.innerHTML = `
    <div class="stats-section mb-4">
      <p class="stats-section-title font-bold text-sm mb-1 text-gray-700 dark:text-gray-300">🗓️ Daily</p>
      <div class="stats-grid grid grid-cols-3 gap-2 text-center text-xs">
        ${pill(dailyStreak, 'Current Streak')}
        ${pill(pData.bestDailyStreak || dailyStreak, 'Best Streak')}
        ${pill(pData.dailyWins || 0, 'Wins')}
      </div>
    </div>
    <div class="stats-section mb-4">
      <p class="stats-section-title font-bold text-sm mb-1 text-blue-600 dark:text-blue-400">🟢 Easy Mode</p>
      <div class="stats-grid grid grid-cols-3 gap-2 text-center text-xs">
        ${pill(easyStreak, 'Current Streak')}
        ${pill(pData.bestEasyStreak || easyStreak, 'Best Streak')}
        ${pill(pData.easyWins || 0, 'Wins')}
      </div>
    </div>
    <div class="stats-section mb-4">
      <p class="stats-section-title font-bold text-sm mb-1 text-red-600 dark:text-red-400">🔁 Normal</p>
      <div class="stats-grid grid grid-cols-3 gap-2 text-center text-xs">
        ${pill(unlimitedStreak, 'Current Streak')}
        ${pill(pData.bestUnlimitedStreak || unlimitedStreak, 'Best Streak')}
        ${pill(pData.unlimitedWins || 0, 'Wins')}
      </div>
    </div>
    <div class="stats-section mb-2">
      <p class="stats-section-title font-bold text-sm mb-1 text-purple-600 dark:text-purple-400">💀 Hard Mode</p>
      <div class="stats-grid grid grid-cols-3 gap-2 text-center text-xs">
        ${pill(hardStreak, 'Current Streak')}
        ${pill(pData.bestHardStreak || hardStreak, 'Best Streak')}
        ${pill(pData.hardWins || 0, 'Wins')}
      </div>
    </div>
  `;
}

function resetStatsTab() {
  if (!confirm(`Reset all ${currentStatsTab === 'uma' ? 'Umamusume' : 'G1 Race'} statistics? This cannot be undone.`)) return;
  allPersistentData[currentStatsTab] = _blankStats();
  savePersistentData();
  updateStatsUI();
  renderStatsContent();
}

function resetAllStats() {
  if (!confirm('Reset ALL statistics for both Umamusume and G1 Race? This cannot be undone.')) return;
  allPersistentData.uma    = _blankStats();
  allPersistentData.course = _blankStats();
  savePersistentData();
  updateStatsUI();
  renderStatsContent();
}

function _blankStats() {
  return {
    dailyStreak: 0, easyStreak: 0, unlimitedStreak: 0, hardStreak: 0,
    bestDailyStreak: 0, bestEasyStreak: 0, bestUnlimitedStreak: 0, bestHardStreak: 0,
    dailyPlayed: 0, dailyWins: 0,
    easyPlayed: 0, easyWins: 0,
    unlimitedPlayed: 0, unlimitedWins: 0,
    hardPlayed: 0, hardWins: 0,
    lastPlayedDate: null,
    dailyGuesses: [], dailyStatus: 'playing',
    rankedGuesses: [], rankedStatus: 'playing', rankedTargetName: null,
    unlimitedSession: null, hardSession: null, lbSubmittedKey: null
  };
}

// --------------- No-op stubs (picker is always visible) ---------------
function showAutocomplete() {}
function hideAutocomplete() {}
// --------------- Wallpaper Picker ---------------
const WALLPAPER_PRESETS = [
  { label: 'Default',        value: 'images/trace background.jpg',                                                    thumb: 'images/trace background.jpg' },
  { label: 'Outside',       value: 'https://images.steamusercontent.com/ugc/13963806649216154660/DF23A51B457215B75849D01FD85B8EC311BAFD68/?imw=637&imh=358&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true',             thumb: 'https://images.steamusercontent.com/ugc/13963806649216154660/DF23A51B457215B75849D01FD85B8EC311BAFD68/?imw=637&imh=358&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true' },
  { label: 'Ogu-Cre-rden', value: 'https://preview.redd.it/the-perfect-wallpaper-umadachis-v0-v4t4j435dy2f1.png?width=1080&crop=smart&auto=webp&s=6af615cb08905c9d14c3c8e6ae923c80999ab74b',       thumb: 'https://preview.redd.it/the-perfect-wallpaper-umadachis-v0-v4t4j435dy2f1.png?width=1080&crop=smart&auto=webp&s=6af615cb08905c9d14c3c8e6ae923c80999ab74b' },
  { label: 'Racetrack',     value: 'https://media.pocketgamer.biz/images/132587/86039/uma-musume-pretty-derby-track-field_orig.webp',       thumb: 'https://media.pocketgamer.biz/images/132587/86039/uma-musume-pretty-derby-track-field_orig.webp' },
  { label: 'Season 1',         value: 'https://en-portal.g.kuroco-img.app/v=1749187165/files/user/media/anime/anime01.jpg',         thumb: 'https://en-portal.g.kuroco-img.app/v=1749187165/files/user/media/anime/anime01.jpg' },
  { label: 'Race',   value: 'https://images.steamusercontent.com/ugc/13590127456284630094/1C00EF11763EEFAC06560B7D57B89A415844A9C9/?imw=637&imh=358&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true',       thumb: 'https://images.steamusercontent.com/ugc/13590127456284630094/1C00EF11763EEFAC06560B7D57B89A415844A9C9/?imw=637&imh=358&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true' },
  { label: 'Party',   value: 'https://images.steamusercontent.com/ugc/17440226665388322748/374C7B41283C195C013ED0231430B439D3EF327E/?imw=637&imh=358&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true',         thumb: 'https://images.steamusercontent.com/ugc/17440226665388322748/374C7B41283C195C013ED0231430B439D3EF327E/?imw=637&imh=358&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true' },
  { label: 'Nice Nature',     value: 'https://images.steamusercontent.com/ugc/17148371294565966589/C064B7EDF15B1A02F3C8586F02FAFDEB27FCFBFF/?imw=637&imh=358&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true',       thumb: 'https://images.steamusercontent.com/ugc/17148371294565966589/C064B7EDF15B1A02F3C8586F02FAFDEB27FCFBFF/?imw=637&imh=358&ima=fit&impolicy=Letterbox&imcolor=%23000000&letterbox=true' },
  { label: 'None',           value: '',                                                                                thumb: null },
];

// The storage key used for URL/data-url wallpapers
const _WP_KEY = 'tracendle_wallpaper';

function applyWallpaper(url) {
  document.body.style.backgroundImage = url ? `url('${url}')` : '';
  // Only persist non-dataURL values to localStorage (data URLs can exceed 5 MB limit).
  // For uploaded images we store separately under a dedicated key.
  if (!url.startsWith('data:')) {
    localStorage.setItem(_WP_KEY, url);
    // Clear any previously uploaded custom image reference
    localStorage.removeItem('tracendle_wallpaper_type');
  }
}

function loadWallpaper() {
  const type = localStorage.getItem('tracendle_wallpaper_type');
  if (type === 'upload') {
    // Retrieve the stored data URL from IndexedDB-style key (we use a dedicated localStorage key for blobs)
    const dataUrl = localStorage.getItem('tracendle_wallpaper_data');
    if (dataUrl) {
      document.body.style.backgroundImage = `url('${dataUrl}')`;
      return;
    }
  }
  const saved = localStorage.getItem(_WP_KEY);
  // Default to trace background if nothing has been saved yet
  if (saved === null) {
    applyWallpaper('images/trace background.jpg');
  } else {
    applyWallpaper(saved);
  }
}

function openWallpaperPicker() {
  const modal = document.getElementById('wallpaper-modal');
  if (!modal) return;
  _renderWallpaperPresets();
  modal.classList.remove('hidden');
}

function closeWallpaperPicker() {
  const modal = document.getElementById('wallpaper-modal');
  if (modal) modal.classList.add('hidden');
}

function _getCurrentWallpaperValue() {
  const type = localStorage.getItem('tracendle_wallpaper_type');
  if (type === 'upload') return '__upload__'; // special sentinel
  return localStorage.getItem(_WP_KEY) ?? 'images/trace background.jpg';
}

function _renderWallpaperPresets() {
  const grid    = document.getElementById('wallpaper-preset-grid');
  const current = _getCurrentWallpaperValue();
  if (!grid) return;
  grid.innerHTML = '';

  WALLPAPER_PRESETS.forEach(preset => {
    const isActive = preset.value === current;
    const btn = document.createElement('button');
    btn.title = preset.label;

    // Build border colour via inline style so it works in both light and dark without Tailwind JIT
    btn.style.cssText = `
      position:relative; border-radius:12px; overflow:hidden;
      border: 4px solid ${isActive ? '#22c55e' : '#cbd5e1'};
      outline: ${isActive ? '2px solid #86efac' : 'none'};
      outline-offset: 1px;
      aspect-ratio: 16/9; width:100%; cursor:pointer;
      transition: border-color .2s;
    `;
    if (preset.thumb) {
      btn.style.backgroundImage    = `url('${preset.thumb}')`;
      btn.style.backgroundSize     = 'cover';
      btn.style.backgroundPosition = 'center';
    } else {
      btn.style.background = 'linear-gradient(135deg,#e2e8f0,#94a3b8)';
    }
    btn.innerHTML = `
      <span style="position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;padding-bottom:4px;">
        <span style="font-size:9px;font-weight:700;color:#fff;background:rgba(0,0,0,.55);padding:1px 6px;border-radius:999px;">${preset.label}</span>
      </span>
      ${isActive ? '<span style="position:absolute;top:4px;right:5px;font-size:13px;color:#4ade80;text-shadow:0 0 4px #000;">✓</span>' : ''}
    `;
    btn.onmouseenter = () => { if (!isActive) btn.style.borderColor = '#86efac'; };
    btn.onmouseleave = () => { if (!isActive) btn.style.borderColor = '#cbd5e1'; };
    btn.onclick = () => {
      applyWallpaper(preset.value);
      localStorage.removeItem('tracendle_wallpaper_type');
      localStorage.removeItem('tracendle_wallpaper_data');
      _renderWallpaperPresets();
    };
    grid.appendChild(btn);
  });

  // If an uploaded image is active, show a small badge in the upload zone
  const uploadLabel = document.getElementById('wallpaper-upload-label');
  if (uploadLabel) {
    if (current === '__upload__') {
      uploadLabel.style.borderColor = '#22c55e';
      uploadLabel.querySelector('span.upload-text') && (uploadLabel.querySelector('span.upload-text').textContent = '✓ Custom image active — click to change');
    } else {
      uploadLabel.style.borderColor = '';
    }
  }
}

function handleWallpaperUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file.');
    return;
  }
  // 10 MB safety cap
  if (file.size > 10 * 1024 * 1024) {
    alert('Image is too large (max 10 MB). Please choose a smaller file.');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    try {
      localStorage.setItem('tracendle_wallpaper_data', dataUrl);
      localStorage.setItem('tracendle_wallpaper_type', 'upload');
      // Apply directly
      document.body.style.backgroundImage = `url('${dataUrl}')`;
      _renderWallpaperPresets();
      closeWallpaperPicker();
    } catch (storageErr) {
      // localStorage quota exceeded (data URLs can be large)
      // Apply for this session only without persisting
      document.body.style.backgroundImage = `url('${dataUrl}')`;
      closeWallpaperPicker();
      console.warn('Wallpaper too large to persist in localStorage; applied for this session only.');
    }
  };
  reader.readAsDataURL(file);
  // Reset the input so the same file can be re-selected
  event.target.value = '';
}

function applyCustomWallpaperUrl() {
  const input = document.getElementById('wallpaper-url-input');
  const url   = input ? input.value.trim() : '';
  if (!url) return;
  applyWallpaper(url);
  localStorage.removeItem('tracendle_wallpaper_type');
  localStorage.removeItem('tracendle_wallpaper_data');
  if (input) input.value = '';
  closeWallpaperPicker();
}

function removeWallpaper() {
  applyWallpaper('');
  localStorage.removeItem('tracendle_wallpaper_type');
  localStorage.removeItem('tracendle_wallpaper_data');
  _renderWallpaperPresets();
}

// Load saved wallpaper on startup
window.addEventListener('DOMContentLoaded', loadWallpaper);
// --------------- Overflow menu (⋯) ---------------
function toggleOverflowMenu() {
  const dropdown = document.getElementById('overflow-menu-dropdown');
  if (!dropdown) return;
  const isOpen = !dropdown.classList.contains('hidden');
  if (isOpen) {
    closeOverflowMenu();
  } else {
    dropdown.classList.remove('hidden');
    // Close when clicking outside
    setTimeout(() => {
      document.addEventListener('click', _overflowOutsideHandler, { once: true });
    }, 0);
  }
}

function closeOverflowMenu() {
  const dropdown = document.getElementById('overflow-menu-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

function _overflowOutsideHandler(e) {
  const wrap = document.getElementById('overflow-menu-wrap');
  if (wrap && !wrap.contains(e.target)) {
    closeOverflowMenu();
  }
}