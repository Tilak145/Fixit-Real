// Expo inlines only statically referenced public variables, so each one is
// written out in full below. Everything here is safe to ship inside the app: the
// Supabase address, its public (anon) key and the website's address. Never put
// a service-role key, a Stripe key or any other secret in this module or in the
// .env file; those live only inside Supabase.
export const config = {
  /** The FixIt Supabase project's address. */
  backend: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  /** Its public (anon) key, which row-level security makes safe to ship. */
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** The website, where payment pages and the full pro dashboard live. */
  siteUrl: (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://www.fixitls.com').replace(/\/+$/u, ''),
  /** The app's own link scheme, used to bring a sign-in email back into the app. Matches app.json. */
  scheme: process.env.EXPO_PUBLIC_APP_SCHEME ?? 'fixit',
  /** Optional: an address that says the oldest installable version, to force an update. Unused when empty. */
  statusUrl: process.env.EXPO_PUBLIC_APP_STATUS_URL ?? '',
  versionCode: Number(process.env.EXPO_PUBLIC_APP_VERSION_CODE ?? 0),
  preview: process.env.EXPO_PUBLIC_PREVIEW === 'true',
  /** Shows the "testing phase" notice on every screen. Set EXPO_PUBLIC_IN_TESTING=false at launch. */
  testing: process.env.EXPO_PUBLIC_IN_TESTING !== 'false',
};
