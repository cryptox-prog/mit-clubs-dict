// Dedicated, read-only load-test listener. Production application code is unchanged.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { createClient } from '@supabase/supabase-js';
import { parseEnv } from '../../config/env.js';
import { createRateLimitStore } from '../../config/redis.js';
import { createApp } from '../../app.js';
const dir=resolve(process.argv[2]);
const plan=JSON.parse(await readFile(resolve(dir,'plan.json'),'utf8'));
const config=parseEnv(process.env);
const metrics={runId:plan.runId,upstreamRequests:0,upstreamBytes:0,upstreamErrors:0,budgetStopped:false,inFlight:0,maxInFlight:0};
const delay=monitorEventLoopDelay({resolution:20});delay.enable();
const realFetch=globalThis.fetch;
const instrumentedFetch=async(input,options={})=>{
 const url=new URL(typeof input==='string'?input:input.url??input.href);
 if(url.origin!==new URL(config.SUPABASE_URL).origin||!['GET','HEAD'].includes(options.method??'GET'))throw new Error('Load test permits Supabase reads only');
 if(metrics.upstreamRequests>=plan.maxUpstreamRequests||metrics.upstreamBytes>=plan.maxUpstreamBytes){metrics.budgetStopped=true;throw new Error('Cloud test budget reached')}
 if(metrics.inFlight>=16)throw new Error('Load-test upstream concurrency cap');
 metrics.upstreamRequests++;metrics.inFlight++;metrics.maxInFlight=Math.max(metrics.maxInFlight,metrics.inFlight);
 try{
  const response=await realFetch(input,{...options,signal:options.signal??AbortSignal.timeout(12000)});
  const chunks=[];let size=0;
  if(response.body)for await(const chunk of response.body){size+=chunk.length;metrics.upstreamBytes+=chunk.length;
   if(size>6*1024*1024||metrics.upstreamBytes>plan.maxUpstreamBytes){metrics.budgetStopped=true;throw new Error('Cloud byte budget reached')}
   chunks.push(chunk);
  }
  if(!response.ok)metrics.upstreamErrors++;
  const headers=new Headers(response.headers);headers.delete('content-encoding');headers.delete('content-length');
  return new Response([204,205,304].includes(response.status)?null:Buffer.concat(chunks),{status:response.status,statusText:response.statusText,headers});
 }catch(error){metrics.upstreamErrors++;throw error}finally{metrics.inFlight--}
};
const supabase=createClient(config.SUPABASE_URL,config.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},db:{schema:'public'},global:{fetch:instrumentedFetch}});
const limits=await createRateLimitStore(config);
const app=createApp({config,supabase,authStoreFactory:limits.storeFactory?name=>limits.storeFactory(`loadtest:${plan.runId}:${name}`):undefined,readinessCheck:limits.check});
// Actual client source addresses are distinct loopback IPs. No spoofed forwarding headers.
const server=app.listen(0,'127.0.0.1',async()=>{await writeFile(resolve(dir,'server-ready.json'),JSON.stringify({pid:process.pid,port:server.address().port,redis:Boolean(config.REDIS_URL)}));console.log('Isolated load-test listener ready')});
server.maxConnections=64;server.requestTimeout=15000;server.headersTimeout=16000;
let previous=process.cpuUsage(),previousTime=performance.now();
async function snapshot(){const now=performance.now(),cpu=process.cpuUsage();const memory=process.memoryUsage();Object.assign(metrics,{rssBytes:memory.rss,heapBytes:memory.heapUsed,eventLoopP99Ms:delay.percentile(99)/1e6,cpuPercent:((cpu.user-previous.user+cpu.system-previous.system)/1000)/(now-previousTime)*100});previous=cpu;previousTime=now;delay.reset();await writeFile(resolve(dir,'server-metrics.json'),JSON.stringify(metrics));}
const timer=setInterval(()=>{void snapshot()},1000);await snapshot();
let closing=false;async function shutdown(){if(closing)return;closing=true;clearInterval(timer);server.closeIdleConnections();server.close(async()=>{await snapshot();await limits.close();delay.disable()});setTimeout(()=>process.exit(0),5000).unref()}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
