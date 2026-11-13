import http from 'node:http';
import { readFile,writeFile,access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseEnv } from 'node:util';
const dir=resolve(process.argv[2]),plan=JSON.parse(await readFile(resolve(dir,'plan.json'),'utf8'));
const {port}=JSON.parse(await readFile(resolve(dir,'server-ready.json'),'utf8'));
let randomState=1192026;function random(){randomState=(Math.imul(1664525,randomState)+1013904223)>>>0;return randomState/4294967296}
const pick=items=>items[Math.floor(random()*items.length)];
const categories=['clubs','student-projects','events'];const catalogs=new Map();
const stats={runId:plan.runId,stages:[],sampledAnalyticsEvents:0,analyticsAccepted:0,analyticsFailed:0,stopReason:null};
let rootEnv={};try{rootEnv=parseEnv(await readFile(new URL('../../../.env',import.meta.url),'utf8'))}catch{}
const analytics=[];let nextRequest=performance.now(),active=0,maxActive=0,totalBytes=0,totalRequests=0;const inflightWaiters=[];
const metricsFile=resolve(dir,'progress.json');
function source(id){return `127.${1+Math.floor(id/64516)%250}.${1+Math.floor(id/254)%254}.${1+id%254}`}
async function stopped(){if(stats.stopReason)return true;try{await access(resolve(dir,'STOP'));stats.stopReason='supervisor requested stop';return true}catch{}return false}
async function gate(rps){
 while(active>=plan.maxInFlight)await new Promise(resolve=>inflightWaiters.push(resolve));
 const at=Math.max(performance.now(),nextRequest);nextRequest=at+1000/rps;active++;maxActive=Math.max(maxActive,active);
 await sleep(Math.max(0,at-performance.now())*(0.85+random()*0.3));
}
function release(){active--;inflightWaiters.splice(0).forEach(resolve=>resolve())}
async function request(path,id,stage,{method='GET',body,readJson=false,expected401=false}={}){
 if(await stopped())return null;
 await gate(stage.rps);
 const start=performance.now();stage.startedRequests++;totalRequests++;
 try{return await new Promise(resolve=>{
  const req=http.request({hostname:'127.0.0.1',port,path,method,localAddress:source(id),agent:false,headers:{'User-Agent':'mit-clubs-bounded-load-test','Connection':'close',...(body?{'Content-Type':'application/json','X-Requested-With':'mit-clubs-web','Content-Length':Buffer.byteLength(body)}:{})}},res=>{
   let size=0;const chunks=[];res.on('data',chunk=>{size+=chunk.length;if(readJson)chunks.push(chunk);if(size>6*1024*1024)req.destroy()});res.on('end',()=>{
    totalBytes+=size;stage.bytes+=size;stage.statuses[res.statusCode]=(stage.statuses[res.statusCode]??0)+1;
    const elapsed=performance.now()-start;stage.latencies.push(elapsed);
    const ok=res.statusCode===200||(expected401&&res.statusCode===401);if(!ok){stage.errors++;stage.consecutiveErrors++}else stage.consecutiveErrors=0;
    if(stage.consecutiveErrors>=15)stats.stopReason='15 consecutive unexpected HTTP responses';
    if(stage.startedRequests>=100&&stage.errors/stage.startedRequests>0.08)stats.stopReason='unexpected HTTP error rate exceeded 8%';
    if(totalRequests>=plan.maxClientRequests)stats.stopReason='client request budget reached';
    if(totalBytes>=plan.maxClientBytes)stats.stopReason='download budget reached';
    try{resolve({status:res.statusCode,headers:res.headers,bytes:size,data:readJson?JSON.parse(Buffer.concat(chunks).toString()):null})}catch{stage.errors++;resolve(null)}
   });res.on('error',()=>resolve(null));
  });
  req.setTimeout(15000,()=>req.destroy(new Error('timeout')));
  req.on('error',()=>{stage.transportErrors++;stage.errors++;stage.consecutiveErrors++;resolve(null)});
  if(body)req.write(body);req.end();
 })}finally{release()}
}
function event(name,id,stage,properties={}){stage.modeledAnalyticsEvents++;if(id%100!==0||analytics.length+stats.sampledAnalyticsEvents>=plan.maxAnalyticsEvents)return;analytics.push({event:name,distinct_id:`loadtest:${plan.runId}:${id}`,timestamp:new Date().toISOString(),properties:{...properties,load_test:true,load_test_run_id:plan.runId,load_test_stage:stage.targetUsers,$process_person_profile:false,$geoip_disable:true}})}
async function flushAnalytics(){
 const batch=analytics.splice(0);if(!batch.length)return;
 stats.sampledAnalyticsEvents+=batch.length;
 if(!rootEnv.VITE_POSTHOG_KEY){stats.analyticsFailed+=batch.length;return}
 try{const r=await fetch(`${rootEnv.VITE_POSTHOG_HOST}/batch/`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:rootEnv.VITE_POSTHOG_KEY,batch}),signal:AbortSignal.timeout(10000)});if(r.ok)stats.analyticsAccepted+=batch.length;else stats.analyticsFailed+=batch.length}catch{stats.analyticsFailed+=batch.length}
}
async function visit(id,stage){
 stage.startedUsers++;stage.activeUsers++;stage.peakActiveUsers=Math.max(stage.peakActiveUsers,stage.activeUsers);
 const warm=random()<0.35;const cache=new Set();const localCatalogs=new Set(warm?['clubs']:[]);
 if(warm)stage.returningWarmUsers++;else stage.coldUsers++;
 let aborted=false;
 try{
  event('$pageview',id,stage);event('directory_tab_viewed',id,stage,{category:'Clubs'});
  await request('/api/auth/refresh',id,stage,{method:'POST',body:'{}',expected401:true});
  async function browse(category){
   let items=catalogs.get(category)??[];
   if(!localCatalogs.has(category)){
    const res=await request(`/api/${category}?page=1&limit=200`,id,stage,{readJson:true});if(!res||res.status!==200){aborted=true;return}
    items=res.data.data;localCatalogs.add(category);catalogs.set(category,items);
   }else stage.directoryCacheHits++;
   const visible=items.filter(item=>item.icon_url).slice(0,2+Math.floor(random()*3));
   for(const item of visible){if(await stopped()){aborted=true;return}if(warm||cache.has(item.icon_url)){stage.iconCacheHits++;continue}await request(item.icon_url,id,stage);cache.add(item.icon_url)}
   await sleep(300+random()*1200);
   if(random()<0.55){event('directory_searched',id,stage,{category,query_length:3+Math.floor(random()*8),result_count:Math.floor(random()*5)});await sleep(700+random()*1000)}
   if(random()<0.3){event('directory_filters_changed',id,stage,{category,filter_count:1+Math.floor(random()*2)});await sleep(300+random()*1000)}
   if(random()<0.35){for(const item of items.filter(item=>item.icon_url).slice(5,7)){if(warm||cache.has(item.icon_url)){stage.iconCacheHits++;continue}await request(item.icon_url,id,stage);cache.add(item.icon_url)}}
  }
  await browse('clubs');
  if(random()<0.3&&!await stopped()){event('directory_tab_viewed',id,stage,{category:'Student Projects'});await browse('student-projects')}
  if(random()<0.1&&!await stopped()){event('directory_tab_viewed',id,stage,{category:'Events'});await browse('events')}
  if(random()<0.2){stage.directoryCacheHits++;stage.iconCacheHits+=2}
  if(!aborted&&!await stopped())stage.completedUsers++;else stage.abortedUsers++;
 }finally{stage.activeUsers--}
}
function percentile(values,p){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return Math.round(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]*100)/100}
async function save(){const safe={...stats,totalRequests,totalBytes,maxActiveRequests:maxActive,rssBytes:process.memoryUsage().rss,stages:stats.stages.map(({latencies,...s})=>({...s,p50Ms:percentile(latencies,0.5),p95Ms:percentile(latencies,0.95),p99Ms:percentile(latencies,0.99)}))};await writeFile(metricsFile,JSON.stringify(safe,null,2));return safe}
const progress=setInterval(()=>{void save()},2000);
let offset=0;
try{
 for(const config of plan.stages){if(await stopped())break;
  const stage={...config,startedAt:new Date().toISOString(),startedUsers:0,completedUsers:0,abortedUsers:0,activeUsers:0,peakActiveUsers:0,startedRequests:0,statuses:{},errors:0,transportErrors:0,consecutiveErrors:0,bytes:0,latencies:[],returningWarmUsers:0,coldUsers:0,directoryCacheHits:0,iconCacheHits:0,modeledAnalyticsEvents:0};stats.stages.push(stage);const start=performance.now();let nextUser=0;
  const workers=Array.from({length:Math.min(config.workers,config.targetUsers)},async(_,worker)=>{
   await sleep(worker/config.workers*config.rampSeconds*1000);
   while(nextUser<config.targetUsers&&!await stopped()){
    if(performance.now()-start>config.maxSeconds*1000){stats.stopReason=`${config.targetUsers}-visitor stage reached its time budget`;break}
    const id=offset+(nextUser++);await visit(id,stage);await sleep(200+random()*700);
   }
  });
  await Promise.all(workers);offset+=config.targetUsers;stage.durationSeconds=Math.round((performance.now()-start)/10)/100;stage.finishedAt=new Date().toISOString();await flushAnalytics();
  const server=JSON.parse(await readFile(resolve(dir,'server-metrics.json'),'utf8'));if(server.budgetStopped)stats.stopReason='Supabase upstream budget reached';
  await save();console.log(JSON.stringify({stage:stage.targetUsers,completed:stage.completedUsers,requests:stage.startedRequests,p95Ms:percentile(stage.latencies,0.95),stopReason:stats.stopReason}));
  if(!await stopped())await sleep(3000);
 }
}catch{stats.stopReason??='tester encountered an unexpected error';process.exitCode=1}
finally{clearInterval(progress);await flushAnalytics();const report=await save();await writeFile(resolve(dir,'results.json'),JSON.stringify(report,null,2));console.log('Load-test results saved')}
