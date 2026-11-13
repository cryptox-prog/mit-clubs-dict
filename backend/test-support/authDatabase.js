// Embedded PostgreSQL integration fixture. Never connects to the hosted project.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

export async function createAuthDatabase() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create table storage.buckets(id text primary key,name text unique,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
    alter table storage.objects enable row level security;
    alter table storage.buckets enable row level security;
  `);
  await db.exec(await readFile(new URL('../../supabase/init.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/auth_functions.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/management.sql', import.meta.url), 'utf8'));
  const tables = new Set(['users', 'auth_sessions', 'refresh_tokens', 'app_admins', 'club_managers', 'project_managers']);
  const functions = new Set(['auth_create_account', 'auth_create_session', 'auth_rotate_refresh', 'auth_revoke_refresh', 'directory_can_manage', 'manager_dashboard', 'manager_update_listing', 'manager_set_icon', 'manager_assignments', 'manager_set_assignment']);
  const sqlError = error => ({ data: null, error: { code: error.code, message: error.message } });
  const client = {
    async rpc(name, args) {
      if (!functions.has(name)) throw new Error('Unexpected test RPC');
      try {
        const keys = Object.keys(args);
        const named = keys.map((key, i) => `${key} => $${i+1}`).join(',');
        const result = await db.query(`select to_jsonb(public.${name}(${named})) as data`, Object.values(args));
        return { data: result.rows[0].data, error: null };
      } catch (error) { return sqlError(error); }
    },
    from(table) {
      if (!tables.has(table)) throw new Error(`Unexpected test table ${table}`);
      let columns = '', updates = null, single = false;
      const conditions = [];
      const builder = {
        select(value) { columns = value; return builder; },
        update(value) { updates = value; return builder; },
        eq(field, value) { if (!/^[a-z_]+$/.test(field)) throw new Error('Unsafe test field'); conditions.push([field,value]); return builder; },
        maybeSingle() { single = true; return builder; },
        async then(resolve, reject) {
          try {
            const values = [];
            const params = value => { values.push(value); return '$'+values.length; };
            let sql;
            const sessionJoin = columns.includes('user:users');
            const where = () => conditions.length ? ' where '+conditions.map(([field,value]) => `${sessionJoin?'s.':''}${field}=${params(value)}`).join(' and ') : '';
            if (updates) {
              sql = `update public.${table} set ${Object.entries(updates).map(([field,value])=>`${field}=${params(value)}`).join(',')}${where()}`;
            } else if (sessionJoin) {
              sql = `select s.id,s.user_id,s.expires_at,s.revoked_at,to_jsonb(u) as "user" from public.auth_sessions s join public.users u on u.id=s.user_id${where()}`;
            } else {
              if (!/^[a-z_,]+$/.test(columns)) throw new Error('Unsafe test projection');
              sql = `select ${columns} from public.${table}${where()}`;
            }
            const result = await db.query(sql, values);
            return resolve({ data: single ? result.rows[0] ?? null : result.rows, error: null });
          } catch (error) { if (resolve) return resolve(sqlError(error)); return reject(error); }
        },
      };
      return builder;
    },
  };
  return { db, client, close: () => db.close() };
}
