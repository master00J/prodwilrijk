# Prodwilrijk V2

Modern web application built with Next.js, TypeScript, and Supabase.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query

## Project Structure

```
prodwilrijk nieuw/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── (pages)/           # Page routes
│   └── layout.tsx         # Root layout
├── components/            # React components
├── lib/                   # Utilities and configurations
│   ├── supabase/         # Supabase client
│   └── utils/            # Helper functions
├── types/                 # TypeScript type definitions
└── public/               # Static assets
```

