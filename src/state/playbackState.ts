export interface CrossfadeState {
  fromAnimId: string;
  fromTimeSnapshot: number;
  elapsed: number;
  duration: number;
}

export interface ActiveBlendState {
  animAId: string;
  animBId: string;
  weight: number;
}

export const PlaybackState = {
  playing: true,
  time: 0,
  speedMult: 1.0,
  fps: 24,
  crossfade: null as CrossfadeState | null,
  activeBlend: null as ActiveBlendState | null,
};

type AnimationTiming = {
  duration?: number;
  loop?: boolean;
} | null | undefined;

export function getPlaybackTimeForAnimation(anim: AnimationTiming): number {
  const duration = Math.max(anim?.duration || 1, 0.001);
  const time = Math.max(PlaybackState.time, 0);

  if (anim?.loop) {
    return time % duration;
  }

  return Math.min(time, duration);
}

/**
 * Start a crossfade from the currently-playing animation to the next one.
 * Should be called just before `SelectionState.activeAnimId` is updated.
 */
export function startCrossfade(fromAnimId: string, fromTimeSnapshot: number, duration: number) {
  if (duration <= 0) { PlaybackState.crossfade = null; return; }
  PlaybackState.crossfade = {
    fromAnimId,
    fromTimeSnapshot,
    elapsed: 0,
    duration,
  };
}
