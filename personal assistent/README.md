# Prodwilrijk Persoonlijke Assistent (Android)

Mobiele assistent-app met AI en live data uit **prodwilrijk.be**. Werkt met tekst en spraak; op Android pakt de app de microfoon van je telefoon of **Samsung-oortjes** (Bluetooth) op zolang je de microfoonknop ingedrukt houdt.

## Wat kan de app?

- **Hey Jarvis (hands-free)** — zeg "Jarvis" om live spraak te starten zonder de telefoon aan te raken (Android + Picovoice)
- **Live spraak (OpenAI Realtime)** — direct praten via oortjes, zoals Grote Inpak op de website
- **Klassieke spraak** — knop ingedrukt houden → transcriptie → antwoord
- **Tekstchat** — typ je vraag
- Live data uit Prodwilrijk: Grote Inpak, productieorders, Atlas status, Prepack

## Architectuur

```
Mobiele app (Expo/React Native)
  → Bearer token (Supabase login)
  → https://prodwilrijk.be/api/personal-assistant/chat
  → https://prodwilrijk.be/api/personal-assistant/voice
  → OpenAI + Prodwilrijk database-tools (server-side)
```

De OpenAI-key blijft **alleen op de server**. De app slaat enkel je sessie-token veilig op.

---

## 1. Backend deployen (hoofdproject)

De API-routes zitten in het hoofdproject:

- `app/api/personal-assistant/chat/route.ts`
- `app/api/personal-assistant/voice/route.ts`
- `lib/personal-assistant/*`

Deploy/push naar Vercel zodat productie de endpoints kent. `OPENAI_API_KEY` moet gezet zijn.

Optioneel in Vercel env:

```env
PERSONAL_ASSISTANT_MODEL=gpt-4o-mini
PERSONAL_ASSISTANT_TRANSCRIBE_MODEL=gpt-4o-transcribe
PERSONAL_ASSISTANT_REALTIME_MODEL=gpt-realtime
PERSONAL_ASSISTANT_REALTIME_VOICE=marin
```

---

## 2. App lokaal configureren

```bash
cd "personal assistent"
cp .env.example .env
```

Vul in `.env`:

```env
EXPO_PUBLIC_API_BASE=https://prodwilrijk.be
EXPO_PUBLIC_SUPABASE_URL=<zelfde als NEXT_PUBLIC_SUPABASE_URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<zelfde als NEXT_PUBLIC_SUPABASE_ANON_KEY>
EXPO_PUBLIC_PICOVOICE_ACCESS_KEY=<AccessKey van console.picovoice.ai>
```

### Hey Jarvis (wake word)

**Standaard: [openWakeWord](https://github.com/dscripka/openWakeWord)** (offline, geen account). Zeg **"Hey Jarvis"**. Bij eerste gebruik downloadt de app drie kleine modellen (~3 MB) van GitHub.

1. Bouw een **native APK** (geen Expo Go).
2. **Hey Jarvis** aan → melding *Prodwilrijk Assistent actief*.
3. Zeg **"Hey Jarvis"** → live spraak start.

**Optioneel Picovoice:** `EXPO_PUBLIC_USE_PICOVOICE_WAKE=true` + `EXPO_PUBLIC_PICOVOICE_ACCESS_KEY`.

**Fallback:** als openWakeWord niet laadt → Google spraakherkenning.

**Beperkingen:** App force-stop = geen luisteren. Batterij-optimalisatie uitzetten op Android helpt.

Installeer en start:

```bash
npm install
npx expo start
```

Scan de QR-code met **Expo Go** op je Android-toestel, of:

```bash
npx expo run:android
```

> Voor spraak in Expo Go: microfoon-toestemming geven. Samsung Buds werken als standaard Android-audio-input zolang ze verbonden zijn.

---

## 3. Google Play build (EAS)

### Eenmalige setup

1. Installeer EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. In `personal assistent/`: `eas init` → plak het project ID in `app.json` onder `extra.eas.projectId`
4. Vervang placeholder-iconen in `assets/` door echte 1024×1024 PNG’s (optioneel maar aanbevolen voor Play Store)

### Production build (AAB voor Play Store)

```bash
cd "personal assistent"
eas build -p android --profile production
```

Download de `.aab` en upload in [Google Play Console](https://play.google.com/console).

### Snelle interne test (APK)

```bash
eas build -p android --profile preview
```

Installeer de APK direct op je telefoon.

### Play Store submit (optioneel)

```bash
eas submit -p android --profile production
```

---

## 4. Samsung-oortjes tips

- Verbind je Buds vóór je opneemt
- Houd **“Houd ingedrukt”** ingedrukt tijdens je vraag; laat los om te versturen
- Zet **“Antwoord voorlezen”** aan voor TTS via je oortjes/luidspreker
- Als de microfoon niet werkt: controleer Android app-permissies → Microfoon → Toestaan

---

## 5. Veiligheid

- Alleen ingelogde, geverifieerde Prodwilrijk-gebruikers kunnen de API aanroepen (zelfde middleware als de website)
- Rate limit: zelfde bucket als AI-chat (20 req/min per IP)
- Geen OpenAI-key in de mobiele app

---

## Volgende uitbreidingen (optioneel)

- Meer tools: Wood, CNH, dagplanning, packed items
- Wake-word / hands-free modus
- Push-notificaties bij priority-cases
- iOS build via `eas build -p ios`
