import type { ImageSourcePropType } from 'react-native';

/**
 * The provider photos that ship with FixIt. The database stores each logo as a
 * website path (/assets/<digest>.jpg); the phone app bundles the same files and
 * resolves them by digest, so a profile shows its photo on the phone too.
 */
const bundled: Record<string, ImageSourcePropType> = {
  '655ddbf67a0c4dc2c748201704f6aaeada01648ae69be7002ae9d1c108f1a9df': require('@/assets/pros/655ddbf67a0c4dc2c748201704f6aaeada01648ae69be7002ae9d1c108f1a9df.jpg'),
  'be782792d01dd49ebcfa3131b8710678122d055151625dc7edea12b838dd083b': require('@/assets/pros/be782792d01dd49ebcfa3131b8710678122d055151625dc7edea12b838dd083b.jpg'),
  'cac346852d56c22dda280cbbb86392d83ec74ab6dbea19d462325fc89f7458a9': require('@/assets/pros/cac346852d56c22dda280cbbb86392d83ec74ab6dbea19d462325fc89f7458a9.jpg'),
  'f5cd92936ee38a0e98f9371d1afa3a9d0589035c9f035718861e511fef89c29d': require('@/assets/pros/f5cd92936ee38a0e98f9371d1afa3a9d0589035c9f035718861e511fef89c29d.jpg'),
};

/** The image for a provider's logo_url: a bundled photo, or a remote URL. */
export function proPhoto(logoUrl: string | null | undefined): ImageSourcePropType | null {
  if (!logoUrl) return null;
  const digest = /\/assets\/([a-f0-9]+)\.(?:jpg|jpeg|png)/i.exec(logoUrl)?.[1];
  if (digest && bundled[digest]) return bundled[digest];
  if (/^https?:\/\//i.test(logoUrl)) return { uri: logoUrl };
  return null;
}
