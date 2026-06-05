export const PlaybackState = {
  playing: true,
  time: 0,
  speedMult: 1.0,
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
