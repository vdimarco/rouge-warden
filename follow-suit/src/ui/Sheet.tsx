import { useEffect, useId, useRef, type ReactNode } from 'react';

interface SheetProps {
  title: string;
  children: ReactNode;
  /** Closes on Escape and on a tap outside the panel. Leave it out when the player must answer. */
  onClose?: () => void;
  className?: string;
  testId?: string;
}

/** A panel that slides up from the bottom, where the thumb is. */
export function Sheet({ title, children, onClose, className = '', testId }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('button:not(:disabled), input')?.focus();
  }, []);

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        ref={panel}
        className={`sheet ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid={testId}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && onClose) onClose();
        }}
      >
        <h2 id={titleId} className="sheet-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
