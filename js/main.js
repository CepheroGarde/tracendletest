// ============================================================
//  main.js — Entry point: load data, initialise the app
// ============================================================

async function loadGameData() {
  try {
    const [umaRes, courseRes, voicedleRes] = await Promise.all([
      fetch('data.json'),
      fetch('courses.json'),
      fetch('voicedle.json')
    ]);
    UMAS    = await umaRes.json();
    COURSES = await courseRes.json();
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

function checkGoodman(inputString) {
  goodmanBuffer += inputString.toLowerCase();
  if (goodmanBuffer.length > 7) goodmanBuffer = goodmanBuffer.slice(-7);
  
  if (goodmanBuffer === 'goodman') {
    if (typeof applyWallpaper === 'function') {
      applyWallpaper('images/goodman.jpg');
      console.log("Better call Saul!");
      goodmanBuffer = ""; // Reset after trigger
    }
  }
}

// 1. Desktop: Listen to physical keys
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  checkGoodman(e.key);
});

// 2. Mobile/Inputs: Listen for input changes in the game's guess field
// Replace 'guess-input' with the actual ID of your game's text input field
const gameInput = document.getElementById('guess-input');

if (gameInput) {
  gameInput.addEventListener('input', (e) => {
    // Get the full current value of the input field
    const currentVal = gameInput.value;
    
    // Check if the input is long enough to contain our code
    if (currentVal.length >= 7) {
      // Get the last 7 characters of the current input
      const lastSeven = currentVal.slice(-7);
      
      // Manually trigger the logic if the buffer matches
      if (lastSeven.toLowerCase() === 'goodman') {
        if (typeof applyWallpaper === 'function') {
          applyWallpaper('images/goodman.jpg');
          console.log("Better call Saul!");
          // Optional: Clear the input after the trigger
          // gameInput.value = ""; 
        }
      }
    }
  });
}



// Kick everything off
loadGameData();