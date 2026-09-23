import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, linkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listWorkspaceFiles, readWorkspaceFile, searchWorkspace } from '../workspace/files.js';
import { WorkspaceReviews } from '../workspace/reviews.js';
import { startNssWorkspaceAiServer } from '../server.js';
function fixture() {
  const root=mkdtempSync(join(tmpdir(),'matterhorn workspace ')),project=join(root,'project');mkdirSync(project);mkdirSync(join(project,'src'));
  writeFileSync(join(project,'src/app.ts'),'export const value = 1;\n');
  return { root,project,projects:[{id:'project',name:'Fixture',path:project}],cleanup:()=>rmSync(root,{recursive:true,force:true}) };
}
test('workspace listing and search exclude hidden/generated paths and sensitive file contents',()=>{
  const f=fixture();try {
    mkdirSync(join(f.project,'node_modules'));writeFileSync(join(f.project,'node_modules/dep.ts'),'value');writeFileSync(join(f.project,'.env'),'TOKEN=secret');writeFileSync(join(f.project,'credentials.json'),'{}');writeFileSync(join(f.project,'config.ts'),'const api_key = "super-secret-value";');
    assert.deepEqual(listWorkspaceFiles(f.project).files,['config.ts','src/app.ts']);
    assert.equal(searchWorkspace(f.project,'value').matches.length,1);assert.equal(searchWorkspace(f.project,'value').skipped,1);
    for(const path of ['../outside.ts','src/../config.ts','C:/file.ts','src\\app.ts','.env'])assert.throws(()=>readWorkspaceFile(f.project,path));
  }finally{f.cleanup();}
});
test('workspace refuses binary, oversized and linked files',()=>{
  const f=fixture();try {
    writeFileSync(join(f.project,'big.txt'),'x'.repeat(32769));writeFileSync(join(f.project,'binary.txt'),'abc\0def');
    assert.throws(()=>readWorkspaceFile(f.project,'big.txt'));assert.throws(()=>readWorkspaceFile(f.project,'binary.txt'));
    linkSync(join(f.project,'src/app.ts'),join(f.project,'hardlink.ts'));assert.throws(()=>readWorkspaceFile(f.project,'hardlink.ts'));
    if(process.platform!=='win32'){symlinkSync(f.project,join(f.project,'escape'));assert.throws(()=>readWorkspaceFile(f.project,'escape/src/app.ts'));}
  }finally{f.cleanup();}
});
test('review apply and restore persist across service restart without automatic mutation',()=>{
  const f=fixture();try {
    const file=readWorkspaceFile(f.project,'src/app.ts'),store=new WorkspaceReviews(f.projects,join(f.root,'data'));
    const review=store.stage('project',file.path,file.version,'export const value = 2;\n');assert.equal(readFileSync(join(f.project,file.path),'utf8'),file.content);
    assert.equal(store.act(review.id,'apply').status,'applied');assert.equal(readFileSync(join(f.project,file.path),'utf8'),review.after);
    const restarted=new WorkspaceReviews(f.projects,join(f.root,'data'));assert.equal(restarted.get(review.id).status,'applied');assert.equal(restarted.act(review.id,'restore').status,'restored');assert.equal(readFileSync(join(f.project,file.path),'utf8'),file.content);
  }finally{f.cleanup();}
});
test('stale apply, stale restore and rejected proposals cannot overwrite files',()=>{
  const f=fixture();try {
    const store=new WorkspaceReviews(f.projects,join(f.root,'data')),file=readWorkspaceFile(f.project,'src/app.ts'),r=store.stage('project',file.path,file.version,'changed');
    writeFileSync(join(f.project,file.path),'external edit');assert.throws(()=>store.act(r.id,'apply'),/changed/);assert.equal(readFileSync(join(f.project,file.path),'utf8'),'external edit');
    assert.throws(()=>store.stage('project',file.path,file.version,'new'),/changed/);store.act(r.id,'reject');assert.throws(()=>store.act(r.id,'apply'),/state/);
    const current=readWorkspaceFile(f.project,file.path),r2=store.stage('project',file.path,current.version,'applied text');store.act(r2.id,'apply');writeFileSync(join(f.project,file.path),'later edit');assert.throws(()=>store.act(r2.id,'restore'),/changed/);assert.equal(readFileSync(join(f.project,file.path),'utf8'),'later edit');
  }finally{f.cleanup();}
});
test('journal recovery reconciles an interrupted write and blocks active Studio mutation',()=>{
  const f=fixture();try {
    let active=false;const store=new WorkspaceReviews(f.projects,join(f.root,'data'),()=>{if(active)throw new Error('Studio is active');});const file=readWorkspaceFile(f.project,'src/app.ts'),r=store.stage('project',file.path,file.version,'next');
    active=true;assert.throws(()=>store.act(r.id,'apply'),/active/);active=false;
    const recordPath=join(f.root,'data/workspace-reviews',`${r.id}.json`);writeFileSync(recordPath,JSON.stringify({...r,status:'applying'}));writeFileSync(join(f.project,file.path),r.after);
    assert.equal(new WorkspaceReviews(f.projects,join(f.root,'data')).get(r.id).status,'applied');
    const moved=[{...f.projects[0],path:f.root}];assert.throws(()=>new WorkspaceReviews(moved,join(f.root,'data')).get(r.id),/location changed/);
  }finally{f.cleanup();}
});
test('workspace HTTP flow browses, explains, stages, applies and restores a real temporary file',async()=>{
  const f=fixture();const previousProjects=process.env.MATTERHORN_PROJECTS,previousData=process.env.MATTERHORN_DATA_DIR;
  process.env.MATTERHORN_PROJECTS=JSON.stringify(f.projects);process.env.MATTERHORN_DATA_DIR=join(f.root,'data');
  const server=await startNssWorkspaceAiServer({port:0,mCore:{providerMode:'mock',requestTimeoutMs:1000}},{portStateFilePath:false});const base=`http://127.0.0.1:${server.port}`;
  const post=async(path:string,body:unknown)=>{const response=await fetch(base+'/api/workspace/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(response.status,200,await response.clone().text());return response.json() as Promise<any>;};
  try {
    const file=await (await fetch(base+'/api/workspace/file?projectId=project&path=src/app.ts')).json() as {version:string};
    const input={projectId:'project',path:'src/app.ts',version:file.version};
    const answer=await post('assist',{...input,intent:'explain',prompt:'Explain',provider:'mock'});assert(answer.response.includes('Active file:'));assert.equal(answer.review,null);
    const proposal=await post('assist',{...input,intent:'propose',prompt:'Change it',provider:'mock'});assert.equal(proposal.review,null);
    const review=await post('stage',{...input,content:'export const value = 3;\n'});assert.equal(review.root,undefined);
    await post('apply',{id:review.id});assert.equal(readFileSync(join(f.project,'src/app.ts'),'utf8'),review.after);
    await post('restore',{id:review.id});assert.equal(readFileSync(join(f.project,'src/app.ts'),'utf8'),review.before);
    assert.equal((await fetch(base+'/api/workspace/file?projectId=project&path=../escape.ts')).status,400);
  }finally{await server.close();if(previousProjects===undefined)delete process.env.MATTERHORN_PROJECTS;else process.env.MATTERHORN_PROJECTS=previousProjects;if(previousData===undefined)delete process.env.MATTERHORN_DATA_DIR;else process.env.MATTERHORN_DATA_DIR=previousData;f.cleanup();}
});
