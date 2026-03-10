/**
 * import-packed-consumption.js
 *
 * Leest alle PACKED_Y*.XLS en PACKED_N*.XLS bestanden uit de map 'packed-attachments'
 * en schrijft het verbruik per kisttype per dag naar de Supabase tabel
 * 'grote_inpak_packed_consumption'.
 *
 * Gebruik:
 *   node scripts/import-packed-consumption.js
 *
 * Vereist een .env.local bestand in de projectroot met:
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ...
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// ── .env.local laden (eenvoudige parser, geen externe module nodig) ──────────
const envFile = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  });
  console.log('✅ .env.local geladen');
} else {
  console.warn('⚠️  Geen .env.local gevonden — gebruik omgevingsvariabelen of maak .env.local aan.');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || SUPABASE_URL.includes('placeholder')) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL niet ingesteld in .env.local');
  process.exit(1);
}
if (!SUPABASE_KEY || SUPABASE_KEY.includes('placeholder')) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY niet ingesteld in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Paden ────────────────────────────────────────────────────────────────────
const ATTACHMENTS_DIR = path.join(__dirname, '..', '..', 'packed-attachments');

if (!fs.existsSync(ATTACHMENTS_DIR)) {
  console.error(`❌ Map niet gevonden: ${ATTACHMENTS_DIR}`);
  process.exit(1);
}

// ── Datum parseer-hulp (IBM AS/400 YYMMDD numeriek) ─────────────────────────
function parseIbmDate(raw) {
  if (!raw && raw !== 0) return null;
  const str = String(Math.round(Number(raw))).padStart(6, '0');
  if (str.length !== 6) return null;
  const yy = parseInt(str.slice(0, 2), 10);
  const mm = parseInt(str.slice(2, 4), 10);
  const dd = parseInt(str.slice(4, 6), 10);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  const dateStr = `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  return dateStr;
}

// ── Eén XLS-bestand verwerken ────────────────────────────────────────────────
function parseXlsFile(filePath, sourceType) {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (rows.length < 2) return [];

  // Bepaal kolomindex op basis van de header-rij
  const header = rows[0].map(h => String(h || '').trim().toUpperCase());

  // Kolom D = PCCATP (kisttype), kolom I = PCSCDT (scandatum)
  let caseTypeIdx = header.indexOf('PCCATP');
  let dateIdx     = header.indexOf('PCSCDT');

  // Fallback: gebruik vaste kolom-indices (D=3, I=8)
  if (caseTypeIdx < 0) caseTypeIdx = 3;
  if (dateIdx < 0)     dateIdx     = 8;

  // Als er meerdere PCSCDT kolommen zijn, neem de tweede (de scandate, niet de packdate)
  const allPcscdt = header.reduce((acc, h, i) => (h === 'PCSCDT' ? [...acc, i] : acc), []);
  if (allPcscdt.length >= 2) dateIdx = allPcscdt[1];

  // Aggregeer: { `caseType|date` → count }
  const counts = new Map();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every(cell => cell === '' || cell === null)) continue;

    const caseType = String(row[caseTypeIdx] || '').trim().toUpperCase();
    if (!caseType || !caseType.startsWith('C')) continue;

    const rawDate = row[dateIdx];
    const scanDate = parseIbmDate(rawDate);
    if (!scanDate) continue;

    const key = `${caseType}|${scanDate}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return Array.from(counts.entries()).map(([key, qty]) => {
    const [caseType, scanDate] = key.split('|');
    return { case_type: caseType, scan_date: scanDate, quantity: qty, source_type: sourceType };
  });
}

// ── Bepaal source_type uit bestandsnaam ──────────────────────────────────────
function getSourceType(filename) {
  const upper = filename.toUpperCase();
  if (upper.includes('PACKED_Y')) return 'Y';
  if (upper.includes('PACKED_N')) return 'N';
  return 'Y';
}

// ── Batch-upsert helper ──────────────────────────────────────────────────────
async function upsertBatch(records) {
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const slice = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from('grote_inpak_packed_consumption')
      .upsert(slice, { onConflict: 'case_type,scan_date,source_type', ignoreDuplicates: false });
    if (error) throw new Error(`Supabase upsert fout (batch ${i}): ${error.message}`);
    inserted += slice.length;
  }
  return inserted;
}

// ── Hoofd ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📦 PACKED verbruik importeren naar Supabase...');
  console.log(`📁 Map: ${ATTACHMENTS_DIR}\n`);

  const files = fs.readdirSync(ATTACHMENTS_DIR)
    .filter(f => /\.(xls|xlsx)$/i.test(f) && /PACKED_[YN]/i.test(f))
    .sort();

  console.log(`🔎 Gevonden: ${files.length} bestanden\n`);
  if (files.length === 0) {
    console.error('❌ Geen PACKED_Y*.XLS of PACKED_N*.XLS bestanden gevonden.');
    process.exit(1);
  }

  const allRecords = [];
  let errors = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const filePath = path.join(ATTACHMENTS_DIR, file);
    const sourceType = getSourceType(file);

    try {
      const records = parseXlsFile(filePath, sourceType);
      allRecords.push(...records);
      if ((i + 1) % 50 === 0 || i === files.length - 1) {
        process.stdout.write(`\r  ✅ ${i + 1}/${files.length} bestanden verwerkt (${allRecords.length} rijen)   `);
      }
    } catch (err) {
      errors++;
      console.warn(`\n  ⚠️  Fout bij ${file}: ${err.message}`);
    }
  }

  console.log(`\n\n📊 Totaal te importeren: ${allRecords.length} unieke dagrecords`);
  if (errors > 0) console.warn(`⚠️  ${errors} bestanden overgeslagen wegens fouten`);

  if (allRecords.length === 0) {
    console.error('❌ Geen geldige data gevonden. Controleer de bestandsstructuur.');
    process.exit(1);
  }

  console.log('⬆️  Uploaden naar Supabase...');
  const inserted = await upsertBatch(allRecords);
  console.log(`✅ ${inserted} rijen succesvol opgeslagen in grote_inpak_packed_consumption`);

  // Samenvatting per kisttype
  const summary = new Map();
  allRecords.forEach(r => {
    const prev = summary.get(r.case_type) || 0;
    summary.set(r.case_type, prev + r.quantity);
  });
  const sorted = [...summary.entries()].sort((a, b) => b[1] - a[1]);
  console.log('\n📈 Top 15 kisten (totaal verbruik afgelopen jaar):');
  sorted.slice(0, 15).forEach(([kist, qty], i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${kist.padEnd(8)} → ${qty} stuks`);
  });
  console.log('\n🎉 Import voltooid!\n');
}

main().catch(err => {
  console.error('\n❌ Onverwachte fout:', err.message);
  process.exit(1);
});
