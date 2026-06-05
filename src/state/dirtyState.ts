export const DirtyState = {
  isDirty: false,
  onChange: null as (() => void) | null,
  
  markDirty() {
    this.isDirty = true;
    const status = document.getElementById('autosave-status');
    if (status) status.textContent = 'Unsaved changes...';
    if (this.onChange) this.onChange();
  },
  
  markClean() {
    this.isDirty = false;
    const status = document.getElementById('autosave-status');
    if (status) status.textContent = 'All changes saved';
  }
};
