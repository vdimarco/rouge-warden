import { Config, Flags, NumericParameters, OptionParameters, PixelStreaming, TextParameters } from '@epicgames-ps/lib-pixelstreamingfrontend-ue5.8';
import { Logger, LogLevel } from '@epicgames-ps/lib-pixelstreamingcommon-ue5.8';
import { signallingUrl, streamDimensions, receiverLagging } from './config.mjs';
import { setupTouchControls } from './touch-controls.js';

Logger.InitLogging(LogLevel.Warning, false);

const element = id => document.getElementById(id);
const frame = element('frame');
const videoParent = element('video');
const overlay = element('overlay');
const connectButton = element('connect');
const playButton = element('play');
const streamSelect = element('streamer');
const disconnectButton = element('disconnect');
const muteButton = element('mute');
const fullscreenButton = element('fullscreen');
const touchRoot = element('touch-controls');
const touchMode = navigator.maxTouchPoints > 0;
document.body.classList.toggle('touch-input', touchMode);
let stream;
let touchControls;
let started = false;
let timeout;
let muted = false;
let streamSize = '';
let resizeTimer;
let mobileEdge = 800;
let phoneBitrate = 1500;
let poorFrames = 0;
let previousVideo;

function status(state, title, detail) {
  document.body.dataset.state = state;
  element('status-label').textContent = state.toUpperCase();
  element('status-title').textContent = title;
  element('status-detail').textContent = detail;
  overlay.hidden = state === 'playing';
  connectButton.hidden = ['connecting', 'ready', 'playing'].includes(state);
  connectButton.textContent = started ? 'Reconnect' : 'Connect';
  playButton.hidden = state !== 'ready';
  muteButton.disabled = state !== 'playing';
  if (['connecting', 'selecting', 'ready', 'playing'].includes(state)) disconnectButton.disabled = false;
  if (state !== 'playing' && document.pointerLockElement === videoParent) document.exitPointerLock();
  updateInput();
}

function updateInput() {
  const playing = document.body.dataset.state === 'playing';
  const locked = document.pointerLockElement === videoParent;
  stream?.config.setFlagEnabled(Flags.KeyboardInput, playing && locked);
  touchRoot.hidden = !touchMode || !playing;
  touchControls?.setEnabled(touchMode && playing);
  element('input-note').textContent = playing
    ? (touchMode ? 'Drag anywhere on the game to look · Move / steer on the left · Gas and Brake in cars · Gyro look in ☰ Menu.'
      : locked ? 'You’re in control. Esc releases the mouse.' : 'Click the game to control it. Esc releases the mouse.')
    : `${touchMode ? 'Touch controls appear when you play.' : 'Keyboard + mouse supported.'} The host PC must stay online.`;
}

function setMuted(value) {
  muted = value;
  stream.config.setFlagEnabled(Flags.StartVideoMuted, muted);
  stream.webRtcController.streamController.audioElement.muted = muted;
  stream.webRtcController.videoPlayer.getVideoElement().muted = muted;
  muteButton.textContent = muted ? 'Unmute' : 'Mute';
  muteButton.setAttribute('aria-pressed', String(muted));
}

// Smaller phone frames leave more bandwidth and decoder time for smooth playback.
function wantedSize() {
  return streamDimensions(touchMode, frame.clientWidth, frame.clientHeight, NORD_PORTRAIT_STREAM, mobileEdge);
}

function requestStreamSize() {
  if (document.body.dataset.state !== 'playing') return;
  const [width, height] = wantedSize();
  const size = `${width}x${height}`;
  if (size === streamSize || !stream.emitCommand({ 'Resolution.Width': width, 'Resolution.Height': height })) return;
  streamSize = size;
  document.body.dataset.streamSize = size;
}

function stopTimeout() {
  clearTimeout(timeout);
}

function waitForConnection() {
  stopTimeout();
  timeout = setTimeout(() => {
    stream.disconnect();
    status('offline', 'The game isn’t responding.', 'The host may be offline, or this network may be unable to reach it. Try reconnecting.');
  }, 20000);
}

function readyToPlay() {
  stopTimeout();
  status('ready', 'Your player is ready.', touchMode
    ? 'Tap Play with sound. Use the touch sticks and buttons to play; turn your phone sideways for a wider view.'
    : 'Click Play with sound, then click the game to take control.');
}

function fail(title, detail, state = 'error') {
  stopTimeout();
  status(state, title, detail);
}

let endpoint;
try {
  endpoint = signallingUrl(NORD_SIGNALLING_URL, location.hostname);
} catch (error) {
  status('error', 'The game connection needs attention.', error.message);
}

if (endpoint) {
  try {
    const config = new Config({
      useUrlParams: false,
      initialSettings: {
        [TextParameters.SignallingServerUrl]: endpoint,
        [OptionParameters.StreamerId]: NORD_DEFAULT_STREAMER_ID,
        [Flags.AutoConnect]: false,
        [Flags.AutoPlayVideo]: false,
        [Flags.StartVideoMuted]: false,
        [Flags.WaitForStreamer]: false,
        [Flags.KeyboardInput]: false,
        [Flags.HoveringMouseMode]: false,
        [Flags.UseMic]: false,
        [Flags.UseCamera]: false,
        [Flags.TouchInput]: false,
        [Flags.GamepadInput]: false,
        [Flags.MatchViewportResolution]: false,
        [NumericParameters.WebRTCMaxBitrate]: touchMode ? 1500 : 12000,
        [NumericParameters.MaxReconnectAttempts]: 0
      }
    });
    stream = new PixelStreaming(config, { videoElementParent: videoParent });
    touchControls = setupTouchControls({ root: touchRoot, surface: frame, stream });
    stream.addResponseEventListener('nord-driving', response => {
      let state;
      try { state = JSON.parse(response); } catch { return; }
      if (typeof state?.nordDriving === 'boolean') touchControls.setDriving(state.nordDriving);
    });
    connectButton.disabled = false;
    status('idle', 'The city is waiting.', 'Connect to a free player and help save Park La Fontaine.');

    stream.addEventListener('streamerListMessage', event => {
      const ids = event.data.messageStreamerList.ids;
      streamSelect.replaceChildren();
      if (!ids.length) {
        streamSelect.add(new Option('No players online', ''));
        streamSelect.disabled = true;
        fail('No players are online.', 'The game host is connected, but no game players are running yet. Try reconnecting shortly.', 'offline');
        return;
      }
      streamSelect.add(new Option('Choose a player', ''));
      for (const id of ids) {
        const label = id === 'NordHost' ? 'Player 1 · Host' : id === 'NordFriend1' ? 'Player 2 · Friend' : id;
        streamSelect.add(new Option(label, id));
      }
      streamSelect.disabled = false;
      streamSelect.value = event.data.autoSelectedStreamerId || '';
      if (!event.data.autoSelectedStreamerId) {
        stopTimeout();
        status('selecting', 'Choose your player.', 'Pick a free player in the menu. Each friend needs a different player.');
      }
    });
    stream.addEventListener('webRtcConnecting', () => {
      status('connecting', 'Opening your player…', 'Connecting to the game. Keep this page open.');
      waitForConnection();
    });
    stream.addEventListener('initialSettings', () => {
      // The SDK imports host defaults before this microtask reapplies the player budget.
      queueMicrotask(() => config.setNumericSetting(NumericParameters.WebRTCMaxBitrate, touchMode ? phoneBitrate : 12000));
    });
    stream.addEventListener('statsReceived', event => {
      if (!touchMode || document.hidden || document.body.dataset.state !== 'playing' || mobileEdge !== 800) return;
      const video = event.data.aggregatedStats.inboundVideoStats;
      poorFrames = video.freezeCount > previousVideo?.freezeCount ? 5
        : receiverLagging(video, previousVideo) ? poorFrames + 1 : 0;
      previousVideo = { framesDecoded: video.framesDecoded, timestamp: video.timestamp,
        jitterBufferDelay: video.jitterBufferDelay, jitterBufferEmittedCount: video.jitterBufferEmittedCount,
        freezeCount: video.freezeCount };
      if (poorFrames < 5) return;
      mobileEdge = 640;
      phoneBitrate = 1000;
      config.setNumericSetting(NumericParameters.WebRTCMaxBitrate, phoneBitrate);
      requestStreamSize();
    });
    stream.addEventListener('videoInitialized', readyToPlay);
    stream.addEventListener('playStreamRejected', readyToPlay);
    stream.addEventListener('playStreamError', event => fail('The stream couldn’t play.', event.data.message));
    stream.addEventListener('webRtcFailed', () => fail('The game couldn’t be reached.', 'The video connection failed. Reconnect, or try another network.'));
    stream.addEventListener('webRtcDisconnected', () => {
      streamSelect.disabled = true;
      disconnectButton.disabled = true;
      fail('Your game disconnected.', 'Reconnect to continue when the host is available.', 'disconnected');
    });
    stream.addEventListener('subscribeFailed', event => fail('This player is unavailable.', `${event.data.message} Choose another player in the menu, or reconnect.`));
    stream.addEventListener('dataChannelError', () => fail('The controls disconnected.', 'Reconnect before continuing to play.'));
    const video = stream.webRtcController.videoPlayer.getVideoElement();
    video.addEventListener('playing', () => {
      stopTimeout();
      status('playing', 'You’re in Montréal.', '');
      config.setNumericSetting(NumericParameters.WebRTCMaxBitrate, touchMode ? phoneBitrate : 12000);
      setTimeout(requestStreamSize, 500);
    });
    // Lay the controls out for the frame the game actually sends: a tall frame puts them all under its HUD.
    video.addEventListener('resize', () => {
      document.body.classList.toggle('portrait-stream', video.videoHeight > video.videoWidth * 1.1);
    });
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(requestStreamSize, 300);
    });

    connectButton.addEventListener('click', () => {
      const reconnect = started;
      started = true;
      streamSize = '';
      mobileEdge = 800; phoneBitrate = 1500; poorFrames = 0; previousVideo = undefined;
      disconnectButton.disabled = false;
      status('connecting', 'Connecting to Montréal…', 'Finding the game host and available players.');
      waitForConnection();
      try {
        if (reconnect) stream.reconnect();
        else stream.connect();
      } catch {
        fail('The game couldn’t connect.', 'The host may be offline. Try reconnecting.');
      }
    });
    streamSelect.addEventListener('change', () => {
      if (streamSelect.disabled || !streamSelect.value) return;
      streamSize = '';
      mobileEdge = 800; phoneBitrate = 1500; poorFrames = 0; previousVideo = undefined;
      status('connecting', 'Opening your player…', 'Connecting to the selected player.');
      waitForConnection();
      config.setOptionSettingValue(OptionParameters.StreamerId, streamSelect.value);
    });
    playButton.addEventListener('click', () => {
      setMuted(false);
      stream.play();
      videoParent.focus();
    });
    disconnectButton.addEventListener('click', () => {
      stopTimeout();
      streamSelect.disabled = true;
      touchControls.setEnabled(false);
      stream.disconnect();
      disconnectButton.disabled = true;
      status('disconnected', 'You left the game.', 'Reconnect when you’re ready to return.');
    });
    muteButton.addEventListener('click', () => {
      setMuted(!muted);
    });
    window.addEventListener('pagehide', () => {
      touchControls.setEnabled(false);
      stream.disconnect();
    });
  } catch {
    status('error', 'This browser couldn’t start the game.', 'Use a current Chrome, Edge, Firefox or Safari browser with WebRTC enabled.');
  }
}

document.addEventListener('pointerlockchange', updateInput);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.pointerLockElement) {
    event.preventDefault();
    document.exitPointerLock();
  }
}, true);
// The start screen can go fullscreen too, so the menu can leave it in every state.
fullscreenButton.disabled = !document.fullscreenEnabled;
fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await frame.requestFullscreen();
  } catch {
    element('input-note').textContent = 'Fullscreen is unavailable in this browser. You can keep playing in this window.';
  }
});
document.addEventListener('fullscreenchange', () => {
  fullscreenButton.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen';
});
// Phones and tablets go fullscreen on the tap that starts the game (Play as, Play with sound); the menu leaves it again.
// Start stays in the window: the start screen covers the title screen's menu button, so the header keeps ☰ Menu in reach.
let fullscreenPending = false;
function enterFullscreen() {
  if (!touchMode || fullscreenPending || document.fullscreenElement || !document.fullscreenEnabled) return;
  fullscreenPending = true;
  frame.requestFullscreen({ navigationUI: 'hide' }).catch(() => {}).finally(() => { fullscreenPending = false; });
}
for (const id of ['crew-play', 'play']) element(id).addEventListener('click', enterFullscreen);
