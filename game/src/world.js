// EMBERFALL's world: the keeper, the wisps, the embers, the particles and the nights. The
// loop advances it in fixed steps; every random choice comes from the seeded generator the
// world was built with, so a staged screenshot scene always plays out the same way.
import {
  COMBO,
  FIELD,
  KEEPER,
  LIGHT_SLOW,
  NIGHT,
  NIGHT_BONUS,
  POOL,
  UPGRADES,
  WISP,
  nightTuning,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_HIT = 1;
export const EVENT_BURN = 2;
export const EVENT_PICKUP = 4;
export const EVENT_NIGHT_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;

const TWO_PI = Math.PI * 2;

function makeWisp() {
  return { active: false, kind: 'drifter', x: 0, y: 0, vx: 0, vy: 0, hp: 1, radius: 14, speed: 60, wobble: 0, phase: 0, flash: 0 };
}
function makeEmber() {
  return { active: false, x: 0, y: 0, vx: 0, vy: 0, value: 1 };
}
function makeParticle() {
  return { active: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffc94d' };
}
function makeText() {
  return { active: false, x: 0, y: 0, life: 0, maxLife: 1, text: '', color: '#f5e6c8', size: 16 };
}

export function createWorld(random) {
  const state = {
    time: 0,
    night: 1,
    nightTime: 0,
    score: 0,
    best: 0,
    combo: 0,
    comboTimer: 0,
    flames: KEEPER.flames,
    embers: 0,
    burns: 0,
    keeper: { x: FIELD.width / 2, y: FIELD.height / 2, invuln: 0, flareTimer: 0 },
    upgrades: {},
    wisps: Array.from({ length: POOL.wisps }, makeWisp),
    emberPool: Array.from({ length: POOL.embers }, makeEmber),
    particles: Array.from({ length: POOL.particles }, makeParticle),
    texts: Array.from({ length: POOL.texts }, makeText),
    spawnTimer: 1.2,
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    flash: 0,
    ashTimer: 0,
    offer: [],
  };

  function stats() {
    const levels = state.upgrades;
    const light = (levels['wider-light'] || 0) * 35;
    const quick = (levels['quick-flare'] || 0) * 0.18;
    const magnet = (levels['ember-magnet'] || 0) * 70;
    const speed = (levels['swift-boots'] || 0) * 0.12;
    return {
      speed: KEEPER.speed * (1 + speed),
      lightRadius: KEEPER.lightRadius + light,
      flareRadius: KEEPER.flareRadius + light,
      flareCooldown: KEEPER.flareCooldown * (1 - quick),
      flareDamage: KEEPER.flareDamage + (levels['bright-burn'] || 0),
      magnetRadius: KEEPER.magnetRadius + magnet,
      flamesMax: KEEPER.flamesMax + (levels['extra-flame'] || 0),
    };
  }

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function spawnParticle(kind, x, y, vx, vy, life, size, color) {
    const p = free(state.particles);
    if (!p) return;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.angle();
      const s = random.range(speed * 0.3, speed);
      spawnParticle('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, random.range(0.3, 0.7), random.range(2, 4.5), color);
    }
  }

  function floatText(x, y, text, color, size = 16) {
    const t = free(state.texts);
    if (!t) return;
    t.active = true;
    t.x = x;
    t.y = y;
    t.life = 1;
    t.maxLife = 1;
    t.text = text;
    t.color = color;
    t.size = size;
  }

  function flareRing(x, y, radius) {
    spawnParticle('ring', x, y, 0, 0, 0.45, radius, '#ffcf6e');
  }

  function edgePoint() {
    const side = random.int(0, 3);
    const margin = 40;
    if (side === 0) return { x: random.range(0, FIELD.width), y: -margin };
    if (side === 1) return { x: FIELD.width + margin, y: random.range(0, FIELD.height) };
    if (side === 2) return { x: random.range(0, FIELD.width), y: FIELD.height + margin };
    return { x: -margin, y: random.range(0, FIELD.height) };
  }

  function pickKind(tuning) {
    const total = WISP.drifter.weight + tuning.darterWeight + tuning.gloomerWeight + tuning.splitterWeight;
    let roll = random.range(0, total);
    if ((roll -= WISP.drifter.weight) < 0) return 'drifter';
    if ((roll -= tuning.darterWeight) < 0) return 'darter';
    if ((roll -= tuning.gloomerWeight) < 0) return 'gloomer';
    return 'splitter';
  }

  function spawnWisp(kind) {
    const w = free(state.wisps);
    if (!w) return;
    const def = WISP[kind];
    const tuning = nightTuning(state.night);
    const at = edgePoint();
    w.active = true;
    w.kind = kind;
    w.x = at.x;
    w.y = at.y;
    w.hp = def.hp;
    w.radius = def.radius;
    w.speed = def.speed * tuning.speedScale * random.range(0.9, 1.1);
    w.wobble = kind === 'darter' ? random.range(2.2, 3.4) : random.range(0.4, 1.1);
    w.phase = random.angle();
    w.flash = 0;
    w.vx = 0;
    w.vy = 0;
  }

  function dropEmber(x, y, value) {
    for (let i = 0; i < value; i += 1) {
      const e = free(state.emberPool);
      if (!e) return;
      const a = random.angle();
      e.active = true;
      e.x = x;
      e.y = y;
      e.vx = Math.cos(a) * random.range(20, 70);
      e.vy = Math.sin(a) * random.range(20, 70);
      e.value = 1;
    }
  }

  function burnWisp(w) {
    const def = WISP[w.kind];
    state.combo += 1;
    state.comboTimer = COMBO.window;
    const mult = 1 + Math.min(state.combo, COMBO.max) * COMBO.step;
    const points = Math.round(def.points * mult);
    state.score += points;
    state.burns += 1;
    burst(w.x, w.y, '#ffc94d', w.kind === 'gloomer' ? 22 : 12, 180);
    burst(w.x, w.y, '#8b7ff0', 8, 120);
    floatText(w.x, w.y - w.radius - 6, `+${points}`, '#ffd76a', 17);
    if (state.combo >= 3) floatText(w.x, w.y + w.radius + 14, `COMBO x${Math.min(state.combo, COMBO.max)}`, '#ff9d5c', 14);
    dropEmber(w.x, w.y, def.embers);
    if (w.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        const child = free(state.wisps);
        if (!child) break;
        const a = random.angle();
        child.active = true;
        child.kind = 'drifter';
        child.x = w.x + Math.cos(a) * 24;
        child.y = w.y + Math.sin(a) * 24;
        child.hp = 1;
        child.radius = WISP.drifter.radius;
        child.speed = WISP.drifter.speed * nightTuning(state.night).speedScale;
        child.wobble = random.range(0.4, 1.1);
        child.phase = random.angle();
        child.flash = 0;
      }
    }
    w.active = false;
  }

  /** The flare: a burst of lantern light that burns every wisp inside its reach. */
  function flare() {
    const s = stats();
    const k = state.keeper;
    if (k.flareTimer > 0) return EVENT_NONE;
    k.flareTimer = s.flareCooldown;
    state.flash = 1;
    state.shake = Math.max(state.shake, 5);
    flareRing(k.x, k.y, s.flareRadius);
    let burned = 0;
    // Snapshot the targets first: burning a splitter wakes two drifters, and they must
    // not be caught by the same flare that killed their parent.
    const targets = state.wisps.filter((w) => w.active);
    for (const w of targets) {
      if (!w.active) continue;
      const d = Math.hypot(w.x - k.x, w.y - k.y);
      if (d > s.flareRadius + w.radius) continue;
      w.hp -= s.flareDamage;
      w.flash = 0.18;
      if (w.hp <= 0) {
        burnWisp(w);
        burned += 1;
      } else {
        const a = Math.atan2(w.y - k.y, w.x - k.x);
        w.x += Math.cos(a) * 26;
        w.y += Math.sin(a) * 26;
      }
    }
    return burned > 0 ? EVENT_BURN : EVENT_NONE;
  }

  function hitKeeper(w) {
    const k = state.keeper;
    state.flames -= 1;
    k.invuln = KEEPER.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = 14;
    state.flash = 0.6;
    burst(k.x, k.y, '#ff6b5e', 18, 220);
    floatText(k.x, k.y - 44, 'A FLAME GOES OUT', '#ff6b5e', 18);
    w.active = false;
    return state.flames <= 0 ? EVENT_OVER : EVENT_HIT;
  }

  function stepParticles(dt) {
    for (const p of state.particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'spark') {
        p.vx *= 1 - 2.4 * dt;
        p.vy *= 1 - 2.4 * dt;
      }
    }
    for (const t of state.texts) {
      if (!t.active) continue;
      t.life -= dt * 0.9;
      t.y -= 26 * dt;
      if (t.life <= 0) t.active = false;
    }
  }

  function stepAsh(dt) {
    state.ashTimer -= dt;
    if (state.ashTimer <= 0) {
      state.ashTimer = 0.4;
      spawnParticle('ash', random.range(0, FIELD.width), -6, random.range(-8, 8), random.range(14, 30), random.range(4, 8), random.range(1.5, 3), '#5a6390');
    }
  }

  function reset() {
    state.time = 0;
    state.night = 1;
    state.nightTime = 0;
    state.score = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.flames = KEEPER.flames;
    state.embers = 0;
    state.burns = 0;
    state.keeper.x = FIELD.width / 2;
    state.keeper.y = FIELD.height / 2;
    state.keeper.invuln = 0;
    state.keeper.flareTimer = 0;
    state.upgrades = {};
    state.spawnTimer = 1.2;
    state.shake = 0;
    state.flash = 0;
    state.ashTimer = 0;
    state.offer = [];
    for (const w of state.wisps) w.active = false;
    for (const e of state.emberPool) e.active = false;
    for (const p of state.particles) p.active = false;
    for (const t of state.texts) t.active = false;
  }

  /** Three distinct upgrades the keeper has not maxed out, for the night-clear screen. */
  function offerUpgrades() {
    const available = UPGRADES.filter((u) => (state.upgrades[u.id] || 0) < u.max);
    const pool = available.length > 0 ? available : UPGRADES.slice(0, 3);
    const picked = [];
    const bag = [...pool];
    while (picked.length < 3 && bag.length > 0) {
      picked.push(bag.splice(random.int(0, bag.length - 1), 1)[0]);
    }
    state.offer = picked;
    return picked;
  }

  function applyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return false;
    if ((state.upgrades[id] || 0) >= def.max) return false;
    state.upgrades[id] = (state.upgrades[id] || 0) + 1;
    if (id === 'extra-flame') state.flames = Math.min(stats().flamesMax, state.flames + 1);
    return true;
  }

  /**
   * Advance the world one fixed step. `move` is a normalized {x, y} vector, `doFlare` fires
   * the lantern's flare, `attract` runs the title-screen drift (no danger, no score).
   */
  function step(dt, move, doFlare, attract) {
    state.time += dt;
    let events = EVENT_NONE;
    const k = state.keeper;
    const s = stats();

    stepAsh(dt);
    stepParticles(dt);
    state.flash = Math.max(0, state.flash - dt * 2.2);
    state.shake = Math.max(0, state.shake - dt * 26);
    if (state.shake > 0) {
      state.shakeX = random.range(-state.shake, state.shake);
      state.shakeY = random.range(-state.shake, state.shake);
    } else {
      state.shakeX = 0;
      state.shakeY = 0;
    }

    if (attract) {
      // The title screen: wisps drift through the dark, the keeper waits below the
      // title where the screen can show them.
      state.keeper.x += (FIELD.width / 2 - state.keeper.x) * 0.02;
      state.keeper.y += (615 - state.keeper.y) * 0.02;
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = 1.6;
        spawnWisp('drifter');
      }
      for (const w of state.wisps) {
        if (!w.active) continue;
        w.phase += dt * w.wobble;
        w.x += Math.sin(w.phase) * 12 * dt;
        w.y += 26 * dt;
        if (w.y > FIELD.height + 50) w.active = false;
      }
      return EVENT_NONE;
    }

    // The keeper moves.
    k.x = Math.min(FIELD.width - KEEPER.radius, Math.max(KEEPER.radius, k.x + move.x * s.speed * dt));
    k.y = Math.min(FIELD.height - KEEPER.radius, Math.max(KEEPER.radius, k.y + move.y * s.speed * dt));
    k.invuln = Math.max(0, k.invuln - dt);
    k.flareTimer = Math.max(0, k.flareTimer - dt);
    if (doFlare) events |= flare();

    // Combo decays.
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // Spawn the night's wisps.
    const tuning = nightTuning(state.night);
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = tuning.interval * random.range(0.8, 1.25);
      spawnWisp(pickKind(tuning));
    }

    // Move the wisps toward the lantern; the light slows them.
    for (const w of state.wisps) {
      if (!w.active) continue;
      w.flash = Math.max(0, w.flash - dt);
      w.phase += dt * w.wobble;
      const dx = k.x - w.x;
      const dy = k.y - w.y;
      const d = Math.hypot(dx, dy) || 1;
      const inLight = d < s.lightRadius;
      const speed = w.speed * (inLight ? LIGHT_SLOW : 1);
      const wobbleX = w.kind === 'darter' ? Math.cos(w.phase) * 46 : Math.sin(w.phase) * 14;
      w.x += (dx / d) * speed * dt + wobbleX * dt;
      w.y += (dy / d) * speed * dt;
      if (k.invuln <= 0 && d < KEEPER.radius + w.radius - 4) {
        events |= hitKeeper(w);
      }
    }

    // Embers drift, then home in on the keeper inside the magnet's reach.
    for (const e of state.emberPool) {
      if (!e.active) continue;
      const dx = k.x - e.x;
      const dy = k.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < s.magnetRadius) {
        e.vx += (dx / d) * 520 * dt;
        e.vy += (dy / d) * 520 * dt;
      } else {
        e.vx *= 1 - 1.6 * dt;
        e.vy *= 1 - 1.6 * dt;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      if (d < KEEPER.radius + 12) {
        e.active = false;
        state.embers += e.value;
        state.score += 2;
        spawnParticle('spark', e.x, e.y, 0, -30, 0.3, 3, '#ffc94d');
        events |= EVENT_PICKUP;
      }
    }

    // The night ends: dawn on the tenth, an upgrade choice on the others.
    state.nightTime += dt;
    if (state.nightTime >= NIGHT.seconds) {
      state.nightTime = 0;
      const bonus = NIGHT_BONUS.perNight * state.night + NIGHT_BONUS.perFlame * state.flames;
      state.score += bonus;
      if (state.night >= NIGHT.max) {
        state.score += 500;
        return events | EVENT_WIN;
      }
      state.night += 1;
      offerUpgrades();
      return events | EVENT_NIGHT_CLEAR;
    }
    return events;
  }

  return { state, stats, reset, step, flare, offerUpgrades, applyUpgrade, get flareCd() { return state.keeper.flareTimer; } };
}
