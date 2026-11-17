// EMBERFALL — every tuning number, colour and night in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. A night lasts NIGHT_SECONDS; survive all NIGHTS_MAX nights and dawn breaks.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** A night's length, and how many nights stand between the keeper and dawn. */
export const NIGHT = { seconds: 45, max: 10 };

export const KEEPER = {
  radius: 16,
  speed: 300,
  lightRadius: 170,
  flareRadius: 150,
  flareCooldown: 1.1,
  flareDamage: 1,
  magnetRadius: 110,
  invulnerable: 1.6,
  flames: 3,
  flamesMax: 5,
};

/** Wisp kinds: drifters are the common horde, darters are fast and small, gloomers are big and
 *  tough and eat embers, splitters break into two drifters when burned. */
export const WISP = {
  drifter: { radius: 14, speed: 62, hp: 1, points: 10, embers: 1, weight: 10 },
  darter: { radius: 10, speed: 150, hp: 1, points: 15, embers: 1, weight: 0 },
  gloomer: { radius: 26, speed: 38, hp: 3, points: 40, embers: 3, weight: 0 },
  splitter: { radius: 16, speed: 84, hp: 1, points: 20, embers: 1, weight: 0 },
};

/** Wisps inside the lantern's light are slowed: light pushes the dark back. */
export const LIGHT_SLOW = 0.72;

/** Spawn tuning per night: interval between spawns, speed scale, and which kinds may appear. */
export function nightTuning(night) {
  const n = Math.max(1, Math.min(NIGHT.max, night));
  return {
    interval: Math.max(0.26, 0.92 - 0.06 * (n - 1)),
    speedScale: 1 + 0.09 * (n - 1),
    darterWeight: n >= 2 ? 2 + (n - 2) : 0,
    gloomerWeight: n >= 3 ? 1 + Math.floor((n - 3) / 2) : 0,
    splitterWeight: n >= 4 ? 2 + (n - 4) : 0,
  };
}

/** Combo: burns chained inside COMBO_WINDOW seconds raise the multiplier, up to COMBO_MAX. */
export const COMBO = { window: 2.5, max: 8, step: 0.25 };

/** Upgrades offered between nights: pick one of three. Each has levels; `apply` names the
 *  keeper stat it raises so the upgrade screen can describe it in plain words. */
export const UPGRADES = [
  { id: 'wider-light', name: 'Wider Light', text: '+35 lantern light, +35 flare reach', max: 4, stat: 'lightRadius', per: 35 },
  { id: 'quick-flare', name: 'Quicker Flare', text: 'Flare recharges 18% faster', max: 4, stat: 'flareCooldown', per: -0.18 },
  { id: 'ember-magnet', name: 'Ember Magnet', text: '+70 ember pickup reach', max: 3, stat: 'magnetRadius', per: 70 },
  { id: 'extra-flame', name: 'Extra Flame', text: '+1 lantern flame (up to 5)', max: 2, stat: 'flamesMax', per: 1 },
  { id: 'bright-burn', name: 'Bright Burn', text: 'Flare hits 1 harder', max: 2, stat: 'flareDamage', per: 1 },
  { id: 'swift-boots', name: 'Swift Boots', text: 'Move 12% faster', max: 3, stat: 'speed', per: 0.12 },
];

/** Night-clear bonus: 100 per night survived, plus 25 per flame still lit. */
export const NIGHT_BONUS = { perNight: 100, perFlame: 25 };

/** Particle and pickup pools, allocated once at boot. */
export const POOL = { wisps: 96, embers: 128, particles: 256, texts: 32 };

export const PALETTE = {
  night: '#0b0e1a',
  farTrees: '#12172a',
  nearTrees: '#1a2140',
  ground: '#141a30',
  mist: '#232c52',
  keeper: '#f5e6c8',
  cloak: '#e8c98a',
  lantern: '#ffcf6e',
  flame: '#ffb347',
  ember: '#ffc94d',
  drifter: '#8b7ff0',
  darter: '#ff7ad9',
  gloomer: '#6f5ce0',
  splitter: '#7fe0c3',
  panel: '#171d33',
  panelEdge: '#2c3760',
  text: '#f5e6c8',
  muted: '#9aa3c0',
  danger: '#ff6b5e',
  gold: '#ffd76a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall.best';
