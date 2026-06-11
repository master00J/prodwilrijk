// Rapportagemail wanneer prio-lijnen van de PILS verdwijnen (= unit verwerkt/verpakt).
// Wordt aangeroepen vanuit de PILS-verwerking, vóór het verwijderen van de cases,
// zodat de gekoppelde klantmails (ON DELETE CASCADE) nog meegestuurd kunnen worden.

import nodemailer from 'nodemailer'
import { supabaseAdmin } from '@/lib/supabase/server'

const REPORT_TO = process.env.GROTE_INPAK_PRIO_REPORT_TO || 'prodwilrijk@foresco.eu'
const MAX_ATTACHMENTS = 10
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024

export type RemovedPriorityCase = {
  case_label: string
  case_type: string | null
  serial_number?: string | null
  status?: string | null
  arrival_date?: string | null
  deadline?: string | null
  comment?: string | null
  atlas_planner_email?: string | null
  bc_shop_order_no?: string | null
}

type LinkedMailRow = {
  id: number
  case_label: string
  original_filename: string
  content_type: string | null
  subject: string | null
  from_email: string | null
  from_name: string | null
  received_at: string | null
  body_text: string | null
  file_bytes: unknown
}

function decodeFileBytes(fileBytes: unknown): Buffer {
  if (!fileBytes) return Buffer.alloc(0)
  if (Buffer.isBuffer(fileBytes)) return fileBytes
  if (fileBytes instanceof Uint8Array) return Buffer.from(fileBytes)
  if (Array.isArray(fileBytes)) return Buffer.from(fileBytes)
  if (typeof fileBytes === 'object' && fileBytes !== null && 'data' in fileBytes) {
    const data = (fileBytes as { data?: unknown }).data
    if (Array.isArray(data)) return Buffer.from(data)
  }
  if (typeof fileBytes === 'string') {
    const s = fileBytes.trim()
    if (s.startsWith('\\x')) return Buffer.from(s.slice(2), 'hex')
    if (/^[0-9a-f]+$/i.test(s) && s.length % 2 === 0) return Buffer.from(s, 'hex')
    return Buffer.from(s, 'base64')
  }
  if (fileBytes instanceof ArrayBuffer) return Buffer.from(fileBytes)
  return Buffer.alloc(0)
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('nl-BE')
}

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('nl-BE', { dateStyle: 'short', timeStyle: 'short' })
}

async function loadLinkedMails(caseLabels: string[]): Promise<Map<string, LinkedMailRow[]>> {
  const byLabel = new Map<string, LinkedMailRow[]>()
  if (caseLabels.length === 0) return byLabel

  const { data, error } = await supabaseAdmin
    .from('grote_inpak_case_linked_mails')
    .select(
      'id, case_label, original_filename, content_type, subject, from_email, from_name, received_at, body_text, file_bytes'
    )
    .in('case_label', caseLabels)
    .order('received_at', { ascending: true })

  if (error) {
    console.warn('priority-removed-report: gekoppelde mails laden mislukt:', error.message)
    return byLabel
  }

  for (const row of (data || []) as LinkedMailRow[]) {
    const label = String(row.case_label || '').trim()
    if (!label) continue
    byLabel.set(label, [...(byLabel.get(label) || []), row])
  }
  return byLabel
}

function buildHtml(
  cases: RemovedPriorityCase[],
  mailsByLabel: Map<string, LinkedMailRow[]>,
  sourceFile: string | null
): string {
  const rows = cases
    .map((c) => {
      const mails = mailsByLabel.get(c.case_label) || []
      const mailInfo = mails.length > 0
        ? mails
            .map(
              (m) =>
                `${escapeHtml(m.subject || '(geen onderwerp)')} — ${escapeHtml(
                  m.from_name || m.from_email || 'onbekende afzender'
                )} (${fmtDateTime(m.received_at)})`
            )
            .join('<br/>')
        : '—'
      return `<tr>
        <td style="padding:6px 10px;border:1px solid #d1d5db;font-weight:bold;">${escapeHtml(c.case_label)}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;">${escapeHtml(c.case_type || '—')}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;">${escapeHtml(c.serial_number || '—')}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;">${escapeHtml(c.status || '—')}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;">${fmtDate(c.arrival_date)}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;">${fmtDate(c.deadline)}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;">${escapeHtml(c.comment || '—')}</td>
        <td style="padding:6px 10px;border:1px solid #d1d5db;">${mailInfo}</td>
      </tr>`
    })
    .join('')

  return `
  <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;">
    <h2 style="color:#047857;">✅ Prio-units verwerkt (van PILS verdwenen)</h2>
    <p>
      De volgende <strong>${cases.length}</strong> lijn(en) met prioriteit stonden op de PILS
      en zijn bij de laatste PILS-update niet meer aanwezig — de units zijn dus verwerkt/verpakt.
      ${sourceFile ? `<br/>Bron: <em>${escapeHtml(sourceFile)}</em>` : ''}
    </p>
    <table style="border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#ecfdf5;">
          <th style="padding:6px 10px;border:1px solid #d1d5db;text-align:left;">Case</th>
          <th style="padding:6px 10px;border:1px solid #d1d5db;text-align:left;">Type</th>
          <th style="padding:6px 10px;border:1px solid #d1d5db;text-align:left;">Serienr</th>
          <th style="padding:6px 10px;border:1px solid #d1d5db;text-align:left;">Status</th>
          <th style="padding:6px 10px;border:1px solid #d1d5db;text-align:left;">Aankomst</th>
          <th style="padding:6px 10px;border:1px solid #d1d5db;text-align:left;">Deadline</th>
          <th style="padding:6px 10px;border:1px solid #d1d5db;text-align:left;">Commentaar</th>
          <th style="padding:6px 10px;border:1px solid #d1d5db;text-align:left;">Gekoppelde klantmail(s)</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="font-size:12px;color:#6b7280;margin-top:16px;">
      De originele klantmails zitten als bijlage bij deze mail (indien aanwezig).<br/>
      Automatisch verstuurd door prodwilrijk.be — grote inpak.
    </p>
  </div>`
}

/**
 * Stuur de rapportagemail voor prio-lijnen die van de PILS verdwijnen.
 * Moet aangeroepen worden VÓÓR het verwijderen van de cases (CASCADE op linked mails).
 * Gooit nooit: een mislukte mail mag de PILS-verwerking niet blokkeren.
 */
export async function sendPriorityRemovedReport(
  removedCases: RemovedPriorityCase[],
  sourceFile: string | null
): Promise<void> {
  if (removedCases.length === 0) return

  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.warn('priority-removed-report: SMTP niet geconfigureerd, rapport overgeslagen')
      return
    }

    const labels = removedCases.map((c) => c.case_label)
    const mailsByLabel = await loadLinkedMails(labels)

    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = []
    let totalBytes = 0
    for (const [label, mails] of mailsByLabel) {
      for (const mail of mails) {
        if (attachments.length >= MAX_ATTACHMENTS) break
        const bytes = decodeFileBytes(mail.file_bytes)
        if (bytes.length === 0 || totalBytes + bytes.length > MAX_ATTACHMENT_BYTES) continue
        totalBytes += bytes.length
        attachments.push({
          filename: `${label} - ${mail.original_filename || `mail-${mail.id}.eml`}`,
          content: bytes,
          contentType: mail.content_type || 'application/octet-stream',
        })
      }
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    })

    const labelList = labels.join(', ')
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: REPORT_TO,
      subject: `✅ Prio verwerkt: ${labels.length === 1 ? labelList : `${labels.length} units (${labelList})`}`,
      html: buildHtml(removedCases, mailsByLabel, sourceFile),
      attachments,
    })

    console.log(
      `priority-removed-report: rapport verstuurd naar ${REPORT_TO} voor ${labels.length} prio-case(s): ${labelList}`
    )
  } catch (err) {
    console.error('priority-removed-report: versturen mislukt:', err)
  }
}
