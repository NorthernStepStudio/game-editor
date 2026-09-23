import { closeSync, constants, fstatSync, openSync, readFileSync, opendirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { textFile, visibleName, workspacePath } from './paths.js';
export const MAX_FILE_BYTES = 32768;
export const digest = (text: string): string => createHash('sha256').update(text).digest('hex');
export interface WorkspaceFile { path: string; content: string; version: string }
export function checkText(content: string): void {
  if (typeof content !== 'string' || Buffer.byteLength(content) > MAX_FILE_BYTES || content.includes('\0') || content.includes('\ufffd')) throw new Error('Only UTF-8 text files up to 32 KiB are supported.');
  if (/-----BEGIN (?:[A-Z ]*PRIVATE KEY|CERTIFICATE)-----/.test(content) || /(?:api[_-]?key|access[_-]?token|password|secret)\s*["']?\s*[:=]\s*["'][^"'\s]{8,}["']/i.test(content)) throw new Error('This file appears to contain credentials. Remove credentials before using workspace assistance.');
}
export function readWorkspaceFile(root: string, file: string): WorkspaceFile {
  const target = workspacePath(root, file);
  const fd = openSync(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const info = fstatSync(fd);
    if (!info.isFile() || info.nlink !== 1 || info.size > MAX_FILE_BYTES) throw new Error('Only single-link text files up to 32 KiB are supported.');
    const content = readFileSync(fd, 'utf8'); checkText(content);
    return { path: file, content, version: digest(content) };
  } finally { closeSync(fd); }
}
export function listWorkspaceFiles(root: string): { files: string[]; truncated: boolean } {
  const files: string[] = []; let entries = 0, truncated = false;
  const visit = (directory: string, prefix: string, depth: number): void => {
    if (depth > 12 || entries >= 10000 || files.length >= 1000) { truncated = true; return; }
    const handle = opendirSync(directory);
    try {
      let entry;
      while ((entry = handle.readSync()) !== null) {
        if (++entries > 10000 || files.length >= 1000) { truncated = true; break; }
        if (!visibleName(entry.name) || entry.isSymbolicLink()) continue;
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) visit(join(directory,entry.name),name,depth+1);
        else if (entry.isFile() && textFile(entry.name)) files.push(name);
      }
    } finally { handle.closeSync(); }
  };
  visit(root,'',0); files.sort(); return { files, truncated };
}
export function searchWorkspace(root: string, query: string) {
  if (typeof query !== 'string' || !query.trim() || query.length > 200) throw new Error('Search text must contain 1–200 characters.');
  const listing = listWorkspaceFiles(root), matches: { path: string; line: number; text: string }[] = [];
  let scannedBytes = 0, skipped = 0, truncated = listing.truncated;
  for (const path of listing.files) {
    if (scannedBytes >= 4 * 1024 * 1024 || matches.length >= 50) { truncated = true; break; }
    try {
      const file = readWorkspaceFile(root,path); scannedBytes += Buffer.byteLength(file.content);
      const lines = file.content.split(/\r?\n/);
      for (let i=0; i<lines.length; i++) if (lines[i].toLowerCase().includes(query.toLowerCase())) {
        matches.push({ path, line:i+1, text:lines[i].slice(0,240) }); if (matches.length >= 50) { truncated = true; break; }
      }
    } catch { skipped++; }
  }
  return { matches, truncated, skipped };
}
