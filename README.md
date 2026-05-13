# LeaseLens

Production-ready base scaffold for a Next.js 15 SaaS application.

## Stack

- Next.js 15 App Router
- TypeScript
- Tailwind CSS
- Supabase
- Vercel-ready deployment config

## Getting Started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your env file:

   ```bash
   cp .env.example .env.local
   ```

3. Run development server:

   ```bash
   npm run dev
   ```

## Base Architecture

- `src/app`: App Router routes and API handlers
- `src/components`: reusable UI and layout components
- `src/lib`: shared utilities, Supabase clients, and API helpers
- `src/app/api/v1`: versioned API route modules

No business features are implemented yet.
