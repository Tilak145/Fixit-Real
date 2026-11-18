# Account

ExaSpark composition guide.

Wrap protected content in `AccountGate` from `features/auth.tsx`; it shows
sign-in, sign-up, email verification, email codes and password reset, and
renders its children once the person is signed in. `useAuth()` returns the
current `session`. `AuthProvider` owns the Supabase session; never keep a
second signed-in flag.

Put `AccountActions` on the profile or settings screen so people can sign out
and delete their account. The sign-in, sign-up, forgot-password, verify-email,
profile and settings page examples show the screens around them.
