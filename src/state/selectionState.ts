export const SelectionState = {
  activePartId: null as string | null,
  activeAnimId: 'idle' as string | null,
  clipboardController: null as any | null,
  isEditingPivot: false,
  showDebugBounds: false,
  selectedLaneCtrlId: null as string | null,
  selectedKeyframeIds: new Set<string>(),
  selectedPartIds: new Set<string>(),
  gizmoMode: 'move' as 'move' | 'rotate' | 'scale',
};
