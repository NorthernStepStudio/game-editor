import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const require=createRequire(import.meta.url);
const {startNssWorkspaceAiServer}=require('../server/out/server.js');
test('Projects UI performs reviewed edits against the real local API and restores the file',async()=>{
  const root=await mkdtemp(join(tmpdir(),'matterhorn ui ')),project=join(root,'project');await mkdir(project);await writeFile(join(project,'app.ts'),'export const value = 1;\n');
  const oldProjects=process.env.MATTERHORN_PROJECTS,oldData=process.env.MATTERHORN_DATA_DIR;
  process.env.MATTERHORN_PROJECTS=JSON.stringify([{id:'fixture',name:'Fixture',path:project}]);process.env.MATTERHORN_DATA_DIR=join(root,'data');
  const server=await startNssWorkspaceAiServer({port:0,mCore:{providerMode:'mock',requestTimeoutMs:1000}},{portStateFilePath:false});
  const dom=new JSDOM(await readFile(new URL('../web/index.html',import.meta.url),'utf8'),{url:`http://127.0.0.1:${server.port}/#projects`});
  const originals=new Map(['window','document','Option','fetch'].map(key=>[key,globalThis[key]])),nativeFetch=globalThis.fetch;
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,Option:dom.window.Option,fetch:(path,options)=>nativeFetch(new URL(path,dom.window.location.href),options)});
  const $=id=>document.getElementById(id);
  const until=async predicate=>{const deadline=Date.now()+3000;while(!predicate()){if(Date.now()>deadline)throw new Error('UI state timed out: '+$('notice').textContent);await new Promise(r=>setTimeout(r,10));}};
  try {
    const {initWorkspace}=await import('../web/workspace.js');initWorkspace();
    $('provider').add(new Option('Mock','mock'));$('provider').value='mock';
    window.dispatchEvent(new window.CustomEvent('workspace-projects',{detail:[{id:'fixture',name:'Fixture'}]}));$('workspace-project').value='fixture';$('workspace-project').dispatchEvent(new window.Event('change'));
    await until(()=>$('workspace-files').querySelector('button'));$('workspace-files').querySelector('button').click();await until(()=>!$('workspace-editor').disabled);
    $('workspace-editor').value='export const value = 2;\n';$('workspace-stage').click();await until(()=>!$('workspace-review').hidden&&!$('workspace-stage').disabled);
    assert.equal(await readFile(join(project,'app.ts'),'utf8'),'export const value = 1;\n');assert.match($('workspace-after').textContent,/value = 2/);
    $('workspace-review-actions').querySelector('button').click();await until(()=>$('workspace-review-status').textContent==='applied'&&!$('workspace-stage').disabled);assert.equal(await readFile(join(project,'app.ts'),'utf8'),'export const value = 2;\n');
    $('workspace-review-actions').querySelector('button').click();await until(()=>$('workspace-review-status').textContent==='restored'&&!$('workspace-stage').disabled);assert.equal(await readFile(join(project,'app.ts'),'utf8'),'export const value = 1;\n');
    document.querySelector('[data-assist=propose]').click();await until(()=>$('workspace-answer').textContent.includes('No concrete edit'));assert.equal(await readFile(join(project,'app.ts'),'utf8'),'export const value = 1;\n');
    $('workspace-query').value='value';$('workspace-search-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await until(()=>$('workspace-scope').textContent.includes('matches'));assert.match($('workspace-files').textContent,/app.ts:1/);assert.equal($('notice').hidden,true);
  } finally {dom.window.close();for(const[key,value]of originals){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}await server.close();if(oldProjects===undefined)delete process.env.MATTERHORN_PROJECTS;else process.env.MATTERHORN_PROJECTS=oldProjects;if(oldData===undefined)delete process.env.MATTERHORN_DATA_DIR;else process.env.MATTERHORN_DATA_DIR=oldData;await rm(root,{recursive:true,force:true});}
});
