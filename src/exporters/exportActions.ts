import { ProjectState } from '../state/projectState';
import { exportToGDScript } from '../../../../packages/nstep-motion-core/src/exporters/godot/gdscript';
import { exportToCanvas2D, exportStandaloneHTML } from '../../../../packages/nstep-motion-core/src/exporters/canvas2d/runtime';
import { downloadFile } from '../shared/fileUtils';
import { normalizeProject } from '../../../../packages/nstep-motion-core/src/schema/validators';

export function exportJSON() {
  const { project } = ProjectState;
  const json = JSON.stringify(project, null, 2);
  const filename = project.name.replace(/\s+/g, '-') + '.motion.json';
  downloadFile(filename, json, 'application/json');
}

export function exportGodot() {
  const { project } = ProjectState;
  const code = exportToGDScript(project);
  const filename = project.name.replace(/\s+/g, '-') + '.gd';
  downloadFile(filename, code, 'text/plain');
}

export function exportCanvasRuntime() {
  const { project } = ProjectState;
  const { code } = exportToCanvas2D(project);
  const filename = project.name.replace(/\s+/g, '-') + '.runtime.ts';
  downloadFile(filename, code, 'text/typescript');
}

export function exportDemoHTML() {
  const { project } = ProjectState;
  const { code } = exportToCanvas2D(project);
  const html = exportStandaloneHTML(project, code);
  const filename = project.name.replace(/\s+/g, '-') + '.demo.html';
  downloadFile(filename, html, 'text/html');
}

export async function importJSON(file: File): Promise<any> {
  try {
    const text = await file.text();
    const p = JSON.parse(text);
    return normalizeProject(p);
  } catch (e) {
    alert('Invalid .motion.json file');
    return null;
  }
}
