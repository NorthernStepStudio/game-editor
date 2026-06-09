export interface PoseTransform {
  x:        number;
  y:        number;
  rotation: number;
  scaleX:   number;
  scaleY:   number;
}

export type Pose = Record<string, PoseTransform>;

export const ClipboardState = {
  copiedPose: null as Pose | null,
};
