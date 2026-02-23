# Salaf Sayings

Standalone Nuxt app for `salafsayings.arhmn.sh`.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Data Sync

```bash
npm run salaf:sync
npm run salaf:update
```

- `salaf:sync`: full refresh from sayings source.
- `salaf:update`: incremental refresh (for daily runs).

## Daily Job

Workflow file: `.github/workflows/daily-sync.yml`

## Deployment

GitHub Pages deploy workflow: `.github/workflows/deploy.yml`

This deploys on push to `main` and publishes `.output/public`.

Custom domain is configured with `public/CNAME`:

`salafsayings.arhmn.sh`
