/** Regression coverage for the public Phase 3 API after evidence/cancellation hardening. */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { StudioRunController } from '../studio/run/runController.js';
import { SpecialistAdapterRegistry } from '../studio/run/registry.js';
import { InMemoryStudioRunStore } from '../studio/run/store.js';
import { createStudioPlan } from '../studio/orchestrator.js';
import { SpecialistError, type SpecialistAdapter } from '../studio/adapters/types.js';
import type { StudioRunEvent } from '../studio/run/types.js';
const makePlan = () => createStudioPlan({goal:'Verify change',tasks:[{id:'check',title:'Check',goal:'Verify change',domain:'godot',requiredCapabilities:['godot.validation.run'],acceptanceCriteria:['Works']}]});
function setup(overrides: Partial<SpecialistAdapter> = {}) {
  const registry=new SpecialistAdapterRegistry();registry.register({specialistId:'flyrail',health:async()=>({available:true,specialistId:'flyrail'}),getCapabilities:async()=>({specialistId:'flyrail',protocolVersion:'test',capabilities:['godot.validation.run']}),submitTask:async h=>({taskId:h.taskId,specialistId:'flyrail',accepted:true}),getTaskStatus:async id=>({taskId:id,specialistId:'flyrail',phase:'completed'}),getResult:async id=>({taskId:id,specialistId:'flyrail',status:'completed',summary:'Checked',artifacts:[{kind:'report',uri:'fixture:report'}],evidence:[{kind:'test',summary:'Works',outcome:'passed',uri:'fixture:report'}],criterionResults:[{criterion:'Works',outcome:'passed',evidenceUri:'fixture:report'}]}),cancelTask:async id=>({taskId:id,cancelled:true}),...overrides});return registry;
}
test('Phase 3 executeRun mirrors final state and ordered events into injected store',async()=>{
  const store=new InMemoryStudioRunStore(),events:StudioRunEvent[]=[];
  const controller=new StudioRunController({registry:setup(),store,pollIntervalMs:2,listeners:[e=>events.push(e)]});
  const run=await controller.executeRun(makePlan(),'compat-run');assert.equal(run.status,'completed');assert.equal(run.taskRuns.check.status,'completed');assert.equal(run.artifacts.length,1);assert.equal((await store.getRun('compat-run'))?.status,'completed');assert.equal(events[0].kind,'studio.run.started');assert.equal(events.at(-1)?.kind,'studio.run.completed');assert(events.some(e=>e.kind==='studio.evidence.received'));
});
test('required capabilities block submission',async()=>{
  let submissions=0;const controller=new StudioRunController({registry:setup({getCapabilities:async()=>({specialistId:'flyrail',protocolVersion:'test',capabilities:[]}),submitTask:async h=>{submissions++;return {taskId:h.taskId,specialistId:'flyrail',accepted:true};}})});
  assert.equal((await controller.executeRun(makePlan())).status,'blocked');assert.equal(submissions,0);
});
test('a recoverable submission error is not replayed and uncertainty stays visible',async()=>{
  let submissions=0;const controller=new StudioRunController({registry:setup({submitTask:async()=>{submissions++;throw new SpecialistError('TRANSPORT_ERROR','Uncertain',{recoverable:true});},cancelTask:async id=>({taskId:id,cancelled:false})}),retryPolicy:{maxTaskAttempts:3}});
  assert.equal((await controller.executeRun(makePlan())).status,'cancel-requested');assert.equal(submissions,1);
});
test('cancelRun confirms remote termination before reporting cancelled',async()=>{
  const controller=new StudioRunController({registry:setup({getTaskStatus:async id=>({taskId:id,specialistId:'flyrail',phase:'running'})}),pollIntervalMs:2});const promise=controller.executeRun(makePlan(),'cancel-api');await new Promise(r=>setTimeout(r,10));const requested=await controller.cancelRun('cancel-api');assert.equal(requested?.status,'cancel-requested');assert.equal((await promise).status,'cancelled');
});
test('plain success summaries no longer satisfy acceptance criteria',async()=>{
  const controller=new StudioRunController({registry:setup({getResult:async id=>({taskId:id,specialistId:'flyrail',status:'completed',summary:'Done',evidence:[{kind:'test',summary:'Validation passed'}]})})});assert.equal((await controller.executeRun(makePlan())).status,'blocked');
});
test('required artifacts are enforced',async()=>{
  const controller=new StudioRunController({registry:setup()});const plan=makePlan();const run=await controller.executeRun({...plan,tasks:plan.tasks.map(t=>({...t,outputArtifacts:[{kind:'export',uri:'required'}]}))});assert.equal(run.status,'failed');
});
test('additional validators can reject but cannot replace the strict evidence gate',async()=>{
  const controller=new StudioRunController({registry:setup(),validator:{validate:()=>({passed:false,criteria:[],evidenceConsidered:[],failures:['Additional gate failed'],warnings:[]})}});assert.equal((await controller.executeRun(makePlan())).status,'failed');
});
