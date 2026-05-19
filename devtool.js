
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
    devContainer.className = 'fixed bottom-4 right-4 z-[10000] bg-slate-950 text-slate-100 p-4 rounded-2xl shadow-2xl border border-slate-800 w-84 font-sans text-xs select-none max-h-[85vh] overflow-y-auto scrollbar-thin';
    
    devContainer.innerHTML = `
      <div class="flex justify-between items-center border-b border-slate-800 pb-2.5 mb-3">
        <div class="flex items-center gap-1.5">
          <span class="animate-pulse w-2 h-2 rounded-full bg-emerald-500"></span>
          <span class="font-black tracking-widest text-amber-400 text-xs">TRACENDLE TOOL</span>
        </div>
        <button id="dev-toggle-btn" class="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2 py-0.5 rounded text-[10px] transition">Minimize</button>
      </div>
      
      <div id="dev-content" class="space-y-4">
        <div class="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5">
          <span class="block font-black text-[10px] text-teal-400 uppercase tracking-wider">📡 Engine Telemetry</span>
          <div class="grid grid-cols-2 gap-x-2 text-[11px]">
            <div class="flex justify-between border-b border-slate-800/50 pb-0.5"><span class="text-slate-500">Category:</span><span id="dev-mon-type" class="font-bold text-slate-300">-</span></div>
            <div class="flex justify-between border-b border-slate-800/50 pb-0.5"><span class="text-slate-500">Mode:</span><span id="dev-mon-mode" class="font-bold text-slate-300">-</span></div>
          </div>
          <div class="flex flex-col pt-1">
            <span class="text-slate-500 mb-1 text-[10px]">🎯 Target Answer Entity:</span>
            <div id="dev-mon-answer" class="font-mono font-bold text-xs text-emerald-400 bg-slate-950 px-2 py-1.5 rounded border border-emerald-950/60 break-all select-all text-center">
              Waiting for session...
            </div>
          </div>
        </div>

        <div class="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 space-y-2">
          <span class="block font-black text-[10px] text-rose-400 uppercase tracking-wider">⚡ Instant Godmode Actions</span>
          <div class="grid grid-cols-2 gap-2">
            <button id="dev-reveal-btn" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-2 rounded-lg transition active:scale-95 text-[10px]">
              🔍 Reveal & Type
            </button>
            <button id="dev-solve-btn" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-1.5 px-2 rounded-lg transition active:scale-95 text-[10px]">
              🏆 Instant Auto-Win
            </button>
            <button id="dev-skip-btn" class="bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 px-2 rounded-lg transition active:scale-95 text-[10px]">
              🎲 Reroll Target
            </button>
            <button id="dev-clear-guesses-btn" class="bg-amber-600 hover:bg-amber-500 text-white font-bold py-1.5 px-2 rounded-lg transition active:scale-95 text-[10px]">
              🧹 Wipe Guesses
            </button>
          </div>
          <div class="border-t border-slate-800/60 pt-2 space-y-1.5">
            <label class="block text-[10px] text-slate-400 font-bold uppercase">🧬 Teleport New Target Answer:</label>
            <div class="flex gap-1">
              <input type="text" id="dev-teleport-input" placeholder="Enter Exact Target Name..." class="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white placeholder-slate-600 text-[11px]">
              <button id="dev-teleport-btn" class="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2 rounded text-[11px] transition">Inject</button>
            </div>
          </div>
        </div>

        <div class="bg-slate-900/40 p-2.5 rounded-xl border border-slate-800/50 space-y-3">
          <div>
            <label class="block font-bold text-slate-400 mb-1 uppercase tracking-wide text-[10px]">Selected Save Scope</label>
            <select id="dev-type" class="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-white font-bold text-xs">
              <option value="uma">Umamusume (uma)</option>
              <option value="course">G1 Course (course)</option>
            </select>
          </div>

          <div class="border-t border-slate-800/80 pt-2">
            <span class="block font-bold text-amber-400 mb-1.5 uppercase tracking-wider text-[10px]">🔥 Active Mode Streaks</span>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-slate-400 block text-[10px] mb-0.5">Daily Streak</label>
                <input type="number" id="dev-daily" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center font-bold">
              </div>
              <div>
                <label class="text-slate-400 block text-[10px] mb-0.5">Normal Streak</label>
                <input type="number" id="dev-unlimited" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center font-bold">
              </div>
              <div>
                <label class="text-slate-400 block text-[10px] mb-0.5">Hard Streak</label>
                <input type="number" id="dev-hard" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center font-bold">
              </div>
              <div>
                <label class="text-slate-400 block text-[10px] mb-0.5">Easy Streak</label>
                <input type="number" id="dev-easy" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center font-bold">
              </div>
            </div>
          </div>

          <div class="border-t border-slate-800/80 pt-2">
            <span class="block font-bold text-yellow-500 mb-1.5 uppercase tracking-wider text-[10px]">👑 All-Time Records</span>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-slate-400 block text-[10px] mb-0.5">Best Daily</label>
                <input type="number" id="dev-best-daily" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center">
              </div>
              <div>
                <label class="text-slate-400 block text-[10px] mb-0.5">Best Normal</label>
                <input type="number" id="dev-best-unlimited" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center">
              </div>
              <div>
                <label class="text-slate-400 block text-[10px] mb-0.5">Best Hard</label>
                <input type="number" id="dev-best-hard" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center">
              </div>
              <div>
                <label class="text-slate-400 block text-[10px] mb-0.5">Best Easy</label>
                <input type="number" id="dev-best-easy" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center">
              </div>
            </div>
          </div>

          <div class="border-t border-slate-800/80 pt-2">
            <span class="block font-bold text-fuchsia-400 mb-1.5 uppercase tracking-wider text-[10px]">⚔️ Arena Ranked System</span>
            <div class="space-y-1.5">
              <div>
                <label class="text-slate-400 block text-[10px] mb-0.5">Rating Points (200 Elo per Rank Tier)</label>
                <input type="number" id="dev-ranked-points" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center font-black text-amber-300">
              </div>
              <div class="grid grid-cols-2 gap-2">
                <div>
                  <label class="text-slate-400 block text-[10px] mb-0.5">Placements (0-5)</label>
                  <input type="number" id="dev-ranked-place" max="5" min="0" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center">
                </div>
                <div>
                  <label class="text-slate-400 block text-[10px] mb-0.5">Ranked Win Streak</label>
                  <input type="number" id="dev-ranked-winstreak" class="w-full bg-slate-950 border border-slate-800 rounded p-1 text-center">
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-2 border-t border-slate-800 pt-3">
          <button id="dev-load-btn" class="flex-1 bg-slate-800 hover:bg-slate-700 font-bold py-2 rounded-xl transition">Fetch Engine</button>
          <button id="dev-save-btn" class="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2 rounded-xl transition shadow-lg shadow-emerald-950/40">Apply Hotfix</button>
        </div>
      </div>
    `;

    document.body.appendChild(devContainer);

    const toggleBtn = document.getElementById('dev-toggle-btn');
    const content = document.getElementById('dev-content');
    const typeSelect = document.getElementById('dev-type');

    toggleBtn.addEventListener('click', () => {
      const isHidden = content.classList.toggle('hidden');
      toggleBtn.textContent = isHidden ? 'Expand' : 'Minimize';
      devContainer.style.width = isHidden ? '150px' : '336px';
    });

    typeSelect.addEventListener('change', loadCurrentSaveIntoUI);
    document.getElementById('dev-load-btn').addEventListener('click', loadCurrentSaveIntoUI);
    document.getElementById('dev-save-btn').addEventListener('click', injectModifiedSaveData);

    document.getElementById('dev-reveal-btn').addEventListener('click', triggerRevealTarget);
    document.getElementById('dev-solve-btn').addEventListener('click', triggerAutoSolve);
    document.getElementById('dev-skip-btn').addEventListener('click', triggerSkipSession);
    document.getElementById('dev-clear-guesses-btn').addEventListener('click', triggerClearGuesses);
    document.getElementById('dev-teleport-btn').addEventListener('click', triggerTargetTeleport);

    loadCurrentSaveIntoUI();
    startStateMonitorLoop();
  }

  function startStateMonitorLoop() {
    setInterval(() => {
      const monType = document.getElementById('dev-mon-type');
      const monMode = document.getElementById('dev-mon-mode');
      const monAns = document.getElementById('dev-mon-answer');
      
      if (!monType || !monMode || !monAns) return;

      if (typeof currentGameType !== 'undefined') {
        monType.textContent = currentGameType.toUpperCase();
      }
      
      if (typeof sessionState !== 'undefined' && sessionState.active) {
        monMode.textContent = (sessionState.mode || 'Active').toUpperCase();
        if (sessionState.target && sessionState.target.name) {
          monAns.textContent = sessionState.target.name;
          monAns.className = "font-mono font-bold text-xs text-emerald-400 bg-slate-950 px-2 py-1.5 rounded border border-emerald-900/50 break-all select-all text-center";
        } else {
          monAns.textContent = "Acquiring secret target...";
        }
      } else {
        monMode.textContent = "IDLE";
        monAns.textContent = "No Match Active";
        monAns.className = "font-bold text-slate-500 bg-slate-900/40 px-2 py-1.5 rounded border border-slate-800 text-center";
      }
    }, 250);
  }

  
  function triggerRevealTarget() {
    if (typeof sessionState === 'undefined' || !sessionState.active || !sessionState.target) {
      alert("⚠️ No active game session found.");
      return;
    }
    
    const targetName = sessionState.target.name;
    const inputField = document.getElementById('uma-input');
    
    if (inputField) {
      inputField.value = targetName;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.focus();
    } else {
      alert(`🎯 Secret Answer: ${targetName}`);
    }
  }

  function triggerAutoSolve() {
    if (typeof sessionState === 'undefined' || !sessionState.active || !sessionState.target) {
      alert("⚠️ No match running to process.");
      return;
    }
    if (sessionState.isGameOver) {
      alert("⚠️ Match has already finished.");
      return;
    }
    if (typeof submitGuess === 'function') {
      submitGuess(sessionState.target);
    } else {
      alert("❌ Error: Native execution link 'submitGuess' is missing.");
    }
  }

  function triggerSkipSession() {
    if (typeof sessionState === 'undefined' || !sessionState.active || !sessionState.mode) {
      alert("⚠️ No match active.");
      return;
    }
    if (sessionState.mode === 'daily') {
      alert("⚠️ Daily target parameters cannot be hot-swapped without disrupting game timestamp verification.");
      return;
    }

    if (typeof allPersistentData !== 'undefined' && typeof currentGameType !== 'undefined') {
      const pData = allPersistentData[currentGameType];
      if (sessionState.mode === 'hard') pData.hardSession = null;
      if (sessionState.mode === 'unlimited') pData.unlimitedSession = null;
      if (sessionState.mode === 'easy') pData.easySession = null; 
      if (typeof savePersistentData === 'function') savePersistentData();
    }

    if (typeof startGame === 'function') {
      startGame(sessionState.mode);
    } else {
      location.reload();
    }
  }

  function triggerClearGuesses() {
    if (typeof sessionState === 'undefined' || !sessionState.active) {
      alert("⚠️ No game active.");
      return;
    }
    
    sessionState.guesses = [];
    
    const grid = document.getElementById('guesses-grid');
    if (grid) grid.innerHTML = '';
    
    const inputField = document.getElementById('uma-input');
    if (inputField) {
      inputField.disabled = false;
      inputField.value = '';
    }
    const submitBtn = document.querySelector('button[onclick="handleGuessSubmit()"]');
    if (submitBtn) submitBtn.disabled = false;

    if (typeof savePersistentState === 'function') {
      savePersistentState();
    }
    
    alert("🧹 Guess log wiped clean. You have unlimited attempts remaining!");
  }

  function triggerTargetTeleport() {
    if (typeof sessionState === 'undefined' || !sessionState.active) {
      alert("⚠️ Enter a match before updating target vectors.");
      return;
    }
    
    const input = document.getElementById('dev-teleport-input');
    const name = input.value.trim();
    if (!name) return;

    if (typeof GAME_CONFIG === 'undefined' || typeof currentGameType === 'undefined') {
      alert("❌ Core engine config array not found.");
      return;
    }

    const pool = GAME_CONFIG[currentGameType].data();
    const cleanMatch = pool.find(item => item.name.toLowerCase() === name.toLowerCase());

    if (!cleanMatch) {
      alert("❌ Invalid target name! Must exactly match database profiles.");
      return;
    }

    sessionState.target = cleanMatch;
    triggerClearGuesses();
    input.value = '';
    alert(`🧬 Game state hijacked! Target is now forced to: ${cleanMatch.name}`);
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
      } catch(e) { console.error("Telemetry tracking exception:", e); }
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
    if (rawRanked) {
      try {
        const parsedRanked = JSON.parse(rawRanked);
        const rData = parsedRanked.data || parsedRanked;
        document.getElementById('dev-ranked-points').value = rData.points ?? 0;
        document.getElementById('dev-ranked-place').value = rData.placements ?? 5;
        document.getElementById('dev-ranked-winstreak').value = rData.winStreak ?? 0;
      } catch(e) { console.error("Arena tracking exception:", e); }
    } else {
      document.getElementById('dev-ranked-points').value = 0;
      document.getElementById('dev-ranked-place').value = 5;
      document.getElementById('dev-ranked-winstreak').value = 0;
    }
  }

  function injectModifiedSaveData() {
    const activeType = document.getElementById('dev-type').value;
    
    let masterSave = {};
    const localRaw = localStorage.getItem('uma_wordle_v2_stats');
    if (localRaw) {
      try {
        const parsed = JSON.parse(localRaw);
        masterSave = parsed.data || parsed;
      } catch(e) { console.error(e); }
    }

    if (!masterSave[activeType]) masterSave[activeType] = {};

    const targetScope = masterSave[activeType];
    targetScope.dailyStreak = parseInt(document.getElementById('dev-daily').value) || 0;
    targetScope.unlimitedStreak = parseInt(document.getElementById('dev-unlimited').value) || 0;
    targetScope.hardStreak = parseInt(document.getElementById('dev-hard').value) || 0;
    targetScope.easyStreak = parseInt(document.getElementById('dev-easy').value) || 0;

    targetScope.bestDailyStreak = parseInt(document.getElementById('dev-best-daily').value) || 0;
    targetScope.bestUnlimitedStreak = parseInt(document.getElementById('dev-best-unlimited').value) || 0;
    targetScope.bestHardStreak = parseInt(document.getElementById('dev-best-hard').value) || 0;
    targetScope.bestEasyStreak = parseInt(document.getElementById('dev-best-easy').value) || 0;

    localStorage.setItem('uma_wordle_v2_stats', JSON.stringify({
      data: masterSave,
      checksum: computeHash(masterSave)
    }));

    const rankedPayload = {
      points: parseInt(document.getElementById('dev-ranked-points').value) || 0,
      winStreak: parseInt(document.getElementById('dev-ranked-winstreak').value) || 0,
      lossStreak: 0,
      placements: parseInt(document.getElementById('dev-ranked-place').value) ?? 5,
      rankProtection: 1
    };

    localStorage.setItem(`${activeType}_ranked_stats`, JSON.stringify({
      data: rankedPayload,
      checksum: computeHash(rankedPayload)
    }));

    if (typeof allPersistentData !== 'undefined' && allPersistentData[activeType]) {
      allPersistentData[activeType] = {
        ...allPersistentData[activeType],
        ...targetScope
      };
    }

    if (typeof updateStatsUI === 'function') updateStatsUI();
    if (typeof updateScoreUI === 'function') updateScoreUI();

    alert("⚡ Engine hotfix initialized and synchronized successfully!");
  }

  function computeHash(obj) {
    const salt = "Satono Diamond";
    const str = JSON.stringify(obj) + salt;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }
})();