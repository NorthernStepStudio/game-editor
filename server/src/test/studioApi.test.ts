import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { startNssWorkspaceAiServer } from '../server.js';
test('standalone APIs enforce local origin, body limits and static boundaries', async () => {
  const app=await startNssWorkspaceAiServer({port:0,mCore:{providerMode:'mock',requestTimeoutMs:1000}},{portStateFilePath:false});const base=`http://127.0.0.1:${app.port}`;
  try {
    assert.equal((await fetch(base+'/')).status,200);
    assert.equal((await fetch(base+'/api/projects')).status,200);
    assert.deepEqual(await (await fetch(base+'/api/studio/runs')).json(),[]);
    assert.equal((await fetch(base+'/api/studio/runs/missing')).status,404);
    assert.equal((await fetch(base+'/api/studio/runs',{headers:{Origin:'https://evil.example'}})).status,403);
    assert.equal((await fetch(base+'/api/studio/runs',{method:'POST',body:'{}'})).status,415);
    assert.equal((await fetch(base+'/api/studio/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({goal:'Hello',projectId:'unknown',criteria:['Works']})})).status,400);
    assert.equal((await fetch(base+'/api/studio/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(70000)})).status,400);
    assert.equal((await fetch(base+'/%2e%2e%2fpackage.json')).status,403);
    const page=await fetch(base+'/');assert(page.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"));assert(!page.headers.has('access-control-allow-origin'));
    const providers=JSON.stringify(await (await fetch(base+'/providers')).json());assert(!providers.includes('apiKey'));
  } finally { await app.close(); }
});
