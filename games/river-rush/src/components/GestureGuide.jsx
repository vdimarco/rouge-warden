import React from 'react';
import './adventure-extras.css';

const gestures = [
  { id: 'lanes', label: 'Switch lanes', hint: 'Swipe left or right', path: 'M13 34H87M22 25l-9 9 9 9m56-18 9 9-9 9' },
  { id: 'jump', label: 'Jump logs', hint: 'Swipe up to jump', path: 'M50 60V12m-10 11 10-11 10 11' },
  { id: 'duck', label: 'Duck branches', hint: 'Swipe down to duck', path: 'M50 10v48M40 47l10 11 10-11' },
];

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

export default function GestureGuide({ variant = 'menu', active = true, time = 0, action, enemy }) {
  const opening = variant === 'play' || variant === 'opening';
  if (!active || (opening && time >= 10 && !enemy)) return null;
  const nextGesture = action === 'log' ? 1 : action === 'branch' ? 2 : action === 'rock' ? 0 : time < .7 ? 0 : time < 2.15 ? 1 : time < 3.5 ? 2 : time < 5.5 ? 0 : time < 7.75 ? 1 : 2;
  const shown = opening ? [{ ...gestures[nextGesture], ...(enemy ? { label: enemy === 'crocodile' ? 'Jump crocodile' : 'Duck swooping bird', hint: enemy === 'crocodile' ? 'Swipe up or dodge its lane' : 'Swipe down or dodge its lane' } : {}) }] : gestures;
  return <div className={`gesture-guide gesture-guide-${opening ? 'play' : variant}`} role="group" aria-label="Swipe controls: left or right changes lanes, up jumps, down ducks">
    {shown.map(gesture => <Gesture gesture={gesture} key={gesture.id}/>)}
  </div>;
}
