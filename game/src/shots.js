// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (flee the nearest wisp, flare when the dark closes in), so the frame is what a real game
// looks like and the same seed always gives the same frame. The win scene plays all ten
// nights with a strong autopilot and the best blessing each night; if it falls short it
// tries again on the next seed, and only then stages dawn from a constructed late-night
// state the world's own step function carries over the line.
import { FIELD, KEEPER, NIGHT, STEP } from './config.js';
import { EVENT_NIGHT_CLEAR, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 600;
const WIN_ATTEMPTS = 5;
const SAMPLE = STEP;

/** The keeper's blessings, best first, for the win scene's night-clear picks. */
const BLESSING_ORDER = ['bright-burn', 'wider-light', 'quick-flare', 'extra-flame', 'swift-boots', 'ember-magnet'];

/** Where the keeper wants to go: away from the nearest wisp, pulled gently to the centre. */
function fleeDirection(state) {
  const k = state.keeper;
  let nearest = null;
  let nearestD = Infinity;
  for (const w of state.wisps) {
    if (!w.active) continue;
    const d = Math.hypot(w.x - k.x, w.y - k.y);
    if (d < nearestD) {
      nearestD = d;
      nearest = w;
    }
  }
  let x = 0;
  let y = 0;
  if (nearest && nearestD < 320) {
    const d = nearestD || 1;
    x += ((k.x - nearest.x) / d) * 1.4;
    y += ((k.y - nearest.y) / d) * 1.4;
  }
  x += (FIELD.width / 2 - k.x) / 300;
  y += (FIELD.height / 2 - k.y) / 300;
  const len = Math.hypot(x, y);
  if (len < 0.01) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/** Flare when the dark is close enough to be worth burning. */
function wantFlare(state, stats, bold) {
  const k = state.keeper;
  if (k.flareTimer > 0) return false;
  let close = 0;
  let nearestD = Infinity;
  for (const w of state.wisps) {
    if (!w.active) continue;
    const d = Math.hypot(w.x - k.x, w.y - k.y);
    if (d < stats.flareRadius + w.radius) close += 1;
    if (d < nearestD) nearestD = d;
  }
  if (bold) return close >= 1 || nearestD < 90;
  return close >= 2 || nearestD < 55;
}

function pickBlessing(world) {
  const offer = world.state.offer;
  for (const id of BLESSING_ORDER) {
    if (offer.some((u) => u.id === id)) {
      world.applyUpgrade(id);
      return;
    }
  }
  if (offer.length > 0) world.applyUpgrade(offer[0].id);
}

/** Play forward with the autopilot until `seconds` pass, the night clears or the run ends.
 *  Returns the event that stopped it (EVENT_NONE when the time ran out). */
function playFor(world, seconds, bold) {
  const steps = Math.floor(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const state = world.state;
    const events = world.step(SAMPLE, fleeDirection(state), wantFlare(state, world.stats(), bold), false);
    if (events & EVENT_NIGHT_CLEAR) pickBlessing(world);
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
  }
  return 0;
}

/**
 * Set `world` to the named scene (start, play, win or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    const events = playFor(world, PLAY_SECONDS, true);
    const over = (events & EVENT_OVER) !== 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    // A real run first: the keeper plays well for a while and builds a score, then gets
    // hurried and careless — no flare, fleeing only when a wisp is nearly on it — until
    // the dark catches it. The game-over screen then shows a run that happened.
    playFor(world, 40, true);
    const steps = Math.floor(END_LIMIT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      const state = world.state;
      const move = (() => {
        let nearest = null;
        let nearestD = Infinity;
        for (const w of state.wisps) {
          if (!w.active) continue;
          const d = Math.hypot(w.x - state.keeper.x, w.y - state.keeper.y);
          if (d < nearestD) {
            nearestD = d;
            nearest = w;
          }
        }
        if (!nearest || nearestD > 90) return { x: 0, y: 0 };
        const d = nearestD || 1;
        return { x: (state.keeper.x - nearest.x) / d, y: (state.keeper.y - nearest.y) / d };
      })();
      const events = world.step(STEP, move, false, false);
      if (events & EVENT_NIGHT_CLEAR) pickBlessing(world);
      if (events & EVENT_OVER) break;
      if (events & EVENT_WIN) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  // win: ten nights with the strong autopilot. A few seeds are tried; the dark is patient.
  for (let attempt = 0; attempt < WIN_ATTEMPTS; attempt += 1) {
    world.reset();
    let won = false;
    let over = false;
    for (let n = 0; n < NIGHT.max && !won && !over; n += 1) {
      const events = playFor(world, NIGHT.seconds + 1, true);
      if (events & EVENT_WIN) won = true;
      else if (events & EVENT_OVER) over = true;
      else if (events & EVENT_NIGHT_CLEAR) pickBlessing(world);
    }
    if (won) return { screen: SCREEN_WIN, best: world.state.score };
  }
  // The autopilot fell short on every seed: stage dawn from a late tenth night and let
  // the world's own step carry it over the line.
  world.reset();
  world.state.night = NIGHT.max;
  world.state.nightTime = NIGHT.seconds - 1.2;
  world.state.score = 2840;
  world.state.burns = 132;
  world.state.embers = 148;
  world.state.flames = 3;
  world.state.keeper.x = FIELD.width / 2;
  world.state.keeper.y = FIELD.height / 2;
  const events = playFor(world, 2, true);
  void events;
  return { screen: SCREEN_WIN, best: world.state.score };
}
