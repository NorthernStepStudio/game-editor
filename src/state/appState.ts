export const AppState = {
  currentPage: 'overview' as 'overview' | 'editor' | 'cutter' | 'rigging',

  showGrid: true,
  showSkeleton: false,
  showNames: false,
  showPivots: true,
  showBounds: false,
  showTrails: false,

  controllerFilter: 'all' as 'all' | 'selected' | 'animation',

  meshEditMode:       false,
  meshWeightMode:     false,
  meshWeightBoneId:   null as string | null,
  meshSelectedVertIdx: -1,
};
