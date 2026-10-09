import React, { useEffect, useRef } from 'react';
import { updateGame, togglePause, WIDTH, HEIGHT } from './engine.js';
import { renderGame } from './renderer.js';

export default function GameCanvas({ gameRef, inputRef, sound, onUpdate, onCommand }) {
  const canvasRef = useRef(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false });
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const keyMap = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'fire', ShiftLeft: 'dash', ShiftRight: 'dash' };
    let frame, previous = performance.now(), lastHud = 0, accumulator = 0, audio, pointerFire = false;
    let lastGame = gameRef.current, lastShots = 0, lastKills = 0, lastEmp = 0, lastHp = lastGame.player.hp;
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
    function tone(frequency, duration, volume = 0.025) {
      if (!soundRef.current) return;
      try {
        audio ??= new AudioContext();
        if (audio.state === 'suspended') audio.resume();
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, frequency / 3), audio.currentTime + duration);
        gain.gain.setValueAtTime(volume, audio.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
        oscillator.connect(gain); gain.connect(audio.destination);
        oscillator.start(); oscillator.stop(audio.currentTime + duration);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      } catch { /* Audio is optional when the browser disallows it. */ }
    }
    function keyDown(event) {
      if (event.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
      if (event.target.closest?.('dialog') || window.GameSwitch?.isOpen) return;
      const command = { Enter: 'start', Escape: 'pause', KeyR: 'restart', KeyE: 'emp' }[event.code];
      const key = keyMap[event.code];
      if (!key && !command) return;
      if (event.target.closest?.('button') && ['Enter', 'Space'].includes(event.code)) return;
      event.preventDefault();
      if (command && !event.repeat) onCommand(command);
      if (key) { keys[event.code] = true; pulses[key] = true; }
    }
    function keyUp(event) { delete keys[event.code]; }
    function aim(event) {
      if (event.pointerType === 'touch') return;
      const bounds = canvas.getBoundingClientRect();
      inputRef.current.aimX = (event.clientX - bounds.left) / bounds.width * WIDTH;
      inputRef.current.aimY = (event.clientY - bounds.top) / bounds.height * HEIGHT;
    }
    function pointerDown(event) {
      if (event.pointerType === 'touch' || event.button !== 0 || gameRef.current.status !== 'playing') return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      aim(event);
      pointerFire = true;
      pulses.fire = true;
    }
    function pointerUp(event) {
      pointerFire = false;
      const bounds = canvas.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) pointerLeave();
    }
    function pointerLeave() { if (!pointerFire) { delete inputRef.current.aimX; delete inputRef.current.aimY; } }
    function loseFocus() {
      inputRef.current = {};
      pointerFire = false;
      for (const key in keys) delete keys[key];
      for (const key in pulses) delete pulses[key];
      accumulator = 0;
      if (gameRef.current.status === 'playing') { togglePause(gameRef.current); onUpdate(); }
    }
    function tick(now) {
      const game = gameRef.current;
      if (lastGame !== game || game.status === 'ready') {
        lastGame = game;
        lastShots = game.shots; lastKills = game.kills; lastEmp = game.empCount; lastHp = game.player.hp;
        accumulator = 0;
      }
      if (game.status !== 'playing') {
        for (const code in keys) delete keys[code];
        for (const key in pulses) delete pulses[key];
        pointerFire = false;
        inputRef.current = {};
      }
      const input = { ...inputRef.current };
      for (const code in keys) input[keyMap[code]] = true;
      for (const key in pulses) input[key] = true;
      input.fire ||= pointerFire;
      accumulator = game.status === 'playing' ? Math.min(accumulator + (now - previous) / 1000, 0.1) : 0;
      while (accumulator >= 1 / 120) {
        updateGame(game, 1 / 120, input);
        accumulator -= 1 / 120;
        for (const key in pulses) delete pulses[key];
      }
      if (game.shots > lastShots) tone(240, 0.04, 0.01);
      if (game.kills > lastKills) tone(85, 0.21, 0.045);
      if (game.empCount > lastEmp) tone(680, 0.38, 0.035);
      if (game.player.hp < lastHp) tone(55, 0.22, 0.04);
      lastShots = game.shots; lastKills = game.kills; lastEmp = game.empCount; lastHp = game.player.hp;
      renderGame(ctx, game, now / 1000, { reducedMotion });
      canvas.dataset.status = game.status;
      canvas.dataset.playerX = game.player.x.toFixed(1);
      canvas.dataset.playerY = game.player.y.toFixed(1);
      canvas.dataset.aim = game.player.aimAngle?.toFixed(2);
      canvas.dataset.bullets = game.bullets.length;
      canvas.dataset.shots = game.shots;
      previous = now;
      if (now - lastHud > 80) { onUpdate(); lastHud = now; }
      frame = requestAnimationFrame(tick);
    }
    window.addEventListener('keydown', keyDown);
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
      window.removeEventListener('keyup', keyUp);
      window.removeEventListener('blur', loseFocus);
      canvas.removeEventListener('pointermove', aim);
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('lostpointercapture', pointerUp);
      canvas.removeEventListener('pointerleave', pointerLeave);
      document.removeEventListener('visibilitychange', visibility);
      audio?.close();
    };
  }, [gameRef, inputRef, onUpdate, onCommand]);

  return <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} tabIndex={0} role="application" aria-label="Tank battlefield. Move freely with WASD or arrow keys. Aim with the mouse, hold left click or Space to fire. Shift dashes, E activates EMP. Escape pauses." />;
}
