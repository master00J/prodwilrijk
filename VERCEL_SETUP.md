# Vercel Deployment Setup

## Automatische Deployments van GitHub

Om ervoor te zorgen dat elke push naar GitHub automatisch een nieuwe build triggert in Vercel, moet je het volgende doen:

### Stap 1: Vercel Project Koppelen aan GitHub

1. Ga naar [Vercel Dashboard](https://vercel.com/dashboard)
2. Klik op **"Add New..."** → **"Project"**
3. Selecteer je GitHub repository: `master00J/prodwilrijk`
4. Vercel zal automatisch de repository detecteren

### Stap 2: Project Instellingen

1. **Framework Preset**: Next.js (wordt automatisch gedetecteerd)
2. **Root Directory**: Laat leeg (of `prodwilrijk nieuw` als je de hele repo hebt)
3. **Build Command**: `npm run build` (standaard)
4. **Output Directory**: `.next` (standaard voor Next.js)
5. **Install Command**: `npm install` (standaard)

### Stap 3: Environment Variables

Zorg ervoor dat je de volgende environment variables instelt in Vercel:

1. Ga naar je project → **Settings** → **Environment Variables**
2. Voeg de volgende variabelen toe:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Belangrijk**: 
- Zet deze voor **Production**, **Preview**, en **Development**
- Gebruik de juiste Supabase credentials

### Stap 4: Auto-Deploy Instellen

1. Ga naar **Settings** → **Git**
2. Zorg ervoor dat:
   - **Production Branch**: `main` (of `master`)
   - **Auto-deploy** is ingeschakeld
   - **Vercel for GitHub** app is geïnstalleerd

### Stap 5: GitHub Integration Verifiëren

1. Ga naar je GitHub repository
2. Klik op **Settings** → **Integrations** → **Vercel**
3. Zorg ervoor dat Vercel toegang heeft tot de repository

## Handmatige Deploy

Als automatische deploy niet werkt, kun je handmatig deployen:

1. Installeer Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`

## Troubleshooting

### Build faalt
- Controleer of alle environment variables zijn ingesteld
- Controleer de build logs in Vercel dashboard
- Zorg ervoor dat `npm run build` lokaal werkt

### Geen automatische deploy
- Controleer of Vercel for GitHub app is geïnstalleerd
- Controleer of de repository correct is gekoppeld
- Controleer de GitHub webhook settings

### Environment Variables niet beschikbaar
- Zorg ervoor dat variabelen zijn ingesteld voor de juiste environment (Production/Preview/Development)
- Herstart de deployment na het toevoegen van nieuwe variabelen





