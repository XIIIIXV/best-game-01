// EMBERFALL's renderer: everything the player sees, painted on one canvas. The playfield is
// a fixed 1280x720 logical area scaled to the window, so the game looks the same on any
// desktop. Screens: title, play, upgrade, paused, dawn (win) and game over.
import { FIELD, NIGHT, NIGHT_BONUS, PALETTE, FONT } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const LOGICAL_W = FIELD.width;
const LOGICAL_H = FIELD.height;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const decor = createRandom(20261115);
  const stars = Array.from({ length: 110 }, () => ({
    x: decor.range(0, LOGICAL_W),
    y: decor.range(0, 430),
    r: decor.range(0.6, 1.8),
    tw: decor.range(0, Math.PI * 2),
  }));
  const farTrees = Array.from({ length: 26 }, (_, i) => ({
    x: i * 52 + decor.range(-14, 14),
    w: decor.range(34, 66),
    h: decor.range(120, 230),
  }));
  const nearTrees = Array.from({ length: 18 }, (_, i) => ({
    x: i * 76 + decor.range(-20, 20),
    w: decor.range(46, 84),
    h: decor.range(180, 320),
  }));
  const fireflies = Array.from({ length: 26 }, () => ({
    x: decor.range(0, LOGICAL_W),
    y: decor.range(80, 640),
    phase: decor.range(0, Math.PI * 2),
    speed: decor.range(0.3, 0.9),
  }));

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    scale = Math.min(canvas.width / LOGICAL_W, canvas.height / LOGICAL_H);
    offsetX = (canvas.width - LOGICAL_W * scale) / 2;
    offsetY = (canvas.height - LOGICAL_H * scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function begin() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.night;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
  }

  function drawSky(time) {
    const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    g.addColorStop(0, '#0a0d1c');
    g.addColorStop(0.55, '#0e1330');
    g.addColorStop(1, '#131a33');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    for (const s of stars) {
      const a = 0.35 + 0.4 * Math.abs(Math.sin(time * 0.7 + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#dfe6ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // A low moon, the night's other light.
    const moon = ctx.createRadialGradient(1120, 92, 6, 1120, 92, 60);
    moon.addColorStop(0, 'rgba(235, 240, 255, 0.9)');
    moon.addColorStop(0.25, 'rgba(200, 210, 245, 0.28)');
    moon.addColorStop(1, 'rgba(200, 210, 245, 0)');
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(1120, 92, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8edff';
    ctx.beginPath();
    ctx.arc(1120, 92, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTrees() {
    ctx.fillStyle = PALETTE.farTrees;
    for (const t of farTrees) {
      ctx.beginPath();
      ctx.moveTo(t.x - t.w / 2, 664);
      ctx.lineTo(t.x, 664 - t.h);
      ctx.lineTo(t.x + t.w / 2, 664);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.nearTrees;
    for (const t of nearTrees) {
      ctx.beginPath();
      ctx.moveTo(t.x - t.w / 2, 720);
      ctx.lineTo(t.x - t.w * 0.18, 720 - t.h * 0.72);
      ctx.lineTo(t.x, 720 - t.h);
      ctx.lineTo(t.x + t.w * 0.18, 720 - t.h * 0.72);
      ctx.lineTo(t.x + t.w / 2, 720);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 664, LOGICAL_W, 56);
  }

  function drawFireflies(time) {
    for (const f of fireflies) {
      const x = f.x + Math.sin(time * f.speed + f.phase) * 18;
      const y = f.y + Math.cos(time * f.speed * 0.8 + f.phase) * 10;
      const a = 0.25 + 0.35 * Math.abs(Math.sin(time * 1.4 + f.phase));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawEmbers(state) {
    for (const e of state.emberPool) {
      if (!e.active) continue;
      const pulse = 0.75 + 0.25 * Math.sin(state.time * 6 + e.x);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(Math.PI / 4);
      ctx.shadowColor = PALETTE.ember;
      ctx.shadowBlur = 12;
      ctx.fillStyle = PALETTE.ember;
      ctx.globalAlpha = pulse;
      ctx.fillRect(-4.5, -4.5, 9, 9);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawWisp(w, time) {
    const colors = { drifter: PALETTE.drifter, darter: PALETTE.darter, gloomer: PALETTE.gloomer, splitter: PALETTE.splitter };
    const color = colors[w.kind] || PALETTE.drifter;
    const bob = Math.sin(time * 2 + w.phase) * 3;
    ctx.save();
    ctx.translate(w.x, w.y + bob);
    ctx.shadowColor = color;
    ctx.shadowBlur = w.flash > 0 ? 26 : 16;
    ctx.fillStyle = w.flash > 0 ? '#ffffff' : color;
    // A ragged ghost: a round body with a wavy tail.
    ctx.beginPath();
    ctx.arc(0, -w.radius * 0.15, w.radius, Math.PI, 0);
    const waves = 3;
    for (let i = 0; i <= waves; i += 1) {
      const x = w.radius - (i * 2 * w.radius) / waves;
      const y = w.radius * 0.55 + (i % 2 === 0 ? 5 : -5);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    // Pale core and two eyes: the face the player reads at a glance.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(0, -w.radius * 0.2, w.radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.arc(-w.radius * 0.32, -w.radius * 0.28, w.radius * 0.13, 0, Math.PI * 2);
    ctx.arc(w.radius * 0.32, -w.radius * 0.28, w.radius * 0.13, 0, Math.PI * 2);
    ctx.fill();
    if (w.kind === 'gloomer') {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, w.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawKeeper(state, time) {
    const k = state.keeper;
    const blink = k.invuln > 0 && Math.floor(time * 12) % 2 === 0;
    ctx.save();
    ctx.translate(k.x, k.y);
    if (blink) ctx.globalAlpha = 0.45;
    // Cloak.
    ctx.fillStyle = PALETTE.cloak;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.quadraticCurveTo(13, -8, 12, 12);
    ctx.quadraticCurveTo(0, 18, -12, 12);
    ctx.quadraticCurveTo(-13, -8, 0, -20);
    ctx.fill();
    // Hood and face.
    ctx.fillStyle = '#3a2c18';
    ctx.beginPath();
    ctx.arc(0, -12, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.keeper;
    ctx.beginPath();
    ctx.arc(0, -11, 5.5, 0, Math.PI * 2);
    ctx.fill();
    // The lantern, swinging gently, the game's warm heart.
    const swing = Math.sin(time * 2.2) * 0.16;
    ctx.rotate(swing);
    ctx.strokeStyle = '#8a6a2f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(16, 8);
    ctx.stroke();
    ctx.shadowColor = PALETTE.flame;
    ctx.shadowBlur = 18;
    ctx.fillStyle = PALETTE.lantern;
    ctx.beginPath();
    ctx.arc(19, 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.arc(19, 10, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'ring') {
        ctx.globalAlpha = a * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - a * 0.55) + 12, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === 'ash') {
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts(state) {
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      if (!t.active) continue;
      ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
      ctx.font = `700 ${t.size}px ${FONT}`;
      ctx.fillStyle = t.color;
      // Never let a floating score clip off the top edge.
      ctx.fillText(t.text, t.x, Math.max(20, t.y));
    }
    ctx.globalAlpha = 1;
  }

  /** The darkness, cut by the lantern's warm light: the game's signature look. */
  function drawDarkness(state, stats) {
    const k = state.keeper;
    const r = stats.lightRadius;
    const g = ctx.createRadialGradient(k.x, k.y, r * 0.15, k.x, k.y, r * 2.1);
    g.addColorStop(0, 'rgba(5, 8, 20, 0)');
    g.addColorStop(0.32, 'rgba(5, 8, 20, 0.28)');
    g.addColorStop(1, 'rgba(5, 8, 20, 0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    const glow = ctx.createRadialGradient(k.x, k.y, 4, k.x, k.y, r);
    glow.addColorStop(0, 'rgba(255, 190, 90, 0.20)');
    glow.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(k.x - r, k.y - r, r * 2, r * 2);
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 214, 130, ${state.flash * 0.16})`;
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    }
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
  }

  function drawFlames(flames, maxFlames, x, y) {
    for (let i = 0; i < maxFlames; i += 1) {
      const cx = x + i * 30;
      const lit = i < flames;
      ctx.save();
      ctx.translate(cx, y);
      ctx.shadowColor = lit ? PALETTE.flame : 'transparent';
      ctx.shadowBlur = lit ? 10 : 0;
      ctx.fillStyle = lit ? PALETTE.flame : '#3a4266';
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.quadraticCurveTo(8, -2, 6, 5);
      ctx.quadraticCurveTo(0, 10, -6, 5);
      ctx.quadraticCurveTo(-8, -2, 0, -11);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawHud(state, stats, best, muted) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.font = `800 34px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`SCORE ${state.score}`, 28, 48);
    ctx.font = `600 16px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 28, 72);
    if (state.combo >= 2) {
      ctx.font = `800 22px ${FONT}`;
      ctx.fillStyle = '#ff9d5c';
      ctx.fillText(`COMBO x${Math.min(state.combo, 8)}`, 28, 102);
    }
    // Night, top centre, with the night's progress.
    ctx.textAlign = 'center';
    ctx.font = `800 22px ${FONT}`;
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`NIGHT ${state.night} / 10`, LOGICAL_W / 2, 40);
    ctx.fillStyle = '#2c3760';
    ctx.fillRect(LOGICAL_W / 2 - 110, 52, 220, 8);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillRect(LOGICAL_W / 2 - 110, 52, 220 * (state.nightTime / NIGHT.seconds), 8);
    // Flames and embers, top right.
    drawFlames(state.flames, stats.flamesMax, LOGICAL_W - 28 - (stats.flamesMax - 1) * 30, 40);
    ctx.textAlign = 'right';
    ctx.font = `700 20px ${FONT}`;
    ctx.fillStyle = PALETTE.ember;
    ctx.fillText(`◆ ${state.embers}`, LOGICAL_W - 28, 74);
    // Flare cooldown, bottom centre.
    const frac = 1 - state.keeper.flareTimer / stats.flareCooldown;
    ctx.textAlign = 'center';
    ctx.font = `600 14px ${FONT}`;
    ctx.fillStyle = frac >= 1 ? PALETTE.lantern : PALETTE.muted;
    ctx.fillText(frac >= 1 ? 'FLARE READY — SPACE / CLICK' : 'FLARE CHARGING…', LOGICAL_W / 2, LOGICAL_H - 34);
    ctx.fillStyle = '#2c3760';
    ctx.fillRect(LOGICAL_W / 2 - 90, LOGICAL_H - 26, 180, 6);
    ctx.fillStyle = PALETTE.lantern;
    ctx.fillRect(LOGICAL_W / 2 - 90, LOGICAL_H - 26, 180 * Math.min(1, frac), 6);
    // Mute hint, bottom left.
    ctx.textAlign = 'left';
    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(muted ? 'M — SOUND OFF' : 'M — SOUND ON · P — PAUSE', 28, LOGICAL_H - 30);
  }

  function titleText(text, y, size, color, weight = 800) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.fillText(text, LOGICAL_W / 2, y);
  }

  function drawTitle(state, best) {
    ctx.save();
    ctx.textAlign = 'center';
    // A big lantern glow behind the title.
    const g = ctx.createRadialGradient(640, 300, 10, 640, 300, 330);
    g.addColorStop(0, 'rgba(255, 190, 90, 0.28)');
    g.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(240, 0, 800, 620);
    ctx.shadowColor = PALETTE.flame;
    ctx.shadowBlur = 34;
    titleText('EMBERFALL', 268, 92, PALETTE.lantern);
    ctx.shadowBlur = 0;
    titleText('Keep the last lantern lit.', 316, 26, PALETTE.text, 600);
    titleText('Wisps come for your light. Burn them with flares, gather their', 380, 20, PALETTE.muted, 500);
    titleText('embers, and survive all 10 nights until dawn.', 408, 20, PALETTE.muted, 500);
    titleText('MOVE — WASD / ARROWS      FLARE — SPACE / CLICK', 470, 20, PALETTE.text, 700);
    titleText('M — SOUND    P — PAUSE', 500, 16, PALETTE.muted, 600);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    titleText('▶  PRESS SPACE OR CLICK TO BEGIN', 566, 24, '#ffd76a');
    ctx.globalAlpha = 1;
    if (best > 0) titleText(`BEST SCORE ${best}`, 610, 18, PALETTE.muted, 600);
    ctx.restore();
  }

  /** The upgrade cards' rectangles, in playfield coordinates, for click detection. */
  function upgradeCardRects() {
    const cardW = 300;
    const cardH = 190;
    const gap = 36;
    const totalW = cardW * 3 + gap * 2;
    const startX = (LOGICAL_W - totalW) / 2;
    const y = 260;
    return [0, 1, 2].map((i) => ({ x: startX + i * (cardW + gap), y, w: cardW, h: cardH }));
  }

  function drawUpgrade(state) {
    const offer = state.offer;
    ctx.fillStyle = 'rgba(5, 8, 20, 0.55)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    titleText(`NIGHT ${state.night - 1} CLEARED`, 130, 44, PALETTE.gold);
    titleText(`Bonus +${NIGHT_BONUS.perNight * (state.night - 1) + NIGHT_BONUS.perFlame * state.flames}  ·  Score ${state.score}`, 168, 20, PALETTE.text, 600);
    titleText('Choose one blessing for the night ahead:', 210, 22, PALETTE.muted, 600);
    const rects = upgradeCardRects();
    offer.forEach((u, i) => {
      const { x, y, w: cardW } = rects[i];
      panel(x, y, cardW, 190);
      const level = state.upgrades[u.id] || 0;
      ctx.textAlign = 'center';
      ctx.font = `800 24px ${FONT}`;
      ctx.fillStyle = PALETTE.lantern;
      ctx.fillText(u.name, x + cardW / 2, y + 52);
      ctx.font = `600 17px ${FONT}`;
      ctx.fillStyle = PALETTE.text;
      ctx.fillText(u.text, x + cardW / 2, y + 92);
      ctx.font = `600 15px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(level > 0 ? `Owned: level ${level} of ${u.max}` : `New blessing`, x + cardW / 2, y + 122);
      ctx.font = `800 18px ${FONT}`;
      ctx.fillStyle = '#ffd76a';
      ctx.fillText(`[ ${i + 1} ]  or click`, x + cardW / 2, y + 158);
    });
    titleText('The dark grows colder each night. Choose well.', 520, 18, PALETTE.muted, 600);
  }

  function drawWin(state, best) {
    const g = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
    g.addColorStop(0, 'rgba(255, 170, 80, 0.34)');
    g.addColorStop(0.5, 'rgba(255, 200, 120, 0.12)');
    g.addColorStop(1, 'rgba(5, 8, 20, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 30;
    titleText('DAWN BREAKS', 210, 76, '#ffd76a');
    ctx.shadowBlur = 0;
    titleText('Ten nights survived. The lantern never went out.', 268, 24, PALETTE.text, 600);
    titleText(`FINAL SCORE  ${state.score}`, 350, 34, PALETTE.text);
    titleText(`BEST  ${Math.max(best, state.score)}    ·    WISPS BURNED  ${state.burns}    ·    EMBERS  ${state.embers}`, 398, 20, PALETTE.muted, 600);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    titleText('▶  PRESS R OR CLICK TO PLAY AGAIN', 480, 24, '#ffd76a');
    ctx.globalAlpha = 1;
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(5, 8, 20, 0.5)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    titleText('THE LIGHT GOES OUT', 220, 64, '#ff6b5e');
    titleText(`The wisps take the grove on night ${state.night}.`, 278, 24, PALETTE.text, 600);
    titleText(`SCORE  ${state.score}`, 352, 34, PALETTE.text);
    titleText(`BEST  ${Math.max(best, state.score)}    ·    WISPS BURNED  ${state.burns}    ·    EMBERS  ${state.embers}`, 400, 20, PALETTE.muted, 600);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    titleText('▶  PRESS R OR CLICK TO TRY AGAIN', 480, 24, '#ffd76a');
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(5, 8, 20, 0.6)';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
    titleText('PAUSED', 320, 56, PALETTE.text);
    titleText('Press P or click to keep playing.', 380, 20, PALETTE.muted, 600);
  }

  /** Paint one frame. `ui` carries the best score, the keeper's stats and the mute flag. */
  function draw(state, screen, ui) {
    begin();
    ctx.save();
    if (state.shakeX !== 0 || state.shakeY !== 0) ctx.translate(state.shakeX, state.shakeY);
    drawSky(state.time);
    drawTrees();
    drawFireflies(state.time);
    if (screen === SCREEN_TITLE) {
      for (const w of state.wisps) if (w.active) drawWisp(w, state.time);
      drawKeeper(state, state.time);
      drawParticles(state);
      drawDarkness(state, ui.stats);
      drawTitle(state, ui.best);
      ctx.restore();
      return;
    }
    drawEmbers(state);
    for (const w of state.wisps) if (w.active) drawWisp(w, state.time);
    drawKeeper(state, state.time);
    drawParticles(state);
    drawTexts(state);
    drawDarkness(state, ui.stats);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, ui.stats, ui.best, ui.muted);
    if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_WIN) drawWin(state, ui.best);
    else if (screen === SCREEN_OVER) drawOver(state, ui.best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    ctx.restore();
  }

  return { draw, resize, upgradeCardRects };
}
