// All tunable game data lives here: settings, cast, personalities, sabotages, win rules.

export const SETTINGS = {
  moleCount: 2,
  tasksPerStaff: 6,
  walkSpeed: 5.0,
  runSpeed: 7.8,
  aiSpeed: 3.3,
  visionRange: 13,
  interactRange: 1.5,
  reportRange: 3.2,
  killRange: 1.8,
  killCooldown: 42,
  killCooldownStart: 40,
  sabotageCooldown: 48,
  sabotageCooldownStart: 30,
  stealDuration: 3.5,
  stealAmount: 9,
  stealCooldown: 26,
  stealAlertDelay: [5, 9],
  exfilWin: 100,
  cameraJamDuration: 30,
  cameraJamCooldown: 50,
  forgeCooldown: 40,
  badgeMissChance: 0.2,
  pagerCharges: 1,
  pagerLockout: 20,
  confirmEjects: true,
  meeting: { discussion: 30, voting: 25, results: 7 },
};

export const ROLES = {
  staff: { id: 'staff', name: 'Staff', blurb: 'Close your tickets. Find the two moles.' },
  mole: { id: 'mole', name: 'Mole', blurb: 'Blend in. Break production. Leak the data.' },
};

// suspicion thresholds and habits that drive AI behaviour
export const PERSONALITIES = {
  suspicious:   { name: 'Suspicious',   accuseAt: 14, voteAt: 18, observe: 0.4, follow: 0.1, pagerAt: 60, usesLogs: false, sway: 1.0, breakTime: 1.0 },
  logical:      { name: 'Logical',      accuseAt: 30, voteAt: 34, observe: 0.5, follow: 0.1, pagerAt: 85, usesLogs: true,  sway: 0.6, breakTime: 0.8 },
  passive:      { name: 'Passive',      accuseAt: 60, voteAt: 48, observe: 0.25, follow: 0.15, pagerAt: 999, usesLogs: false, sway: 1.0, breakTime: 1.4 },
  social:       { name: 'Social',       accuseAt: 34, voteAt: 26, observe: 0.3, follow: 0.6, pagerAt: 90, usesLogs: false, sway: 1.7, breakTime: 1.3 },
  aggressive:   { name: 'Aggressive',   accuseAt: 18, voteAt: 22, observe: 0.35, follow: 0.1, pagerAt: 38, usesLogs: false, sway: 1.0, breakTime: 0.7 },
  observant:    { name: 'Observant',    accuseAt: 26, voteAt: 28, observe: 0.85, follow: 0.2, pagerAt: 70, usesLogs: true,  sway: 0.7, breakTime: 1.0 },
  manipulative: { name: 'Manipulative', accuseAt: 16, voteAt: 24, observe: 0.4, follow: 0.3, pagerAt: 75, usesLogs: false, sway: 0.8, breakTime: 1.0 },
};

// look: skin, hair colour, hair style, accessory. shirt colour doubles as the identity colour.
export const CHARACTERS = [
  { id: 'maya',   name: 'Maya',   full: 'Maya Okafor',    job: 'Frontend Developer',  color: '#ff6b5e', personality: 'social',       look: { skin: '#8d5a3b', hair: '#1c1412', style: 'puffs',  acc: 'headphones' } },
  { id: 'dmitri', name: 'Dmitri', full: 'Dmitri Volkov',  job: 'Backend Developer',   color: '#3d6fe0', personality: 'logical',      look: { skin: '#f0c9a8', hair: '#c9b27a', style: 'short',  acc: 'glasses' } },
  { id: 'priya',  name: 'Priya',  full: 'Priya Raman',    job: 'Mobile Developer',    color: '#18b8a6', personality: 'observant',    look: { skin: '#c68e5f', hair: '#17110f', style: 'long',   acc: 'none' } },
  { id: 'leo',    name: 'Leo',    full: 'Leo Tanaka',     job: 'QA Engineer',         color: '#9bd13a', personality: 'suspicious',   look: { skin: '#f1d0ae', hair: '#101014', style: 'spiky',  acc: 'glasses' } },
  { id: 'sofia',  name: 'Sofia',  full: 'Sofia Marques',  job: 'DevOps Engineer',     color: '#ff9a2e', personality: 'aggressive',   look: { skin: '#dba87e', hair: '#5a2d1a', style: 'bun',    acc: 'none' } },
  { id: 'noah',   name: 'Noah',   full: 'Noah Bergström', job: 'UI/UX Designer',      color: '#a56bf0', personality: 'passive',      look: { skin: '#f6d9c0', hair: '#e8a33c', style: 'beanie', acc: 'none' } },
  { id: 'amara',  name: 'Amara',  full: 'Amara Diallo',   job: 'Product Manager',     color: '#ee4fa0', personality: 'manipulative', look: { skin: '#6f4329', hair: '#0f0c0b', style: 'bob',    acc: 'earrings' } },
  { id: 'omar',   name: 'Omar',   full: 'Omar Haddad',    job: 'Project Manager',     color: '#f2c230', personality: 'social',       look: { skin: '#cf9b6e', hair: '#1d1512', style: 'short',  acc: 'beard' } },
  { id: 'hana',   name: 'Hana',   full: 'Hana Kim',       job: 'Data Analyst',        color: '#5cc8ff', personality: 'logical',      look: { skin: '#f3d3b3', hair: '#2a1d3a', style: 'bob',    acc: 'headphones' } },
  { id: 'victor', name: 'Victor', full: 'Victor Reyes',   job: 'Engineering Manager', color: '#c7ccd6', personality: 'aggressive',   look: { skin: '#b97d55', hair: '#8a8f99', style: 'bald',   acc: 'tie' } },
];

// station = where staff repair it. critical ones end the game when the timer runs out.
export const SABOTAGES = {
  outage: {
    id: 'outage', name: 'Production Outage', verb: 'Take down production',
    alert: 'PRODUCTION IS DOWN', hint: 'Reboot the core cluster in the Server Room before the timer runs out',
    station: 'core', critical: true, timer: 55, minigame: 'sequence',
  },
  breach: {
    id: 'breach', name: 'Database Breach', verb: 'Breach the database',
    alert: 'DATABASE BREACH', hint: 'Restore a clean backup at the DB console in the Backend Pod',
    station: 'db1', critical: false, leakPerSec: 1.2, minigame: 'choice',
  },
  network: {
    id: 'network', name: 'Network Failure', verb: 'Kill the office network',
    alert: 'NETWORK DOWN', hint: 'Re-patch the core switch in IT Support. Cameras and logs are offline.',
    station: 'router', critical: false, blocksTerminals: true, minigame: 'match',
  },
};

// evaluated in order after every state change; first match ends the match
export const WIN_CONDITIONS = [
  { id: 'molesOut', side: 'staff', text: 'Both moles were walked out of the building.',
    test: g => g.living('mole').length === 0 },
  { id: 'tasks', side: 'staff', text: 'Every ticket shipped. The release went out clean.',
    test: g => g.taskTotal > 0 && g.taskDone >= g.taskTotal },
  { id: 'parity', side: 'mole', text: 'The moles now outnumber the people who could stop them.',
    test: g => g.living('mole').length >= g.living('staff').length },
  { id: 'exfil', side: 'mole', text: 'The whole customer database walked out the door.',
    test: g => g.exfil >= SETTINGS.exfilWin },
  { id: 'meltdown', side: 'mole', text: 'Production stayed down too long. The company folded.',
    test: g => g.sabotage && g.sabotage.def.critical && g.sabotage.timeLeft <= 0 },
];
