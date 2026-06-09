import { DirtyState } from '../state/dirtyState';

export interface KfDragState {
  ctrl: any;
  kfRef: any;
  dur: number;
  stripEl: HTMLElement;
  onUpdate: (skipInsp?: boolean, skipTl?: boolean) => void;
}

let _kfDrag: KfDragState | null = null;
let _kfDragWasActive = false;
let _kfDragListenersInit = false;

export function wasKfDragActive(): boolean { return _kfDragWasActive; }
export function resetKfDragActive(): void  { _kfDragWasActive = false; }
export function setKfDrag(state: KfDragState | null): void { _kfDrag = state; }

export function initKfDragListeners() {
  if (_kfDragListenersInit) return;
  _kfDragListenersInit = true;

  window.addEventListener('pointermove', (e: PointerEvent) => {
    if (!_kfDrag) return;
    const { ctrl, kfRef, dur, stripEl } = _kfDrag;
    if (!stripEl.isConnected) { _kfDrag = null; return; }
    const rect = stripEl.getBoundingClientRect();
    if (rect.width === 0) return;
    const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    kfRef.time = +(relX * dur).toFixed(3);
    ctrl.keyframes.sort((a: any, b: any) => a.time - b.time);
    const diamonds = stripEl.querySelectorAll('.kf-diamond');
    ctrl.keyframes.forEach((kf: any, i: number) => {
      if (diamonds[i]) (diamonds[i] as HTMLElement).style.left = `${(kf.time / dur * 100).toFixed(1)}%`;
    });
    DirtyState.markDirty();
  });

  window.addEventListener('pointerup', () => {
    if (_kfDrag) {
      _kfDragWasActive = true;
      _kfDrag.onUpdate(true, false);
      _kfDrag = null;
    }
  });
}
