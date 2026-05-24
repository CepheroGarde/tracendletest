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

// ============================================================
//  Save Transfer  (cross-device via transfer code)
// ============================================================

const SAVE_EXPORT_KEYS = [
  'tracendle_user_id',
  'tracendle_nickname',
  'tracendle_lb_migrated',
  'uma_wordle_v2_stats',
  'uma_ranked_stats',
  'course_ranked_stats',
  'voicedle_ranked_stats',
  'theme',
  'tracendle_wallpaper_type',
  'tracendle_wallpaper_data',
  'voicedle_volume',
  'is_ranked_session'
];

// Code lifetime: 15 minutes (in seconds)
const TRANSFER_CODE_TTL_SECONDS = 15 * 60;

// --------------- Helpers ---------------

function _buildSavePayload() {
  const payload = { version: CURRENT_VERSION, exportedAt: new Date().toISOString(), data: {} };
  for (const key of SAVE_EXPORT_KEYS) {
    const val = localStorage.getItem(key);
    if (val !== null) payload.data[key] = val;
  }
  return payload;
}

function _applySavePayload(payload) {
  for (const [key, val] of Object.entries(payload.data)) {
    if (SAVE_EXPORT_KEYS.includes(key)) {
      localStorage.setItem(key, val);
    }
  }
}

/** Generate a human-friendly 8-char uppercase code, e.g. "XKCD-7J2M" */
function _generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// --------------- Supabase helpers ---------------
// We reuse the existing supabaseClient from config.js.
// Table needed (run once in Supabase SQL editor):
//
//   create table if not exists save_transfers (
//     code        text primary key,
//     payload     jsonb not null,
//     expires_at  timestamptz not null
//   );
//   -- Auto-delete expired rows (optional but tidy):
//   create index if not exists save_transfers_expires_idx on save_transfers (expires_at);
//
// Row-Level Security: allow anonymous insert + select by code (no user check needed,
// data is ephemeral and code acts as the secret).

async function _storeCodeInSupabase(code, payload) {
  const expiresAt = new Date(Date.now() + TRANSFER_CODE_TTL_SECONDS * 1000).toISOString();
  const { error } = await supabaseClient
    .from('save_transfers')
    .insert({ code, payload, expires_at: expiresAt });
  if (error) throw new Error(error.message);
}

async function _fetchCodeFromSupabase(code) {
  const { data, error } = await supabaseClient
    .from('save_transfers')
    .select('payload, expires_at')
    .eq('code', code)
    .single();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Code not found.');
  if (new Date(data.expires_at) < new Date()) throw new Error('Code has expired.');
  return data.payload;
}

async function _deleteCodeFromSupabase(code) {
  await supabaseClient.from('save_transfers').delete().eq('code', code);
}

// --------------- Toast ---------------
function showSaveTransferToast(msg, duration = 3000) {
  let toast = document.getElementById('save-transfer-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'save-transfer-toast';
    toast.style.cssText = [
      'position:fixed', 'bottom:24px', 'left:50%', 'transform:translateX(-50%)',
      'background:var(--toast-bg,#1e293b)', 'color:#f8fafc', 'padding:10px 20px',
      'border-radius:999px', 'font-size:14px', 'font-weight:600',
      'box-shadow:0 4px 20px rgba(0,0,0,.35)', 'z-index:99999',
      'transition:opacity .3s', 'white-space:nowrap', 'pointer-events:none'
    ].join(';');
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, duration);
}

// --------------- Generate transfer code (sender side) ---------------
async function generateTransferCode() {
  const btn = document.getElementById('st-generate-btn');
  const codeBox = document.getElementById('st-code-box');
  const codeDisplay = document.getElementById('st-code-display');
  const countdown = document.getElementById('st-countdown');
  const copyBtn = document.getElementById('st-copy-btn');

  if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }

  try {
    const payload = _buildSavePayload();
    const code = _generateCode();
    await _storeCodeInSupabase(code, payload);

    // Show code
    if (codeDisplay) codeDisplay.textContent = code;
    if (codeBox) codeBox.style.display = 'block';
    if (btn) btn.style.display = 'none';
    if (copyBtn) { copyBtn.style.display = 'inline-flex'; copyBtn.disabled = false; }

    // Countdown timer
    let remaining = TRANSFER_CODE_TTL_SECONDS;
    if (countdown) {
      const tick = () => {
        const m = String(Math.floor(remaining / 60)).padStart(2, '0');
        const s = String(remaining % 60).padStart(2, '0');
        countdown.textContent = `Expires in ${m}:${s}`;
        if (remaining <= 0) {
          countdown.textContent = '⚠️ Code expired. Generate a new one.';
          if (codeDisplay) codeDisplay.style.opacity = '0.4';
          if (copyBtn) copyBtn.disabled = true;
          return;
        }
        remaining--;
        setTimeout(tick, 1000);
      };
      tick();
    }

  } catch (err) {
    console.error('Generate code failed:', err);
    showSaveTransferToast('❌ Failed to generate code. Check your connection.');
    if (btn) { btn.disabled = false; btn.textContent = '🎲 Generate Transfer Code'; }
  }
}

function copyTransferCode() {
  const codeDisplay = document.getElementById('st-code-display');
  if (!codeDisplay) return;
  const code = codeDisplay.textContent.trim();
  navigator.clipboard.writeText(code).then(() => {
    showSaveTransferToast('📋 Code copied!');
  }).catch(() => {
    // fallback: select the text
    const range = document.createRange();
    range.selectNode(codeDisplay);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
  });
}

// --------------- Redeem transfer code (receiver side) ---------------
async function redeemTransferCode() {
  const input = document.getElementById('st-code-input');
  const btn   = document.getElementById('st-redeem-btn');
  const errEl = document.getElementById('st-import-error');

  if (!input) return;
  // Normalise: strip spaces/dashes, uppercase, then re-insert dash
  const raw  = input.value.replace(/[\s-]/g, '').toUpperCase();
  const code = raw.length >= 4 ? raw.slice(0, 4) + '-' + raw.slice(4) : raw;

  if (raw.length !== 8) {
    if (errEl) { errEl.textContent = 'Please enter the full 8-character code.'; errEl.style.display = 'block'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Importing…'; }
  if (errEl) errEl.style.display = 'none';

  try {
    const payload = await _fetchCodeFromSupabase(code);

    if (!payload || typeof payload.data !== 'object') {
      throw new Error('Save data in this code is invalid.');
    }

    const confirmed = confirm(
      '⚠️ Import Save?\n\nThis will REPLACE your current save on this device.\n' +
      'Your streaks, progress, and settings will be overwritten.\n\nContinue?'
    );
    if (!confirmed) {
      if (btn) { btn.disabled = false; btn.textContent = '✅ Import Save'; }
      return;
    }

    _applySavePayload(payload);

    // Delete code after one-time use
    await _deleteCodeFromSupabase(code).catch(() => {});

    closeSaveTransferModal();
    showSaveTransferToast('✅ Save imported! Reloading…', 2000);
    setTimeout(() => location.reload(), 2000);

  } catch (err) {
    console.error('Redeem code failed:', err);
    const msg = err.message.includes('not found') || err.message.includes('0 rows')
      ? 'Invalid code. Double-check and try again.'
      : err.message.includes('expired')
      ? 'This code has expired. Ask for a new one.'
      : 'Something went wrong. Please try again.';
    if (errEl) { errEl.textContent = '❌ ' + msg; errEl.style.display = 'block'; }
    if (btn) { btn.disabled = false; btn.textContent = '✅ Import Save'; }
  }
}

// --------------- Modal ---------------
function openSaveTransferModal() {
  closeOverflowMenu();

  // Remove stale modal so state resets each open
  const old = document.getElementById('save-transfer-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'save-transfer-modal';
  modal.style.cssText = [
    'position:fixed','inset:0','background:rgba(0,0,0,.65)',
    'display:flex','align-items:center','justify-content:center',
    'z-index:9999','padding:16px'
  ].join(';');

  modal.innerHTML = `
    <div id="save-transfer-inner">

      <!-- Header -->
      <div class="st-header">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">📲</span>
          <h2 class="st-title">Save Transfer</h2>
        </div>
        <button onclick="closeSaveTransferModal()" class="st-close-btn">&times;</button>
      </div>

      <!-- Tabs -->
      <div class="st-tabs">
        <button id="st-tab-send" onclick="_stSwitchTab('send')" class="st-tab st-tab--active">📤 Send Save</button>
        <button id="st-tab-receive" onclick="_stSwitchTab('receive')" class="st-tab">📥 Receive Save</button>
      </div>

      <!-- SEND panel -->
      <div id="st-panel-send" class="st-panel">
        <p class="st-desc">
          Generate a one-time code on <strong>this device</strong>, then enter it on your other device within <strong>15 minutes</strong>.
        </p>

        <button id="st-generate-btn" onclick="generateTransferCode()" class="st-btn-primary">
          Generate Transfer Code
        </button>

        <!-- Code display (hidden until generated) -->
        <div id="st-code-box" class="st-code-box">
          <div class="st-code-label">Your Transfer Code</div>
          <div class="st-code-pill">
            <span id="st-code-display">----</span>
            <button id="st-copy-btn" onclick="copyTransferCode()" class="st-copy-btn">📋 Copy</button>
          </div>
          <div id="st-countdown"></div>
          <p class="st-code-note">Code is single-use and expires automatically.</p>
        </div>
      </div>

      <!-- RECEIVE panel (hidden) -->
      <div id="st-panel-receive" class="st-panel" style="display:none;">
        <p class="st-desc">
          Enter the code generated on your <strong>other device</strong>. This will replace the save on this device.
        </p>

        <input id="st-code-input"
          class="st-code-input"
          type="text"
          maxlength="9"
          placeholder="XXXX-XXXX"
          oninput="_stFormatCodeInput(this)"
          onkeydown="if(event.key==='Enter') redeemTransferCode()"
        />

        <button id="st-redeem-btn" onclick="redeemTransferCode()" class="st-btn-secondary">
          ✅ Import Save
        </button>

        <div id="st-import-error" class="st-error"></div>

        <p class="st-warn">⚠️ Importing will overwrite your current save on this device.</p>
      </div>

    </div>
  `;

  modal.addEventListener('click', (e) => { if (e.target === modal) closeSaveTransferModal(); });
  document.body.appendChild(modal);
}

function closeSaveTransferModal() {
  const modal = document.getElementById('save-transfer-modal');
  if (modal) modal.remove();
}

function _stSwitchTab(tab) {
  const sendPanel    = document.getElementById('st-panel-send');
  const receivePanel = document.getElementById('st-panel-receive');
  const sendTab      = document.getElementById('st-tab-send');
  const receiveTab   = document.getElementById('st-tab-receive');
  if (!sendPanel || !receivePanel) return;

  const isSend = tab === 'send';
  sendPanel.style.display    = isSend ? 'block' : 'none';
  receivePanel.style.display = isSend ? 'none'  : 'block';

  sendTab.classList.toggle('st-tab--active', isSend);
  receiveTab.classList.toggle('st-tab--active', !isSend);
}

/** Auto-insert dash after 4 chars in the input */
function _stFormatCodeInput(el) {
  let v = el.value.replace(/[\s-]/g, '').toUpperCase().slice(0, 8);
  if (v.length > 4) v = v.slice(0, 4) + '-' + v.slice(4);
  el.value = v;
}