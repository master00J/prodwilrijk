import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const parseInsertBlocks = (sql: string, tableName: string) => {
  const regex = new RegExp(`INSERT INTO\\s+\`${tableName}\`[^]*?VALUES\\s*([\\s\\S]*?);`, 'gi')
  const blocks: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(sql)) !== null) {
    blocks.push(match[1])
  }
  return blocks
}

const parseValuesBlock = (block: string) => {
  const rows: Array<Array<string | number | null>> = []
  let currentRow: Array<string | number | null> = []
  let currentValue = ''
  let inString = false
  let escape = false
  let inRow = false
  let valueWasQuoted = false

  const pushValue = () => {
    const raw = currentValue.trim()
    let value: string | number | null = null
    if (valueWasQuoted) {
      value = currentValue
    } else if (raw.length === 0 || raw.toUpperCase() === 'NULL') {
      value = null
    } else if (/^-?\d+(\.\d+)?$/.test(raw)) {
      value = Number(raw)
    } else {
      value = raw
    }
    currentRow.push(value)
    currentValue = ''
    valueWasQuoted = false
  }

  for (let i = 0; i < block.length; i += 1) {
    const char = block[i]

    if (inString) {
      if (escape) {
        currentValue += char
        escape = false
        continue
      }
      if (char === '\\') {
        escape = true
        continue
      }
      if (char === "'") {
        const next = block[i + 1]
        if (next === "'") {
          currentValue += "'"
          i += 1
          continue
        }
        inString = false
        continue
      }
      currentValue += char
      continue
    }

    if (char === "'") {
      inString = true
      valueWasQuoted = true
      continue
    }
    if (char === '(') {
      inRow = true
      currentRow = []
      currentValue = ''
      valueWasQuoted = false
      continue
    }
    if (char === ')' && inRow) {
      pushValue()
      rows.push(currentRow)
      inRow = false
      continue
    }
    if (char === ',' && inRow) {
      pushValue()
      continue
    }
    if (inRow) {
      currentValue += char
    }
  }

  return rows
}

const normalizeDate = (value: unknown) => {
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '0000-00-00' || trimmed === '0000-00-00 00:00:00') {
      return null
    }
    return trimmed
  }
  return value as string
}

const parseEmployeeIds = (value: unknown) => {
  if (!value) return [] as number[]
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
    }
  } catch (error) {
    // ignore
  }
  return [] as number[]
}

const chunkArray = <T,>(items: T[], size: number) => {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const packedFile = formData.get('packedFile')
    const timelogsFile = formData.get('timelogsFile')
    const truncate = formData.get('truncate') === 'true'
    const dryRun = formData.get('dryRun') === 'true'

    if (!(packedFile instanceof File) || !(timelogsFile instanceof File)) {
      return NextResponse.json({ error: 'Beide SQL bestanden zijn verplicht.' }, { status: 400 })
    }

    const packedSql = await packedFile.text()
    const timelogSql = await timelogsFile.text()

    const packedBlocks = parseInsertBlocks(packedSql, 'packed_items_airtec')
    const packedRows = packedBlocks.flatMap(parseValuesBlock)
    const packedItems = packedRows.map((row) => {
      const received = normalizeDate(row[7]) || normalizeDate(row[8]) || new Date().toISOString()
      const packed = normalizeDate(row[8]) || received
      const quantity = Number.isFinite(row[9]) ? Number(row[9]) : 1
      return {
        beschrijving: row[1] ?? null,
        item_number: row[2] ?? null,
        lot_number: row[3] ?? null,
        datum_opgestuurd: normalizeDate(row[4]),
        kistnummer: row[5] ?? null,
        divisie: row[6] ?? null,
        datum_ontvangen: received,
        date_packed: packed,
        quantity,
      }
    })

    const timelogBlocks = parseInsertBlocks(timelogSql, 'airtec_timelogs')
    const timelogRows = timelogBlocks.flatMap(parseValuesBlock)
    const timeLogs = timelogRows.flatMap((row) => {
      const employeeIds = parseEmployeeIds(row[3])
      const startTime = normalizeDate(row[1])
      const endTime = normalizeDate(row[2])
      return employeeIds.map((employeeId) => ({
        employee_id: employeeId,
        type: 'items_to_pack_airtec',
        start_time: startTime,
        end_time: endTime,
        is_paused: false,
      }))
    })

    if (truncate && !dryRun) {
      const { error: packedDeleteError } = await supabaseAdmin
        .from('packed_items_airtec')
        .delete()
        .neq('id', 0)
      if (packedDeleteError) {
        throw new Error(`Wissen packed_items_airtec mislukt: ${packedDeleteError.message}`)
      }

      const { error: timeDeleteError } = await supabaseAdmin
        .from('time_logs')
        .delete()
        .eq('type', 'items_to_pack_airtec')
      if (timeDeleteError) {
        throw new Error(`Wissen time_logs mislukt: ${timeDeleteError.message}`)
      }
    }

    let createdEmployees = 0

    if (!dryRun) {
      for (const chunk of chunkArray(packedItems, 500)) {
        const { error } = await supabaseAdmin.from('packed_items_airtec').insert(chunk)
        if (error) {
          throw new Error(`Insert packed_items_airtec mislukt: ${error.message}`)
        }
      }

      const employeeIds = [...new Set(timeLogs.map((log) => log.employee_id).filter(Boolean))]
      if (employeeIds.length > 0) {
        const existingIds = new Set<number>()
        for (const chunk of chunkArray(employeeIds, 500)) {
          const { data, error } = await supabaseAdmin.from('employees').select('id').in('id', chunk)
          if (error) {
            throw new Error(`Employees ophalen mislukt: ${error.message}`)
          }
          data?.forEach((row) => existingIds.add(row.id))
        }
        const missingEmployees = employeeIds
          .filter((id) => !existingIds.has(id))
          .map((id) => ({
            id,
            name: `Legacy ${id}`,
            active: false,
          }))

        createdEmployees = missingEmployees.length
        for (const chunk of chunkArray(missingEmployees, 500)) {
          const { error } = await supabaseAdmin.from('employees').insert(chunk)
          if (error) {
            throw new Error(`Employees insert mislukt: ${error.message}`)
          }
        }
      }

      for (const chunk of chunkArray(timeLogs, 1000)) {
        const { error } = await supabaseAdmin.from('time_logs').insert(chunk)
        if (error) {
          throw new Error(`Insert time_logs mislukt: ${error.message}`)
        }
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      truncate,
      packedItems: packedItems.length,
      timeLogs: timeLogs.length,
      createdEmployees,
    })
  } catch (error: any) {
    console.error('Airtec legacy import error:', error)
    return NextResponse.json(
      { error: error.message || 'Import mislukt' },
      { status: 500 }
    )
  }
}
