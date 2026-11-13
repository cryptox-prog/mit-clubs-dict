// Linux/systemd supervisor: hard limits are enforced by cgroups, not just Node heap.
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir,readFile,writeFile,open,access } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
const exec=promisify(execFile),root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const runId=new Date().toISOString().replace(/[^0-9]/g,'').slice(0,14);
const dir=resolve(root,'docs/load-tests',runId);await mkdir(dir,{recursive:true});
const plan={runId,mode:'gradual-total-visitors',seed:1192026,maxInFlight:12,maxUpstreamRequests:10000,maxUpstreamBytes:128*1024*1024,maxClientRequests:20000,maxClientBytes:144*1024*1024,maxAnalyticsEvents:500,minimumHostAvailableMiB:1536,maxRunSeconds:1000,
 stages:[{targetUsers:100,rps:10,workers:20,rampSeconds:10,maxSeconds:140},{targetUsers:1000,rps:18,workers:48,rampSeconds:15,maxSeconds:420},{targetUsers:10000,rps:18,workers:48,rampSeconds:20,maxSeconds:600}],
 caps:{server:{memoryMiB:384,cpuPercent:50,heapMiB:192},tester:{memoryMiB:256,cpuPercent:50,heapMiB:128},swapMiB:0,maxTasksEach:64},
 behavior:{warmReturningFraction:0.35,searchProbability:0.55,filterProbability:0.3,projectsTabProbability:0.3,eventsTabProbability:0.1,scrollProbability:0.35,visibleIcons:'2–4 plus 2 on some scrolls',thinkSeconds:'0.3–3.2 between interactions',analyticsSample:'1 in 100 visitors; load_test=true; at most 500 events'},
 caveats:['Visitor counts are total gradually arriving sessions, not simultaneous users.','Protocol-level browsing model; no browser rendering/JS cost is benchmarked.','Warm visitor caches are an explicit assumption, not measured production behavior.','Search/filter operations are local and do not generate directory requests.','No accounts, listings, or files are created or edited.','Only sampled analytics are sent to PostHog; analytics events are synthetic and tagged.','Cloud remaining monthly usage is not available; this test has its own conservative additive quota.','No inference that 10000 concurrent users are supported is valid.']};
if(process.argv.includes('--continuation')){
 plan.continuationOf='20261113064912';
 plan.maxUpstreamBytes=384*1024*1024;plan.maxClientBytes=400*1024*1024;
 plan.maxRunSeconds=850;
 plan.stages=[{targetUsers:1000,rps:18,workers:48,rampSeconds:15,maxSeconds:450},{targetUsers:10000,rps:18,workers:48,rampSeconds:20,maxSeconds:400}];
}
await writeFile(resolve(dir,'plan.json'),JSON.stringify(plan,null,2));
const units={server:`mit-clubs-load-server-${runId}`,tester:`mit-clubs-load-tester-${runId}`};
const processes={};const samples=[];let stopReason=null,finished=false;
async function json(file){try{return JSON.parse(await readFile(resolve(dir,file),'utf8'))}catch{return null}}
async function unitInfo(unit){try{const{stdout}=await exec('systemctl',['--user','show',unit,'-p','MemoryCurrent','-p','MemoryPeak','-p','CPUUsageNSec','-p','CPUQuotaPerSecUSec','-p','MemoryMax','-p','MemorySwapMax','-p','TasksCurrent','-p','ActiveState','-p','Result']);return Object.fromEntries(stdout.trim().split('\n').map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)]}))}catch{return null}}
async function start(kind,script){const cap=plan.caps[kind],log=await open(resolve(dir,`${kind}.log`),'a');
 const args=['--user',`--unit=${units[kind]}`,'--wait','--pipe','--quiet','--property=MemoryAccounting=yes','--property=CPUAccounting=yes',`--property=MemoryMax=${cap.memoryMiB}M`,'--property=MemorySwapMax=0',`--property=CPUQuota=${cap.cpuPercent}%`,'--property=TasksMax=64','--property=Nice=10','--property=OOMPolicy=kill',`--property=RuntimeMaxSec=${plan.maxRunSeconds+30}`,'--setenv=UV_THREADPOOL_SIZE=2',process.execPath,`--max-old-space-size=${cap.heapMiB}`,resolve(root,script),dir];
 const child=spawn('systemd-run',args,{cwd:root,stdio:['ignore',log.fd,log.fd]});processes[kind]={child,exitCode:null};child.on('exit',code=>{processes[kind].exitCode=code??1});await log.close();return child;
}
async function stop(reason){stopReason??=reason;await writeFile(resolve(dir,'STOP'),stopReason);}
process.on('SIGINT',()=>{void stop('interrupted by user')});process.on('SIGTERM',()=>{void stop('supervisor terminated')});
try{
 // Fail before any load if a user manager cannot enforce actual cgroup limits.
 await exec('systemd-run',['--user','--scope','--quiet','-p','MemoryMax=64M','-p','CPUQuota=10%','/usr/bin/true']);
 await start('server','backend/scripts/load-test/server.js');
 let ready=null;for(let n=0;n<200;n++){ready=await json('server-ready.json');if(ready)break;if(processes.server.exitCode!==null)throw new Error('Test server failed to start');await sleep(100)}
 if(!ready)throw new Error('Test server startup timed out');
 // Refuse memory fallback: this run specifically benchmarks the configured Redis.
 if(!ready.redis)throw new Error('Redis must be configured for this test');
 await start('tester','backend/scripts/load-test/runner.js');
 console.log(JSON.stringify({runId,directory:dir,plan:{targets:plan.stages.map(x=>x.targetUsers),caps:plan.caps,maxUpstreamMiB:plan.maxUpstreamBytes/1048576,maxUpstreamRequests:10000,maxRps:18}}));
 const began=Date.now();let warned=false,serverMissing=0;
 while(processes.tester.exitCode===null){
  const mem=await readFile('/proc/meminfo','utf8');const availableMiB=Number(/MemAvailable:\s+(\d+)/.exec(mem)[1])/1024;
  const [server,tester,progress,live]=await Promise.all([unitInfo(units.server),unitInfo(units.tester),json('progress.json'),json('server-metrics.json')]);
  samples.push({time:new Date().toISOString(),availableMiB:Math.round(availableMiB),server,tester,serverRss:live?.rssBytes,eventLoopP99Ms:live?.eventLoopP99Ms,upstreamRequests:live?.upstreamRequests,upstreamBytes:live?.upstreamBytes});
  if(availableMiB<plan.minimumHostAvailableMiB)await stop('host available memory below 1536 MiB');
  if(Date.now()-began>plan.maxRunSeconds*1000)await stop('overall time budget reached');
  if(live?.budgetStopped)await stop('Supabase upstream budget reached');
  if(processes.server.exitCode!==null)await stop('test server stopped; resource cap or startup failure');
  if(live?.eventLoopP99Ms>1500)serverMissing++;else serverMissing=0;
  if(serverMissing>=5)await stop('server event loop delay exceeded 1.5 seconds for 10 seconds');
  if(progress?.stopReason)await stop(progress.stopReason);
  if(stopReason&&!warned){warned=true;console.log(JSON.stringify({stopping:stopReason}));setTimeout(()=>{void exec('systemctl',['--user','stop',units.tester]).catch(()=>{})},25000).unref()}
  await writeFile(resolve(dir,'resource-samples.json'),JSON.stringify(samples,null,2));
  await sleep(2000);
 }
 finished=true;
}catch(error){await stop(error.message);console.log(JSON.stringify({stopping:error.message}));process.exitCode=1}
finally{
 const before=await unitInfo(units.server);
 for(const unit of Object.values(units))await exec('systemctl',['--user','stop',unit]).catch(()=>{});
 const results=await json('results.json')??await json('progress.json');const server=await json('server-metrics.json');
 const summary={runId,finished,stopReason:stopReason??results?.stopReason??null,plan,results,server,serverUnit:before,testerExitCode:processes.tester?.exitCode,resourcePeaks:{serverMiB:Math.max(0,...samples.map(x=>Number(x.server?.MemoryPeak)||0))/1048576,testerMiB:Math.max(0,...samples.map(x=>Number(x.tester?.MemoryPeak)||0))/1048576,minimumHostAvailableMiB:Math.min(...samples.map(x=>x.availableMiB))}};
 await writeFile(resolve(dir,'summary.json'),JSON.stringify(summary,null,2));
 console.log(JSON.stringify({runId,stages:results?.stages.map(s=>({target:s.targetUsers,completed:s.completedUsers,requests:s.startedRequests,errors:s.errors,p95Ms:s.p95Ms})),stopReason:summary.stopReason,resourcePeaks:summary.resourcePeaks,upstreamMiB:server?.upstreamBytes/1048576,upstreamRequests:server?.upstreamRequests}));
 console.log(`Report data: ${resolve(dir,'summary.json')}`);
}
