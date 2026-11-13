import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { createApp } from '../app.js';
import { createAuthMiddleware } from '../middleware/auth.js';
import { createAuthDatabase } from '../test-support/authDatabase.js';
import { hashToken } from '../utils/tokens.js';
const config={NODE_ENV:'test',CORS_ORIGINS:['http://localhost:5173'],JWT_SECRET:'test-only-secret-at-least-thirty-two-characters',JWT_ISSUER:'test-api',JWT_AUDIENCE:'test-web',JWT_ACCESS_TTL_SECONDS:900,AUTH_SESSION_DAYS:30};
let fixture, counter=0;
before(async()=>{fixture=await createAuthDatabase()});
after(async()=>{await fixture?.close()});
const bearer=token=>({Authorization:`Bearer ${token}`});
async function withApp(run,customConfig=config){
 const app=createApp({config:customConfig,supabase:fixture.client});
 const server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',error=>error?reject(error):resolve(s));s.once('error',reject)});
 const base=`http://127.0.0.1:${server.address().port}`;
 const post=(route,data={},headers={})=>fetch(base+'/api/auth'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Requested-With':'mit-clubs-web',Origin:'http://localhost:5173',...headers},body:JSON.stringify(data)});
 const me=token=>fetch(base+'/api/auth/me',{headers:bearer(token)});
 const signup=async()=>{
  const email=`auth-${++counter}@example.com`;
  const res=await post('/signup',{email,password:'correct horse battery staple',full_name:'Test Student',year_group_id:2});
  assert.equal(res.status,201,await res.clone().text());
  return {body:await res.json(),cookie:res.headers.get('set-cookie').split(';')[0],email};
 };
 try{await run({post,me,signup,base})}finally{await new Promise(resolve=>server.close(resolve))}
}
test('signup hashes passwords/tokens, exposes safe fields, and login sets protected cookies',async()=>{
 await withApp(async({post,me,signup})=>{
  const account=await signup(), raw=account.cookie.split('=')[1];
  assert.equal(account.body.refreshToken,undefined);assert.equal(account.body.user.password_hash,undefined);
  const stored=(await fixture.db.query('select password_hash from public.users where email=$1',[account.email])).rows[0];
  assert.match(stored.password_hash,/^\$argon2id\$/);
  assert.equal((await fixture.db.query('select token_hash from public.refresh_tokens where token_hash=$1',[hashToken(raw)])).rows[0].token_hash.length,64);
  const info=await me(account.body.accessToken);assert.equal(info.status,200);
  const user=(await info.json()).user;assert.equal(user.is_admin,false);assert.deepEqual(user.managed_club_ids,[]);
  const login=await post('/login',{email:account.email.toUpperCase(),password:'correct horse battery staple'});
  assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly/);assert.match(login.headers.get('set-cookie'),/SameSite=Lax/);assert.match(login.headers.get('set-cookie'),/Path=\/api\/auth/);assert.equal(login.headers.get('cache-control'),'no-store');
 });
});
test('wrong passwords and unknown emails are indistinguishable; role injection is rejected',async()=>{
 await withApp(async({post,signup})=>{
  const account=await signup();
  for(const email of [account.email,'missing@example.com']){const res=await post('/login',{email,password:'wrong password'});assert.equal(res.status,401);assert.equal((await res.json()).error.message,'Invalid email or password')}
  assert.equal((await post('/signup',{email:'bad@example.com',password:'long enough password',full_name:'Name',is_admin:true})).status,400);
  assert.equal((await post('/signup',{email:'bad@example.com',password:'short',full_name:'Name'})).status,400);
  assert.equal((await post('/signup',{email:account.email,password:'long enough password',full_name:'Name'})).status,409);
 });
});
test('refresh rotation commits replay revocation and invalidates access JWTs immediately',async()=>{
 await withApp(async({post,me,signup})=>{
  const account=await signup();
  const res=await post('/refresh',{}, {Cookie:account.cookie});assert.equal(res.status,200);
  const cookie=res.headers.get('set-cookie').split(';')[0];assert.notEqual(cookie,account.cookie);
  const token=(await res.json()).accessToken;
  assert.equal((await post('/refresh',{}, {Cookie:account.cookie})).status,401);
  assert.equal((await post('/refresh',{}, {Cookie:cookie})).status,401);
  assert.equal((await me(token)).status,401);
 });
});
test('logout and logout-all revoke server sessions',async()=>{
 await withApp(async({post,me,signup})=>{
  const a=await signup();assert.equal((await post('/logout',{}, {Cookie:a.cookie})).status,204);assert.equal((await me(a.body.accessToken)).status,401);
  const one=await post('/login',{email:a.email,password:'correct horse battery staple'}),two=await post('/login',{email:a.email,password:'correct horse battery staple'});
  const t1=(await one.json()).accessToken,t2=(await two.json()).accessToken;
  assert.equal((await post('/logout-all',{},bearer(t1))).status,204);
  assert.equal((await me(t1)).status,401);assert.equal((await me(t2)).status,401);
 });
});
test('JWT signature, algorithm, audience, and expiry are checked',async()=>{
 await withApp(async({me,signup})=>{
  const a=await signup(),claims=jwt.decode(a.body.accessToken);
  const payload={sid:claims.sid,token_use:'access'},opts={subject:claims.sub,issuer:config.JWT_ISSUER,audience:config.JWT_AUDIENCE,expiresIn:900};
  const invalid=[a.body.accessToken+'bad',jwt.sign(payload,config.JWT_SECRET,{...opts,expiresIn:-10}),jwt.sign(payload,config.JWT_SECRET,{...opts,audience:'wrong'}),jwt.sign(payload,'',{...opts,algorithm:'none'})];
  for(const token of invalid)assert.equal((await me(token)).status,401);
 });
});
test('disabled users and expired sessions are refused',async()=>{
 await withApp(async({post,me,signup})=>{
  const a=await signup();await fixture.db.query('update public.users set disabled_at=now() where id=$1',[a.body.user.id]);
  assert.equal((await me(a.body.accessToken)).status,401);assert.equal((await post('/refresh',{}, {Cookie:a.cookie})).status,401);assert.equal((await post('/login',{email:a.email,password:'correct horse battery staple'})).status,401);
  const b=await signup();await fixture.db.query("update public.auth_sessions set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where user_id=$1",[b.body.user.id]);
  assert.equal((await me(b.body.accessToken)).status,401);assert.equal((await post('/refresh',{}, {Cookie:b.cookie})).status,401);
 });
});
test('custom header and Origin guard writes; repeated logins are rate limited',async()=>{
 await withApp(async({base,post})=>{
  assert.equal((await fetch(base+'/api/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,403);
  assert.equal((await post('/refresh',{}, {Origin:'https://untrusted.example'})).status,403);
  for(let n=0;n<20;n++)assert.equal((await post('/login',{email:'rate@example.com',password:'wrong'})).status,401);
  assert.equal((await post('/login',{email:'rate@example.com',password:'wrong'})).status,429);
 });
});
test('production cookies use the Secure prefix',async()=>{
 await withApp(async({signup})=>{assert.ok((await signup()).cookie.startsWith('__Secure-mit_refresh='))},{...config,NODE_ENV:'production',AUTH_COOKIE_SECURE:true});
});
test('RPC execution is service-role-only and failed account creation is atomic',async()=>{
 for(const role of ['anon','authenticated']){await fixture.db.exec(`set role ${role}`);await assert.rejects(fixture.db.query("select public.auth_rotate_refresh('old','new')"),/permission denied/);await fixture.db.exec('reset role')}
 const email='rollback@example.com';
 await assert.rejects(fixture.db.query('select public.auth_create_account($1,$2,$3,null,$4,$5,$6)',[email,'$argon2id$test','Name',randomUUID(),'invalid-hash',new Date(Date.now()+86400000).toISOString()]));
 assert.equal((await fixture.db.query('select id from public.users where email=$1',[email])).rows.length,0);
});
test('role middleware denies students and recognizes assigned managers/admins',async()=>{
 const {requireAdmin,requireClubManager}=createAuthMiddleware(fixture.client,config),id=randomUUID(),clubId=randomUUID();
 await fixture.db.query('insert into public.users(id,email,password_hash) values($1,$2,$3)',[id,'roles@example.com','$argon2id$test']);
 await fixture.db.query("insert into public.clubs(id,name,club_kind) values($1,'Test club','Technical')",[clubId]);
 const req={auth:{user:{id}},params:{clubId}};
 await assert.rejects(requireAdmin(req,{},()=>{}),e=>e.statusCode===403);await assert.rejects(requireClubManager(req,{},()=>{}),e=>e.statusCode===403);
 await fixture.db.query('insert into public.club_managers(club_id,user_id) values($1,$2)',[clubId,id]);let passed=false;await requireClubManager(req,{},()=>{passed=true});assert.ok(passed);
 await fixture.db.query('insert into public.app_admins(user_id) values($1)',[id]);passed=false;await requireAdmin(req,{},()=>{passed=true});assert.ok(passed);
});

test('failed refresh insertion rolls back consumption; concurrent reuse revokes the family',async()=>{
 await withApp(async({post,me,signup})=>{
  const a=await signup(),raw=a.cookie.split('=')[1];
  const failed=await fixture.client.rpc('auth_rotate_refresh',{p_old_hash:hashToken(raw),p_new_hash:'invalid-hash'});
  assert.ok(failed.error);
  const row=(await fixture.db.query('select consumed_at from public.refresh_tokens where token_hash=$1',[hashToken(raw)])).rows[0];
  assert.equal(row.consumed_at,null);
  const responses=await Promise.all([post('/refresh',{}, {Cookie:a.cookie}),post('/refresh',{}, {Cookie:a.cookie})]);
  assert.deepEqual(responses.map(r=>r.status).sort(),[200,401]);
  assert.equal((await me(a.body.accessToken)).status,401);
 });
});
test('service_role can execute auth RPCs using the actual schema grants',async()=>{
 await fixture.db.exec('set role service_role');
 try{
  const result=await fixture.client.rpc('auth_create_account',{
   p_email:'service-role@example.com',p_password_hash:'$argon2id$test',p_full_name:'Service Role Test',p_year_group_id:null,
   p_session_id:randomUUID(),p_refresh_hash:'f'.repeat(64),p_expires_at:new Date(Date.now()+86400000).toISOString(),
  });
  assert.equal(result.error,null);assert.ok(result.data.id);
 }finally{await fixture.db.exec('reset role')}
});
