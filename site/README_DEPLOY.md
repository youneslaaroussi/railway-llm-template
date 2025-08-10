Deployment (Railway) for site/

Service type: Nixpacks
Root directory: site

Requirements:
- Bun runtime available (Railway Nixpacks provides bun)

Env vars:
- NEXT_PUBLIC_BACKEND_URL: URL of your API service

Nixpacks overrides: see nixpacks.toml in this folder

Commands:
- Install: bun install --frozen-lockfile
- Build: bun run build
- Start: bun run start


