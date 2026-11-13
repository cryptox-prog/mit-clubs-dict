import { createHash } from 'node:crypto';

export const iconVersion = key => createHash('sha256').update(key).digest('hex');
// Only files named by content hash are safe to keep immutable for a year.
// Our logo importer follows this convention; manually named icons stay at 5 min.
export const isContentAddressedIcon = key => /\/[a-f0-9]{64}\.(png|jpg|jpeg|webp|gif|avif)$/.test(key);
