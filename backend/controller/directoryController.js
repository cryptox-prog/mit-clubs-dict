import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { z } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { iconVersion, isContentAddressedIcon } from '../utils/iconCache.js';
import { createDirectoryService } from '../service/directoryService.js';

const pagination = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(100),
}).strict();
const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);

export function createDirectoryController(supabase, bucket) {
  const directory = createDirectoryService(supabase);
  return {
    list(route) {
      return async (req, res) => {
        const parsed = pagination.safeParse(req.query);
        if (!parsed.success) throw new ApiError(400, 'Use a positive page and a limit between 1 and 200');
        res.set('Cache-Control', 'no-store').json(await directory.list(route, parsed.data.page, parsed.data.limit));
      };
    },
    icon(route) {
      return async (req, res) => {
        if (!z.uuid().safeParse(req.params.id).success) throw new ApiError(400, 'Invalid directory ID');
        const key = await directory.iconRecord(route, req.params.id);
        const version = iconVersion(key);
        const etag = `"${version}"`;
        // Never return new bytes under an old immutable URL after a logo update.
        if (req.query.v && req.query.v !== version) {
          res.set('Cache-Control', 'no-store');
          return res.redirect(307, `/api/${route}/${req.params.id}/icon?v=${version}`);
        }
        const immutable = req.query.v === version && isContentAddressedIcon(key);
        res.set({
          'Cross-Origin-Resource-Policy': 'cross-origin',
          'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
        });
        if (isContentAddressedIcon(key)) res.set('ETag', etag);
        if (isContentAddressedIcon(key) && req.headers['if-none-match'] === etag) return res.status(304).end();
        const { data, error } = await supabase.storage.from(bucket)
          .download(key, {}, { signal: AbortSignal.timeout(10000) });
        if (error) {
          res.removeHeader('Cache-Control');
          res.removeHeader('ETag');
          if (String(error.statusCode) === '404' || error.code === 'NoSuchKey' || error.code === 'not_found') {
            throw new ApiError(404, 'Icon not found');
          }
          throw new ApiError(503, 'Icon is temporarily unavailable');
        }
        if (!imageTypes.has(data.type) || data.size > 5 * 1024 * 1024) {
          res.removeHeader('Cache-Control');
          res.removeHeader('ETag');
          throw new ApiError(415, 'Unsupported icon');
        }
        res.type(data.type).set('Content-Length', String(data.size));
        await pipeline(Readable.fromWeb(data.stream()), res);
      };
    },
  };
}
