import type { HandMode } from './Hand';

interface ActionBarProps {
  mode: HandMode;
  canUndo: boolean;
  canPlay: boolean;
  canRedraw: boolean;
  redrawsLeft: number;
  selectedCount: number;
  onUndo: () => void;
  onPlay: () => void;
  onRedraw: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ActionBar(props: ActionBarProps) {
  if (props.mode === 'redraw') {
    return (
      <div className="actions redraw-actions">
        <button type="button" className="btn" onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={props.selectedCount === 0}
          onClick={props.onConfirm}
        >
          Confirm{props.selectedCount > 0 ? ` (${props.selectedCount})` : ''}
        </button>
      </div>
    );
  }

  return (
    <div className="actions">
      <button type="button" className="btn" disabled={!props.canUndo} onClick={props.onUndo}>
        Undo
      </button>
      <button type="button" className="btn primary" disabled={!props.canPlay} onClick={props.onPlay}>
        Play chain
      </button>
      <button type="button" className="btn" disabled={!props.canRedraw} onClick={props.onRedraw}>
        Redraw <span className="count">{props.redrawsLeft}</span>
      </button>
    </div>
  );
}
