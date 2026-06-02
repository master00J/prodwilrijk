# IT-aanvraag — Server Prodwilrijk V2

**Versie:** 1.0  
**Datum:** 1 juni 2026  
**Aanvrager:** _________________________  
**Contact ontwikkeling:** _________________________

---

## Doel

Wij willen de interne webapplicatie **Prodwilrijk V2** hosten op een bedrijfsserver (on-premise). De applicatie draait volledig in **Docker**. IT levert de infrastructuur; het ontwikkelteam installeert en beheert de applicatie-containers.

**Domein:** `prodwilrijk.be` (eigendom aanvrager — DNS wordt **niet** door IT geregeld, enkel het **publieke server-IP** is nodig).

---

## Wat IT moet opleveren

### 1. Virtuele machine

**Optie A — één server (minimum)**

| | Minimum | Aanbevolen |
|---|---------|------------|
| vCPU | 4 | 8 |
| RAM | 8 GB | **16 GB** |
| Schijf | 100 GB SSD | **250 GB SSD** |
| OS | Ubuntu 22.04 LTS of 24.04 LTS (64-bit) | |

**Optie B — twee servers (voorkeur productie)**

| Server | Rol | vCPU | RAM | Schijf |
|--------|-----|------|-----|--------|
| VM 1 | Webapp + reverse proxy | 2–4 | 4–8 GB | 50 GB SSD |
| VM 2 | Database + file storage | 4–8 | 8–16 GB | 200+ GB SSD |

Extra schijfruimte is nodig voor PostgreSQL en foto-/documentopslag (min. 50 GB bovenop database).

---

### 2. Basissoftware op de VM

- [ ] Ubuntu LTS, timezone **Europe/Brussels**, NTP actief
- [ ] **Docker Engine** (v24+) + **Docker Compose** (v2)
- [ ] **nginx** als reverse proxy
- [ ] **Let's Encrypt** (certbot) of intern PKI-certificaat voor HTTPS
- [ ] Geen aparte installatie van Node.js, PostgreSQL of Supabase op het OS — alles draait in containers

---

### 3. Toegang

- [ ] **SSH-toegang** voor het ontwikkelteam (key-based, geen wachtwoordlogin)
- [ ] Deploy-user met sudo-rechten voor Docker
- [ ] User toevoegen aan `docker`-groep

**Door te geven na oplevering:**

```
Publiek IP:     ___________________
Intern IP:      ___________________  (indien van toepassing)
SSH hostname:   ___________________
SSH user:       ___________________
SSH poort:      22 (of: _____)
```

---

### 4. Firewall

#### Inkomend (naar server)

| Poort | Protocol | Toegang | Opmerking |
|-------|----------|---------|-----------|
| **443** | TCP | Internet / bedrijfsnetwerk | HTTPS — **hoofdtoegang** |
| **80** | TCP | Internet | HTTP → HTTPS redirect + certificaatvernieuwing |
| **22** | TCP | Vaste IP's IT + dev team | SSH-beheer |

#### Niet publiek openzetten

Poorten **3000**, **8000**, **5432**, **6543** — enkel intern/localhost (Docker + reverse proxy).

#### Uitgaand (van server)

| Doel | Poort | Verplicht |
|------|-------|-----------|
| SMTP (mail versturen) | 587 / 465 | **Ja** |
| IMAP (mail ophalen) | 993 | **Ja** |
| HTTPS (updates, optioneel AI) | 443 | **Ja** |

> Bij interne mailservers: uitgaande routes naar die hosts volstaan.

---

### 5. Reverse proxy & HTTPS

IT installeert nginx (of equivalent) met TLS. Routing:

| URL | Doorsturen naar |
|-----|-----------------|
| `https://prodwilrijk.be` | `http://127.0.0.1:3000` |
| `https://www.prodwilrijk.be` | `http://127.0.0.1:3000` |
| `https://api.prodwilrijk.be` | `http://127.0.0.1:8000` |

**Vereisten reverse proxy:**
- TLS-certificaat voor `prodwilrijk.be`, `www.prodwilrijk.be` en `api.prodwilrijk.be`
- Automatische certificaatvernieuwing
- **WebSocket-ondersteuning** op `api.prodwilrijk.be`
- Uploadlimiet min. **50 MB** (`client_max_body_size`)

Referentieconfiguratie (optioneel, van ontwikkelteam): `docker/nginx/prodwilrijk.conf`

---

### 6. DNS (door aanvrager, niet IT)

Het domein `prodwilrijk.be` wordt beheerd door de aanvrager. IT levert enkel het **publieke IP-adres** van de server.

Aanvrager zet zelf deze DNS-records:

| Host | Type | Waarde |
|------|------|--------|
| `@` | A | `<publiek IP server>` |
| `www` | A | `<publiek IP server>` |
| `api` | A | `<publiek IP server>` |

---

### 7. Backups

| Wat | Frequentie | Retentie |
|-----|------------|----------|
| VM snapshot | Dagelijks | Min. 30 dagen |
| Database-backup | Dagelijks | Min. 30 dagen |
| Off-site kopie | Wekelijks | Min. 90 dagen |
| Restore-test | 1× per kwartaal | — |

---

### 8. Monitoring (minimum)

- [ ] Alert bij schijfruimte > 80%
- [ ] Alert bij VM/container niet bereikbaar
- [ ] Logretentie min. 30 dagen (nginx + systeem)

---

### 9. Beveiliging

- [ ] SSH: key-only, root login uit
- [ ] Firewall: default deny
- [ ] Automatische OS-security-updates (of afgesproken patchvenster)
- [ ] Admin-dashboard database (Supabase Studio) **niet** publiek — enkel intern/VPN

---

## Opleveringschecklist IT

Vóór overdracht aan ontwikkelteam:

- [ ] VM(s) operationeel volgens specificaties
- [ ] Docker + Docker Compose getest (`docker run hello-world`)
- [ ] SSH-toegang dev team actief
- [ ] Firewall: 443 (+ 80, 22) correct
- [ ] Uitgaand SMTP, IMAP en HTTPS toegestaan
- [ ] nginx geïnstalleerd, reverse proxy routes klaar
- [ ] TLS-certificaat actief voor alle 3 hostnames
- [ ] Backups gepland en getest
- [ ] Publiek IP doorgegeven aan aanvrager (voor DNS)

---

## Wat IT niet hoeft te doen

| Taak | Uitgevoerd door |
|------|-----------------|
| Applicatie deployen | Ontwikkelteam |
| Docker-containers app/database | Ontwikkelteam |
| Database-migraties | Ontwikkelteam |
| DNS-records domein | Aanvrager |
| Geplande taken (cron) | Ontwikkelteam (via Docker) |
| SMTP/IMAP credentials invullen | Ontwikkelteam |

---

## Architectuur (referentie)

```
Internet
   │
   ▼
nginx (:443) ──► Next.js (:3000)     prodwilrijk.be
              └──► Supabase API (:8000) api.prodwilrijk.be
                        │
                        └── PostgreSQL + file storage (Docker, intern)
```

Ontwikkelteam deployt na oplevering server. Geschatte duur eerste installatie: **1 werkdag**.

---

## Vragen / contact

| | Naam | E-mail |
|---|------|--------|
| Aanvrager | | |
| Ontwikkelaar | | |
| IT contactpersoon | | |
