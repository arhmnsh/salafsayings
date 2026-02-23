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
