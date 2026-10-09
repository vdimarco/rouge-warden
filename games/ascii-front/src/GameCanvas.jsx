import React, { useEffect, useRef } from 'react';
import { updateGame, togglePause, WIDTH, HEIGHT, TILE } from './engine.js';
import { renderGame } from './renderer.js';
import { paintTile } from './maps.js';
import { createAudio } from './audio.js';

export default function GameCanvas({ gameRef, inputRef, sound, onUpdate, onCommand }) {
  const canvasRef = useRef(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const keyMap = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'fire', ShiftLeft: 'dash', ShiftRight: 'dash' };
    const p2KeyMap = { KeyI: 'up', KeyK: 'down', KeyJ: 'left', KeyL: 'right', KeyU: 'fire', KeyO: 'dash' };
    const audio = createAudio();
    let frame, previous = performance.now(), lastHud = 0, accumulator = 0, pointerFire = false, pointerPulse = false, painting = null, lastTile;
    const health = game => (game.players || [game.player]).reduce((total, player) => total + player.hp, 0);
    let lastGame = gameRef.current, lastShots = 0, lastKills = 0, lastEmp = 0, lastHp = health(lastGame);
    const keys = {}, pulses = {};
    function resize() {
      const scale = Math.min(2, Math.max(1, canvas.clientWidth / WIDTH * (devicePixelRatio || 1)));
      const width = Math.round(WIDTH * scale), height = Math.round(HEIGHT * scale);
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      ctx.setTransform(width / WIDTH, 0, 0, height / HEIGHT, 0, 0);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    const unlock = event => { if (event.isTrusted) audio.unlock(); };
    function keyDown(event) {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.target.closest?.('dialog') || window.GameSwitch?.isOpen) return;
      const command = { Enter: 'start', Escape: 'pause', KeyR: 'restart', KeyE: 'emp' }[event.code];
      const key = keyMap[event.code] || p2KeyMap[event.code];
      if (!key && !command) return;
      if (event.target.closest?.('button') && ['Enter', 'Space'].includes(event.code)) return;
      event.preventDefault();
      if (command && !event.repeat) onCommand(command);
      if (key) { keys[event.code] = true; pulses[event.code] = true; }
    }
    function keyUp(event) { delete keys[event.code]; }
    function aim(event) {
      if (gameRef.current.status === 'editor') {
        if (painting === event.pointerId) paint(event);
        return;
      }
      if (event.pointerType === 'touch') return;
      const bounds = canvas.getBoundingClientRect();
      inputRef.current.aimX = (event.clientX - bounds.left) / bounds.width * WIDTH;
      inputRef.current.aimY = (event.clientY - bounds.top) / bounds.height * HEIGHT;
    }
    function paint(event) {
      const bounds = canvas.getBoundingClientRect();
      const col = Math.floor((event.clientX - bounds.left) / bounds.width * WIDTH / TILE);
      const row = Math.floor((event.clientY - bounds.top) / bounds.height * HEIGHT / TILE);
      const from = lastTile || { col, row };
      const steps = Math.max(1, Math.abs(col - from.col), Math.abs(row - from.row));
      let changed = false;
      for (let i = 1; i <= steps; i++) {
        changed = paintTile(gameRef.current, Math.round(from.col + (col - from.col) * i / steps), Math.round(from.row + (row - from.row) * i / steps)) || changed;
      }
      lastTile = { col, row };
      if (changed) onUpdate();
    }
    function pointerDown(event) {
      if (gameRef.current.status === 'editor') {
        if (event.button !== 0 || painting !== null) return;
        event.preventDefault();
        canvas.focus({ preventScroll: true });
        canvas.setPointerCapture(event.pointerId);
        painting = event.pointerId;
        lastTile = undefined;
        paint(event);
        return;
      }
      if (event.pointerType === 'touch' || event.button !== 0 || gameRef.current.status !== 'playing') return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      aim(event);
      pointerFire = true;
      pointerPulse = true;
    }
    function pointerUp(event) {
      pointerFire = false;
      if (painting === event.pointerId) { painting = null; lastTile = undefined; }
      const bounds = canvas.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) pointerLeave();
    }
    function pointerLeave() { if (!pointerFire && !pointerPulse) { delete inputRef.current.aimX; delete inputRef.current.aimY; } }
    function loseFocus() {
      inputRef.current = {};
      pointerFire = false;
      pointerPulse = false;
      painting = null;
      lastTile = undefined;
      for (const key in keys) delete keys[key];
      for (const key in pulses) delete pulses[key];
      accumulator = 0;
      audio.suspend();
      if (gameRef.current.status === 'playing') { togglePause(gameRef.current); onUpdate(); }
    }
    function tick(now) {
      const game = gameRef.current;
      if (window.GameSwitch?.isOpen && game.status === 'playing') loseFocus();
      if (lastGame !== game || game.status === 'ready') {
        if (lastGame !== game) audio.reset();
        lastGame = game;
        lastShots = game.shots; lastKills = game.kills; lastEmp = game.empCount; lastHp = health(game);
        accumulator = 0;
      }
      if (game.status !== 'playing') {
        for (const code in keys) delete keys[code];
        for (const key in pulses) delete pulses[key];
        pointerFire = false;
        pointerPulse = false;
        inputRef.current = {};
      }
      const input = { ...inputRef.current, ...inputRef.current.pulses, p2: { ...inputRef.current.p2 } };
      for (const code of Object.keys({ ...keys, ...pulses })) {
        if (keyMap[code]) input[keyMap[code]] = true;
        else if (p2KeyMap[code]) input.p2[p2KeyMap[code]] = true;
      }
      input.fire ||= pointerFire || pointerPulse;
      if (!pointerFire && !pointerPulse) { delete input.aimX; delete input.aimY; }
      accumulator = game.status === 'playing' ? Math.min(accumulator + (now - previous) / 1000, 0.1) : 0;
      while (accumulator >= 1 / 120) {
        updateGame(game, 1 / 120, input);
        accumulator -= 1 / 120;
        pointerPulse = false;
        delete inputRef.current.pulses;
        for (const key in pulses) delete pulses[key];
      }
      audio.sync(game, soundRef.current);
      if (game.shots > lastShots) audio.effect(240, 0.04, 0.01);
      if (game.kills > lastKills) audio.effect(85, 0.21, 0.045);
      if (game.empCount > lastEmp) audio.effect(680, 0.38, 0.035);
      if (health(game) < lastHp) audio.effect(55, 0.22, 0.04);
      if (document.hidden || window.GameSwitch?.isOpen) audio.suspend();
      lastShots = game.shots; lastKills = game.kills; lastEmp = game.empCount; lastHp = health(game);
      renderGame(ctx, game, now / 1000, { reducedMotion });
      canvas.dataset.status = game.status;
      canvas.dataset.playerX = game.player.x.toFixed(1);
      canvas.dataset.playerY = game.player.y.toFixed(1);
      canvas.dataset.aim = game.player.aimAngle?.toFixed(2);
      canvas.dataset.bullets = game.bullets.length;
      canvas.dataset.shots = game.shots;
      canvas.dataset.music = audio.state;
      canvas.dataset.player2X = game.players?.[1]?.x.toFixed(1) || '';
      canvas.dataset.player2Y = game.players?.[1]?.y.toFixed(1) || '';
      canvas.dataset.tier = game.player.level ?? 0;
      canvas.dataset.enemies = game.enemies.length;
      canvas.dataset.enemyBullets = game.bullets.filter(bullet => bullet.owner === 'enemy').length;
      canvas.dataset.rankUps = game.rankUps ?? 0;
      previous = now;
      if (now - lastHud > 80) { onUpdate(); lastHud = now; }
      frame = requestAnimationFrame(tick);
    }
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', loseFocus);
    canvas.addEventListener('pointermove', aim);
    canvas.addEventListener('pointerdown', pointerDown);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerUp);
    canvas.addEventListener('lostpointercapture', pointerUp);
    canvas.addEventListener('pointerleave', pointerLeave);
    const visibility = () => { if (document.hidden) loseFocus(); };
    document.addEventListener('visibilitychange', visibility);
    document.fonts.ready.then(() => { if (canvas.isConnected) { resize(); renderGame(ctx, gameRef.current, 0, { reducedMotion }); } });
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', loseFocus);
      canvas.removeEventListener('pointermove', aim);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('lostpointercapture', pointerUp);
      canvas.removeEventListener('pointerleave', pointerLeave);
      document.removeEventListener('visibilitychange', visibility);
      audio.dispose();
    };
  }, [gameRef, inputRef, onUpdate, onCommand]);

  return <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} tabIndex={0} role="application" aria-label={gameRef.current.status === 'editor' ? 'Map construction. Choose terrain and paint by clicking or dragging on the battlefield.' : 'Tank battlefield. P1: WASD or arrows to move in four directions, Space to fire forward, or hold left click to aim and fire. Shift to dash, E for EMP. P2: IJKL to move, U to fire forward, O to dash. Escape pauses.'} />;
}
