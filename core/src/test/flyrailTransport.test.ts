import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { FlyrailClient } from '../studio/adapters/flyrail/flyrailClient.js';
test('native WebSocket shares a connection, handles fragmented large replies, and bounds RPC waits', async () => {
  const server=createServer((_req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,product:'flyrail'}));});
  const wss=new WebSocketServer({server});let connections=0;
  wss.on('connection',(socket,request)=>{
    connections++;assert.equal(new URL(request.url!,'http://localhost').searchParams.get('token'),'fixture-token');
    socket.send(JSON.stringify({jsonrpc:'2.0',method:'daemon.hello'}));socket.send('null');socket.ping();
    socket.on('message',data=>{const message=JSON.parse(data.toString());if(message.method==='hang')return;
      const text=JSON.stringify({jsonrpc:'2.0',id:message.id,result:{method:message.method,value:'x'.repeat(70000)}});
      socket.send(text.slice(0,35000),{fin:false});socket.send(text.slice(35000),{fin:true});
    });
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert(address && typeof address!=='string');
  const client=new FlyrailClient({daemonUrl:`ws://127.0.0.1:${address.port}`,token:'fixture-token',discoveryPaths:[],requestTimeoutMs:100});
  try {
    const results=await Promise.all([client.call('first'),client.call('second')]) as {method:string,value:string}[];
    assert.equal(connections,1);assert.deepEqual(results.map(r=>r.method),['first','second']);assert(results.every(r=>r.value.length===70000));
    await assert.rejects(client.call('hang'),/timed out/);
  } finally {client.disconnect();for(const socket of wss.clients)socket.terminate();await new Promise<void>(resolve=>wss.close(()=>resolve()));await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
