import { createHash } from 'node:crypto';

// Basic signature checks for this local import tool; do not trust extensions alone.
export function inspectLogo(bytes) {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) {
    throw new Error('Logo must be nonempty and no larger than 5 MiB');
  }
  let extension;
  let contentType;
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    extension = 'png'; contentType = 'image/png';
  } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    extension = 'jpg'; contentType = 'image/jpeg';
  } else if (['GIF87a','GIF89a'].includes(bytes.toString('ascii',0,6))) {
    extension = 'gif'; contentType = 'image/gif';
  } else if (bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP') {
    extension = 'webp'; contentType = 'image/webp';
  } else if (bytes.toString('ascii',4,8) === 'ftyp' && ['avif','avis'].includes(bytes.toString('ascii',8,12))) {
    extension = 'avif'; contentType = 'image/avif';
  } else {
    throw new Error('Unsupported logo signature; use PNG/JPEG/WebP/GIF/AVIF, not SVG or HTML');
  }
  return { extension, contentType, hash: createHash('sha256').update(bytes).digest('hex') };
}
