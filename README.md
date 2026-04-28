# Launch Decision System V1

Monorepo for the batch-arrival driven product launch decision system.

## Stack

- Web: Next.js 15 + React + TypeScript + Tailwind CSS
- API: NestJS + TypeScript + Prisma
- Database: PostgreSQL in production, SQLite for local bootstrap
- Scheduling: `@nestjs/schedule`

## Apps

- `apps/web`: operator-facing frontend
- `apps/api`: backend API and recalculation engine

## Local development

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env`
3. Run Prisma migrate or push
4. Start frontend and backend in separate terminals

## Core V1 scope

- Product-level launchable quantity snapshots
- BOM versioning
- Receipt batch tracking
- Shared material manual allocation
- Hourly recalculation skeleton

