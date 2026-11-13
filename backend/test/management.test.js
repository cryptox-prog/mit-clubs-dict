import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createApp } from '../app.js';
import { createTokens } from '../utils/tokens.js';
import { createAuthDatabase } from '../test-support/authDatabase.js';

test('management permissions, atomic edits, assignments, versions and normalized uploads', async () => {
  const fixture = await createAuthDatabase();
  const { db, client } = fixture;
  const config = { NODE_ENV: 'test', CORS_ORIGINS: ['http://localhost:5173'], JWT_SECRET: 'management-test-secret-over-thirty-two-characters', JWT_ISSUER: 'test-api', JWT_AUDIENCE: 'test-web', JWT_ACCESS_TTL_SECONDS: 900 };
  const uploads = new Map();
  client.storage = { from: () => ({ upload: async (key, bytes, options) => { uploads.set(key, { bytes, options }); return { error: null }; } }) };
  let server;
  try {
    // The additive migration must also be safe to run again.
    await db.exec(await readFile(new URL('../../supabase/management.sql', import.meta.url), 'utf8'));
    const admin = randomUUID(), manager = randomUUID(), student = randomUUID();
    const tokens = {};
    for (const [role, id] of Object.entries({ admin, manager, student })) {
      const sid = randomUUID();
      await db.query('insert into public.users(id,email,password_hash) values($1,$2,$3)', [id, `${role}@example.com`, '$argon2id$test']);
      await db.query("insert into public.auth_sessions(id,user_id,expires_at) values($1,$2,now()+interval '1 day')", [sid,id]);
      tokens[role] = createTokens(config).sign(id,sid);
    }
    await db.query('insert into public.app_admins(user_id) values($1)', [admin]);
    const club = randomUUID(), other = randomUUID(), project = randomUUID(), independent = randomUUID(), event = randomUUID();
    for (const id of [club,other]) await db.query("insert into public.clubs(id,name,club_kind) values($1,$2,'Technical')", [id,id===club?'Managed club':'Other club']);
    await db.query("insert into public.student_projects(id,title,club_id) values($1,'Linked project',$2),($3,'Independent project',null)", [project,club,independent]);
    await db.query("insert into public.events(id,title,club_id) values($1,'Linked event',$2)", [event,club]);
    const domain = randomUUID();
    await db.query("insert into public.domains(id,name) values($1,'Engineering')", [domain]);
    server = await new Promise((resolve,reject) => { const s=createApp({config,supabase:client}).listen(0,'127.0.0.1',()=>resolve(s)); s.once('error',reject); });
    const base = `http://127.0.0.1:${server.address().port}/api/manage`;
    const request = (role, path, method='GET', body, extra={}) => fetch(base+path,{method,headers:{...(role ? {Authorization:`Bearer ${tokens[role]}`} : {}),'X-Requested-With':'mit-clubs-web',...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...extra},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)})});
    const dashboard = async role => { const res=await request(role,'/dashboard'); assert.equal(res.status,200,await res.clone().text()); assert.equal(res.headers.get('cache-control'),'no-store'); return res.json(); };
    const assign = (kind,id,email,assign=true,role='admin') => request(role,`/${kind}/${id}/managers`,'PUT',{email,assign});
    const row = async () => (await dashboard('manager')).listings.find(x=>x.id===club);
    const patch = listing => ({expected_updated_at:listing.updated_at,name:'Updated club',description:'Managed description',club_kind:'Technical',application_start:null,registration_deadline:null,apply_link:null,domain_ids:[domain],year_group_ids:[1,2]});
    assert.equal((await request(null,'/dashboard')).status,401);
    assert.equal((await dashboard('student')).listings.length,0);
    assert.equal((await dashboard('admin')).listings.length,5);
    assert.equal((await assign('clubs',club,'manager@example.com',true,'student')).status,403);
    assert.equal((await assign('clubs',club,'missing@example.com')).status,404);
    assert.equal((await assign('clubs',club,'manager@example.com')).status,204);
    assert.deepEqual((await dashboard('manager')).listings.map(x=>x.id).sort(),[club,project,event].sort());
    assert.equal((await assign('student-projects',independent,'manager@example.com')).status,204);
    assert.equal((await dashboard('manager')).listings.length,4);
    assert.equal((await request('manager',`/clubs/${other}`,'PATCH',{})).status,403);
    assert.equal((await request('manager',`/clubs/${club}/managers`)).status,403);
    const assignmentList = await (await request('admin',`/clubs/${club}/managers`)).json();
    assert.equal(assignmentList.data[0].email,'manager@example.com');
    assert.equal(assignmentList.data[0].password_hash,undefined);
    let listing = await row();
    const initial = patch(listing);
    assert.equal((await request('manager',`/clubs/${club}`,'PATCH',{...initial,club_id:other})).status,400);
    assert.equal((await request('manager',`/clubs/${club}`,'PATCH',{...initial,application_start:'2026-11-01'})).status,400);
    assert.equal((await request('manager',`/clubs/${club}`,'PATCH',{...initial,apply_link:'javascript:alert(1)'})).status,400);
    assert.equal((await request('manager',`/clubs/${club}`,'PATCH',{...initial,year_group_ids:[1,5]})).status,400);
    assert.equal((await request('manager',`/clubs/${club}`,'PATCH',initial,{'X-Requested-With':''})).status,403);
    // Failed join insertion must roll back the name, version and all filters.
    assert.equal((await request('manager',`/clubs/${club}`,'PATCH',{...initial,domain_ids:[randomUUID()]})).status,400);
    assert.equal((await row()).name,'Managed club');
    assert.equal((await row()).updated_at,listing.updated_at);
    let res=await request('manager',`/clubs/${club}`,'PATCH',initial);
    assert.equal(res.status,200,await res.clone().text());
    assert.equal((await request('manager',`/clubs/${club}`,'PATCH',initial)).status,409);
    listing=await row(); assert.equal(listing.name,'Updated club'); assert.deepEqual(listing.domain_ids,[domain]); assert.deepEqual(listing.year_group_ids.sort(),[1,2]);
    // Exercise all three update branches and inherited permissions.
    for (const kind of ['student-projects','events']) {
      const item=(await dashboard('manager')).listings.find(x=>x.kind===kind);
      const body={...patch(item),name:'Updated '+kind}; delete body.club_kind;
      if(kind==='events')Object.assign(body,{event_start:'2026-11-20T10:00:00+05:30',event_end:'2026-11-20T12:00:00+05:30',participation_type:'TEAM'});
      res=await request('manager',`/${kind}/${item.id}`,'PATCH',body); assert.equal(res.status,200,await res.clone().text());
    }
    const multipart = (bytes,version=listing.updated_at) => { const f=new FormData(); f.set('expected_updated_at',version); f.set('icon',new Blob([bytes],{type:'image/png'}),'logo.png'); return f; };
    assert.equal((await request('student',`/clubs/${club}/icon`,'POST',multipart('bad'))).status,403);
    assert.equal((await request('manager',`/clubs/${club}/icon`,'POST',multipart('bad'))).status,400);
    assert.equal((await request('manager',`/clubs/${club}/icon`,'POST',multipart(Buffer.alloc(5*1024*1024+1)))).status,413);
    assert.equal(uploads.size,0);
    const bytes=await sharp({create:{width:800,height:400,channels:4,background:'#ff0044'}}).png().toBuffer();
    res=await request('manager',`/clubs/${club}/icon`,'POST',multipart(bytes)); assert.equal(res.status,200,await res.clone().text());
    const [key,file]=[...uploads.entries()][0];
    assert.match(key,new RegExp(`^clubs/${club}/[a-f0-9]{64}\\.png$`));
    const meta=await sharp(file.bytes).metadata(); assert.equal(meta.width,512); assert.equal(meta.height,256); assert.equal(file.options.contentType,'image/png');
    assert.equal((await db.query('select icon_path from public.clubs where id=$1',[club])).rows[0].icon_path,key);
    const fresh=await row(); assert.ok(fresh.icon_url.includes('?v=')); assert.equal(fresh.icon_path,undefined);
    assert.equal((await request('manager',`/clubs/${club}/icon`,'POST',multipart(bytes))).status,409);
    assert.equal((await assign('clubs',club,'manager@example.com',false)).status,204);
    assert.equal((await request('manager',`/clubs/${club}`,'PATCH',patch(fresh))).status,403);
    assert.deepEqual((await dashboard('manager')).listings.map(x=>x.id),[independent]);
    for(const role of ['anon','authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select public.manager_dashboard($1)',[admin]),/permission denied/);
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    try { const result=await client.rpc('manager_dashboard',{p_actor:admin}); assert.equal(result.error,null); assert.equal(result.data.listings.length,5); }
    finally { await db.exec('reset role'); }
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await fixture.close();
  }
});
