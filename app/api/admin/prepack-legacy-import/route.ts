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

const excelSerialToIso = (serial: number) => {
  const base = Date.UTC(1899, 11, 30)
  const millis = serial * 86400000
  const date = new Date(base + millis)
  if (!Number.isFinite(date.getTime())) return null
  return date.toISOString()
}

const normalizeDate = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') {
    return excelSerialToIso(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '0000-00-00' || trimmed === '0000-00-00 00:00:00') {
      return null
    }
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const serial = Number(trimmed)
      return excelSerialToIso(serial)
    }
    return trimmed
  }
  return null
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

    const packedBlocks = parseInsertBlocks(packedSql, 'packed_items')
    const packedRows = packedBlocks.flatMap(parseValuesBlock)
    const packedItems = packedRows.map((row) => {
      const added = normalizeDate(row[4]) || new Date().toISOString()
      const packed = normalizeDate(row[5]) || added
      const amount = Number.isFinite(row[3]) ? Number(row[3]) : 1
      return {
        item_number: row[1] ?? null,
        po_number: row[2] ?? null,
        amount,
        date_added: added,
        date_packed: packed,
        original_id: row[6] ?? null,
      }
    })

    const timelogBlocks = parseInsertBlocks(timelogSql, 'prepack_timelogs')
    const timelogRows = timelogBlocks.flatMap(parseValuesBlock)
    const legacyTimeLogs = timelogRows.map((row) => ({
      employeeIds: parseEmployeeIds(row[2]),
      start_time: normalizeDate(row[3]),
      end_time: normalizeDate(row[4]),
    }))
    const legacyEmployeeIds = [
      ...new Set(legacyTimeLogs.flatMap((row) => row.employeeIds).filter(Boolean)),
    ]
    const unknownEmployeeName = 'Legacy onbekend'

    if (truncate && !dryRun) {
      const { error: packedDeleteError } = await supabaseAdmin
        .from('packed_items')
        .delete()
        .neq('id', 0)
      if (packedDeleteError) {
        throw new Error(`Wissen packed_items mislukt: ${packedDeleteError.message}`)
      }

      const { error: timeDeleteError } = await supabaseAdmin
        .from('time_logs')
        .delete()
        .eq('type', 'items_to_pack')
      if (timeDeleteError) {
        throw new Error(`Wissen time_logs mislukt: ${timeDeleteError.message}`)
      }
    }

    let createdEmployees = 0
    let unknownEmployeeId: number | null = null

    if (!dryRun) {
      for (const chunk of chunkArray(packedItems, 500)) {
        const { error } = await supabaseAdmin.from('packed_items').insert(chunk)
        if (error) {
          throw new Error(`Insert packed_items mislukt: ${error.message}`)
        }
      }

      const legacyNames = legacyEmployeeIds.map((id) => `Legacy ${id}`)
      const legacyIdToEmployeeId = new Map<number, number>()

      if (legacyNames.length > 0) {
        for (const chunk of chunkArray(legacyNames, 500)) {
          const { data, error } = await supabaseAdmin.from('employees').select('id, name').in('name', chunk)
          if (error) {
            throw new Error(`Employees ophalen mislukt: ${error.message}`)
          }
          data?.forEach((row) => {
            const match = row.name?.replace('Legacy ', '')
            const legacyId = match ? Number(match) : NaN
            if (Number.isFinite(legacyId)) {
              legacyIdToEmployeeId.set(legacyId, row.id)
            }
          })
        }

        const missingLegacyIds = legacyEmployeeIds.filter((id) => !legacyIdToEmployeeId.has(id))
        if (missingLegacyIds.length > 0) {
          const missingEmployees = missingLegacyIds.map((id) => ({
            name: `Legacy ${id}`,
            active: false,
          }))
          createdEmployees = missingEmployees.length
          for (const chunk of chunkArray(missingEmployees, 500)) {
            const { error } = await supabaseAdmin
              .from('employees')
              .upsert(chunk, { onConflict: 'name' })
            if (error) {
              throw new Error(`Employees insert mislukt: ${error.message}`)
            }
          }
          for (const chunk of chunkArray(legacyNames, 500)) {
            const { data, error } = await supabaseAdmin.from('employees').select('id, name').in('name', chunk)
            if (error) {
              throw new Error(`Employees ophalen mislukt: ${error.message}`)
            }
            data?.forEach((row) => {
              const match = row.name?.replace('Legacy ', '')
              const legacyId = match ? Number(match) : NaN
              if (Number.isFinite(legacyId)) {
                legacyIdToEmployeeId.set(legacyId, row.id)
              }
            })
          }
        }
      }

      const { data: unknownEmployee, error: unknownEmployeeError } = await supabaseAdmin
        .from('employees')
        .select('id, name')
        .eq('name', unknownEmployeeName)
        .maybeSingle()

      if (unknownEmployeeError) {
        throw new Error(`Employees ophalen mislukt: ${unknownEmployeeError.message}`)
      }

      if (unknownEmployee?.id) {
        unknownEmployeeId = unknownEmployee.id
      } else {
        const { data: createdUnknown, error: createUnknownError } = await supabaseAdmin
          .from('employees')
          .insert({ name: unknownEmployeeName, active: false })
          .select('id')
          .single()
        if (createUnknownError) {
          throw new Error(`Employees insert mislukt: ${createUnknownError.message}`)
        }
        unknownEmployeeId = createdUnknown?.id ?? null
        createdEmployees += 1
      }

      const timeLogs = legacyTimeLogs.flatMap((row) => {
        const mappedEmployees = row.employeeIds
          .map((legacyId) => legacyIdToEmployeeId.get(legacyId))
          .filter(Boolean) as number[]
        const employeeIds = mappedEmployees.length > 0 ? mappedEmployees : unknownEmployeeId ? [unknownEmployeeId] : []
        return employeeIds.map((employeeId) => ({
          employee_id: employeeId,
          type: 'items_to_pack',
          start_time: row.start_time,
          end_time: row.end_time,
          is_paused: false,
        }))
      })

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
      timeLogs: legacyTimeLogs.reduce((sum, row) => sum + row.employeeIds.length, 0),
      createdEmployees,
    })
  } catch (error: any) {
    console.error('Prepack legacy import error:', error)
    return NextResponse.json(
      { error: error.message || 'Import mislukt' },
      { status: 500 }
    )
  }
}
