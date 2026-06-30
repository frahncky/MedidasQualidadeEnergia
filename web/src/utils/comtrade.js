const VOLTAGE_ALIASES = {
  A: ['va', 'v_a', 'van', 'v1', 'ua', 'u_a'],
  B: ['vb', 'v_b', 'vbn', 'v2', 'ub', 'u_b'],
  C: ['vc', 'v_c', 'vcn', 'v3', 'uc', 'u_c'],
}

const CURRENT_ALIASES = {
  A: ['ia', 'i_a', 'i1', 'ca', 'c_a'],
  B: ['ib', 'i_b', 'i2', 'cb', 'c_b'],
  C: ['ic', 'i_c', 'i3', 'cc', 'c_c'],
}

function splitLine(line) {
  return String(line ?? '').split(',').map(cell => cell.trim())
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
}

function parseComtradeDate(value) {
  const raw = String(value ?? '').trim()
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}),(\d{1,2}):(\d{2}):(\d{2}(?:[.,]\d+)?)$/)
  if (!match) return Date.parse(raw) || 0
  const [, dd, mm, yyyy, hh, min, sec] = match
  const secNum = parseNumber(sec, 0)
  const wholeSec = Math.floor(secNum)
  const ms = Math.round((secNum - wholeSec) * 1000)
  return new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), wholeSec, ms).getTime()
}

function parseCfg(cfgText) {
  const lines = String(cfgText ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  if (lines.length < 8) throw new Error('Arquivo CFG COMTRADE incompleto')

  const [stationName = '', recorderId = '', revision = ''] = splitLine(lines[0])
  const counts = splitLine(lines[1])
  const analogCount = parseInt(counts.find(cell => /a$/i.test(cell))?.replace(/\D/g, '') ?? counts[1], 10) || 0
  const digitalCount = parseInt(counts.find(cell => /d$/i.test(cell))?.replace(/\D/g, '') ?? counts[2], 10) || 0

  const analogChannels = []
  for (let i = 0; i < analogCount; i += 1) {
    const cells = splitLine(lines[2 + i])
    analogChannels.push({
      index: parseInt(cells[0], 10) || i + 1,
      name: cells[1] || `A${i + 1}`,
      phase: (cells[2] || '').toUpperCase(),
      unit: cells[4] || '',
      a: parseNumber(cells[5], 1),
      b: parseNumber(cells[6], 0),
      skew: parseNumber(cells[7], 0),
      primary: parseNumber(cells[10], 1),
      secondary: parseNumber(cells[11], 1),
      ps: cells[12] || '',
    })
  }

  let cursor = 2 + analogCount + digitalCount
  const frequency = parseNumber(lines[cursor], 60)
  cursor += 1
  const rateCount = parseInt(lines[cursor], 10) || 1
  cursor += 1
  const sampleRates = []
  for (let i = 0; i < rateCount; i += 1) {
    const cells = splitLine(lines[cursor + i])
    sampleRates.push({ rate: parseNumber(cells[0], 0), endSample: parseInt(cells[1], 10) || 0 })
  }
  cursor += rateCount
  const startTime = parseComtradeDate(lines[cursor])
  const triggerTime = parseComtradeDate(lines[cursor + 1])
  const dataType = String(lines[cursor + 2] ?? 'ASCII').trim().toUpperCase()
  const timeMultiplier = parseNumber(lines[cursor + 3], 1)

  return {
    stationName,
    recorderId,
    revision,
    analogCount,
    digitalCount,
    analogChannels,
    frequency,
    sampleRates,
    startTime,
    triggerTime,
    dataType,
    timeMultiplier,
  }
}

function targetForChannel(channel) {
  const name = normalize(channel.name)
  const phase = normalize(channel.phase).toUpperCase()
  const unit = normalize(channel.unit)
  const isVoltage = unit.includes('v') || Object.values(VOLTAGE_ALIASES).some(aliases => aliases.some(alias => name.includes(alias)))
  const isCurrent = unit.includes('a') || Object.values(CURRENT_ALIASES).some(aliases => aliases.some(alias => name.includes(alias)))

  for (const ph of ['A', 'B', 'C']) {
    if (phase === ph || VOLTAGE_ALIASES[ph].some(alias => name === alias || name.includes(alias))) {
      if (isVoltage) return `V${ph}`
    }
    if (phase === ph || CURRENT_ALIASES[ph].some(alias => name === alias || name.includes(alias))) {
      if (isCurrent) return `I${ph}`
    }
  }
  return null
}

function parseAsciiDat(datText, cfg) {
  if (cfg.dataType && cfg.dataType !== 'ASCII') {
    throw new Error(`COMTRADE ${cfg.dataType} ainda não é suportado; use DAT ASCII`)
  }

  const targets = cfg.analogChannels.map(targetForChannel)
  const rows = String(datText ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line, rowIndex) => {
      const cells = splitLine(line)
      const timestampUs = parseNumber(cells[1], rowIndex * 1e6 / (cfg.sampleRates[0]?.rate || cfg.frequency * 64))
      const row = {
        timestamp: cfg.startTime + timestampUs * cfg.timeMultiplier / 1000,
        Freq_Hz: cfg.frequency,
      }

      cfg.analogChannels.forEach((channel, index) => {
        const target = targets[index]
        if (!target) return
        const raw = parseNumber(cells[2 + index], null)
        if (raw == null) return
        row[target] = channel.a * raw + channel.b
      })
      return row
    })

  const columns = ['timestamp', 'Va', 'Vb', 'Vc', 'Ia', 'Ib', 'Ic', 'Freq_Hz']
  return rows.map(row => ({
    timestamp: row.timestamp,
    Va: row.VA ?? row.Va,
    Vb: row.VB ?? row.Vb,
    Vc: row.VC ?? row.Vc,
    Ia: row.IA ?? row.Ia,
    Ib: row.IB ?? row.Ib,
    Ic: row.IC ?? row.Ic,
    Freq_Hz: row.Freq_Hz,
  })).filter(row => columns.some(column => Number.isFinite(row[column])))
}

export function parseComtradeFiles({ cfgText, datText, cfgName = 'arquivo.cfg', datName = 'arquivo.dat' }) {
  const cfg = parseCfg(cfgText)
  const rows = parseAsciiDat(datText, cfg)
  if (!rows.length) throw new Error('DAT COMTRADE sem amostras analógicas reconhecidas')

  return {
    fileName: `${cfgName} + ${datName}`,
    sourceType: 'COMTRADE ASCII',
    columns: ['timestamp', 'Va', 'Vb', 'Vc', 'Ia', 'Ib', 'Ic', 'Freq_Hz'],
    rows,
    totalRows: rows.length,
    delimiter: ',',
    metadata: cfg,
    importedAt: new Date().toISOString(),
  }
}
