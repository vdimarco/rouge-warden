import React from 'react';
export function Logo() { return <svg viewBox="0 0 64 54" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m3 32 17-21 10 12L39 4l22 28H3M15 19l10 6m8-14 9 10M10 43c11-7 20 7 34 0m-27 8c7-4 15 4 25 0"/></svg>; }
export function Icon({ name, ...props }) {
  const paths = {
    sound: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
    muted: <><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 6 6m0-6-6 6"/></>,
    pause: <><path d="M8 5v14m8-14v14"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    key: <><circle cx="15" cy="7" r="4"/><path d="m12 10-9 10m3-3 3 3m0-6 3 3"/></>,
    chest: <><path d="M3 9h18v11H3V9Zm0 0V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v2M7 3v17m10-17v17"/><path d="M10 10h4v5h-4z"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    left: <path d="m15 5-7 7 7 7"/>,
    right: <path d="m9 5 7 7-7 7"/>,
    close: <path d="m6 6 12 12M6 18 18 6"/>,
    flag: <><path d="M5 21V3m0 0h14l-3 5 3 5H5"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
