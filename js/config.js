// ============================================================
//  config.js — Constants, game configuration, and shared state
// ============================================================

const SUPABASE_URL = 'https://arjlihlurgfjdrnrjefi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyamxpaGx1cmdmamRybnJqZWZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxODY2OTMsImV4cCI6MjA5NDc2MjY5M30.SJNQr8lL726tEaba83y6OaNxHZdt2lsdsDZGrXoYC48';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --------------- Data lists (populated by loadGameData) ---------------
let UMAS = [];
let COURSES = [];
let VOICEDLE = [];

// --------------- Rank map ---------------
const RANK_MAP = {
  'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1, 'F': 0, 'G': -1
};

const GRADES = ["G", "F", "E", "D", "C", "B", "A", "S"];
const POINTS_PER_TIER = 200;
const DIV_THRESHOLD = 100;

// --------------- Game configuration ---------------
const GAME_CONFIG = {
  uma: {
    keys: ['role1', 'role2', 'gender', 'difficulty', 'year'],
    headers: ['Role 1', 'Role 2', 'Gender', 'Difficulty', 'Year'],
    data: () => UMAS,
    placeholder: "Enter survivor name...",
    resultTitle: "Survivor",
    storageKey: 'idvle_wordle_stats',
    helpDesc: "Guess the Identity V survivor from their roles, gender, difficulty and release year!",
    shareTitle: "IDVLE WORDLE",
    sections: [
      { title: "Survivor Info", keys: ['role1', 'role2', 'gender', 'difficulty', 'year'], color: 'cyan' }
    ]
  },
  course: {
    keys: ['length', 'surface', 'turn', 'location', 'schedule'],
    headers: ['Length', 'Surface', 'Turn', 'Location', 'Schedule'],
    data: () => COURSES,
    placeholder: "Enter Hunter name...",
    resultTitle: "Winning Hunter",
    storageKey: 'course_wordle_stats',
    helpDesc: "Guess the Hunter based on its track features!",
    shareTitle: "IDVLE HUNTER",
    sections: [
      { title: "Hunter Info", keys: ['length', 'surface', 'turn', 'location', 'schedule'], color: 'green' }
    ]
  },
  voicedle: {
    keys: [],
    headers: [],
    data: () => VOICEDLE,
    placeholder: "Guess the survivor from the voice line...",
    resultTitle: "Winning Survivor",
    storageKey: 'voicedle_stats',
    helpDesc: "Guess the Identity V survivor from their voice line! Each wrong guess unlocks more audio.",
    shareTitle: "IDVLE VOICEDLE",
    sections: []
  }
};

// --------------- Active game type ---------------
let currentGameType = 'uma';

// --------------- Persistent player data ---------------
let allPersistentData = {
  uma: {
    dailyStreak: 0, easyStreak: 0, unlimitedStreak: 0, hardStreak: 0,
    lastPlayedDate: null,
    dailyGuesses: [], dailyStatus: 'playing',
    rankedGuesses: [], rankedStatus: 'playing', rankedTargetName: null,
    unlimitedSession: null, hardSession: null, easySession: null, lbSubmittedKey: null
  },
  course: {
    dailyStreak: 0, easyStreak: 0, unlimitedStreak: 0, hardStreak: 0,
    lastPlayedDate: null,
    dailyGuesses: [], dailyStatus: 'playing',
    rankedGuesses: [], rankedStatus: 'playing', rankedTargetName: null,
    unlimitedSession: null, hardSession: null, lbSubmittedKey: null
  },
  voicedle: {
    dailyStreak: 0, easyStreak: 0, unlimitedStreak: 0, hardStreak: 0,
    lastPlayedDate: null,
    dailyGuesses: [], dailyStatus: 'playing',
    rankedGuesses: [], rankedStatus: 'playing', rankedTargetName: null,
    unlimitedSession: null, hardSession: null, easySession: null, lbSubmittedKey: null
  }
};

// --------------- In-memory session state ---------------
let sessionState = {
  active: false,
  mode: null,
  target: null,
  guesses: [],
  clues: [],
  unlimitedScore: 0,
  isGameOver: false,
  knownStats: {},
  pendingStreakReset: false,
  streakAtLoss: 0,
  sessionKey: null,
  _leaderboardSynced: false
};

// --------------- Leaderboard UI state ---------------
let currentLbTab = 'uma';
let currentLbType = 'dailyStreak';
let activeLbCategory = 'normal';
let activeLbTimeWindow = 'weekly';

// --------------- Stats modal state ---------------
let currentStatsTab = 'uma';

// --------------- Versioning ---------------
const CURRENT_VERSION = '1.3.1';
