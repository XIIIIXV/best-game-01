// EMBERFALL's boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints
// what is there. The game moves between six screens: title, play, upgrade, paused, dawn
// (win) and game over.
//
// ?seed=N fixes the night's pattern. ?shot=start|play|win|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady for a
// screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BURN, EVENT_HIT, EVENT_NIGHT_CLEAR, EVENT_OVER, EVENT_PICKUP, EVENT_WIN } from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_PICK_1,
  ACTION_PICK_2,
  ACTION_PICK_3,
  ACTION_RESTART,
  createInput,
} from './input.js';
import {
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_UPGRADE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

/** A read-only peek at the run for local playtesting (never used by the game itself). */
window.__emberfallState = () => ({
  night: world.state.night,
  score: world.state.score,
  flames: world.state.flames,
  combo: world.state.combo,
  embers: world.state.embers,
  flareCd: +world.flareCd.toFixed(2),
  keeper: { x: Math.round(world.state.keeper.x), y: Math.round(world.state.keeper.y) },
  wisps: world.state.wisps.filter((w) => w.active).map((w) => ({ x: Math.round(w.x), y: Math.round(w.y), r: w.radius })),
  offer: world.state.offer.map((u) => u.id),
});

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, stats: world.stats(), muted: true });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let flareQueued = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    flareQueued = false;
    screen = SCREEN_PLAY;
    announce('Playing. Three flames. Survive ten nights until dawn.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.dawn();
      announce(`Dawn breaks. You survived all ten nights. Score ${world.state.score}. Best ${best}.`);
    } else {
      announce(`Game over on night ${world.state.night}. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function pickCard(index) {
    const offer = world.state.offer;
    if (index < 0 || index >= offer.length) return;
    if (!world.applyUpgrade(offer[index].id)) return;
    audio.click();
    screen = SCREEN_PLAY;
    announce(`Night ${world.state.night}. ${offer[index].name} chosen.`);
  }

  function cardAt(point) {
    const rects = renderer.upgradeCardRects();
    for (let i = 0; i < rects.length; i += 1) {
      const r = rects[i];
      if (point.x >= r.x && point.x <= r.x + r.w && point.y >= r.y && point.y <= r.y + r.h) return i;
    }
    return -1;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMuted();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        audio.click();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        flareQueued = true;
      } else if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_UPGRADE) {
      if (actions & ACTION_PICK_1) pickCard(0);
      else if (actions & ACTION_PICK_2) pickCard(1);
      else if (actions & ACTION_PICK_3) pickCard(2);
      else if (actions & ACTION_CONFIRM) {
        const at = cardAt(input.mouse());
        if (at >= 0) pickCard(at);
      }
      return;
    }
    if (screen === SCREEN_WIN || screen === SCREEN_OVER) {
      if (actions & (ACTION_RESTART | ACTION_CONFIRM)) {
        audio.unlock();
        audio.click();
        startGame();
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, true);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const doFlare = flareQueued;
    flareQueued = false;
    const events = world.step(STEP, input.vector(), doFlare, false);
    if (events & EVENT_BURN) audio.burn(world.state.combo);
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HIT) {
      audio.hit();
      announce(world.state.flames === 1 ? 'A flame goes out. One left.' : `A flame goes out. ${world.state.flames} left.`);
    }
    if (events & EVENT_NIGHT_CLEAR) {
      audio.nightClear();
      screen = SCREEN_UPGRADE;
      announce(`Night ${world.state.night - 1} cleared. Choose a blessing.`);
    } else if (events & EVENT_WIN) {
      endGame(true);
    } else if (events & EVENT_OVER) {
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { best, stats: world.stats(), muted: audio.muted });
  }

  // Leaving the tab pauses a running game rather than letting wisps close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberfall. Keep the last lantern lit. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
