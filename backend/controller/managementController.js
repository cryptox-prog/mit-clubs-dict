import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { inspectLogo } from '../utils/logoFile.js';
import { createManagementService, listingKinds } from '../service/managementService.js';
import { createAuthService } from '../service/authService.js';

const timestamp = z.iso.datetime({ offset: true });
const nullableDate = z.iso.date().nullable();
const baseFields = {
  expected_updated_at: timestamp, name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).nullable(),
  application_start: nullableDate, registration_deadline: nullableDate,
  apply_link: z.url().max(2048).refine(value => new URL(value).protocol === 'https:', 'Use an HTTPS link').nullable(),
  domain_ids: z.array(z.uuid()).max(100), year_group_ids: z.array(z.number().int().min(1).max(5)).max(5),
};
const assignment = z.object({ email: z.email().max(254), assign: z.boolean() }).strict();
export function createManagementController(supabase, config) {
  const management = createManagementService(supabase);
  const auth = createAuthService(supabase, config);
  const params = req => {
    if (!listingKinds.includes(req.params.kind) || !z.uuid().safeParse(req.params.id).success) throw new ApiError(400, 'Invalid listing');
    return [req.params.kind, req.params.id];
  };
  return {
    access: async (req, res) => res.json(await auth.roles(req.auth.user.id)),
    dashboard: async (req, res) => res.json(await management.dashboard(req.auth.user.id)),
    authorize: async (req, res, next) => { const [kind,id] = params(req); await management.authorize(req.auth.user.id,kind,id); next(); },
    update: async (req, res) => {
      const [kind,id] = params(req);
      const fields = kind === 'clubs' ? { ...baseFields, club_kind: z.enum(['Technical','Cultural']) }
        : kind === 'events' ? { ...baseFields, event_start: timestamp.nullable(), event_end: timestamp.nullable(), participation_type: z.enum(['INDIVIDUAL','TEAM']).nullable() } : baseFields;
      const result = z.object(fields).strict().safeParse(req.body);
      if (!result.success) throw new ApiError(400, result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
      const { expected_updated_at, ...patch } = result.data;
      if (Boolean(patch.application_start) !== Boolean(patch.registration_deadline)
        || (patch.application_start && patch.registration_deadline < patch.application_start)) throw new ApiError(400, 'Provide both recruitment dates in chronological order, or leave both empty');
      if (kind === 'events' && (Boolean(patch.event_start) !== Boolean(patch.event_end)
        || (patch.event_start && new Date(patch.event_end) < new Date(patch.event_start)))) throw new ApiError(400, 'Provide both event times in chronological order, or leave both empty');
      if (patch.year_group_ids.includes(5) && patch.year_group_ids.length > 1) throw new ApiError(400, 'Everyone cannot be combined with individual year groups');
      const updated_at = await management.update(req.auth.user.id,kind,id,expected_updated_at,patch);
      res.json({ updated_at });
    },
    assignments: async (req,res) => { const [kind,id] = params(req); res.json({ data: await management.assignments(req.auth.user.id,kind,id) }); },
    assign: async (req,res) => {
      const [kind,id] = params(req);
      const parsed = assignment.safeParse(req.body);
      if (!parsed.success) throw new ApiError(400, 'Provide a registered user email and assignment action');
      await management.assign(req.auth.user.id,kind,id,parsed.data.email.trim().toLowerCase(),parsed.data.assign);
      res.status(204).end();
    },
    icon: async (req,res) => {
      const [kind,id] = params(req);
      const parsed = z.object({ expected_updated_at: timestamp }).strict().safeParse(req.body);
      if (!req.file || !parsed.success) throw new ApiError(400, 'Provide one logo and the current listing version');
      let bytes;
      try {
        inspectLogo(req.file.buffer);
        bytes = await sharp(req.file.buffer, { limitInputPixels: 25000000, failOn: 'warning' })
          .rotate().resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
          .png().timeout({ seconds: 5 }).toBuffer();
      } catch { throw new ApiError(400, 'Upload a valid PNG, JPEG, WebP, GIF or AVIF image under 5 MiB'); }
      const folder = kind === 'student-projects' ? 'projects' : kind;
      const key = `${folder}/${id}/${createHash('sha256').update(bytes).digest('hex')}.png`;
      const { error } = await supabase.storage.from(config.SUPABASE_STORAGE_BUCKET ?? 'assets')
        .upload(key, bytes, { contentType: 'image/png', cacheControl: '31536000', upsert: true });
      if (error) throw new ApiError(503, 'Logo upload failed. Please try again.');
      // SQL rechecks permissions and the version after upload; a revoked manager
      // cannot link an uploaded file. Orphans are retained for safe Storage cleanup.
      const updated_at = await management.setIcon(req.auth.user.id,kind,id,parsed.data.expected_updated_at,key);
      res.json({ updated_at });
    },
  };
}
