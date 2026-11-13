import { ApiError } from '../utils/ApiError.js';
import { iconVersion } from '../utils/iconCache.js';

export const listingKinds = ['clubs', 'student-projects', 'events'];
export function managementError(error) {
  if (error.code === '42501') return new ApiError(403, 'You do not have permission to manage this listing');
  if (error.code === '40001') return new ApiError(409, 'This listing changed. Reload it before saving again.');
  if (error.code === 'P0002') return new ApiError(404, 'Listing or registered active user not found');
  if (['23503', '23514', '22023', '22P02'].includes(error.code)) return new ApiError(400, 'Invalid listing values or filter selections');
  if (error.code === 'PGRST202' || error.code === '42P01') return new ApiError(503, 'Management setup is incomplete. Please contact the administrator.');
  return new ApiError(503, 'Management is temporarily unavailable');
}
export function createManagementService(supabase) {
  const rpc = async (name, args) => {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw managementError(error);
    return data;
  };
  return {
    async dashboard(actor) {
      const result = await rpc('manager_dashboard', { p_actor: actor });
      return { ...result, listings: result.listings.map(({ icon_path, ...listing }) => ({
        ...listing, icon_url: icon_path ? `/api/${listing.kind}/${listing.id}/icon?v=${iconVersion(icon_path)}` : null,
      })) };
    },
    async authorize(actor, kind, id) {
      if (!await rpc('directory_can_manage', { p_actor: actor, p_kind: kind, p_id: id })) {
        throw new ApiError(403, 'You do not have permission to manage this listing');
      }
    },
    update(actor, kind, id, expected, patch) {
      return rpc('manager_update_listing', { p_actor: actor, p_kind: kind, p_id: id, p_expected_updated_at: expected, p_patch: patch });
    },
    setIcon(actor, kind, id, expected, key) {
      return rpc('manager_set_icon', { p_actor: actor, p_kind: kind, p_id: id, p_expected_updated_at: expected, p_icon_path: key });
    },
    assignments(actor, kind, id) { return rpc('manager_assignments', { p_actor: actor, p_kind: kind, p_id: id }); },
    assign(actor, kind, id, email, assign) {
      return rpc('manager_set_assignment', { p_actor: actor, p_kind: kind, p_id: id, p_email: email, p_assign: assign });
    },
  };
}
