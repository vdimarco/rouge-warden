import React, { useEffect, useRef } from 'react';
export default function Modal({ children, onDismiss, label }) {
  const ref = useRef();
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="modal" aria-label={label} onCancel={e => { e.preventDefault(); onDismiss(); }} onClick={e => { if (e.target === ref.current) onDismiss(); }}>{children}</dialog>;
}
