# Namma Habba hub

Static landing page listing every festival deployment. Edit `festivals.json`; no build step.

`status` is `live`, `soon` or `past`. A festival with an empty `url` renders as a non-clickable card.

## Deploy (own Vercel project)
1. Vercel -> Add New Project -> import this repo, set **Root Directory** to `hub`, framework preset **Other**.
2. Deploy. It is served at `<project>.vercel.app`.
3. When you have a domain: Project -> Settings -> Domains -> add e.g. `habba.<yourdomain>`, then create the CNAME record Vercel shows at your DNS provider.

When a new festival launches, flip its `status` to `live` and fill in `url`; when it ends, set `past`.
