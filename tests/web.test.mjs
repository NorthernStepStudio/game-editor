import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
test('standalone UI navigation, plan review, run state, cancellation and chat history', async () => {
  const dom = new JSDOM(await readFile(new URL('../web/index.html', import.meta.url), 'utf8'), { url: 'http://localhost/#studio' });
  const originals = new Map();
  for (const key of ['window','document','location','Option','EventSource','fetch']) originals.set(key,globalThis[key]);
  Object.assign(globalThis, {window:dom.window,document:dom.window.document,location:dom.window.location,Option:dom.window.Option});
  let run=null, chatBodies=[];
  globalThis.EventSource=class { close(){} };
  globalThis.fetch=async (path,options) => {
    const body=options?.body && JSON.parse(options.body);let data;
    if(path==='/health')data={mode:'mock'};
    else if(path==='/providers')data={current:'mock',providers:[{id:'mock',label:'Mock',available:true}]};
    else if(path==='/api/studio/health')data={available:false};
    else if(path==='/api/studio/specialists')data=[
      {id:'matterhorn',title:'Matterhorn',role:'Orchestrator',executionMode:'orchestrator',availability:'available',capabilities:[{id:'studio.plan',description:'Plan work'}]},
      {id:'flyrail',title:'Flyrail',role:'Godot executor',executionMode:'executor',availability:'available',capabilities:[{id:'godot.project',description:'Godot work'}]},
      {id:'blender-engine',title:'Blender Engine',role:'3D executor',executionMode:'executor',availability:'available',capabilities:[{id:'blender.create',description:'3D work'}]},
    ];
    else if(path==='/api/foundry/providers')data={providers:[{id:'sprite-fusion',name:'Sprite Fusion',configured:true,available:true,local:false,requiresNetwork:true,externalCost:true,commercialUseAllowed:true,operations:['generate'],kinds:['pixel_sprite'],note:'Configured',estimatedCost:{currency:'SPRITE_FUSION_CREDITS',amount:15}},{id:'comfyui-local',name:'ComfyUI Local',configured:false,available:false,local:true,requiresNetwork:false,externalCost:false,commercialUseAllowed:false,operations:[],kinds:[],note:'Setup required'}]};
    else if(path==='/api/foundry/assets')data={count:1,assets:[{assetId:'hero-base',type:'pixel_sprite',operation:'generate',generationProvider:'sprite-fusion',createdAt:'2026-09-25T10:00:00.000Z',width:32,height:32,sourceLicenseIds:['Commercial'],previewUrl:'/api/foundry/assets/hero-base/preview'}]};
    else if(path==='/api/foundry/assets/hero-base')data={asset:{assetId:'hero-base',type:'pixel_sprite',operation:'generate',generationProvider:'sprite-fusion',createdAt:'2026-09-25T10:00:00.000Z',width:32,height:32,sourceLicenseIds:['Commercial'],previewUrl:'/api/foundry/assets/hero-base/preview'},lineage:[{assetId:'hero-base',type:'pixel_sprite',operation:'generate',createdAt:'2026-09-25T10:00:00.000Z'}]};
    else if(path==='/api/projects')data=[{id:'fixture',name:'Fixture project'}];
    else if(path==='/api/studio/plan')data={goal:body.goal,tasks:[{title:'Implement',acceptanceCriteria:body.criteria}]};
    else if(path==='/api/studio/runs' && body){run={id:'fixture-run',status:'running',createdAt:'2026-09-25T03:00:00.000Z',plan:{goal:body.goal,tasks:[{id:'work',title:'Implement',goal:body.goal,domain:'godot',specialistId:'flyrail',status:'planned'}]},tasks:[{id:'work',status:'running',detail:'Building Godot scene'}]};data=run;}
    else if(path==='/api/studio/runs')data=run?[run]:[];
    else if(path==='/api/studio/runs/fixture-run/cancel'){run={...run,status:'cancel-requested'};data=run;}
    else if(path==='/api/studio/runs/fixture-run')data=run;
    else if(path==='/ask'){chatBodies.push(body);data={response:'Simulated chat response'};}
    else throw new Error(`Unexpected API ${path}`);
    return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
  };
  const flush=()=>new Promise(r=>setTimeout(r,20));
  try {
    await import('../web/main.js');await flush();
    assert.equal(document.querySelector('#project').options.length,2);
    assert.equal(document.querySelector('#agent-selector'),null);
    assert.match(document.querySelector('#connection').textContent,/mock/);
    assert.equal(document.querySelectorAll('#specialist-list .specialist-card').length,3);
    assert.equal(document.querySelector('#asset-provider').value,'sprite-fusion');
    assert.equal(document.querySelector('#asset-cost-panel').hidden,false);
    assert.equal(document.querySelector('#asset-max-cost').value,'15');
    document.querySelector('#asset-generate-form').dispatchEvent(new window.Event('submit',{cancelable:true}));
    await flush();
    assert.match(document.querySelector('#asset-generate-status').textContent,/Approve network access/i);
    assert.equal(document.querySelectorAll('#asset-gallery .asset-card').length,1);
    assert.match(document.querySelector('#asset-gallery').textContent,/hero-base/);
    document.querySelector('#tab-btn-assets-sidebar').click();await flush();
    assert.equal(document.querySelector('#studio').hidden,false);
    assert.equal(document.querySelector('#studio-assets').hidden,false);
    document.querySelector('#asset-gallery .asset-card').click();await flush();
    assert.match(document.querySelector('#asset-inspector').textContent,/sprite-fusion/);
    assert.match(document.querySelector('#asset-inspector').textContent,/Lineage/);
    document.querySelector('#tab-create').click();await flush();
    for(const page of ['chat','projects','evidence','settings','studio']){location.hash=`#${page}`;window.dispatchEvent(new window.Event('hashchange'));await flush();assert.equal(document.querySelector(`#${page}`).hidden,false);}
    document.querySelector('#project').value='fixture';document.querySelector('#goal').value='Verify fixture';document.querySelector('#criteria').value='Godot validation passes';
    document.querySelector('#run-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await flush();assert.equal(document.querySelector('#plan-review').hidden,false);
    document.querySelector('#start').click();await flush();assert.match(document.querySelector('#active-run').textContent,/running/);
    assert.equal(document.querySelector('#step-node-4').classList.contains('active'),true);
    assert.match(document.querySelector('#project-run-engine').textContent,/Flyrail/);
    [...document.querySelectorAll('#active-run button')].find(b=>b.textContent==='Request cancellation').click();await flush();assert.match(document.querySelector('#active-run').textContent,/cancel-requested/);
    for(const text of ['First question','Second question']){document.querySelector('#prompt').value=text;document.querySelector('#chat-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await flush();}
    assert.equal(chatBodies[1].history.length,2);assert.equal(chatBodies[1].preferredAgentId,undefined);
    assert.equal(document.querySelector('#notice').hidden,true);
  } finally {dom.window.close();for(const [key,value] of originals){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
