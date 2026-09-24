import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyFlyrailEvidence } from '../studio/adapters/flyrail/flyrailEvidence.js';
import { validateStudioEvidence } from '../studio/evidenceValidator.js';
import type { NssStudioExecutionResult } from '../studio/types.js';
test('persisted Flyrail evidence requires matching identity, gates and confined paths', () => {
  const root=mkdtempSync(join(tmpdir(),'matterhorn-evidence-'));const dir=join(root,'.flyrail/evidence');mkdirSync(dir,{recursive:true});const uri=join(dir,'task.json');
  const bundle={schemaVersion:1,requestId:'task',ok:true,validation:{ok:true},scenario:{ok:true},qa:{ok:true},playtestOk:null};
  const result:NssStudioExecutionResult={taskId:'task',specialistId:'flyrail',status:'completed',summary:'Done'};
  const report={requestId:'task',ok:true,evidencePath:uri,evidence:{validationOk:true,scenarioOk:true,qaOk:true}};
  try {
    writeFileSync(uri,JSON.stringify(bundle));const checked=verifyFlyrailEvidence(result,report,root);
    assert.equal(validateStudioEvidence(checked,'task','flyrail',['Godot validation passes','Scenario checks pass','QA checks pass']).valid,true);
    assert.equal(validateStudioEvidence(checked,'task','flyrail',['Player jumps correctly']).valid,false);
    assert.equal(validateStudioEvidence(checked,'task','flyrail',['Playtest passes']).valid,false);
    writeFileSync(uri,JSON.stringify({...bundle,requestId:'another'}));assert.equal(verifyFlyrailEvidence(result,report,root).status,'blocked');
    writeFileSync(uri,JSON.stringify({...bundle,validation:{ok:false}}));assert.equal(verifyFlyrailEvidence(result,report,root).status,'blocked');
    const outside=join(root,'outside.json');writeFileSync(outside,JSON.stringify(bundle));assert.equal(verifyFlyrailEvidence(result,{...report,evidencePath:outside},root).status,'blocked');
    assert.equal(verifyFlyrailEvidence(result,{...report,evidencePath:undefined},root).status,'blocked');
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('structured Flyrail scene criteria remain matched to exact Studio acceptance criteria', () => {
  const root = mkdtempSync(join(tmpdir(), 'matterhorn-scene-evidence-'));
  const dir = join(root, '.flyrail', 'evidence');
  mkdirSync(dir, { recursive: true });
  const uri = join(dir, 'task.json');
  const custom = JSON.stringify({ id: 'scene-environment-root', description: 'Matterhorn environment root exists', checkType: 'node_exists', target: 'MatterhornEnvironment', expected: true });
  const criteria = ['Godot validation passes', 'Scenario checks pass', 'QA checks pass', custom];
  const item = { criterionId: 'scene-environment-root', description: 'Matterhorn environment root exists', checkType: 'node_exists' as const, target: 'MatterhornEnvironment', expected: true, actual: true, outcome: 'passed' as const, evidenceUri: uri, executionId: 'task' };
  const bundle = { schemaVersion: 1, requestId: 'task', ok: true, validation: { ok: true }, scenario: { ok: true }, qa: { ok: true }, playtestOk: true, criterionResults: [item] };
  const result: NssStudioExecutionResult = { taskId: 'task', specialistId: 'flyrail', status: 'completed', summary: 'Done' };
  const report = { requestId: 'task', ok: true, evidencePath: uri, evidence: { validationOk: true, scenarioOk: true, qaOk: true, playtestOk: true }, criterionResults: [item] };
  try {
    writeFileSync(uri, JSON.stringify(bundle));
    const checked = verifyFlyrailEvidence(result, report, root, criteria);
    assert.equal(checked.status, 'completed');
    assert.equal(validateStudioEvidence(checked, 'task', 'flyrail', criteria).valid, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
