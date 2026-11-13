import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from 'redis';
import { createRateLimitStore } from '../config/redis.js';
import { createApp } from '../app.js';

// Explicit executable opt-in: this test only starts its own disposable Redis.
test('real Redis shares HTTP limits, reloads scripts, fails closed and reconnects', { skip: !process.env.REDIS_TEST_SERVER }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'mit-rate-limits-'));
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0,'127.0.0.1',resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  let redis, inspector;
  const stores = [], servers = [];
  async function startRedis() {
    redis = spawn(process.env.REDIS_TEST_SERVER, ['--bind','127.0.0.1','--port',String(port),'--save','','--appendonly','no','--dir',dir], { stdio: ['ignore','pipe','pipe'] });
    await new Promise((resolve,reject) => {
      const timer=setTimeout(()=>reject(new Error('Test Redis did not start')),10000);
      redis.once('error',error=>{clearTimeout(timer);reject(error)});
      redis.once('exit',code=>{clearTimeout(timer);reject(new Error(`Test Redis exited: ${code}`))});
      redis.stdout.on('data',data=>{if(data.toString().includes('Ready to accept connections')){clearTimeout(timer);resolve()}});
    });
  }
  const config = { NODE_ENV:'test', CORS_ORIGINS:['http://localhost:5173'], REDIS_URL:`redis://127.0.0.1:${port}`, JWT_SECRET:'redis-test-only-secret-more-than-thirty-two-characters', JWT_ISSUER:'test', JWT_AUDIENCE:'test', JWT_ACCESS_TTL_SECONDS:900 };
  const database = { from() {
    const builder = { select:()=>builder,eq:()=>builder,order:()=>builder,range:()=>builder,limit:()=>builder,
      maybeSingle:async()=>({data:null,error:null}),abortSignal:async()=>({data:[],count:0,error:null}) };
    return builder;
  } };
  try {
    await startRedis();
    inspector=createClient({url:config.REDIS_URL}); inspector.on('error',()=>{}); await inspector.connect();
    for(let n=0;n<2;n++) {
      const limits=await createRateLimitStore(config);stores.push(limits);
      const server=await new Promise((resolve,reject)=>{const s=createApp({config,supabase:database,authStoreFactory:limits.storeFactory,readinessCheck:limits.check}).listen(0,'127.0.0.1',()=>resolve(s));s.once('error',reject)});
      servers.push(server);
    }
    const url = index => `http://127.0.0.1:${servers[index].address().port}`;
    const login = index => fetch(url(index)+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'mit-clubs-web'},body:JSON.stringify({email:'missing@example.com',password:'wrong test password'})});
    for(let n=0;n<20;n++)assert.equal((await login(n%2)).status,401);
    const denied=await login(1);assert.equal(denied.status,429);assert.ok(denied.headers.get('retry-after'));assert.ok(denied.headers.get('ratelimit'));
    assert.equal((await fetch(url(0)+'/api/clubs')).status,200);
    const [key]=await inspector.keys('mit-clubs:auth:directory:*');assert.ok(key);assert.ok(await inspector.pTTL(key)>0);
    await inspector.set(key,'600',{PX:900000});
    assert.equal((await fetch(url(1)+'/api/student-projects')).status,429);
    await inspector.del(key);await inspector.scriptFlush();
    assert.equal((await fetch(url(0)+'/api/clubs')).status,200);
    assert.equal((await fetch(url(0)+'/api/health/ready')).status,200);
    inspector.destroy();inspector=null;
    const stopped=once(redis,'exit');redis.kill('SIGTERM');await stopped;
    assert.equal((await fetch(url(0)+'/api/health')).status,200);
    assert.equal((await fetch(url(0)+'/api/health/ready')).status,503);
    const unavailable=await fetch(url(0)+'/api/clubs');assert.equal(unavailable.status,503);assert.ok(!(await unavailable.text()).includes(config.REDIS_URL));
    await startRedis();
    let ready=false;
    for(let n=0;n<80;n++){try{await stores[0].check();await stores[1].check();ready=true;break}catch{await delay(100)}}
    assert.ok(ready,'Redis clients should reconnect automatically');
    assert.equal((await fetch(url(1)+'/api/clubs')).status,200);
    assert.equal((await fetch(url(0)+'/api/health/ready')).status,200);
  } finally {
    for(const server of servers)await new Promise(resolve=>server.close(resolve));
    for(const store of stores)await store.close();
    if(inspector?.isOpen)inspector.destroy();
    if(redis && redis.exitCode===null){const stopped=once(redis,'exit');redis.kill('SIGTERM');await stopped}
    await rm(dir,{recursive:true,force:true});
  }
});
