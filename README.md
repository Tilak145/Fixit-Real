# FixIt website — source code

Every file behind the FixIt website: the pages, components, styles, images it
serves, and the database setup and rules in supabase/.

## What is not inside
- Secret settings (API keys, payment credentials) are never kept in the code;
  they live only in the hosting platform.
- The Android phone app is a separate project and is not part of this download.

## Running it on your own computer
1. Install Node.js 20 or newer.
2. In the apps/web folder run npm install, then npm run dev.
3. Open http://localhost:3000.

Saving requests, accounts and quotes needs a database and sign-in service
(Supabase). The setup is in supabase/migrations; apply the files in order to
your own Supabase project and point the website at it. Without it, pages open
but saving shows an honest "not connected" message.

## Deploying it elsewhere
Any host that runs Next.js can serve it. The settings it needs are the
database address and keys Supabase gives you for your own project.
