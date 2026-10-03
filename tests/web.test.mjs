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
    else if(path==='/api/studio/runtime')data=[{capability:'browser-control',title:'Local browser',state:'ready'},{capability:'project-memory',title:'Project memory',state:'unavailable'},{capability:'sandbox-execution',title:'Safe execution',state:'unavailable'},{capability:'telemetry',title:'Run insights',state:'unavailable'},{capability:'agent-evaluation',title:'Agent validation',state:'unavailable'}];
    else if(path==='/api/studio/routing')data={game:'auto',threeD:'auto',assets:'auto',localFirst:true,requireCommercialUse:true,allowNetworkProviders:false,allowExternalCostProviders:false,updatedAt:'1970-01-01T00:00:00.000Z'};
    else if(path==='/api/foundry/providers')data={providers:[]};
    else if(path==='/api/foundry/assets')data={assets:[]};
    else if(path==='/api/studio/completion')data={productionReadiness:42,capabilityCoverage:60,pillars:[],criticalNext:['Run Gate 0 locally']};
    else if(path==='/api/projects')data=[{id:'fixture',name:'Fixture project'}];
    else if(path==='/api/studio/plan')data={goal:body.goal,tasks:[{title:'Implement',acceptanceCriteria:body.criteria}]};
    else if(path==='/api/studio/runs' && body){run={id:'fixture-run',status:'running',plan:{goal:body.goal},tasks:[{id:'work',status:'running'}]};data=run;}
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
    assert.match(document.querySelector('#connection').textContent,/mock/);assert.match(document.querySelector('#runtime-capabilities').textContent,/Local browser/);assert.doesNotMatch(document.querySelector('#runtime-capabilities').textContent,/Graphiti|DeepEval|Langfuse|Browser Harness/);
    for(const page of ['chat','projects','evidence','settings','studio','pipeline','output','assets','specialists']){location.hash=`#${page}`;window.dispatchEvent(new window.Event('hashchange'));await flush();const mainId=['pipeline','output','assets','specialists'].includes(page)?'studio':page;assert.equal(document.querySelector(`#${mainId}`).hidden,false);}
    document.querySelector('#project').value='fixture';document.querySelector('#goal').value='Verify fixture';document.querySelector('#criteria').value='Godot validation passes';
    document.querySelector('#run-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await flush();assert.equal(document.querySelector('#plan-review').hidden,false);
    document.querySelector('#start').click();await flush();assert.match(document.querySelector('#active-run').textContent,/running/);
    [...document.querySelectorAll('#active-run button')].find(b=>b.textContent==='Request cancellation').click();await flush();assert.match(document.querySelector('#active-run').textContent,/cancel-requested/);
    for(const text of ['First question','Second question']){document.querySelector('#prompt').value=text;document.querySelector('#chat-form').dispatchEvent(new window.Event('submit',{cancelable:true}));await flush();}
    assert.equal(chatBodies[1].history.length,2);assert.equal(chatBodies[1].preferredAgentId,undefined);
    assert.equal(document.querySelector('#notice').hidden,true);
  } finally {dom.window.close();for(const [key,value] of originals){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
