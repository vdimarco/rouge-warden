import React, { useEffect, useRef, useState } from 'react';

export default function LivingScene({ active }) {
  const video = useRef();
  const [allowed, setAllowed] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches && !navigator.connection?.saveData);
  const [visible, setVisible] = useState(() => !document.hidden);
  const [ready, setReady] = useState(false), [failed, setFailed] = useState(false);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => { const enabled = !preference.matches && !navigator.connection?.saveData; setAllowed(enabled); if (!enabled) setReady(false); };
    const hidden = () => setVisible(!document.hidden);
    preference.addEventListener('change', changed);
    navigator.connection?.addEventListener('change', changed);
    document.addEventListener('visibilitychange', hidden);
    return () => { preference.removeEventListener('change', changed); navigator.connection?.removeEventListener('change', changed); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => {
    if (!video.current) return;
    if (active && allowed && visible && !failed) video.current.play().catch(() => { setReady(false); });
    else video.current.pause();
  }, [active, allowed, visible, failed]);
  return allowed && !failed ? <video ref={video} className={`living-scene ${ready ? 'scene-ready' : ''}`} src={`${import.meta.env.BASE_URL}art/menu-loop.mp4`} muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1} onLoadedData={() => setReady(true)} onError={() => setFailed(true)}/> : null;
}
