
(function() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDevTool);
  } else {
    initDevTool();
  }

  function initDevTool() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('silencesuzuka') !== 'true') return;

    const devContainer = document.createElement('div');
    devContainer.id = 'devtool-panel';
    devContainer.className = 'devtool-panel';

    devContainer.innerHTML = `
      <div id="dev-header" class="devtool-header">
        <div class="flex items-center gap-1.5">
          <span class="animate-pulse w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="font-black tracking-widest text-amber-400 text-xs">TRACENDLE DEV</span>
        </div>
        <button id="dev-toggle-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2 py-0.5 rounded text-[10px] transition">Minimize</button>
      </div>

      <div id="dev-content" class="devtool-scroll space-y-3">
        <div class="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
          <span class="block font-black text-[10px] text-teal-400 uppercase tracking-wider">📡 Live Session</span>
          <div class="grid grid-cols-2 gap-x-2 text-[11px]">
            <div class="flex justify-between border-b border-slate-800/50 pb-0.5"><span class="text-slate-500">Type:</span><span id="dev-mon-type" class="font-bold text-slate-300">-</span></div>
            <div class="flex justify-between border-b border-slate-800/50 pb-0.5"><span class="text-slate-500">Mode:</span><span id="dev-mon-mode" class="font-bold text-slate-300">-</span></div>
            <div class="flex justify-between border-b border-slate-800/50 pb-0.5 col-span-2"><span class="text-slate-500">Guesses:</span><span id="dev-mon-guesses" class="font-bold text-slate-300">-</span></div>
          </div>
          <div class="flex flex-col pt-1">
            <span class="text-slate-500 mb-1 text-[10px]">🎯 Target</span>
            <div id="dev-mon-answer" class="font-mono font-bold text-xs text-emerald-400 bg-slate-950 px-2 py-1.5 rounded border border-emerald-950/60 break-all select-all text-center">Waiting...</div>
          </div>
        </div>

        <div id="dev-heardle-panel" class="hidden bg-gradient-to-b from-violet-950/40 to-slate-900/60 p-2.5 rounded-xl border border-violet-800/50 space-y-2">
          <span class="block font-black text-[10px] text-violet-300 uppercase tracking-wider">🔊 Heardle Tools</span>
          <div class="text-[10px] space-y-1">
            <div class="flex justify-between"><span class="text-slate-500">Clip unlock:</span><span id="dev-h-clip" class="font-bold text-violet-200">-</span></div>
            <div class="flex justify-between"><span class="text-slate-500">Voice file:</span><span id="dev-h-voice-status" class="font-bold">-</span></div>
          </div>
          <div class="text-[10px] text-slate-500">Path</div>
          <div id="dev-h-voice-path" class="font-mono text-[9px] text-violet-200/90 bg-slate-950 px-2 py-1 rounded border border-violet-900/40 break-all select-all max-h-10 overflow-y-auto">-</div>
          <div class="grid grid-cols-2 gap-1.5">
            <button id="dev-h-play-btn" class="bg-violet-600 hover:bg-violet-500 text-white font-bold py-1.5 rounded-lg text-[10px]">▶ Play Clip</button>
            <button id="dev-h-play-full-btn" class="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-1.5 rounded-lg text-[10px]">▶ Full 2.0s</button>
            <button id="dev-h-unlock-btn" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 rounded-lg text-[10px]">⏩ +Unlock Tier</button>
            <button id="dev-h-test-voice-btn" class="bg-slate-700 hover:bg-slate-600 text-white font-bold py-1.5 rounded-lg text-[10px]">🧪 Test File</button>
          </div>
          <div class="border-t border-violet-900/40 pt-2 space-y-1">
            <div class="flex justify-between text-[10px]"><span class="text-slate-500">Voices on disk</span><span id="dev-h-voice-count" class="font-bold text-emerald-400">-</span></div>
            <button id="dev-h-audit-btn" class="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-1 rounded text-[10px]">📋 List Missing Voices</button>
          </div>
          <div class="border-t border-violet-900/40 pt-2 space-y-1">
            <div class="text-[10px] text-slate-500">Daily targets (UTC+8)</div>
            <div class="grid grid-cols-2 gap-1 text-[10px]">
              <div class="bg-slate-950/80 p-1.5 rounded border border-slate-800"><span class="text-slate-500 block">Uma</span><span id="dev-h-daily-uma" class="font-bold text-green-400">-</span></div>
              <div class="bg-slate-950/80 p-1.5 rounded border border-violet-900/50"><span class="text-slate-500 block">Heardle</span><span id="dev-h-daily-heardle" class="font-bold text-violet-300">-</span></div>
            </div>
            <button id="dev-h-force-daily-btn" class="w-full bg-amber-700 hover:bg-amber-600 text-white font-bold py-1.5 rounded-lg text-[10px]">🔄 Re-roll Heardle Daily (dev)</button>
          </div>
        </div>

        <div id="dev-wordle-panel" class="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-2">
          <span class="block font-black text-[10px] text-rose-400 uppercase tracking-wider">⚡ Session Actions</span>
          <div class="grid grid-cols-2 gap-2">
            <button id="dev-reveal-btn" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-2 rounded-lg text-[10px]">🔍 Reveal</button>
            <button id="dev-solve-btn" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-2 rounded-lg text-[10px]">🏆 Auto-Win</button>
            <button id="dev-skip-btn" class="bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 px-2 rounded-lg text-[10px]">🎲 Reroll</button>
            <button id="dev-clear-guesses-btn" class="bg-amber-600 hover:bg-amber-500 text-white font-bold py-1.5 px-2 rounded-lg text-[10px]">🧹 Clear</button>
          </div>
          <div class="border-t border-slate-800/60 pt-2 space-y-1.5">
            <label class="block text-[10px] text-slate-400 font-bold uppercase">Teleport target</label>
            <div class="flex gap-1">
              <input type="text" id="dev-teleport-input" placeholder="Exact character / race name..." class="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white placeholder-slate-600 text-[11px]">
              <button id="dev-teleport-btn" class="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2 rounded text-[11px]">Go</button>
            </div>
          </div>
        </div>

        <div class="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50 space-y-3">
          <div>
            <label class="block font-bold text-slate-400 mb-1 uppercase tracking-wide text-[10px]">Save scope</label>
            <select id="dev-type" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white font-bold text-xs">
              <option value="uma">Umamusume</option>
              <option value="course">G1 Race</option>
              <option value="heardle">Heardle</option>
            </select>
          </div>

          <div class="border-t border-slate-800/80 pt-2">
            <span class="block font-bold text-amber-400 mb-1.5 uppercase tracking-wider text-[10px]">Streaks</span>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-slate-400 block text-[10px] mb-0.5">Daily</label><input type="number" id="dev-daily" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center font-bold"></div>
              <div><label class="text-slate-400 block text-[10px] mb-0.5">Normal</label><input type="number" id="dev-unlimited" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center font-bold"></div>
              <div><label class="text-slate-400 block text-[10px] mb-0.5">Hard</label><input type="number" id="dev-hard" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center font-bold"></div>
              <div><label class="text-slate-400 block text-[10px] mb-0.5">Easy</label><input type="number" id="dev-easy" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center font-bold"></div>
            </div>
          </div>

          <div class="border-t border-slate-800/80 pt-2">
            <span class="block font-bold text-yellow-500 mb-1.5 uppercase tracking-wider text-[10px]">Best streaks</span>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-slate-400 block text-[10px] mb-0.5">Daily</label><input type="number" id="dev-best-daily" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center"></div>
              <div><label class="text-slate-400 block text-[10px] mb-0.5">Normal</label><input type="number" id="dev-best-unlimited" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center"></div>
              <div><label class="text-slate-400 block text-[10px] mb-0.5">Hard</label><input type="number" id="dev-best-hard" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center"></div>
              <div><label class="text-slate-400 block text-[10px] mb-0.5">Easy</label><input type="number" id="dev-best-easy" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center"></div>
            </div>
          </div>

          <div id="dev-ranked-section" class="border-t border-slate-800/80 pt-2">
            <span class="block font-bold text-fuchsia-400 mb-1.5 uppercase tracking-wider text-[10px]">Ranked (uma / course)</span>
            <div class="space-y-1.5">
              <div><label class="text-slate-400 block text-[10px] mb-0.5">Points</label><input type="number" id="dev-ranked-points" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center font-black text-amber-300"></div>
              <div class="grid grid-cols-2 gap-2">
                <div><label class="text-slate-400 block text-[10px] mb-0.5">Placements</label><input type="number" id="dev-ranked-place" max="5" min="0" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center"></div>
                <div><label class="text-slate-400 block text-[10px] mb-0.5">Win streak</label><input type="number" id="dev-ranked-winstreak" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-2 border-t border-slate-800 pt-3">
          <button id="dev-load-btn" class="flex-1 bg-slate-800 hover:bg-slate-700 font-bold py-2 rounded-xl transition text-[11px]">Reload</button>
          <button id="dev-save-btn" class="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2 rounded-xl transition text-[11px]">Apply</button>
        </div>
      </div>
    `;

    document.body.appendChild(devContainer);

    document.getElementById('dev-toggle-btn').addEventListener('click', () => {
      const content = document.getElementById('dev-content');
      const isHidden = content.classList.toggle('hidden');
      document.getElementById('dev-toggle-btn').textContent = isHidden ? 'Expand' : 'Minimize';
      devContainer.classList.toggle('devtool-panel--minimized', isHidden);
    });

    document.getElementById('dev-type').addEventListener('change', () => {
      loadCurrentSaveIntoUI();
      updateScopePanels();
    });
    document.getElementById('dev-load-btn').addEventListener('click', loadCurrentSaveIntoUI);
    document.getElementById('dev-save-btn').addEventListener('click', injectModifiedSaveData);

    document.getElementById('dev-reveal-btn').addEventListener('click', triggerRevealTarget);
    document.getElementById('dev-solve-btn').addEventListener('click', triggerAutoSolve);
    document.getElementById('dev-skip-btn').addEventListener('click', triggerSkipSession);
    document.getElementById('dev-clear-guesses-btn').addEventListener('click', triggerClearGuesses);
    document.getElementById('dev-teleport-btn').addEventListener('click', triggerTargetTeleport);

    document.getElementById('dev-h-play-btn').addEventListener('click', () => devPlayHeardle(false));
    document.getElementById('dev-h-play-full-btn').addEventListener('click', devPlayHeardleFull);
    document.getElementById('dev-h-unlock-btn').addEventListener('click', devSimulateWrongGuess);
    document.getElementById('dev-h-test-voice-btn').addEventListener('click', devTestVoiceFile);
    document.getElementById('dev-h-audit-btn').addEventListener('click', devAuditVoices);
    document.getElementById('dev-h-force-daily-btn').addEventListener('click', devForceHeardleDailyReroll);

    loadCurrentSaveIntoUI();
    updateScopePanels();
    refreshHeardleDailyPreview();
    refreshVoiceAuditCount();
    startStateMonitorLoop();
  }

  function isHeardleContext() {
    if (typeof sessionState !== 'undefined' && sessionState.active && typeof currentGameType !== 'undefined') {
      return currentGameType === 'heardle';
    }
    const sel = document.getElementById('dev-type');
    return sel && sel.value === 'heardle';
  }

  function updateScopePanels() {
    const scope = document.getElementById('dev-type')?.value || 'uma';
    const heardlePanel = document.getElementById('dev-heardle-panel');
    const rankedSection = document.getElementById('dev-ranked-section');
    if (heardlePanel) heardlePanel.classList.toggle('hidden', scope !== 'heardle');
    if (rankedSection) rankedSection.classList.toggle('hidden', scope === 'heardle');
  }

  function getActivePool(gameType) {
    if (typeof GAME_CONFIG === 'undefined') return [];
    const t = gameType || (typeof currentGameType !== 'undefined' ? currentGameType : 'uma');
    return GAME_CONFIG[t]?.data() || [];
  }

  function normalizeVoicePath(path) {
    return (path || '').replace(/\\/g, '/');
  }

  function getVoiceFileName(entry) {
    const p = normalizeVoicePath(entry?.voice);
    if (!p) return '';
    return p.split('/').pop() || '';
  }

  function refreshVoiceAuditCount() {
    const el = document.getElementById('dev-h-voice-count');
    if (!el || typeof HEARDLE === 'undefined' || !HEARDLE.length) {
      if (el) el.textContent = '—';
      return;
    }
    devAuditVoices(true);
  }

  async function devAuditVoices(silent) {
    const list = typeof HEARDLE !== 'undefined' ? HEARDLE : [];
    const noPath = [];
    const badPath = [];
    const loadFail = [];

    list.forEach(entry => {
      const raw = entry.voice || '';
      const norm = normalizeVoicePath(raw);
      if (!norm) {
        noPath.push(entry.name);
        return;
      }
      if (raw.includes('\\')) badPath.push(`${entry.name} (use / not \\)`);
    });

    const withPath = list.filter(e => normalizeVoicePath(e.voice));
    let ok = 0;
    const checkLimit = silent ? 0 : 12;
    for (let i = 0; i < withPath.length && i < checkLimit; i++) {
      const path = normalizeVoicePath(withPath[i].voice);
      const canPlay = await probeAudio(path);
      if (canPlay) ok++;
      else loadFail.push(`${withPath[i].name} → ${path}`);
    }

    const countEl = document.getElementById('dev-h-voice-count');
    if (countEl) {
      countEl.textContent = silent
        ? `${withPath.length - noPath.length} / ${list.length} paths`
        : `checked ${Math.min(checkLimit, withPath.length)}…`;
    }

    if (silent) return;

    const lines = [];
    if (noPath.length) lines.push(`No voice path (${noPath.length}):\n${noPath.slice(0, 8).join(', ')}`);
    if (badPath.length) lines.push(`Bad slashes:\n${badPath.slice(0, 5).join('\n')}`);
    if (loadFail.length) lines.push(`Failed probe (${loadFail.length}):\n${loadFail.slice(0, 10).join('\n')}`);
    if (!lines.length) {
      alert(`✅ ${list.length} entries have voice paths.\nProbed first ${checkLimit} files — all loaded.`);
    } else {
      alert(lines.join('\n\n'));
    }
    refreshVoiceAuditCount();
  }

  function probeAudio(src) {
    return new Promise(resolve => {
      const a = new Audio();
      const done = ok => {
        a.src = '';
        resolve(ok);
      };
      a.addEventListener('canplaythrough', () => done(true), { once: true });
      a.addEventListener('error', () => done(false), { once: true });
      a.src = src;
      setTimeout(() => done(false), 2500);
    });
  }

  function refreshHeardleDailyPreview() {
    const umaEl = document.getElementById('dev-h-daily-uma');
    const hEl = document.getElementById('dev-h-daily-heardle');
    if (!umaEl || !hEl) return;
    if (typeof getDailyString !== 'function' || typeof getTargetForDate !== 'function') return;

    const today = getDailyString();
    const umaPool = getActivePool('uma');
    const hPool = getActivePool('heardle');

    const umaT = umaPool.length ? getTargetForDate(today, umaPool, 'uma') : null;
    const hT = hPool.length ? getTargetForDate(today, hPool, 'heardle') : null;

    umaEl.textContent = umaT?.name || '—';
    hEl.textContent = hT?.name || '—';
    hEl.classList.toggle('text-red-400', umaT && hT && umaT.name === hT.name);
    hEl.classList.toggle('text-violet-300', !(umaT && hT && umaT.name === hT.name));
  }

  function updateHeardleTelemetry() {
    const clipEl = document.getElementById('dev-h-clip');
    const pathEl = document.getElementById('dev-h-voice-path');
    const statusEl = document.getElementById('dev-h-voice-status');
    if (!clipEl) return;

    if (!sessionState?.active || !sessionState.target || currentGameType !== 'heardle') {
      clipEl.textContent = '—';
      if (pathEl) pathEl.textContent = 'No active Heardle session';
      if (statusEl) { statusEl.textContent = '—'; statusEl.className = 'font-bold text-slate-500'; }
      return;
    }

    const duration = typeof getHeardleClipDuration === 'function' ? getHeardleClipDuration() : '?';
    const maxG = typeof getHeardleMaxGuesses === 'function' ? getHeardleMaxGuesses() : 5;
    const used = sessionState.guesses?.length || 0;
    clipEl.textContent = `${formatDur(duration)} (guess tier ${Math.min(used + 1, 5)})`;

    const voicePath = normalizeVoicePath(sessionState.target.voice || (typeof nameToVoicePath === 'function' ? nameToVoicePath(sessionState.target.name) : ''));
    if (pathEl) pathEl.textContent = voicePath || '—';

    if (statusEl) {
      statusEl.textContent = voicePath ? 'linked' : 'missing path';
      statusEl.className = 'font-bold ' + (voicePath ? 'text-emerald-400' : 'text-red-400');
    }
  }

  function formatDur(sec) {
    if (typeof sec !== 'number') return '?';
    return sec % 1 === 0 ? `${sec.toFixed(0)}s` : `${sec.toFixed(1)}s`;
  }

  function devPlayHeardleFull() {
    if (!requireHeardleSession()) return;
    if (typeof playHeardleClipForDuration === 'function') playHeardleClipForDuration(2.0);
    updateHeardleTelemetry();
  }

  function devPlayHeardle() {
    if (!requireHeardleSession()) return;
    if (typeof playHeardleClip === 'function') playHeardleClip();
  }

  function devSimulateWrongGuess() {
    if (!requireHeardleSession()) return;
    if (sessionState.isGameOver) {
      alert('Match already finished.');
      return;
    }
    const pool = getActivePool('heardle');
    const wrong = pool.find(u => u.name !== sessionState.target.name);
    if (!wrong) return;
    if (typeof submitHeardleGuess === 'function') {
      submitHeardleGuess(wrong);
    } else if (typeof submitGuess === 'function') {
      submitGuess(wrong);
    }
  }

  function devTestVoiceFile() {
    let path = '';
    if (sessionState?.target && currentGameType === 'heardle') {
      path = normalizeVoicePath(sessionState.target.voice || nameToVoicePath?.(sessionState.target.name));
    } else {
      path = document.getElementById('dev-h-voice-path')?.textContent?.trim() || '';
    }
    if (!path || path === '-' || path.startsWith('No active')) {
      alert('No voice path to test.');
      return;
    }
    const test = new Audio(path);
    test.play()
      .then(() => alert(`✅ Playing: ${path}`))
      .catch(err => alert(`❌ Failed to play:\n${path}\n\n${err.message}`));
  }

  function devForceHeardleDailyReroll() {
    if (typeof startGame !== 'function' || typeof HEARDLE === 'undefined') {
      alert('Engine not ready.');
      return;
    }
    const prevType = typeof currentGameType !== 'undefined' ? currentGameType : 'uma';
    if (typeof switchGameType === 'function') switchGameType('heardle');

    const others = HEARDLE.filter(u => {
      const today = getDailyString();
      const official = getTargetForDate(today, HEARDLE, 'heardle');
      return u.name !== official?.name;
    });
    if (!others.length) {
      alert('No alternate targets.');
      return;
    }
    const pick = others[Math.floor(Math.random() * others.length)];

    startGame('daily');
    sessionState.target = pick;
    sessionState.guesses = [];
    sessionState.isGameOver = false;
    if (typeof allPersistentData !== 'undefined') {
      const p = allPersistentData.heardle;
      p.dailyGuesses = [];
      p.dailyStatus = 'playing';
      if (typeof savePersistentData === 'function') savePersistentData();
    }
    if (typeof renderGameLayout === 'function') renderGameLayout();
    if (typeof initHeardleAudio === 'function') initHeardleAudio();
    alert(`🔊 Heardle daily forced to: ${pick.name}\n(Dev only — does not change global daily seed)`);
  }

  function requireHeardleSession() {
    if (typeof sessionState === 'undefined' || !sessionState.active) {
      alert('Start a Heardle match first.');
      return false;
    }
    if (currentGameType !== 'heardle') {
      alert('Switch to Heardle mode (or start a Heardle game).');
      return false;
    }
    if (!sessionState.target) {
      alert('No target loaded.');
      return false;
    }
    return true;
  }

  function startStateMonitorLoop() {
    setInterval(() => {
      const monType = document.getElementById('dev-mon-type');
      const monMode = document.getElementById('dev-mon-mode');
      const monAns = document.getElementById('dev-mon-answer');
      const monGuesses = document.getElementById('dev-mon-guesses');

      if (!monType) return;

      if (typeof currentGameType !== 'undefined') monType.textContent = currentGameType.toUpperCase();

      const heardleLive = typeof currentGameType !== 'undefined' && currentGameType === 'heardle';
      const heardlePanel = document.getElementById('dev-heardle-panel');
      if (heardlePanel && sessionState?.active && heardleLive) {
        heardlePanel.classList.remove('hidden');
      }

      if (sessionState?.active) {
        monMode.textContent = (sessionState.mode || 'active').toUpperCase();
        monAns.textContent = sessionState.target?.name || '…';
        monAns.className = 'font-mono font-bold text-xs text-emerald-400 bg-slate-950 px-2 py-1.5 rounded border border-emerald-900/50 break-all select-all text-center';

        const maxG = currentGameType === 'heardle' && typeof getHeardleMaxGuesses === 'function'
          ? getHeardleMaxGuesses()
          : (sessionState.maxGuesses === Infinity ? '∞' : sessionState.maxGuesses);
        const used = sessionState.guesses?.length || 0;
        monGuesses.textContent = `${used} / ${maxG}`;
      } else {
        monMode.textContent = 'IDLE';
        monAns.textContent = 'No match';
        monAns.className = 'font-bold text-slate-500 bg-slate-900/40 px-2 py-1.5 rounded border border-slate-800 text-center';
        monGuesses.textContent = '—';
      }

      updateHeardleTelemetry();
    }, 250);
  }

  function triggerRevealTarget() {
    if (!sessionState?.active || !sessionState.target) {
      alert('No active session.');
      return;
    }
    const inputField = document.getElementById('uma-input');
    if (inputField) {
      inputField.value = sessionState.target.name;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.focus();
    } else {
      alert(`Target: ${sessionState.target.name}`);
    }
  }

  function triggerAutoSolve() {
    if (!sessionState?.active || !sessionState.target) {
      alert('No active match.');
      return;
    }
    if (sessionState.isGameOver) {
      alert('Match already finished.');
      return;
    }
    if (typeof submitGuess === 'function') submitGuess(sessionState.target);
    else alert('submitGuess not found.');
  }

  function triggerSkipSession() {
    if (!sessionState?.active || !sessionState.mode) {
      alert('No active match.');
      return;
    }

    if (sessionState.mode === 'daily' && currentGameType === 'heardle') {
      devForceHeardleDailyReroll();
      return;
    }
    if (sessionState.mode === 'daily') {
      alert('Daily cannot be rerolled for uma/course (use a different date in archive).');
      return;
    }

    clearSessionPersistence();
    if (typeof startGame === 'function') startGame(sessionState.mode);
    else location.reload();
  }

  function clearSessionPersistence() {
    if (typeof allPersistentData === 'undefined' || typeof currentGameType === 'undefined') return;
    const pData = allPersistentData[currentGameType];
    if (!pData) return;
    const sessionKey = typeof getModeSessionKey === 'function'
      ? getModeSessionKey(sessionState.mode)
      : (sessionState.mode === 'hard' ? 'hardSession' : sessionState.mode === 'unlimited' ? 'unlimitedSession' : sessionState.mode === 'easy' ? 'easySession' : null);
    if (sessionKey) pData[sessionKey] = null;
    if (typeof savePersistentData === 'function') savePersistentData();
  }

  function triggerClearGuesses() {
    if (!sessionState?.active) {
      alert('No active match.');
      return;
    }

    sessionState.guesses = [];
    sessionState.isGameOver = false;

    const grid = document.getElementById('guess-grid');
    if (grid) grid.innerHTML = '';

    const heardleHistory = document.getElementById('heardle-guess-history');
    if (heardleHistory) heardleHistory.innerHTML = '';

    const inputField = document.getElementById('uma-input');
    if (inputField) {
      inputField.disabled = false;
      inputField.value = '';
    }

    const pData = allPersistentData?.[currentGameType];
    if (pData) {
      if (sessionState.mode === 'daily') {
        pData.dailyGuesses = [];
        pData.dailyStatus = 'playing';
      }
      const sessionKey = typeof getModeSessionKey === 'function'
        ? getModeSessionKey(sessionState.mode)
        : null;
      if (sessionKey && pData[sessionKey]) pData[sessionKey].guesses = [];
      if (typeof savePersistentData === 'function') savePersistentData();
    }

    if (typeof updateGuessCountUI === 'function') updateGuessCountUI();
    if (typeof updateHeardleUnlockHint === 'function') updateHeardleUnlockHint();
    if (typeof renderSuggestions === 'function') renderSuggestions('');
    if (currentGameType === 'heardle' && typeof initHeardleAudio === 'function') initHeardleAudio();

    alert('Guesses cleared.');
  }

  function triggerTargetTeleport() {
    if (!sessionState?.active) {
      alert('Start a match first.');
      return;
    }

    const name = document.getElementById('dev-teleport-input').value.trim();
    if (!name) return;

    const pool = getActivePool(currentGameType);
    const match = pool.find(item => item.name.toLowerCase() === name.toLowerCase());
    if (!match) {
      alert('Name not found in current roster.');
      return;
    }

    sessionState.target = match;
    sessionState.isGameOver = false;

    if (currentGameType === 'heardle') {
      if (typeof initHeardleAudio === 'function') initHeardleAudio();
      if (typeof updateHeardleUnlockHint === 'function') updateHeardleUnlockHint();
    }

    triggerClearGuesses();
    document.getElementById('dev-teleport-input').value = '';
    alert(`Target set to: ${match.name}`);
  }

  function loadCurrentSaveIntoUI() {
    const activeType = document.getElementById('dev-type').value;
    let stats = {
      dailyStreak: 0, easyStreak: 0, unlimitedStreak: 0, hardStreak: 0,
      bestDailyStreak: 0, bestEasyStreak: 0, bestUnlimitedStreak: 0, bestHardStreak: 0
    };

    const localRaw = localStorage.getItem('uma_wordle_v2_stats');
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        const data = parsed.data || parsed;
        if (data[activeType]) stats = { ...stats, ...data[activeType] };
      } catch (e) { console.error(e); }
    }

    document.getElementById('dev-daily').value = stats.dailyStreak || 0;
    document.getElementById('dev-unlimited').value = stats.unlimitedStreak || 0;
    document.getElementById('dev-hard').value = stats.hardStreak || 0;
    document.getElementById('dev-easy').value = stats.easyStreak || 0;
    document.getElementById('dev-best-daily').value = stats.bestDailyStreak || 0;
    document.getElementById('dev-best-unlimited').value = stats.bestUnlimitedStreak || 0;
    document.getElementById('dev-best-hard').value = stats.bestHardStreak || 0;
    document.getElementById('dev-best-easy').value = stats.bestEasyStreak || 0;

    const rawRanked = localStorage.getItem(`${activeType}_ranked_stats`);
    if (activeType !== 'heardle' && rawRanked) {
      try {
        const rData = (JSON.parse(rawRanked).data) || JSON.parse(rawRanked);
        document.getElementById('dev-ranked-points').value = rData.points ?? 0;
        document.getElementById('dev-ranked-place').value = rData.placements ?? 5;
        document.getElementById('dev-ranked-winstreak').value = rData.winStreak ?? 0;
      } catch (e) { console.error(e); }
    }

    updateScopePanels();
    refreshHeardleDailyPreview();
    if (activeType === 'heardle') refreshVoiceAuditCount();
  }

  function injectModifiedSaveData() {
    const activeType = document.getElementById('dev-type').value;
    let masterSave = {};
    const localRaw = localStorage.getItem('uma_wordle_v2_stats');
    if (localRaw) {
      try {
        masterSave = (JSON.parse(localRaw).data) || JSON.parse(localRaw);
      } catch (e) { console.error(e); }
    }

    if (!masterSave[activeType]) masterSave[activeType] = {};
    const targetScope = masterSave[activeType];

    targetScope.dailyStreak = parseInt(document.getElementById('dev-daily').value, 10) || 0;
    targetScope.unlimitedStreak = parseInt(document.getElementById('dev-unlimited').value, 10) || 0;
    targetScope.hardStreak = parseInt(document.getElementById('dev-hard').value, 10) || 0;
    targetScope.easyStreak = parseInt(document.getElementById('dev-easy').value, 10) || 0;
    targetScope.bestDailyStreak = parseInt(document.getElementById('dev-best-daily').value, 10) || 0;
    targetScope.bestUnlimitedStreak = parseInt(document.getElementById('dev-best-unlimited').value, 10) || 0;
    targetScope.bestHardStreak = parseInt(document.getElementById('dev-best-hard').value, 10) || 0;
    targetScope.bestEasyStreak = parseInt(document.getElementById('dev-best-easy').value, 10) || 0;

    localStorage.setItem('uma_wordle_v2_stats', JSON.stringify({
      data: masterSave,
      checksum: computeHash(masterSave)
    }));

    if (activeType !== 'heardle') {
      const rankedPayload = {
        points: parseInt(document.getElementById('dev-ranked-points').value, 10) || 0,
        winStreak: parseInt(document.getElementById('dev-ranked-winstreak').value, 10) || 0,
        lossStreak: 0,
        placements: parseInt(document.getElementById('dev-ranked-place').value, 10) ?? 5,
        rankProtection: 1
      };
      localStorage.setItem(`${activeType}_ranked_stats`, JSON.stringify({
        data: rankedPayload,
        checksum: computeHash(rankedPayload)
      }));
    }

    if (typeof allPersistentData !== 'undefined' && allPersistentData[activeType]) {
      Object.assign(allPersistentData[activeType], targetScope);
    }
    if (typeof savePersistentData === 'function') savePersistentData();
    if (typeof updateStatsUI === 'function') updateStatsUI();
    if (typeof updateScoreUI === 'function') updateScoreUI();

    alert('Save data applied.');
  }

  function computeHash(obj) {
    const salt = 'Satono Diamond';
    const str = JSON.stringify(obj) + salt;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }
})();
