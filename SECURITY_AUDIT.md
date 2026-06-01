# Security Audit - Prodwilrijk

Datum: 2026-04-17 (opvolging security-hardening: 2026-05-27)

## Opvolging 2026-05-27

- Next.js 16.2.6 (gepatcht t.o.v. CVE-2025-29927 / CVE-2025-66478).
- Middleware: strip client `x-user-*` headers; optionele `TV_DISPLAY_SECRET` voor TV-read-API's.
- Zod-validatie op o.a. items-to-pack, tv-slides mutaties, production-order upload, admin role/verify/reset.
- `employees` GET achter `withAuth`; `wms-packages` POST achter `withAdmin`.
- xlsx via SheetJS CDN 0.20.3 in `package.json` (na `npm install` lockfile bijwerken).
- `.env.example` + GitHub Actions CI (lint, type-check).

Scope:
- Next.js 14 App Router applicatie.
- Supabase Postgres/Auth/Storage via `supabaseAdmin` en browser anon client.
- Vercel middleware, cron jobs en publieke TV-display routes.
- Analyse op basis van statische code review en `npm audit`.

Niet in scope:
- Penetratietest op productie.
- Runtime loganalyse.
- Secrets in Vercel dashboard zelf.
- Volledige manuele validatie van elke businessregel.

---

## Pass 1 - Threat Model / Inventaris

### 1. Authenticatie- en authorisatie-flows

| Onderdeel | File:line | Rol |
|---|---:|---|
| Middleware auth gate | `middleware.ts:104-203` | Valideert API requests via `sb-access-token` cookie of `Authorization: Bearer`. Injecteert user headers. |
| Publieke API lijst | `middleware.ts:16-43` | Bepaalt welke API routes zonder JWT bereikbaar zijn. |
| Rate limiting | `middleware.ts:53-70` | In-memory rate limits per categorie. |
| CORS allowlist | `middleware.ts:10-14`, `middleware.ts:72-84` | Laat alleen bekende origins toe. |
| Client auth state | `components/AuthProvider.tsx:8-23`, `components/AuthProvider.tsx:69-84` | Houdt user/isAdmin/isVerified/allowedSites bij. |
| Public page skip | `components/AuthProvider.tsx:28-32` | `/tv-display` is publiek. |
| Admin UI guard | `components/AdminGuard.tsx:7-40` | Client-side admin redirect. Geen server-side autorisatie. |
| Auth wrappers | `lib/api/with-auth.ts:13-71` | `withAuth`, `withAdmin`, `canAccessSite`. |
| Legacy Bearer helper | `lib/supabase/require-auth.ts:16-33` | Valideert alleen Bearer token, niet de HttpOnly cookie. |
| Supabase service client | `lib/supabase/server.ts:3-13` | `supabaseAdmin` met service role. Bypasst RLS. |
| Supabase browser client | `lib/supabase/client.ts:3-13` | Browser anon client met persisted session. |

Login-flow:
- `app/login/page.tsx:26-65`: username/password formulier.
- `app/api/auth/login/route.ts:6-53`: publieke username -> email lookup via `user_roles` en Supabase Admin API.
- `app/login/page.tsx:47-50`: client doet `supabase.auth.signInWithPassword`.
- `app/api/auth/session/route.ts:11-41`: valideert access token en zet `sb-access-token` HttpOnly cookie.
- `components/AuthProvider.tsx:59-67`: cookie refresh timer.

Signup-flow:
- `app/api/auth/signup/route.ts:6-120`: publieke signup, maakt Supabase auth user en `user_roles` met `verified=false`.
- `middleware.ts:186-194`: blokkeert niet-geverifieerde users voor niet-auth API routes.
- `app/pending-verification/page.tsx`: pending UI.
- `app/api/admin/verify-user/route.ts:10-62`: admin verifieert user.

Admin-flows:
- `app/api/admin/users/route.ts:8-43`: `withAdmin`.
- `app/api/admin/verify-user/route.ts:10-62`: `withAdmin`.
- `app/api/admin/change-role/route.ts:10-70`: `withAdmin`.
- `app/api/admin/reset-password/route.ts:8-60`: `withAdmin`.
- `lib/api/user-status-cache.ts:11-35`: role/verified cache met 5 minuten TTL.

Site authorisatie:
- `middleware.ts:173-183`: leest `allowed_sites` uit `user_roles`.
- `lib/api/with-auth.ts:31-35`: `canAccessSite`.
- Observatie: helper bestaat, maar wordt niet consequent op domeinroutes toegepast.

### 2. API endpoints en wie ze mag aanroepen

Belangrijkste routecategorieën:

| Routegroep | Toegang | File:line referenties |
|---|---|---|
| `/api/auth/login`, `/api/auth/signup`, `/api/auth/session`, `/api/auth/create-user-role` | Publiek volgens middleware | `middleware.ts:16-20` |
| `/api/tv-slides` | GET publiek; door exacte match stond historisch risico op bredere public exposure | `middleware.ts:34-43`, `app/api/tv-slides/route.ts:6-86` |
| `/api/tv-slides/production-status` | Publiek volgens prefixlijst | `middleware.ts:21`, `app/api/tv-slides/production-status/route.ts:8-140` |
| `/api/tv-slides/packing-stats` | Publiek read voor TV-display | `middleware.ts:22` |
| `/api/tv-slides/transport-planning` | Publiek volgens prefixlijst | `middleware.ts:23` |
| `/api/tv-slides/priorities` | Publiek read voor TV-display | `middleware.ts:24`, `app/api/tv-slides/priorities/route.ts:7-70` |
| `/api/tv-slides/weather` | Publiek weather proxy | `middleware.ts:25` |
| `/api/tv-slides/dagplanning` | Publiek read voor TV-display | `middleware.ts:26`, `app/api/tv-slides/dagplanning/route.ts:8-54` |
| `/api/tv-screens*` GET | Publiek read voor signage | `middleware.ts:35`, `app/api/tv-screens/route.ts:7-28`, `app/api/tv-screens/[slug]/slides/route.ts:6-52` |
| `/api/tv-screens/[slug]/heartbeat` POST | Publiek voor signage heartbeat | `middleware.ts:36`, `app/api/tv-screens/[slug]/heartbeat/route.ts:6-27` |
| `/api/packed-items-airtec/send-daily-report` | Publiek + secret-check | `middleware.ts:27`, `app/api/packed-items-airtec/send-daily-report/route.ts:18-22` |
| `/api/grote-inpak/*-mail-import` | Publiek + secret-check | `middleware.ts:28-31`, `app/api/grote-inpak/pils-mail-import/route.ts:212-224` |
| `/api/bc-mappings` | Publiek read-only mapping | `middleware.ts:32`, `app/api/bc-mappings/route.ts:16-42` |
| `/api/admin/*` | Meestal `withAdmin` | `app/api/admin/users/route.ts:8`, `app/api/admin/change-role/route.ts:10`, `app/api/admin/verify-user/route.ts:10` |
| Overige `/api/**` | Middleware JWT + verified vereist, meestal geen extra wrapper | `middleware.ts:104-203` |
| `requireAuth` routes | Middleware + Bearer-only helper | `app/api/dagplanning/route.ts:3`, `app/api/machines/route.ts:3`, `app/api/competencies/route.ts:3` |

Route-inventaris per domein:
- Admin: `app/api/admin/**`, hoofdzakelijk `withAdmin`.
- Auth: `app/api/auth/**`, deels publiek, deels eigen user-context via headers.
- TV/narrowcasting: `app/api/tv-slides/**`, `app/api/tv-screens/**`, deels publiek voor signage.
- Grote inpak: `app/api/grote-inpak/**`, gemengd MW-only en public+secret voor cron/mail import.
- Airtec: `app/api/airtec/**`, `app/api/airtec-*`, gemengd MW-only, `withAuth`, `withAdmin`, public+secret mail import.
- Packed items: `app/api/packed-items/**`, `app/api/packed-items-airtec/**`, MW-only behalve Airtec daily cron.
- Incoming goods: `app/api/incoming-goods/**`, `app/api/incoming-goods-airtec/**`, MW-only.
- WMS: `app/api/wms-*`, MW-only.
- Production orders/time: `app/api/production-orders/**`, `app/api/production-order-time/**`, MW-only.
- CNH: `app/api/cnh/**`, MW-only.
- Wood: `app/api/wood/**`, MW-only.
- Product inspectie: `app/api/product-inspectie/**`, MW-only.
- Saw sharpening: `app/api/saw-sharpening/**`, MW-only + zod op enkele routes.

### 3. Plekken waar user input wordt verwerkt

| Inputtype | Voorbeelden |
|---|---|
| JSON body | `request.json()` in veel routes, bijvoorbeeld `app/api/tv-screens/route.ts:31`, `app/api/ai/chat/route.ts:9`, `app/api/items-to-pack/route.ts:108`, `app/api/production-order-time/start/route.ts:9`. |
| Query params | `app/api/search_artikels/route.ts:10`, `app/api/items-to-pack/route.ts:10`, `app/api/tv-slides/weather/route.ts:8-14`, `app/api/tv-slides/dagplanning/route.ts:12`. |
| Dynamic route params | `app/api/items-to-pack/[id]/route.ts:12`, `app/api/production-order-time/[id]/stop/route.ts:13-16`, `app/api/production-orders/[orderNumber]/lines/route.ts:12`. |
| FormData uploads | `app/api/tv-slides/upload-image/route.ts:8-30`, `app/api/grote-inpak/upload/route.ts:12-40`, `app/api/cnh/parse-pdf/route.ts:11-31`, `app/api/items-to-pack/upload-image/route.ts:8-67`. |
| AI output JSON parse | `app/api/incoming-goods/scan-label/route.ts:156-161`, `app/api/incoming-goods-airtec/scan-label/route.ts:252`, `app/api/incoming-goods-airtec/scan-label/route.ts:300`. |
| Search filter strings | `app/api/search_artikels/route.ts:17-19`, `app/api/checklist-beheer/templates/route.ts:17-18`, `lib/prepack/stage-kisten-stock.ts:261`. |

### 4. Plekken waar data naar de database gaat

Schrijfpad loopt vaak via `supabaseAdmin`, dus RLS wordt omzeild:
- `lib/supabase/server.ts:8-13`.

Voorbeelden:

| Tabel/domein | File:line | Actie |
|---|---:|---|
| `user_roles` | `app/api/auth/signup/route.ts:87-96` | Insert nieuwe user role. |
| `user_roles` | `app/api/auth/create-user-role/route.ts:33-41` | Public role insert/upsert-achtig pad. |
| `user_roles` | `app/api/admin/change-role/route.ts:29-40` | Admin role change. |
| `auth.users` | `app/api/auth/signup/route.ts:60` | Admin create user. |
| `time_logs` | `app/api/production-order-time/start/route.ts:57-60` | Insert tijdregistratie. |
| `time_logs` | `app/api/production-order-time/[id]/stop/route.ts:54-58` | Stop/update. |
| `production_orders` | `app/api/production-orders/upload/route.ts:26-41` | Delete/replace order. |
| `production_order_lines` | `app/api/tv-slides/production-status/route.ts:31-51` | Update TV line priority. |
| `items_to_pack` | `app/api/items-to-pack/route.ts:161-211` | Bulk delete. |
| `wms_package_lines` | `app/api/wms-packages/assign-line/route.ts:30-45` | Upsert line/package koppeling. |
| `tv_slides` | `app/api/tv-slides/route.ts:20-84` | CRUD slides. |
| `tv_screens` | `app/api/tv-screens/route.ts:31-105` | CRUD screens. |
| `tv_screen_slides` | `app/api/tv-screens/[slug]/slides/route.ts:54-99` | Update scherm-slide koppelingen. |
| `audit_logs` | `lib/api/audit.ts:33-48` | Fire-and-forget audit log. |

### 5. Plekken waar gevoelige data wordt gelezen

| Data | File:line | Wie kan lezen |
|---|---:|---|
| `user_roles` eigen status | `app/api/auth/me/route.ts:19-24` | Ingelogde user voor zichzelf. |
| `user_roles` middleware cache | `middleware.ts:173-183` | Middleware bij authenticated API request. |
| Username by arbitrary `userId` | `app/api/auth/current-user/route.ts:10-34` | Authenticated, maar query-gestuurd. |
| Alle users/admin data | `app/api/admin/users/route.ts:8-43` | Admin. |
| Employee names/status | `app/api/tv-slides/dagplanning/route.ts:8-54` | Publiek voor TV-display. |
| Priority items | `app/api/tv-slides/priorities/route.ts:7-70` | Publiek voor TV-display. |
| Production status/orders | `app/api/tv-slides/production-status/route.ts:31-140` | Publiek voor TV-display. |
| Storage rental data | `app/api/storage-rentals/items/route.ts:7-25` | Authenticated MW-only. |
| WMS/package data | `app/api/wms-packages/**` | Authenticated MW-only. |

### 6. External integrations

| Integratie | File:line | Secrets |
|---|---:|---|
| OpenAI chat/help | `lib/ai/process-help.ts:1-2` | `OPENAI_API_KEY`, `OPENAI_CHAT_MODEL`. |
| OpenAI vision labels | `lib/labels/openai-vision.ts:6-9` | `OPENAI_API_KEY`, `OPENAI_LABEL_MODEL`. |
| Anthropic label/CMR/PDF parsing | `app/api/incoming-goods/scan-label/route.ts:5`, `app/api/incoming-goods-airtec/scan-label/route.ts:6`, `lib/wood/parse-foresco-pdf.ts:1`, `lib/stock-count/extract-label.ts:1` | `ANTHROPIC_API_KEY`. |
| SMTP mail | `app/api/packed-items/send-email/route.ts:10-15`, `lib/airtec/packed-items-report-email.ts:35-40`, `app/api/bestellingen-algemeen/send-email/route.ts:28-33` | `SMTP_*`. |
| IMAP Airtec/Grote Inpak | `app/api/airtec/mail-import/route.ts:250-254`, `app/api/grote-inpak/pils-mail-import/route.ts:302-306` | `*_MAIL_HOST/USER/PASSWORD`. |
| Open-Meteo | `app/api/tv-slides/weather/route.ts:51` | Geen auth. |
| Vercel cron | `vercel.json:2-35` | Route-level secrets zoals `CRON_SECRET`. |

### 7. Secrets en opslag

Git ignore:
- `.gitignore:30-32`: `.env*.local` en `.env` genegeerd.
- Gap: `.env.production` en `.env.development` zonder `.local` worden niet expliciet genegeerd.

Geen `.env` bestanden gevonden in git:
- `git ls-files ".env*"` gaf geen output.
- `git log --all --name-only -- .env ...` gaf geen output.

Server-only secrets:
- `SUPABASE_SERVICE_ROLE_KEY`: `lib/supabase/server.ts:4`, `middleware.ts:175`.
- `OPENAI_API_KEY`: `lib/ai/process-help.ts:1`, `lib/labels/openai-vision.ts:6`.
- `ANTHROPIC_API_KEY`: diverse AI routes.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: mail routes.
- `CRON_SECRET`, `AIRTEC_*_SECRET`, `GROTE_INPAK_*_SECRET`: cron/mail imports.
- IMAP credentials: `AIRTEC_MAIL_*`, `GROTE_INPAK_*_MAIL_*`.

Public-safe:
- `NEXT_PUBLIC_SUPABASE_URL`.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `NEXT_PUBLIC_SITE_URL`.
- `NODE_ENV`.

Config aandachtspunten:
- `lib/supabase/client.ts:3-4` en `lib/supabase/server.ts:3-4` gebruiken placeholders bij ontbrekende env vars.
- `app/api/packed-items-airtec/send-daily-report/route.ts:18-22` laat toegang toe als secret ontbreekt.
- Enkele routes gebruiken fallback e-mailadressen in code, bv. `app/api/wood/send-pdf/route.ts:361`.

---

## Pass 2 - Authorization audit

### Kernobservatie

De meeste endpoints gebruiken `supabaseAdmin`, waardoor Supabase RLS niet beschermt tegen fouten in application-layer autorisatie. Zie `lib/supabase/server.ts:8-13`. De effectieve beveiliging zit dus in:
- `middleware.ts:104-203`.
- `withAuth` / `withAdmin` / `canAccessSite` in `lib/api/with-auth.ts:13-71`.
- Handmatige checks in elke route.

### Concrete authorization/IDOR issues

| Issue | Wie kan dit aanroepen? | Data-specifieke check? | IDOR/tampering risico | Niveau | File:line | Fix |
|---|---|---|---|---|---:|---|
| Public whitelist maakt TV writes publiek als handler zelf niet checkt | Iedereen | Nee | Ja, wijzigen van slides/prioriteiten/transport mogelijk | Kritiek | `middleware.ts:16-43`, `app/api/tv-slides/route.ts:20-84`, `app/api/tv-slides/production-status/route.ts:8-51` | Public route matching per methode doen: alleen GET publiek, PUT/POST/DELETE achter auth/admin. |
| `app/api/tv-slides/production-status` heeft publieke PUT door prefixlist | Iedereen | Alleen payload/site/line ID | Ja, line/order TV prioriteit manipuleerbaar | Kritiek | `middleware.ts:21`, `app/api/tv-slides/production-status/route.ts:8-51` | PUT beschermen met admin/auth. GET publiek houden. |
| `app/api/tv-slides/transport-planning` public prefix kan writes toelaten | Iedereen | Nee | Ja, transportplanning kan gemuteerd worden | Kritiek | `middleware.ts:23`, `app/api/tv-slides/transport-planning/route.ts:42-115` | Alleen GET publiek; POST/PUT/DELETE admin. |
| `/api/tv-slides` exacte public match is method-onafhankelijk | Iedereen | Nee | Ja, slide CRUD mogelijk als middleware alle methods doorlaat | Kritiek | `middleware.ts:42-43`, `app/api/tv-slides/route.ts:20-84` | `pathname === '/api/tv-slides' && method === 'GET'`. |
| Public TV reads tonen operationele data | Iedereen | Nee | Geen IDOR, wel informatielek | Midden-Hoog | `app/api/tv-slides/dagplanning/route.ts:8-54`, `app/api/tv-slides/priorities/route.ts:7-70` | Bewust beperken tot signage token, IP allowlist of minder detail tonen. |
| Airtec daily report secret fallback open | Iedereen als env secret ontbreekt | Secret optioneel | Triggeren van rapport/mail | Hoog | `app/api/packed-items-airtec/send-daily-report/route.ts:18-22` | `if (!secret) return false` in alle omgevingen behalve eventueel local dev. |
| Employees API mutaties zonder admin check | Elke verified user | Nee | Verticale privilege-escalatie | Hoog | `app/api/employees/route.ts:40-172` | POST/PUT/DELETE achter `withAdmin`; GET eventueel site-scoped. |
| Production order upload/replace zonder admin/role check | Elke verified user | Nee | Orders overschrijven via ordernummer | Hoog | `app/api/production-orders/upload/route.ts:26-41`, `app/api/production-orders/upload-for-time/route.ts:27-48` | Alleen admin/planner role. |
| Items-to-pack delete/update via ID body | Elke verified user | Nee | Data van andere flow verwijderen/wijzigen via ID | Hoog | `app/api/items-to-pack/route.ts:161-211`, `app/api/items-to-pack/[id]/route.ts:22-25` | Role/scope check per flow; audit log; deny bulk delete voor gewone users. |
| WMS package assign via arbitrary IDs | Elke verified user | Nee | `lineId`/`packageId` aanpassen | Hoog | `app/api/wms-packages/assign-line/route.ts:30-45` | Check project/package ownership/scope. |
| Storage rental data auth-only | Elke verified user | Nee | Interne users kunnen commerciële data zien/wijzigen | Hoog | `app/api/storage-rentals/items/route.ts:7-25` | Admin/role guard + object-level check. |
| `allowed_sites` wordt niet consequent enforced | Elke verified user | Beperkt/vaak niet | Cross-site reads/writes via `site` query/body | Midden-Hoog | `lib/api/with-auth.ts:31-35`, `app/api/production-orders/[orderNumber]/lines/route.ts:17-24` | `withSiteAccess(site)` wrapper of explicit `canAccessSite`. |
| `x-user-*` headers worden door handlers vertrouwd | Authenticated routes met wrappers | Afhankelijk van middleware header injection | Mogelijke spoofing als request headers niet correct overschreven worden | Hoog-Kritiek | `middleware.ts:196-201`, `lib/api/with-auth.ts:13-29` | Gebruik `NextResponse.next({ request: { headers } })` om request headers server-side te zetten en client headers te verwijderen. |
| `app/api/auth/current-user` leest username voor willekeurige userId | Elke verified user | Nee | User enumeration/IDOR | Midden | `app/api/auth/current-user/route.ts:10-34` | Alleen eigen userId toestaan of admin-only. |

### RLS-status

RLS bestaat op sommige tabellen, maar is meestal niet bepalend voor API security omdat server routes `supabaseAdmin` gebruiken:
- `supabase/migrations/add_user_roles.sql:16-33`: strikte RLS op `user_roles`.
- `supabase/migrations/20260415_tv_screens_and_transport.sql:9-21`: open policies voor `tv_screens` en `tv_screen_slides`.
- `supabase/migrations/20260407_tv_slides.sql`: TV slide policies.
- `supabase/migrations/20260122_add_production_order_costing.sql`: production order RLS/policies.

Praktische conclusie voor authorization review:
- RLS mag niet als primaire bescherming worden beschouwd voor server API's.
- Gebruik route-level role/site/object checks als bron van waarheid.

---

## Pass 3 - Input validation audit

### Systemisch patroon

Veel endpoints gebruiken `await request.json()` met losse destructuring en zonder schema validation. `lib/api/validation.ts:8-31` bestaat, maar wordt beperkt gebruikt.

Goed gebruikte validatie:
- `app/api/auth/session/route.ts:13`: `validateBody`.
- `app/api/incoming-goods-airtec/label-scan-photo/route.ts`.
- `app/api/incoming-goods-airtec/scan-label/route.ts`.
- `app/api/saw-sharpening/rounds/route.ts:45`.
- `app/api/saw-sharpening/rounds/[id]/route.ts:89`.
- `app/api/saw-sharpening/rounds/[id]/signatures/route.ts:47`.

### Issues met risico en fix

| Issue | File:line | Niveau | Risico | Concrete fix |
|---|---:|---|---|---|
| JSON body zonder schema op TV schermbeheer | `app/api/tv-screens/route.ts:31`, `app/api/tv-screens/route.ts:64` | Midden | Onverwachte types, lege strings, booleans verkeerd geïnterpreteerd | Zod schema voor create/update screen. |
| JSON body zonder schema op AI chat | `app/api/ai/chat/route.ts:9-11` | Midden | Te lange messages/role injection/DoS | `z.array(z.object({role:z.enum(...),content:z.string().max(...)})).max(...)`. |
| Search `.or()` met raw input | `app/api/search_artikels/route.ts:10`, `app/api/search_artikels/route.ts:17-19` | Laag-Midden | Wildcard/syntax manipulatie, brede query | Escape `%`, `_`, `,`; max lengte. |
| Items search raw `.or()` | `app/api/items-to-pack/route.ts:27` | Laag-Midden | Zelfde | Gedeelde `escapeIlike` helper. |
| Incoming goods search raw `.or()` | `app/api/incoming-goods/route.ts:21` | Laag-Midden | Zelfde | Gedeelde helper. |
| Checklist templates `.or` met `.eq.${afdeling}` | `app/api/checklist-beheer/templates/route.ts:17-18` | Hoog | PostgREST filterstring manipulatie via komma/special chars | Gebruik `.eq('afdeling', afdeling)` of strikt `z.enum/regex`. |
| Prepack stage kisten dynamic `.or` | `lib/prepack/stage-kisten-stock.ts:261`, `lib/prepack/stage-kisten-stock.ts:271` | Hoog | PostgREST filterstring manipulatie | Geen samengestelde `.or` met raw code; gebruik `.eq/.ilike` apart + regex whitelist. |
| Stock diagnostic dynamic `.or` | `app/api/grote-inpak/stock-diagnostic/route.ts:31`, `app/api/grote-inpak/stock-diagnostic/route.ts:42-44` | Midden-Hoog | Filterstring manipulatie | Regex whitelist voor kist/ERP; geen raw filterstrings. |
| TV image upload geen size/MIME hardening | `app/api/tv-slides/upload-image/route.ts:10-30` | Hoog | Grote uploads, verkeerde content-type, storage abuse | `file.size` limiet, MIME whitelist, veilige extensie, eventueel image transcoding. |
| Items image upload path input | `app/api/items-to-pack/upload-image/route.ts:8-67` | Hoog | Storage path/key manipulatie via `itemType/itemId` | `itemType` enum, `itemId` int, MIME/size checks. |
| Grote inpak upload geen strakke file cap | `app/api/grote-inpak/upload/route.ts:12-40` | Midden-Hoog | CPU/memory DoS door grote XLSX/CSV | Max file size + fileType enum + parser timeouts. |
| CNH PDF parse size cap ontbreekt | `app/api/cnh/parse-pdf/route.ts:11-31` | Midden | CPU/memory DoS | `file.size` limiet voor pdf-parse. |
| `incoming-goods/scan-label` gebruikt geen gedeeld scan schema | `app/api/incoming-goods/scan-label/route.ts:200-216` | Hoog | Grote base64 payload/AI abuse | `validateBody(request, scanLabelSchema)`, zoals Airtec variant. |
| `JSON.parse` op form/AI data zonder inhoudschema | `app/api/product-inspectie/controles/route.ts:66-81`, `app/api/incoming-goods/scan-label/route.ts:156-161` | Midden | Onverwachte objectvormen, crash of slechte data | Try/catch + Zod schema voor geparseerde objecten. |

Aanbevolen helpers:
- `escapeIlike(value: string): string`.
- `parsePositiveIntParam`.
- `validateJsonBody`.
- Upload helper voor `maxBytes`, MIME whitelist en storage key normalization.

---

## Pass 4 - Secrets en config audit

### Hardcoded credentials

Geen klassieke hardcoded API keys/JWTs/private keys gevonden in de kernapplicatiecode.

Aandachtspunten:
- Hardcoded e-mailadressen zijn geen secrets, maar wel privacy/config risico:
  - `app/api/packed-items-airtec/send-daily-report/route.ts:9-10`.
  - `app/api/wood/send-pdf/route.ts:361`.
  - `app/api/bestellingen-algemeen/send-email/route.ts:88`.
  - `app/api/airtec-kisten-stock/send-reorder/route.ts:78`.
- Legacy map `prodwilrijk oud/` bevat oude serverbestanden en DB env fallbacks:
  - `prodwilrijk oud/airtec_service (3).js:35-38`.

### `.env` in git

Controle:
- `git ls-files ".env*"`: geen output.
- `git log --all --name-only -- ".env" ...`: geen output.

`.gitignore`:
- `.gitignore:30-32`: `.env*.local` en `.env`.
- Aanbevolen: voeg ook `.env*` toe of minstens `.env.production`, `.env.development`, `.env.preview`.

### Public-safe env vars

| Env var | Classificatie | File:line |
|---|---|---:|
| `NEXT_PUBLIC_SUPABASE_URL` | Public-safe | `lib/supabase/client.ts:3`, `middleware.ts:7` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public-safe, beveiliging moet via RLS/auth | `lib/supabase/client.ts:4`, `middleware.ts:8` |
| `NEXT_PUBLIC_SITE_URL` | Public-safe, maar bepaalt CORS allowlist | `middleware.ts:13` |
| `NODE_ENV` | Public-safe | `components/ServiceWorkerRegister.tsx:9`, `app/api/auth/session/route.ts:31` |

### Server-only env vars

| Env var | Gebruik |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase/server.ts:4`, `middleware.ts:175`; volledige DB-toegang. |
| `OPENAI_API_KEY` | `lib/ai/process-help.ts:1`, `lib/labels/openai-vision.ts:6`. |
| `OPENAI_CHAT_MODEL`, `OPENAI_LABEL_MODEL` | Modelconfig, server-only. |
| `ANTHROPIC_API_KEY` | AI label/PDF parsing. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | Mail routes. |
| `CRON_SECRET` | Vercel cron / fallback. |
| `AIRTEC_MAIL_IMPORT_SECRET`, `AIRTEC_DAILY_REPORT_SECRET` | Airtec imports/reports. |
| `GROTE_INPAK_PILS_MAIL_IMPORT_SECRET`, `GROTE_INPAK_PACKED_MAIL_IMPORT_SECRET`, `GROTE_INPAK_KIST_MAIL_IMPORT_SECRET`, `GROTE_INPAK_FORECAST_MAIL_IMPORT_SECRET` | Grote Inpak cron/mail imports. |
| `AIRTEC_MAIL_HOST`, `AIRTEC_MAIL_PORT`, `AIRTEC_MAIL_USER`, `AIRTEC_MAIL_PASSWORD`, `AIRTEC_MAILBOX` | IMAP Airtec. |
| `GROTE_INPAK_*_MAIL_HOST/PORT/USER/PASSWORD/MAILBOX` | IMAP Grote Inpak. |
| `ORDER_EMAIL_TO`, `AIRTEC_DAILY_REPORT_RECIPIENTS`, `AIRTEC_DAILY_REPORT_FROM` | Mail recipients/from. |

### Config issues

| Issue | File:line | Niveau | Fix |
|---|---:|---|---|
| Service role key in middleware path | `middleware.ts:173-176` | Hoog gevoelig | Akkoord als server-only blijft; fail-fast als ontbreekt. |
| Placeholder Supabase keys | `lib/supabase/client.ts:3-4`, `lib/supabase/server.ts:3-4` | Midden | In production hard falen als env ontbreekt. |
| Cron report open als secret ontbreekt | `app/api/packed-items-airtec/send-daily-report/route.ts:18-22` | Hoog | `if (!secret) return false`. |
| Secrets via querystring in mail import | `app/api/airtec/mail-import/route.ts:217-220` | Midden | Alleen Authorization header toestaan. |
| Deploy hook URL is secret-like | `.deploy-hook` | Midden | Niet publiceren; roteren indien gedeeld. |

---

## Pass 5 - Dependencies (`npm audit`)

Command:

```bash
npm audit --json
```

Resultaat:
- Total vulnerabilities: 33.
- Critical: 2.
- High: 12.
- Moderate: 19.

Dependency tree inspect:

```bash
npm ls next nodemailer pdfjs-dist xlsx fast-xml-parser @aws-sdk/client-ses @mapbox/node-pre-gyp lodash flatted minimatch picomatch tar --depth=4
```

### High/Critical vulnerabilities

| Package | Direct? | Severity | Wordt gebruikt via | Productie/dev | Fix beschikbaar | Impact als laten staan |
|---|---:|---|---|---|---|---|
| `next@14.0.4` | Ja | Critical | App runtime | Production | Ja: `next@14.2.35` volgens audit | Auth bypass/middleware/cache/DoS advisories. Hoogste prioriteit omdat app op Next draait. |
| `fast-xml-parser@5.2.5` | Nee | Critical/High | `@types/nodemailer -> @aws-sdk/client-ses -> @aws-sdk/xml-builder` | Waarschijnlijk dev/type-only, maar aanwezig in tree | Ja | XML entity/DoS issues. Impact lager als AWS SES niet runtime gebruikt wordt; verwijderen/updaten types beter. |
| `nodemailer@6.10.1` | Ja | High | Mailroutes | Production | Ja, maar major naar `8.0.7` volgens audit | Email parser DoS / address interpretation issues. Relevant omdat app veel mail verstuurt. Upgrade testen. |
| `pdfjs-dist@3.11.174` | Ja | High | Client PDF rendering | Production indien PDF viewer gebruikt | Ja, major naar `5.7.284` | Malicious PDF kan JS execution triggeren bij openen. Upgrade vereist compatibiliteitstest. |
| `xlsx@0.18.5` | Ja | High | Excel import/export | Production | Audit toont fix via `@types/xlsx` downgrade, maar SheetJS npm package heeft historically geen eenvoudige patched npm release in dezelfde lijn | Prototype pollution/ReDoS bij verwerken van malafide Excel. Belangrijk wegens uploads/imports. Overweeg alternatieven of input limits/sandbox. |
| `@types/xlsx@0.0.36` | Ja dev | High via `xlsx` | Type package | Dev | Audit suggereert downgrade naar `0.0.35` (major flag) | Niet de echte runtime fix; issue komt door `xlsx`. |
| `tar` | Nee | High | `@mapbox/node-pre-gyp` | Transitive, waarschijnlijk install/build-time | Ja | Path traversal bij tar extraction. Minder runtime relevant tenzij package extraction gebeurt in app. |
| `@mapbox/node-pre-gyp` | Nee | High | Transitive package | Build/install | Ja | Effect van `tar`; lager runtime risico. |
| `lodash@4.17.21` | Nee | High | `recharts@2.15.4` | Production | Ja | Prototype pollution/code injection afhankelijk van kwetsbare lodash APIs. Recharts gebruikt lodash intern; exploitbaarheid waarschijnlijk beperkt maar update waar mogelijk. |
| `flatted` | Nee | High | `eslint -> file-entry-cache -> flat-cache` | Dev | Ja | Dev-only lint cache; geen production impact. |
| `minimatch` | Nee | High | ESLint tooling + `exceljs`/`readdir-glob` | Dev en mogelijk server import/export transitive | Ja | ReDoS in glob patterns. Meestal dev/build; lager runtime risico. |
| `picomatch` | Nee | High | Tailwind/chokidar/micromatch tooling | Dev/build | Ja | ReDoS/glob issues. Meestal dev/build; lager runtime risico. |
| `@typescript-eslint/parser` / `typescript-estree` | Nee | High | ESLint config | Dev | Ja | Dev-only. |

### Dependency prioriteit

1. Upgrade `next` naar een gepatchte 14.x versie (`14.2.35` volgens audit) en test build/runtime.
2. Upgrade/test `nodemailer`.
3. Behandel `xlsx`: file size caps, trusted uploads, overweeg vervanging of sandboxing voor Excel parsing.
4. Upgrade `pdfjs-dist` als PDF rendering voor externe PDF's wordt gebruikt.
5. Daarna dev/build transitive issues via `npm update`/dependency refresh.

---

## Prioriteitenlijst voor opvolging

1. **Kritiek:** public routes method-specifiek maken. Alleen GET publiek voor TV; PUT/POST/DELETE achter auth/admin.
2. **Kritiek:** `next` upgraden naar gepatchte versie.
3. **Hoog:** middleware user headers correct op request zetten en client-spoofing uitsluiten.
4. **Hoog:** `send-daily-report` secret verplicht maken.
5. **Hoog:** werknemers, production-order uploads, WMS, storage-rentals en items-to-pack mutaties achter role/site checks zetten.
6. **Hoog:** file uploads hardenen met MIME/size limits.
7. **Midden-Hoog:** `allowed_sites` consequent afdwingen op site-scoped API routes.
8. **Midden:** ILIKE/PostgREST filter escaping helper toevoegen.
9. **Midden:** `.env*` in `.gitignore` aanscherpen.
10. **Midden:** publieke TV read endpoints bewust minimaliseren of scherm-token toevoegen.

