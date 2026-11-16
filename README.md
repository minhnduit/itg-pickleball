# Pickleball Tournament Control

## Supabase setup
1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Auth -> disable public signups. Create organizer users manually in the Auth dashboard.
3. The first organizer logs in, creates a tournament on the Home page and becomes its organizer. Add co-organizers by inserting rows into `organizers`.

## Local dev
Copy `.env.example` to `.env.local`, fill in the URL and anon key, then `npm install && npm run dev`.

## GitHub
Repo Settings -> Secrets and variables -> Actions -> Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
Settings -> Pages -> Source = GitHub Actions. Push to `main` to deploy.

## Tests
- Unit: `npm test`
- DB: `cd supabase/test && npm i && node run-tests.mjs ../schema.sql`

## Routing
Clean URLs (`/<slug>`, `/<slug>/tv`, `/<slug>/admin`) use BrowserRouter. `npm run build` copies `dist/index.html` to `dist/404.html`: GitHub Pages serves 404.html for deep links, which acts as the SPA fallback. CI sets `VITE_BASE=/<repo>/`.

## Upgrading an existing Supabase project
Run in the SQL editor to add the short-link column:
```sql
alter table public.tournaments add column if not exists slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 40);
```
# itg-pickleball
