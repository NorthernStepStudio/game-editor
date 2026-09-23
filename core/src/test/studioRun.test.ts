import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { StudioExecutionEngine as StudioRunController } from '../studio/runController.js';
import { StudioAdapterRegistry } from '../studio/adapterRegistry.js';
import { createStudioPlan } from '../studio/orchestrator.js';
import type { SpecialistAdapter } from '../studio/adapters/types.js';
import type { NssStudioExecutionResult } from '../studio/types.js';
import { terminalRun } from '../studio/runTypes.js';
import { validateStudioEvidence } from '../studio/evidenceValidator.js';
const plan = (two = false) => createStudioPlan({ goal: 'Test a change', tasks: [{ id: 'first', title: 'First', goal: 'Implement', domain: 'godot', acceptanceCriteria: ['Works'] }, ...two ? [{ id: 'second', title: 'Second', goal: 'Verify', domain: 'godot' as const, dependsOn: ['first'], acceptanceCriteria: ['Works'] }] : []], finalAcceptanceCriteria: ['Works'] });
function adapter(overrides: Partial<SpecialistAdapter> = {}): SpecialistAdapter {
  return { specialistId: 'flyrail', health: async () => ({ available: true, specialistId: 'flyrail' }), getCapabilities: async () => ({ specialistId: 'flyrail', protocolVersion: 'test', capabilities: [] }), submitTask: async handoff => ({ taskId: handoff.taskId, specialistId: 'flyrail', accepted: true }), getTaskStatus: async id => ({ taskId: id, specialistId: 'flyrail', phase: 'completed' }), getResult: async id => goodResult(id), cancelTask: async id => ({ taskId: id, cancelled: false }), ...overrides };
}
function goodResult(id: string): NssStudioExecutionResult { return { taskId: id, specialistId: 'flyrail', status: 'completed', summary: 'Done', evidence: [{ kind: 'test', summary: 'Works', outcome: 'passed', uri: 'fixture:check' }], criterionResults: [{ criterion: 'Works', outcome: 'passed', evidenceUri: 'fixture:check' }] }; }
function controller(a?: SpecialistAdapter, timeout = 500) { const registry = new StudioAdapterRegistry(); if (a) registry.register(a); return new StudioRunController(registry, { taskTimeoutMs: timeout, requestTimeoutMs: 50, pollIntervalMs: 2 }); }
async function settled(c: StudioRunController, id: string) { for (let i=0;i<400;i++) { const run = c.store.get(id)!; if (terminalRun(run.status)) return run; await new Promise(r => setTimeout(r, 2)); } throw new Error('Run did not settle'); }

test('validated DAG runs dependencies in order with unique execution IDs', async () => {
  const ids: string[] = []; const c = controller(adapter({ submitTask: async h => { ids.push(h.taskId); return { taskId: h.taskId, specialistId: 'flyrail', accepted: true }; } }));
  const first = await settled(c, c.start(plan(true)).id); assert.equal(first.status, 'completed'); assert.equal(ids.length, 2); assert(ids[0].endsWith('-first')); assert(ids[1].endsWith('-second'));
  await settled(c, c.start(plan()).id); assert.equal(new Set(ids).size, 3);
});
test('missing adapters block work', async () => { const c=controller(); assert.equal((await settled(c,c.start(plan()).id)).status,'blocked'); });
test('missing evidence blocks completion and downstream tasks', async () => {
  let submissions=0; const c=controller(adapter({submitTask:async h=>{submissions++;return { taskId:h.taskId,specialistId:'flyrail',accepted:true };},getResult:async id=>({...goodResult(id),criterionResults:undefined})}));
  const run=await settled(c,c.start(plan(true)).id);assert.equal(run.status,'blocked');assert.equal(submissions,1);assert.equal(run.tasks[1].status,'blocked');
});
test('failed checks prevent completion even if executor says completed', async () => { const c=controller(adapter({getResult:async id=>({...goodResult(id),evidence:[{kind:'test',summary:'Failed',outcome:'failed'}]})}));assert.equal((await settled(c,c.start(plan()).id)).status,'failed'); });
test('result identity mismatch fails validation', () => { assert.equal(validateStudioEvidence(goodResult('other'),'expected','flyrail',['Works']).failed,true); });
test('a criterion cannot pass with an unreferenced evidence URI', () => { assert.equal(validateStudioEvidence({...goodResult('x'), evidence:[]},'x','flyrail',['Works']).valid,false); });
test('final acceptance is checked separately', async () => { const c=controller(adapter()); const p={...plan(),finalAcceptanceCriteria:['Unproven']};assert.equal((await settled(c,c.start(p).id)).status,'blocked'); });
test('unsupported cancellation waits for remote completion and stops dependencies', async () => {
  let finish=false, submitted=false; const c=controller(adapter({submitTask:async h=>{submitted=true;return {taskId:h.taskId,specialistId:'flyrail',accepted:true};},getTaskStatus:async id=>({taskId:id,specialistId:'flyrail',phase:finish?'completed':'running'})}));
  const id=c.start(plan(true)).id;while(!submitted)await new Promise(r=>setTimeout(r,2));c.requestCancel(id);await new Promise(r=>setTimeout(r,10));assert.equal(c.store.get(id)!.status,'cancel-requested');finish=true;const run=await settled(c,id);assert.equal(run.status,'cancelled');assert.equal(run.tasks[1].status,'cancelled');
});
test('uncertain timeout does not unlock the project or retry mutation', async () => {
  let submissions=0;const c=controller(adapter({submitTask:async()=>{submissions++;return new Promise(()=>{});}}),20);const id=c.start(plan()).id;
  await new Promise(r=>setTimeout(r,90));assert.equal(submissions,1);assert.equal(c.store.get(id)!.status,'cancel-requested');assert.throws(()=>c.start(plan()),/already active/);
});
test('cancel before submission causes no mutation', async () => {
  let submissions=0; const c=controller(adapter({health:async()=>{await new Promise(r=>setTimeout(r,10));return {available:true,specialistId:'flyrail'};},submitTask:async h=>{submissions++;return {taskId:h.taskId,specialistId:'flyrail',accepted:true};}}));const id=c.start(plan()).id;c.requestCancel(id);assert.equal((await settled(c,id)).status,'cancelled');assert.equal(submissions,0);
});
test('store snapshots and failing observers cannot corrupt execution', async () => { const c=controller(adapter());c.store.subscribe(()=>{throw new Error('observer');}); const run=c.start(plan());run.tasks[0].status='failed';assert.equal((await settled(c,run.id)).status,'completed'); });
test('cycles are rejected before execution', () => { assert.throws(()=>createStudioPlan({goal:'Cycle',tasks:[{id:'x',title:'x',goal:'x',domain:'godot',dependsOn:['x'],acceptanceCriteria:['Works']}]}),/itself/); });
