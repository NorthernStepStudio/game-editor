import { CharacterProject } from '../../../../packages/nstep-motion-core/src/schema/types';
import { createDefaultProject } from '../../../../packages/nstep-motion-core/src/schema/defaults';
import { SelectionState } from './selectionState';
import { DirtyState } from './dirtyState';

export const ProjectState = {
  project: createDefaultProject(),
  
  setProject(p: CharacterProject) {
    this.project = JSON.parse(JSON.stringify(p)); // Deep copy
    if (this.project.animations.length > 0) {
      SelectionState.activeAnimId = this.project.animations[0].id;
    }
    DirtyState.markClean();
  }
};
