// ============================================================
//  main.js — Entry point: load data, initialise the app
// ============================================================

async function loadGameData() {
  try {
    const [umaRes, hunterRes, voicedleRes] = await Promise.all([
      fetch('identity_v_survivors.json'),
      fetch('identity_v_hunters.json'), 
      fetch('voicedle.json')
    ]);
    
    const survivors = await umaRes.json();
    UMAS = survivors.map(item => ({
      name: item.Name || 'Unknown',
      role1: item.Roles?.[0] || 'N/A',
      role2: item.Roles?.[1] || 'N/A',
      gender: item.Gender || 'N/A',
      difficulty: Number(item.Difficulty) || 0,
      year: item.ReleaseYear || 'N/A',
      image: item.image || item.Image || 'images/placeholder.svg'
    }));

    const hunters = await hunterRes.json();
    HUNTERS = hunters.map(item => ({
      name: item.Name || 'Unknown',
      gender: item.Gender || 'N/A',
      trait: Number(item["External Trait"]) || 0, 
      difficulty: Number(item.Difficulty) || 0,
      year: item.ReleaseYear || 'N/A',
      pursuit: String(item.Style?.Pursuit || 'N/A'),
      control: String(item.Style?.Control || 'N/A'),
      chairGuarding: String(item.Style?.ChairGuarding || 'N/A'),
      image: item.Image || `images/hunters/${item.Name}.png`
    }));

    VOICEDLE = await voicedleRes.json();
    init();
  } catch (error) {
    console.error("Failed to load data:", error);
  }
}

function init() {
  checkOrCreateUsername();
  checkDevMode();
  loadPersistentData();
  switchGameType('uma');
  startClock();
  loadTheme();
  loadAndSetRandomPeekingUma();
  loadAndSetRandomDailyChibis();
  maybeRunChibis();
  if (typeof playIntroAnimation === 'function') playIntroAnimation();
}

async function loadAndSetRandomPeekingUma() {
  try {
    const response = await fetch('chibi-list.json');
    const data = await response.json();
    const umaChibiImages = data.peeking || [];
    
    if (umaChibiImages.length === 0) {
      console.warn("No peeking chibi images configured");
      return;
    }

    const img = document.getElementById('peeking-character');
    if (!img) return;

    const randomIndex = Math.floor(Math.random() * umaChibiImages.length);
    img.src = umaChibiImages[randomIndex];
    img.alt = `Peeking ${umaChibiImages[randomIndex].split('/').pop().replace(/_/g, ' ').replace('.webp', '')}`;
  } catch (error) {
    console.error("Failed to load peeking chibi images:", error);
  }
}

async function loadAndSetRandomDailyChibis() {
  try {
    const response = await fetch('chibi-list.json');
    const data = await response.json();
    const leftList = data.left || [];
    const rightList = data.peeking || [];

    if (leftList.length === 0 && rightList.length === 0) {
      console.warn("No chibi images configured for daily button");
      return;
    }

    const leftImg = document.getElementById('daily-chibi-left');
    const rightImg = document.getElementById('daily-chibi-right');
    if (!leftImg || !rightImg) return;

    // Pick random from left list (fallback to right list if left empty)
    const leftSource = leftList.length > 0 ? leftList : rightList;
    const leftIndex = Math.floor(Math.random() * leftSource.length);

    // Pick random from right list (fallback to left list if right empty)
    const rightSource = rightList.length > 0 ? rightList : leftList;
    const rightIndex = Math.floor(Math.random() * rightSource.length);

    leftImg.src = leftSource[leftIndex];
    leftImg.alt = `Daily ${leftSource[leftIndex].split('/').pop().replace(/_/g, ' ').replace('.webp', '')}`;

    rightImg.src = rightSource[rightIndex];
    rightImg.alt = `Daily ${rightSource[rightIndex].split('/').pop().replace(/_/g, ' ').replace('.webp', '')}`;
  } catch (error) {
    console.error("Failed to load daily chibi images:", error);
  }
}

// --- Running Chibi Easter Egg ---
// 10% chance on load: 5—10 random left-folder chibis sprint across the screen L—R
async function maybeRunChibis() {
  if (Math.random() > 0.10) return; // 10% chance

  try {
    const response = await fetch('chibi-list.json');
    const data = await response.json();
    const leftList = data.left || [];
    if (leftList.length === 0) return;

    // Pick 5—10 unique random images
    const count = Math.floor(Math.random() * 6) + 5; // 5..10
    const shuffled = [...leftList].sort(() => 0.5 - Math.random());
    const chosen = shuffled.slice(0, Math.min(count, shuffled.length));

    // Inject keyframes once
    if (!document.getElementById('chibi-run-style')) {
      const style = document.createElement('style');
      style.id = 'chibi-run-style';
      style.textContent = `
        @keyframes chibiRun {
          0%   { transform: translateX(0)      translateY(0px);   }
          10%  { transform: translateX(10vw)   translateY(-8px);  }
          20%  { transform: translateX(20vw)   translateY(0px);   }
          30%  { transform: translateX(30vw)   translateY(-8px);  }
          40%  { transform: translateX(40vw)   translateY(0px);   }
          50%  { transform: translateX(50vw)   translateY(-8px);  }
          60%  { transform: translateX(60vw)   translateY(0px);   }
          70%  { transform: translateX(70vw)   translateY(-8px);  }
          80%  { transform: translateX(80vw)   translateY(0px);   }
          90%  { transform: translateX(90vw)   translateY(-8px);  }
          100% { transform: translateX(110vw)  translateY(0px);   }
        }
        .chibi-runner {
          position: fixed;
          bottom: 0;
          left: -80px;
          width: 72px;
          height: auto;
          z-index: 9999;
          pointer-events: none;
          transform-origin: center bottom;
        }
      `;
      document.head.appendChild(style);
    }

    chosen.forEach((src, i) => {
      // Stagger start times so they don't all appear at once
      const startDelay = i * (300 + Math.random() * 400); // 300—700 ms between each
      // Each chibi gets a different speed: 3s—7s
      const duration = 3 + Math.random() * 4;
      // Slight vertical offset so they don't all run on the exact same baseline
      const bottomOffset = Math.floor(Math.random() * 24); // 0—24 px

      setTimeout(() => {
        const img = document.createElement('img');
        img.src = src;
        img.className = 'chibi-runner';
        img.style.bottom = `${bottomOffset}px`;
        img.style.animation = `chibiRun ${duration.toFixed(2)}s linear forwards`;
        document.body.appendChild(img);

        // Clean up after animation finishes
        img.addEventListener('animationend', () => img.remove());
      }, startDelay);
    });

  } catch (err) {
    console.warn('Running chibi easter egg failed:', err);
  }
}

// --- Goodman Easter Egg (Desktop & Mobile) ---
let goodmanBuffer = "";

function triggerGoodman() {
  if (typeof applyWallpaper === 'function') {
    applyWallpaper('images/goodman.jpg');
    console.log("Better call Saul!");
    goodmanBuffer = "";
  }
}

function checkGoodman(inputString) {
  goodmanBuffer += inputString.toLowerCase();
  if (goodmanBuffer.length > 7) goodmanBuffer = goodmanBuffer.slice(-7);
  if (goodmanBuffer === 'goodman') triggerGoodman();
}

// 1. Desktop: Listen to physical keys (outside input fields)
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  checkGoodman(e.key);
});

// 2. Any text input/textarea: watch for "goodman" typed anywhere
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') return;
  const val = el.value || '';
  if (val.length >= 7 && val.slice(-7).toLowerCase() === 'goodman') {
    triggerGoodman();
  }
});

// 3. Mobile tap sequence: tap the logo/title 7 times within 3 seconds
//    Works on any element with id="logo", id="game-title", or class "app-title" / "site-logo"
(function initGoodmanTapEgg() {
  let tapCount = 0;
  let tapTimer  = null;
  const TAP_TARGET = 7;
  const TAP_WINDOW = 3000; // ms

  function onTap() {
    tapCount++;
    clearTimeout(tapTimer);

    if (tapCount >= TAP_TARGET) {
      tapCount = 0;
      triggerGoodman();
      return;
    }

    // Reset counter if the player stops tapping for 3 s
    tapTimer = setTimeout(() => { tapCount = 0; }, TAP_WINDOW);
  }

  // Attach once the DOM is ready; try several likely selectors for the logo/header
  function attachTapListeners() {
    const selectors = [
      '#logo', '#game-title', '#app-title', '#header-logo',
      '.app-title', '.site-logo', '.game-logo', '.logo',
      'header h1', 'header h2', '.header h1'
    ];
    let attached = false;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        el.addEventListener('click',      onTap, { passive: true });
        el.addEventListener('touchstart', onTap, { passive: true });
        attached = true;
        // Don't break — attach to all matches so any logo area works
      }
    }
    if (!attached) {
      // Fallback: attach to <header> itself so mobile players always have a target
      const header = document.querySelector('header');
      if (header) {
        header.addEventListener('click',      onTap, { passive: true });
        header.addEventListener('touchstart', onTap, { passive: true });
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachTapListeners);
  } else {
    attachTapListeners();
  }
}());





// Kick everything off
loadGameData();