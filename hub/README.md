# Namma Habba hub

Static landing page listing every festival deployment. Edit `festivals.json`; no build step.

`status` is `live`, `soon` or `past`. A festival with an empty `url` renders as a non-clickable card.

## Deploy (own Vercel project)
1. Vercel -> Add New Project -> import this repo, set **Root Directory** to `hub`, framework preset **Other**.
2. Deploy. It is served at `<project>.vercel.app`.
3. Domain is `nammahabba.in` (registered at GoDaddy). Vercel -> Project -> Settings -> Domains -> add `nammahabba.in` and `www.nammahabba.in`.
4. GoDaddy -> My Products -> nammahabba.in -> DNS. Delete the default "Parked" A record for `@` and any `www` CNAME, then add the records Vercel shows (typically A `@` -> `76.76.21.21`, CNAME `www` -> `cname.vercel-dns.com`).
5. Vercel issues the HTTPS certificate automatically once DNS resolves.
6. Each festival gets its own subdomain, e.g. `ganesha.nammahabba.in` (CNAME -> `cname.vercel-dns.com`, added under that festival's Vercel project). Add each one to the Google OAuth client's Authorized JavaScript origins.

When a new festival launches, flip its `status` to `live` and fill in `url`; when it ends, set `past`.
