import { closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import type { StudioProject } from '../services/studioService.js';
import { checkText, digest, readWorkspaceFile } from './files.js';
import { projectRoot, workspacePath } from './paths.js';
type ReviewStatus = 'pending' | 'applying' | 'applied' | 'restoring' | 'restored' | 'rejected' | 'conflict';
export interface WorkspaceReview {
  id: string; projectId: string; path: string; before: string; after: string; beforeVersion: string; afterVersion: string;
  status: ReviewStatus; createdAt: string; updatedAt: string; root: string;
}
function atomicWrite(path: string, text: string, mode = 0o600): void {
  const temp = join(dirname(path), `.matterhorn-${randomUUID()}.tmp`);
  let fd: number | undefined;
  try { fd = openSync(temp,'wx',mode); writeFileSync(fd,text,'utf8'); fsyncSync(fd); closeSync(fd); fd=undefined; renameSync(temp,path); }
  finally { if (fd !== undefined) closeSync(fd); try { unlinkSync(temp); } catch { /* Rename consumed the temporary file. */ } }
}
export class WorkspaceReviews {
  private readonly directory: string;
  constructor(private readonly projects: readonly StudioProject[], dataDirectory: string, private readonly assertIdle: () => void = () => {}) {
    this.directory = resolve(dataDirectory,'workspace-reviews');
  }
  private persist(review: WorkspaceReview): void {
    mkdirSync(this.directory,{ recursive:true, mode:0o700 });
    if (lstatSync(this.directory).isSymbolicLink()) throw new Error('Review storage cannot be a symbolic link.');
    review.updatedAt = new Date().toISOString();
    atomicWrite(join(this.directory,`${review.id}.json`),JSON.stringify(review));
  }
  stage(projectId: string, path: string, version: string, after: string): WorkspaceReview {
    checkText(after);
    const root=projectRoot(this.projects,projectId), file=readWorkspaceFile(root,path);
    if (file.version !== version) throw new Error('File changed. Reopen it and review a new proposal.');
    if (file.content === after) throw new Error('The proposal does not change the file.');
    if (this.ids().length >= 200) throw new Error('Review history limit reached. Archive the local review directory before adding more.');
    const now=new Date().toISOString();const review:WorkspaceReview={id:randomUUID(),projectId,path,before:file.content,after,beforeVersion:file.version,afterVersion:digest(after),status:'pending',createdAt:now,updatedAt:now,root};
    this.persist(review);return review;
  }
  private ids(): string[] {
    try { return readdirSync(this.directory).filter(p=>/^[a-f0-9-]{36}\.json$/.test(p)).map(p=>p.slice(0,-5)); }
    catch(error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  }
  get(id: string): WorkspaceReview {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid review ID.');
    const file=join(this.directory,`${id}.json`), info=lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 512000) throw new Error('Invalid review record.');
    const review=JSON.parse(readFileSync(file,'utf8')) as WorkspaceReview;
    if (review.id !== id || typeof review.before !== 'string' || typeof review.after !== 'string' || digest(review.before)!==review.beforeVersion || digest(review.after)!==review.afterVersion) throw new Error('Review record integrity check failed.');
    if (projectRoot(this.projects,review.projectId)!==review.root) throw new Error('Project location changed; this review cannot be applied.');
    if (['applying','restoring'].includes(review.status)) {
      const current=readWorkspaceFile(review.root,review.path).version;
      review.status=current===review.afterVersion ? 'applied' : current===review.beforeVersion ? (review.status==='restoring'?'restored':'pending') : 'conflict';
      this.persist(review);
    }
    return review;
  }
  list(projectId: string) { projectRoot(this.projects,projectId);let unavailable=0;const reviews:WorkspaceReview[]=[];
    for(const id of this.ids()) { try {const review=this.get(id);if(review.projectId===projectId)reviews.push(review);}catch{unavailable++;} }
    return { reviews: reviews.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)), unavailable };
  }
  act(id: string, action: 'apply' | 'reject' | 'restore'): WorkspaceReview {
    const review=this.get(id);
    if (action==='reject') { if(review.status!=='pending')throw new Error('Only a pending proposal can be rejected.');review.status='rejected';this.persist(review);return review; }
    this.assertIdle();
    const restore=action==='restore';
    if (review.status!==(restore?'applied':'pending')) throw new Error('This review is not in a state that permits this action.');
    const current=readWorkspaceFile(review.root,review.path);
    if (current.version !== (restore?review.afterVersion:review.beforeVersion)) throw new Error('File changed since review. No content was overwritten.');
    const target=workspacePath(review.root,review.path), mode=lstatSync(target).mode & 0o777;
    review.status=restore?'restoring':'applying';this.persist(review); // Backup exists before replacing the file.
    atomicWrite(target,restore?review.before:review.after,mode);
    review.status=restore?'restored':'applied';this.persist(review);return review;
  }
}
export function publicReview({root: _root,...review}: WorkspaceReview) { return review; }
