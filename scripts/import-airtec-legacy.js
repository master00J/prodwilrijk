const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const idx = trimmed.indexOf('=')
    if (idx === -1) return
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) {
      process.env[key] = value
    }
  })
}

const projectRoot = process.cwd()
loadEnvFile(path.join(projectRoot, '.env.local'))
loadEnvFile(path.join(projectRoot, '.env'))

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('placeholder')) {
  console.error('Missing SUPABASE envs. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const legacyDir = path.join(projectRoot, 'oude data')
const packedPath = path.join(legacyDir, 'packed_items_airtec.sql')
const timelogsPath = path.join(legacyDir, 'airtec_timelogs.sql')

const parseInsertBlocks = (sql, tableName) => {
  const regex = new RegExp(`INSERT INTO\\s+\`${tableName}\`[^]*?VALUES\\s*([\\s\\S]*?);`, 'gi')
  const blocks = []
  let match
  while ((match = regex.exec(sql)) !== null) {
    blocks.push(match[1])
  }
  return blocks
}

const parseValuesBlock = (block) => {
  const rows = []
  let currentRow = []
  let currentValue = ''
  let inString = false
  let escape = false
  let inRow = false
  let valueWasQuoted = false

  const pushValue = () => {
    const raw = currentValue.trim()
    let value = null
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

const normalizeDate = (value) => {
  if (!value) return null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed || trimmed === '0000-00-00' || trimmed === '0000-00-00 00:00:00') {
      return null
    }
    return trimmed
  }
  return value
}

const parseEmployeeIds = (value) => {
  if (!value) return []
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => Number(entry)).filter((entry) => Number.isFinite(entry))
    }
  } catch (error) {
    // Ignore malformed entries
  }
  return []
}

const chunkArray = (items, size) => {
  const chunks = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

const run = async () => {
  if (!fs.existsSync(packedPath) || !fs.existsSync(timelogsPath)) {
    console.error('Legacy SQL files not found in "oude data" folder.')
    process.exit(1)
  }

  const args = new Set(process.argv.slice(2))
  const shouldTruncate = args.has('--truncate')
  const dryRun = args.has('--dry-run')

  if (shouldTruncate) {
    console.log('Deleting existing data in packed_items_airtec and time_logs...')
    if (!dryRun) {
      const { error: packedDeleteError } = await supabase.from('packed_items_airtec').delete().neq('id', 0)
      if (packedDeleteError) {
        console.error('Failed to clear packed_items_airtec:', packedDeleteError.message)
        process.exit(1)
      }
      const { error: timeDeleteError } = await supabase
        .from('time_logs')
        .delete()
        .eq('type', 'items_to_pack_airtec')
      if (timeDeleteError) {
        console.error('Failed to clear time_logs:', timeDeleteError.message)
        process.exit(1)
      }
    }
  }

  console.log('Parsing packed_items_airtec.sql...')
  const packedSql = fs.readFileSync(packedPath, 'utf8')
  const packedBlocks = parseInsertBlocks(packedSql, 'packed_items_airtec')
  const packedRows = packedBlocks.flatMap(parseValuesBlock)
  const packedItems = packedRows.map((row) => ({
    beschrijving: row[1] ?? null,
    item_number: row[2] ?? null,
    lot_number: row[3] ?? null,
    datum_opgestuurd: normalizeDate(row[4]),
    kistnummer: row[5] ?? null,
    divisie: row[6] ?? null,
    datum_ontvangen: normalizeDate(row[7]),
    date_packed: normalizeDate(row[8]),
    quantity: Number.isFinite(row[9]) ? Number(row[9]) : null,
  }))

  console.log(`Packed items parsed: ${packedItems.length}`)

  console.log('Parsing airtec_timelogs.sql...')
  const timelogSql = fs.readFileSync(timelogsPath, 'utf8')
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

  console.log(`Time logs parsed: ${timeLogs.length}`)

  if (dryRun) {
    console.log('Dry run enabled. No data inserted.')
    return
  }

  console.log('Inserting packed items...')
  for (const chunk of chunkArray(packedItems, 500)) {
    const { error } = await supabase.from('packed_items_airtec').insert(chunk)
    if (error) {
      console.error('Failed inserting packed_items_airtec:', error.message)
      process.exit(1)
    }
  }

  const employeeIds = [...new Set(timeLogs.map((log) => log.employee_id).filter(Boolean))]
  if (employeeIds.length > 0) {
    console.log(`Ensuring ${employeeIds.length} legacy employees exist...`)
    const existingIds = new Set()
    for (const chunk of chunkArray(employeeIds, 500)) {
      const { data, error } = await supabase.from('employees').select('id').in('id', chunk)
      if (error) {
        console.error('Failed fetching employees:', error.message)
        process.exit(1)
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

    if (missingEmployees.length > 0) {
      console.log(`Creating ${missingEmployees.length} placeholder employees...`)
      for (const chunk of chunkArray(missingEmployees, 500)) {
        const { error } = await supabase.from('employees').insert(chunk)
        if (error) {
          console.error('Failed inserting employees:', error.message)
          process.exit(1)
        }
      }
    }
  }

  console.log('Inserting time logs...')
  for (const chunk of chunkArray(timeLogs, 1000)) {
    const { error } = await supabase.from('time_logs').insert(chunk)
    if (error) {
      console.error('Failed inserting time_logs:', error.message)
      process.exit(1)
    }
  }

  console.log('Import completed successfully.')
}

run().catch((error) => {
  console.error('Import failed:', error.message)
  process.exit(1)
})
