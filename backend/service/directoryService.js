import { ApiError } from '../utils/ApiError.js';
import { iconVersion } from '../utils/iconCache.js';

// Allowlist: callers can never choose arbitrary tables or expose private columns.
export const directoryResources = {
  clubs: { table: 'clubs', category: 'Club', label: 'name', prefix: 'club', iconFolder: 'clubs' },
  'student-projects': { table: 'student_projects', category: 'Student Project', label: 'title', prefix: 'project', iconFolder: 'projects' },
  events: { table: 'events', category: 'Event', label: 'title', prefix: 'event', iconFolder: 'events' },
};
const common = 'id,description,icon_path,application_start,registration_deadline,apply_link,updated_at';
function columns(resource) {
  const extra = resource.table === 'clubs' ? 'name,club_kind'
    : resource.table === 'events' ? 'title,host:clubs(name),event_start,event_end,participation_type'
    : 'title,host:clubs(name)';
  return `${common},${extra},domain_links:${resource.prefix}_domains(domain:domains(name)),year_links:${resource.prefix}_open_to(year:year_groups(name))`;
}
function normalize(row, resource, route) {
  return {
    id: row.id,
    name: row[resource.label],
    category: resource.category,
    description: row.description,
    club_kind: row.club_kind ?? null,
    club_name: row.host?.name ?? null,
    icon_url: row.icon_path ? `/api/${route}/${row.id}/icon?v=${iconVersion(row.icon_path)}` : null,
    application_start: row.application_start,
    registration_deadline: row.registration_deadline,
    apply_link: row.apply_link,
    event_start: row.event_start ?? null,
    event_end: row.event_end ?? null,
    participation_type: row.participation_type ?? null,
    domains: [...new Set((row.domain_links ?? []).map(link => link.domain?.name).filter(Boolean))].sort(),
    open_to: [...new Set((row.year_links ?? []).map(link => link.year?.name).filter(Boolean))].sort(),
  };
}
export function createDirectoryService(supabase) {
  return {
    async list(route, page, limit) {
      const resource = directoryResources[route];
      const offset = (page - 1) * limit;
      const { data, error, count } = await supabase.from(resource.table)
        .select(columns(resource), { count: 'exact' })
        .order(resource.label).order('id').range(offset, offset + limit - 1)
        .abortSignal(AbortSignal.timeout(10000));
      if (error) throw new ApiError(503, 'Directory is temporarily unavailable');
      return {
        data: data.map(row => normalize(row, resource, route)),
        pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) },
      };
    },
    async iconRecord(route, id) {
      const { data, error } = await supabase.from(directoryResources[route].table)
        .select('icon_path').eq('id', id).maybeSingle()
        .abortSignal(AbortSignal.timeout(10000));
      if (error) throw new ApiError(503, 'Icon is temporarily unavailable');
      if (!data?.icon_path) throw new ApiError(404, 'Icon not found');
      // Only an entity's icon may be read, never an arbitrary private bucket path.
      const prefix = `${directoryResources[route].iconFolder}/${id}/`;
      const filename = data.icon_path.slice(prefix.length);
      if (!data.icon_path.startsWith(prefix) || !filename || /[/\\]/.test(filename) || filename === '..') {
        throw new ApiError(404, 'Icon not found');
      }
      return data.icon_path;
    },
  };
}
