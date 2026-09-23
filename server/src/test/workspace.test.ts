import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, linkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { listWorkspaceFiles, readWorkspaceFile, searchWorkspace } from '../workspace/files.js';
import { WorkspaceReviews } from '../workspace/reviews.js';
import { WorkspaceTransactions } from '../workspace/transactions.js';
import { WorkspaceValidations, configuredValidationTasks } from '../workspace/validations.js';
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


test('multi-file transaction applies together, persists, and rolls back safely',()=>{
  const f=fixture();try {
    writeFileSync(join(f.project,'src/other.ts'),'export const other = 1;\n');
    const first=readWorkspaceFile(f.project,'src/app.ts'),second=readWorkspaceFile(f.project,'src/other.ts');
    const store=new WorkspaceTransactions(f.projects,join(f.root,'data'));
    const transaction=store.stage('project',[
      {path:first.path,version:first.version,content:'export const value = 2;\n'},
      {path:second.path,version:second.version,content:'export const other = 2;\n'},
    ]);
    assert.equal(readFileSync(join(f.project,first.path),'utf8'),first.content);
    assert.equal(readFileSync(join(f.project,second.path),'utf8'),second.content);
    assert.equal(store.act(transaction.id,'apply').status,'applied');
    assert.match(readFileSync(join(f.project,first.path),'utf8'),/value = 2/);
    assert.match(readFileSync(join(f.project,second.path),'utf8'),/other = 2/);
    const restarted=new WorkspaceTransactions(f.projects,join(f.root,'data'));
    assert.equal(restarted.get(transaction.id).status,'applied');
    assert.equal(restarted.act(transaction.id,'rollback').status,'rolled-back');
    assert.equal(readFileSync(join(f.project,first.path),'utf8'),first.content);
    assert.equal(readFileSync(join(f.project,second.path),'utf8'),second.content);
  }finally{f.cleanup();}
});

test('multi-file transaction preflights every file and recovers partial apply fail-closed',()=>{
  const f=fixture();try {
    writeFileSync(join(f.project,'src/other.ts'),'export const other = 1;\n');
    const first=readWorkspaceFile(f.project,'src/app.ts'),second=readWorkspaceFile(f.project,'src/other.ts');
    const store=new WorkspaceTransactions(f.projects,join(f.root,'data'));
    const stale=store.stage('project',[
      {path:first.path,version:first.version,content:'export const value = 2;\n'},
      {path:second.path,version:second.version,content:'export const other = 2;\n'},
    ]);
    writeFileSync(join(f.project,second.path),'external edit\n');
    assert.throws(()=>store.act(stale.id,'apply'),/changed since review/);
    assert.equal(readFileSync(join(f.project,first.path),'utf8'),first.content);

    writeFileSync(join(f.project,second.path),second.content);
    const tx=store.stage('project',[
      {path:first.path,version:first.version,content:'export const value = 3;\n'},
      {path:second.path,version:second.version,content:'export const other = 3;\n'},
    ]);
    const recordPath=join(f.root,'data/workspace-transactions',`${tx.id}.json`);
    writeFileSync(recordPath,JSON.stringify({...tx,status:'applying'}));
    writeFileSync(join(f.project,first.path),tx.files[0].after);
    const recovered=new WorkspaceTransactions(f.projects,join(f.root,'data')).get(tx.id);
    assert.equal(recovered.status,'conflict');
    assert.match(readFileSync(join(f.project,first.path),'utf8'),/value = 3/);
    assert.equal(readFileSync(join(f.project,second.path),'utf8'),second.content);
    const repaired=new WorkspaceTransactions(f.projects,join(f.root,'data')).act(tx.id,'rollback');
    assert.equal(repaired.status,'rolled-back');
    assert.equal(readFileSync(join(f.project,first.path),'utf8'),first.content);
    assert.equal(readFileSync(join(f.project,second.path),'utf8'),second.content);
  }finally{f.cleanup();}
});

test('configured validation tasks execute without exposing or accepting browser commands',async()=>{
  const f=fixture();try {
    const env={MATTERHORN_VALIDATIONS:JSON.stringify([
      {id:'node-ok',name:'Node validation',projectId:'project',command:process.execPath,args:['-e',"console.log('validation-ok')"],timeoutMs:5000},
      {id:'node-fail',name:'Failing validation',projectId:'project',command:process.execPath,args:['-e','process.exit(3)'],timeoutMs:5000},
    ])} as NodeJS.ProcessEnv;
    const tasks=configuredValidationTasks(f.projects,env),validations=new WorkspaceValidations(f.projects,tasks);
    const listed=validations.list('project');
    assert.equal(listed.length,2);
    assert.equal('command' in listed[0],false);
    const passed=await validations.run('project','node-ok');
    assert.equal(passed.status,'passed');assert.match(passed.stdout,/validation-ok/);
    const failed=await validations.run('project','node-fail');
    assert.equal(failed.status,'failed');assert.equal(failed.exitCode,3);
    assert.throws(()=>validations.run('project','missing'),/Unknown configured/);
    const blocked=new WorkspaceValidations(f.projects,tasks,()=>{throw new Error('Studio active');});
    assert.throws(()=>blocked.run('project','node-ok'),/Studio active/);
  }finally{f.cleanup();}
});

test('workspace HTTP exposes reviewed transactions and configured validation IDs only',async()=>{
  const f=fixture();writeFileSync(join(f.project,'src/other.ts'),'export const other = 1;\n');
  const previousProjects=process.env.MATTERHORN_PROJECTS,previousData=process.env.MATTERHORN_DATA_DIR,previousValidations=process.env.MATTERHORN_VALIDATIONS;
  process.env.MATTERHORN_PROJECTS=JSON.stringify(f.projects);
  process.env.MATTERHORN_DATA_DIR=join(f.root,'data');
  process.env.MATTERHORN_VALIDATIONS=JSON.stringify([{id:'quick',name:'Quick check',projectId:'project',command:process.execPath,args:['-e',"console.log('ok')"],timeoutMs:5000}]);
  const server=await startNssWorkspaceAiServer({port:0,mCore:{providerMode:'mock',requestTimeoutMs:1000}},{portStateFilePath:false});
  const base=`http://127.0.0.1:${server.port}`,headers={'Content-Type':'application/json'};
  try {
    const first=await (await fetch(base+'/api/workspace/file?projectId=project&path=src/app.ts')).json() as {version:string};
    const second=await (await fetch(base+'/api/workspace/file?projectId=project&path=src/other.ts')).json() as {version:string};
    const stage=await fetch(base+'/api/workspace/transaction-stage',{method:'POST',headers,body:JSON.stringify({projectId:'project',files:[
      {path:'src/app.ts',version:first.version,content:'export const value = 4;\n'},
      {path:'src/other.ts',version:second.version,content:'export const other = 4;\n'},
    ]})});
    assert.equal(stage.status,200,await stage.clone().text());
    const transaction=await stage.json() as any;assert.equal(transaction.root,undefined);assert.equal(transaction.files.length,2);
    const apply=await fetch(base+'/api/workspace/transaction-apply',{method:'POST',headers,body:JSON.stringify({id:transaction.id})});
    assert.equal(apply.status,200,await apply.clone().text());
    assert.match(readFileSync(join(f.project,'src/app.ts'),'utf8'),/value = 4/);
    const rollback=await fetch(base+'/api/workspace/transaction-rollback',{method:'POST',headers,body:JSON.stringify({id:transaction.id})});
    assert.equal(rollback.status,200,await rollback.clone().text());
    assert.match(readFileSync(join(f.project,'src/app.ts'),'utf8'),/value = 1/);

    const listed=await (await fetch(base+'/api/workspace/validations?projectId=project')).json() as any[];
    assert.deepEqual(listed.map(item=>item.id),['quick']);assert.equal('command' in listed[0],false);
    const result=await fetch(base+'/api/workspace/validate',{method:'POST',headers,body:JSON.stringify({projectId:'project',id:'quick'})});
    assert.equal(result.status,200,await result.clone().text());assert.equal((await result.json() as any).status,'passed');
    const injection=await fetch(base+'/api/workspace/validate',{method:'POST',headers,body:JSON.stringify({projectId:'project',id:'missing',command:'echo hacked'})});
    assert.equal(injection.status,400);
  }finally{
    await server.close();
    if(previousProjects===undefined)delete process.env.MATTERHORN_PROJECTS;else process.env.MATTERHORN_PROJECTS=previousProjects;
    if(previousData===undefined)delete process.env.MATTERHORN_DATA_DIR;else process.env.MATTERHORN_DATA_DIR=previousData;
    if(previousValidations===undefined)delete process.env.MATTERHORN_VALIDATIONS;else process.env.MATTERHORN_VALIDATIONS=previousValidations;
    f.cleanup();
  }
});
