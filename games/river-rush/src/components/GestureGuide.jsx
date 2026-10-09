import React from 'react';
import { LANE_COUNT } from '../game/lanes.js';
import { islandGesture } from '../game/adventure-cues.js';
import './adventure-extras.css';

const gestures = [
  { id: 'lanes', label: 'Switch lanes', hint: 'Swipe left or right', path: 'M13 34H87M22 25l-9 9 9 9m56-18 9 9-9 9' },
  { id: 'jump', label: 'Jump logs', hint: 'Swipe up to jump', path: 'M50 60V12m-10 11 10-11 10 11' },
  { id: 'duck', label: 'Duck branches', hint: 'Swipe down to duck', path: 'M50 10v48M40 47l10 11 10-11' },
];

const enemyGuides = {
  crocodile: { gesture: 'jump', label: 'Jump weaving croc', hint: 'Swipe up or dodge' },
  fish: { gesture: 'jump', label: 'Jump leaping fish', hint: 'Swipe up or dodge' },
  bird: { gesture: 'duck', label: 'Duck diving bird', hint: 'Swipe down or dodge' },
};

function Gesture({ gesture }) {
  return <div className={`gesture-card gesture-${gesture.id}`}>
    <svg className="gesture-motion" viewBox="0 0 100 76" aria-hidden="true">
      <path className="gesture-arrow" d={gesture.path}/>
      <g className="gesture-finger">
        <circle className="gesture-touch-ring" cx="50" cy="37" r="13"/>
        <path d="M46 55V35c0-5 8-5 8 0v9l4-2 8 7c2 2 2 5 1 8l-3 8H51l-9-12c-3-4 1-8 4-5"/>
      </g>
    </svg>
    <span><b>{gesture.label}</b><small>{gesture.hint}</small></span>
  </div>;
}

export default function GestureGuide({ variant = 'menu', active = true, force = false, time = 0, action, enemy, branchWidth = 0, branchFullRiver = false }) {
  const opening = variant === 'play' || variant === 'opening';
  const branchGuide = action === 'branch' && !enemy && branchWidth > 0;
  const islandGuide = islandGesture(action);
  if (!active || (opening && time >= 10 && !force && !enemy && !branchGuide && !islandGuide)) return null;
  const nextGesture = action === 'log' ? 1 : action === 'branch' ? 2 : action === 'rock' ? 0 : time < .7 ? 0 : time < 2.15 ? 1 : time < 3.5 ? 2 : time < 5.5 ? 0 : time < 7.75 ? 1 : 2;
  const enemyGuide = enemyGuides[enemy];
  const fullRiver = branchFullRiver || branchWidth >= LANE_COUNT;
  const spanGuide = branchGuide ? { label: fullRiver ? 'Duck full river' : branchWidth > 1 ? `Duck ${branchWidth} lanes` : 'Duck branch', hint: fullRiver ? 'Swipe down to duck' : 'Swipe down or dodge' } : null;
  const motionGuide = islandGuide ?? enemyGuide;
  const shown = opening ? [{ ...(motionGuide ? gestures.find(gesture => gesture.id === motionGuide.gesture) : gestures[nextGesture]), ...motionGuide, ...spanGuide }] : gestures;
  return <div className={`gesture-guide gesture-guide-${opening ? 'play' : variant}`} role="group" aria-label="Swipe controls: left or right changes lanes, up jumps, down ducks">
    {shown.map(gesture => <Gesture gesture={gesture} key={gesture.id}/>)}
  </div>;
}
