import { lstatSync, realpathSync } from 'node:fs';
import { extname, isAbsolute, join, relative } from 'node:path';
import type { StudioProject } from '../services/studioService.js';
const extensions = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.md','.txt','.css','.html','.gd','.tscn','.godot','.gdshader','.py','.rs','.toml','.yaml','.yml','.xml','.svg','.sql','.sh','.ps1']);
const ignored = new Set(['node_modules','vendor','out','dist','build','coverage','target','__pycache__']);
export function visibleName(name: string): boolean {
  return !name.startsWith('.') && !ignored.has(name.toLowerCase()) && !/(^|[-_.])(secrets?|credentials?|tokens?|passwords?|private[-_]?key|service[-_]?account)([-_.]|$)/i.test(name);
}
export function textFile(name: string): boolean { return visibleName(name) && extensions.has(extname(name).toLowerCase()); }
export function projectRoot(projects: readonly StudioProject[], id: string): string {
  const project = projects.find(p => p.id === id);
  if (!project) throw new Error('Unknown workspace project.');
  const root = realpathSync(project.path);
  if (!lstatSync(root).isDirectory()) throw new Error('Workspace project must be a directory.');
  return root;
}
export function workspacePath(root: string, file: string): string {
  if (typeof file !== 'string' || !file || file.length > 500 || isAbsolute(file) || /[\\:\x00-\x1f]/.test(file)) throw new Error('Invalid workspace-relative path.');
  const parts = file.split('/');
  if (parts.some(p => !p || p === '..' || p === '.' || !visibleName(p)) || !textFile(parts.at(-1)!)) throw new Error('This path is not an accessible workspace source file.');
  let current = root;
  for (let i=0; i<parts.length; i++) {
    current = join(current, parts[i]);
    const info = lstatSync(current);
    if (info.isSymbolicLink() || (i < parts.length - 1 ? !info.isDirectory() : !info.isFile() || info.nlink !== 1)) throw new Error('Linked or non-regular workspace paths are not supported.');
  }
  const inside = relative(root, realpathSync(current));
  if (inside.startsWith('..') || isAbsolute(inside)) throw new Error('Path escapes the workspace.');
  return current;
}
