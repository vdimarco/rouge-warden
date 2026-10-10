import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signallingUrl } from './config.mjs';

test('missing host remains explicitly offline', () => {
  assert.equal(signallingUrl('', 'game.vercel.app'), '');
  assert.equal(signallingUrl('  ', 'game.vercel.app'), '');
});

test('secure production signalling uses the configured endpoint', () => {
  assert.equal(signallingUrl(' wss://stream.example/player ', 'game.vercel.app'), 'wss://stream.example/player');
});

test('insecure signalling works only between local development endpoints', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(signallingUrl(`ws://${host}:8080`, host), `ws://${host}:8080/`);
  }
  assert.throws(() => signallingUrl('ws://localhost:8080', 'game.vercel.app'), /secure WSS/);
  assert.throws(() => signallingUrl('ws://remote.example', 'localhost'), /secure WSS/);
  assert.throws(() => signallingUrl('ws://192.168.1.2:8080', 'localhost'), /secure WSS/);
});

test('invalid addresses and embedded credentials are rejected', () => {
  for (const value of ['not a URL', '/player', 'https://stream.example', 'javascript:alert(1)',
    'wss://user:password@stream.example', 'wss://stream.example?token=secret', 'wss://stream.example#override']) {
    assert.throws(() => signallingUrl(value, 'game.vercel.app'));
  }
});
