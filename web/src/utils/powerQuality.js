/** Power quality indices and analysis helpers */

const HARMONIC_ORDERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 17, 19, 21, 23, 25]
const INTERHARMONIC_ORDERS = [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 15.5, 17.5, 19.5, 21.5, 23.5, 24.5]
const PHASES = ['A', 'B', 'C']
const DEFAULT_FREQ = 60
const DEFAULT_LIMITS = {
  thdV: 5,
  thdI: 8,
  interharmonicV: 2,
  interharmonicI: 5,
  transientPu: 1.65,
  unbalance: 2,
  pst: 1,
  fp: 0.92,
  freqMin: 59.9,
  freqMax: 60.1,
  voltageMinPu: 0.9,
  voltageMaxPu: 1.1,
}

const COLUMN_ALIASES = {
  timestamp: ['timestamp', 'datahora', 'datahorario', 'datetime', 'date', 'time', 'tempo', 'data'],
  va: ['va', 'vakv', 'vav', 'v_a', 'tensaoa', 'tensaofa', 'voltagea', 'v1'],
  vb: ['vb', 'vbkv', 'vbv', 'v_b', 'tensaob', 'tensaofb', 'voltageb', 'v2'],
  vc: ['vc', 'vckv', 'vcv', 'v_c', 'tensaoc', 'tensaofc', 'voltagec', 'v3'],
  ia: ['ia', 'iaa', 'i_a', 'correntea', 'currenta', 'i1'],
  ib: ['ib', 'iba', 'i_b', 'correnteb', 'currentb', 'i2'],
  ic: ['ic', 'ica', 'i_c', 'correntec', 'currentc', 'i3'],
  freq: ['freq', 'freqhz', 'frequencia', 'frequenciahz', 'frequency', 'frequencyhz', 'f'],
  p: ['p', 'pkw', 'potenciaativa', 'potenciaativakw', 'activepower', 'kw'],
  q: ['q', 'qkvar', 'potenciareativa', 'potenciareativakvar', 'reactivepower', 'kvar'],
  fp: ['fp', 'pf', 'cosphi', 'fatorpotencia', 'powerfactor'],
}

function seededNoise(i, salt = 1) {
  const value = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function mean(values) {
  const clean = values.filter(Number.isFinite)
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0
}

function median(values) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return 0
  const mid = Math.floor(clean.length / 2)
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2
}

function percentile(values, pct) {
  const clean = values.filter(Number.isFinite).sort((a, b) => a - b)
  if (!clean.length) return 0
  const pos = (clean.length - 1) * pct
  const base = Math.floor(pos)
  const rest = pos - base
  return clean[base + 1] === undefined ? clean[base] : clean[base] + rest * (clean[base + 1] - clean[base])
}

function rms(values) {
  const clean = values.filter(Number.isFinite)
  if (!clean.length) return 0
  return Math.sqrt(clean.reduce((sum, value) => sum + value * value, 0) / clean.length)
}

function std(values) {
  const clean = values.filter(Number.isFinite)
  if (clean.length < 2) return 0
  const avg = mean(clean)
  return Math.sqrt(clean.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (clean.length - 1))
}

function mad(values) {
  const clean = values.filter(Number.isFinite)
  if (!clean.length) return 0
  const center = median(clean)
  return median(clean.map(value => Math.abs(value - center)))
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function normalizeLabel(label) {
  return String(label ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function parseNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = String(value ?? '').trim()
  if (!raw) return null
  let cleaned = raw.replace(/\s/g, '').replace(/[^\d,.\-+eE]/g, '')
  if (!cleaned) return null

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    else cleaned = cleaned.replace(/,/g, '')
  } else if (lastComma >= 0) {
    cleaned = cleaned.replace(',', '.')
  }

  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

function parseTimestamp(value, index = 0, sampleRate = 3840) {
  if (value instanceof Date) return value.getTime()
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e11) return value
    if (value > 10000) {
      const excelEpoch = Date.UTC(1899, 11, 30)
      return excelEpoch + value * 24 * 60 * 60 * 1000
    }
    return value * 1000
  }

  const raw = String(value ?? '').trim()
  if (!raw) return index * 1000 / sampleRate

  const br = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}(?:[.,]\d+)?))?)?/)
  if (br) {
    const [, dd, mm, yyyy, hh = '0', min = '0', sec = '0'] = br
    const year = Number(yyyy.length === 2 ? `20${yyyy}` : yyyy)
    return new Date(year, Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(String(sec).replace(',', '.'))).getTime()
  }

  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : index * 1000 / sampleRate
}

function formatDateLabel(timestamp, index) {
  if (!Number.isFinite(timestamp)) return String(index + 1)
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return String(index + 1)
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function findColumn(columns, key) {
  const normalized = columns.map(column => ({ column, normalized: normalizeLabel(column) }))
  const aliases = COLUMN_ALIASES[key] ?? []
  return normalized.find(item => aliases.includes(item.normalized))?.column
    ?? normalized.find(item => aliases.some(alias => alias.length > 2 && item.normalized.includes(alias)))?.column
    ?? null
}

function inferScale(column, values, kind) {
  const name = normalizeLabel(column)
  if (kind === 'voltage') {
    if (name.includes('kv')) return 1000
    if (name.includes('mv')) return 1000000
    const med = median(values.map(value => Math.abs(value)).filter(value => value > 0))
    return med > 1 && med < 40 ? 1000 : 1
  }
  if (kind === 'current') {
    if (name.includes('ka')) return 1000
    if (name.includes('ma')) return 0.001
  }
  return 1
}

function toFixedNumber(value, digits = 4) {
  return Number.isFinite(value) ? +value.toFixed(digits) : 0
}

function isInstantaneous(values) {
  const clean = values.filter(Number.isFinite)
  if (clean.length < 12) return false
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const maxAbs = Math.max(Math.abs(min), Math.abs(max))
  return min < -0.15 * maxAbs && max > 0.15 * maxAbs
}

function channelRms(values) {
  return isInstantaneous(values) ? rms(values) : mean(values.map(value => Math.abs(value)))
}

function channelAverage(values) {
  return mean(values.map(value => Math.abs(value)))
}

function inferNominalVoltage(values) {
  const avg = channelRms(values)
  if (avg >= 10000) return Math.round(avg / 100) * 100
  if (avg >= 350) return 380
  if (avg >= 190) return 220
  if (avg >= 100) return 127
  return Math.max(1, avg || 220)
}

function inferSampleRate(rows) {
  const deltas = []
  for (let i = 1; i < rows.length; i += 1) {
    const delta = rows[i].timestamp - rows[i - 1].timestamp
    if (Number.isFinite(delta) && delta > 0) deltas.push(delta)
  }
  const stepMs = median(deltas)
  return stepMs > 0 ? 1000 / stepMs : DEFAULT_FREQ * 64
}

function projection(values, timestamps, frequency, order = 1) {
  const clean = values.map(value => Number.isFinite(value) ? value : 0)
  if (clean.length < 8) return { magnitude: 0, angle: 0 }
  const dc = mean(clean)
  const t0 = timestamps[0] ?? 0
  let re = 0
  let im = 0
  for (let i = 0; i < clean.length; i += 1) {
    const t = ((timestamps[i] ?? i / (frequency * 64)) - t0) / 1000
    const angle = 2 * Math.PI * frequency * order * t
    const sample = clean[i] - dc
    re += sample * Math.cos(angle)
    im -= sample * Math.sin(angle)
  }
  const peak = 2 * Math.sqrt(re * re + im * im) / clean.length
  return {
    magnitude: peak / Math.SQRT2,
    angle: Math.atan2(im, re) * 180 / Math.PI,
  }
}

function harmonicLimitPct(order, kind = 'voltage') {
  if (order === 1) return 100
  if (kind === 'current') return +(8 / Math.sqrt(order)).toFixed(2)
  return +(5 / Math.sqrt(order)).toFixed(2)
}

function harmonicSpectrum(values, timestamps, frequency, kind = 'voltage') {
  if (!isInstantaneous(values)) return null
  const spectrum = HARMONIC_ORDERS.map(order => {
    const h = projection(values, timestamps, frequency, order)
    return {
      order,
      magnitude: toFixedNumber(h.magnitude, 5),
      angle: toFixedNumber(h.angle, 2),
      limitPct: harmonicLimitPct(order, kind),
    }
  })
  const fundamental = spectrum.find(h => h.order === 1)?.magnitude || 0
  return spectrum.map(h => ({
    ...h,
    percent: fundamental > 0 ? toFixedNumber((h.magnitude / fundamental) * 100, 3) : 0,
  }))
}

function interharmonicSpectrum(values, timestamps, frequency, kind = 'voltage') {
  if (!isInstantaneous(values)) return []
  const fundamental = projection(values, timestamps, frequency, 1).magnitude || 0
  return INTERHARMONIC_ORDERS.map(order => {
    const h = projection(values, timestamps, frequency, order)
    return {
      order,
      label: `${order.toFixed(1)}ª`,
      magnitude: toFixedNumber(h.magnitude, 5),
      angle: toFixedNumber(h.angle, 2),
      percent: fundamental > 0 ? toFixedNumber((h.magnitude / fundamental) * 100, 3) : 0,
      limitPct: kind === 'current' ? DEFAULT_LIMITS.interharmonicI : DEFAULT_LIMITS.interharmonicV,
    }
  }).sort((a, b) => b.percent - a.percent)
}

function maxSpectrumPct(spectrum) {
  return spectrum.reduce((max, item) => Math.max(max, item.percent ?? 0), 0)
}

function fallbackHarmonics(thdPct, fundamental, kind = 'voltage') {
  return generateHarmonics(thdPct, fundamental).map(h => ({
    ...h,
    percent: h.order === 1 ? 100 : toFixedNumber((h.magnitude / fundamental) * 100, 3),
    limitPct: harmonicLimitPct(h.order, kind),
  }))
}

function bucketRows(rows, maxPoints = 96) {
  if (!rows.length) return []
  const size = Math.max(1, Math.ceil(rows.length / maxPoints))
  const buckets = []
  for (let i = 0; i < rows.length; i += size) buckets.push(rows.slice(i, i + size))
  return buckets
}

function bucketChannel(bucket, key) {
  return channelRms(bucket.map(row => row[key]).filter(Number.isFinite))
}

function estimatePstSeries(rmsSeries, nominalVoltage) {
  return rmsSeries.map((point, index) => {
    const window = rmsSeries.slice(Math.max(0, index - 3), Math.min(rmsSeries.length, index + 4))
    const values = window.map(row => row.Vavg).filter(Number.isFinite)
    const variation = nominalVoltage > 0 ? std(values) / nominalVoltage : 0
    const deviation = nominalVoltage > 0 ? Math.abs(point.Vavg - nominalVoltage) / nominalVoltage : 0
    return {
      ...point,
      pst: toFixedNumber(clamp(variation * 45 + deviation * 8, 0, 2.5), 3),
    }
  })
}

function buildRmsSeries(rows, nominalVoltage) {
  const buckets = bucketRows(rows)
  const base = buckets.map((bucket, index) => {
    const first = bucket[0]
    const last = bucket[bucket.length - 1]
    const point = {
      label: formatDateLabel(first.timestamp, index),
      timestamp: first.timestamp,
      durationMs: Math.max(1, last.timestamp - first.timestamp),
      Va: toFixedNumber(bucketChannel(bucket, 'va'), 3),
      Vb: toFixedNumber(bucketChannel(bucket, 'vb'), 3),
      Vc: toFixedNumber(bucketChannel(bucket, 'vc'), 3),
      Ia: toFixedNumber(bucketChannel(bucket, 'ia'), 3),
      Ib: toFixedNumber(bucketChannel(bucket, 'ib'), 3),
      Ic: toFixedNumber(bucketChannel(bucket, 'ic'), 3),
      freq: toFixedNumber(mean(bucket.map(row => row.freq).filter(Number.isFinite)), 4),
      fp: toFixedNumber(mean(bucket.map(row => row.fp).filter(Number.isFinite)), 4),
      pKw: toFixedNumber(mean(bucket.map(row => row.p).filter(Number.isFinite)), 4),
      qKvar: toFixedNumber(mean(bucket.map(row => row.q).filter(Number.isFinite)), 4),
    }
    point.Vavg = toFixedNumber(mean([point.Va, point.Vb, point.Vc].filter(value => value > 0)), 3)
    point.Iavg = toFixedNumber(mean([point.Ia, point.Ib, point.Ic].filter(value => value > 0)), 3)
    return point
  })
  return estimatePstSeries(base, nominalVoltage)
}

function classifyVoltageEvent(pu) {
  if (pu < 0.1) return 'Interrupção'
  if (pu < DEFAULT_LIMITS.voltageMinPu) return 'Afundamento'
  if (pu > DEFAULT_LIMITS.voltageMaxPu) return 'Elevação'
  return null
}

function eventSeverity(type, pu) {
  if (type === 'Interrupção') return 'Crítico'
  if (type === 'Afundamento') {
    if (pu < 0.5) return 'Crítico'
    if (pu < 0.7) return 'Alto'
    return 'Médio'
  }
  if (type === 'Elevação') {
    if (pu > 1.4) return 'Crítico'
    if (pu > 1.2) return 'Alto'
    return 'Médio'
  }
  return 'Baixo'
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '-'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2).replace('.', ',')} s`
  return `${(ms / 60000).toFixed(1).replace('.', ',')} min`
}

function formatEventTime(timestamp) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '-'
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function voltageThdLimit(nominalVoltage) {
  if (nominalVoltage <= 1000) return 8
  if (nominalVoltage <= 69000) return 5
  if (nominalVoltage <= 161000) return 2.5
  return 1.5
}

function currentThdLimit(shortCircuitRatio = 50) {
  if (shortCircuitRatio < 20) return 5
  if (shortCircuitRatio < 50) return 8
  if (shortCircuitRatio < 100) return 12
  if (shortCircuitRatio < 1000) return 15
  return 20
}

function prodistVoltageClass(pu) {
  if (!Number.isFinite(pu)) return 'Indefinida'
  if (pu >= 0.93 && pu <= 1.05) return 'Adequada'
  if ((pu >= 0.9 && pu < 0.93) || (pu > 1.05 && pu <= 1.06)) return 'Precária'
  return 'Crítica'
}

function prodistVoltageSummary(rmsSeries, nominalVoltage) {
  const counts = { Adequada: 0, Precária: 0, Crítica: 0, Indefinida: 0 }
  rmsSeries.forEach(point => {
    const values = [point.Va, point.Vb, point.Vc].filter(Number.isFinite)
    if (!values.length || nominalVoltage <= 0) {
      counts.Indefinida += 1
      return
    }
    const worst = values
      .map(value => prodistVoltageClass(value / nominalVoltage))
      .sort((a, b) => ['Adequada', 'Precária', 'Crítica', 'Indefinida'].indexOf(b) - ['Adequada', 'Precária', 'Crítica', 'Indefinida'].indexOf(a))[0]
    counts[worst] += 1
  })
  const total = Math.max(1, rmsSeries.length)
  return Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, {
    count: value,
    pct: toFixedNumber((value / total) * 100, 1),
  }]))
}

function detectVoltageEvents(rmsSeries, nominalVoltage) {
  const events = []
  const phases = [
    ['A', 'Va'],
    ['B', 'Vb'],
    ['C', 'Vc'],
  ]

  phases.forEach(([phase, key]) => {
    let active = null
    rmsSeries.forEach((point, index) => {
      const pu = nominalVoltage > 0 ? point[key] / nominalVoltage : 1
      const type = classifyVoltageEvent(pu)
      if (!type) {
        if (active) {
          events.push({ ...active, end: rmsSeries[index - 1]?.timestamp ?? active.start, durMs: (rmsSeries[index - 1]?.timestamp ?? active.start) - active.start })
          active = null
        }
        return
      }

      if (!active || active.tipo !== type) {
        if (active) events.push({ ...active, end: point.timestamp, durMs: point.timestamp - active.start })
        active = {
          ts: formatEventTime(point.timestamp),
          start: point.timestamp,
          tipo: type,
          desc: `${(pu).toFixed(2).replace('.', ',')} pu`,
          sev: eventSeverity(type, pu),
          fase: phase,
          worstPu: pu,
        }
        return
      }

      if (type === 'Afundamento') active.worstPu = Math.min(active.worstPu, pu)
      if (type === 'Elevação') active.worstPu = Math.max(active.worstPu, pu)
      active.desc = `${active.worstPu.toFixed(2).replace('.', ',')} pu`
      active.sev = eventSeverity(type, active.worstPu)
    })
    if (active) {
      const last = rmsSeries[rmsSeries.length - 1]
      events.push({ ...active, end: last.timestamp, durMs: last.timestamp - active.start })
    }
  })

  return events.map(event => ({
    ...event,
    dur: formatDuration(event.durMs),
  }))
}

function detectTransientEvents(rows, nominalVoltage) {
  if (!rows.length || nominalVoltage <= 0) return []
  const events = []
  const nominalPeak = nominalVoltage * Math.SQRT2
  const phases = [
    ['A', 'va'],
    ['B', 'vb'],
    ['C', 'vc'],
  ]

  phases.forEach(([phase, key]) => {
    const values = rows.map(row => row[key]).filter(Number.isFinite)
    if (!isInstantaneous(values)) return

    const steps = []
    for (let i = 1; i < rows.length; i += 1) {
      const current = rows[i][key]
      const previous = rows[i - 1][key]
      if (Number.isFinite(current) && Number.isFinite(previous)) {
        steps.push(Math.abs(current - previous) / nominalPeak)
      }
    }
    const baselineStep = median(steps)
    const noiseStep = mad(steps) * 1.4826
    const stepLimit = Math.max(0.42, baselineStep + noiseStep * 8)

    let active = null
    for (let i = 1; i < rows.length; i += 1) {
      const current = rows[i][key]
      const previous = rows[i - 1][key]
      if (!Number.isFinite(current) || !Number.isFinite(previous)) continue

      const peakPu = Math.abs(current) / nominalPeak
      const stepPu = Math.abs(current - previous) / nominalPeak
      const detected = peakPu > DEFAULT_LIMITS.transientPu || stepPu > stepLimit

      if (!detected) {
        if (active) {
          events.push(active)
          active = null
        }
        continue
      }

      if (!active) {
        active = {
          ts: formatEventTime(rows[i].timestamp),
          start: rows[i].timestamp,
          end: rows[i].timestamp,
          tipo: 'Transitório',
          fase: phase,
          peakPu,
          stepPu,
        }
      } else {
        active.end = rows[i].timestamp
        active.peakPu = Math.max(active.peakPu, peakPu)
        active.stepPu = Math.max(active.stepPu, stepPu)
      }
    }
    if (active) events.push(active)
  })

  return events.map(event => {
    const peak = event.peakPu.toFixed(2).replace('.', ',')
    const step = event.stepPu.toFixed(2).replace('.', ',')
    return {
      ts: event.ts,
      tipo: event.tipo,
      desc: `Pico ${peak} pu, salto ${step} pu`,
      sev: event.peakPu > 2.2 || event.stepPu > 1.2 ? 'Crítico' : 'Alto',
      fase: event.fase,
      dur: formatDuration(Math.max(1, event.end - event.start)),
      start: event.start,
      end: event.end,
      peakPu: event.peakPu,
      stepPu: event.stepPu,
    }
  })
}

function eventSummary(events) {
  const summary = {}
  events.forEach(event => {
    summary[event.tipo] = (summary[event.tipo] ?? 0) + 1
  })
  return summary
}

function addIndexEvents(events, analysis) {
  const indexed = [...events]
  const limits = analysis.limits ?? DEFAULT_LIMITS
  if (analysis.unbalance > limits.unbalance) {
    indexed.push({
      ts: formatEventTime(analysis.lastTimestamp),
      tipo: 'Desequilíbrio',
      desc: `VUF ${analysis.unbalance.toFixed(2).replace('.', ',')}%`,
      sev: analysis.unbalance > 4 ? 'Alto' : 'Médio',
      fase: 'ABC',
      dur: '-',
    })
  }
  if (analysis.thdVAvg > limits.thdV) {
    indexed.push({
      ts: formatEventTime(analysis.lastTimestamp),
      tipo: 'Harmônicas',
      desc: `THD-V ${analysis.thdVAvg.toFixed(2).replace('.', ',')}%`,
      sev: analysis.thdVAvg > 8 ? 'Alto' : 'Médio',
      fase: 'ABC',
      dur: '-',
    })
  }
  if (analysis.thdIAvg > limits.thdI) {
    indexed.push({
      ts: formatEventTime(analysis.lastTimestamp),
      tipo: 'Harmônicas',
      desc: `THD-I ${analysis.thdIAvg.toFixed(2).replace('.', ',')}%`,
      sev: analysis.thdIAvg > 12 ? 'Alto' : 'Médio',
      fase: 'ABC',
      dur: '-',
    })
  }
  if (analysis.interharmonicVMax > limits.interharmonicV) {
    indexed.push({
      ts: formatEventTime(analysis.lastTimestamp),
      tipo: 'Inter-harmônicas',
      desc: `Vih máx. ${analysis.interharmonicVMax.toFixed(2).replace('.', ',')}%`,
      sev: analysis.interharmonicVMax > 4 ? 'Alto' : 'Médio',
      fase: 'ABC',
      dur: '-',
    })
  }
  if (analysis.interharmonicIMax > limits.interharmonicI) {
    indexed.push({
      ts: formatEventTime(analysis.lastTimestamp),
      tipo: 'Inter-harmônicas',
      desc: `Iih máx. ${analysis.interharmonicIMax.toFixed(2).replace('.', ',')}%`,
      sev: analysis.interharmonicIMax > 8 ? 'Alto' : 'Médio',
      fase: 'ABC',
      dur: '-',
    })
  }
  if (analysis.pst95 > limits.pst) {
    indexed.push({
      ts: formatEventTime(analysis.lastTimestamp),
      tipo: 'Flicker',
      desc: `Pst95 ${analysis.pst95.toFixed(2).replace('.', ',')}`,
      sev: analysis.pst95 > 1.5 ? 'Médio' : 'Baixo',
      fase: 'ABC',
      dur: '10 min',
    })
  }
  if (analysis.fpAvg < limits.fp) {
    indexed.push({
      ts: formatEventTime(analysis.lastTimestamp),
      tipo: 'FP baixo',
      desc: `FP ${analysis.fpAvg.toFixed(3).replace('.', ',')}`,
      sev: 'Médio',
      fase: 'ABC',
      dur: '-',
    })
  }
  return indexed
}

function complianceChecks(summary) {
  const limits = summary.limits ?? DEFAULT_LIMITS
  return [
    { name: 'Tensão RMS', value: summary.voltageCompliancePct, limit: '90-110% Vnom', ok: summary.voltageCompliancePct >= 95 },
    { name: 'THD-V', value: summary.thdVAvg, limit: `<= ${limits.thdV}%`, ok: summary.thdVAvg <= limits.thdV },
    { name: 'THD-I', value: summary.thdIAvg, limit: `<= ${limits.thdI}%`, ok: summary.thdIAvg <= limits.thdI },
    { name: 'Inter-harmônicas V', value: summary.interharmonicVMax, limit: `<= ${limits.interharmonicV}%`, ok: summary.interharmonicVMax <= limits.interharmonicV },
    { name: 'Inter-harmônicas I', value: summary.interharmonicIMax, limit: `<= ${limits.interharmonicI}%`, ok: summary.interharmonicIMax <= limits.interharmonicI },
    { name: 'Transitórios', value: summary.transientCount, limit: '0 eventos', ok: summary.transientCount === 0 },
    { name: 'Desequilíbrio', value: summary.unbalance, limit: `<= ${limits.unbalance}%`, ok: summary.unbalance <= limits.unbalance },
    { name: 'Flicker Pst95', value: summary.pst95, limit: `<= ${limits.pst}`, ok: summary.pst95 <= limits.pst },
    { name: 'Frequência', value: summary.freqAvg, limit: `${limits.freqMin}-${limits.freqMax} Hz`, ok: summary.freqAvg >= limits.freqMin && summary.freqAvg <= limits.freqMax },
    { name: 'Fator de potência', value: summary.fpAvg, limit: `>= ${limits.fp}`, ok: summary.fpAvg >= limits.fp },
  ]
}

function buildConformity(summary) {
  const checks = complianceChecks(summary)
  const checkScore = checks.filter(check => check.ok).length / checks.length
  const eventPenalty = clamp(summary.eventsCount / Math.max(1, summary.sampleCount), 0, 0.35)
  const score = clamp((checkScore - eventPenalty) * 100, 0, 100)
  return {
    score: toFixedNumber(score, 1),
    conforming: toFixedNumber(score, 1),
    nonConforming: toFixedNumber(100 - score, 1),
    checks,
  }
}

function buildRecommendations(summary, events, measurement) {
  const recommendations = []
  const add = (priority, title, detail) => recommendations.push({ priority, title, detail })

  if (summary.thdVAvg > summary.limits.thdV || summary.thdIAvg > summary.limits.thdI) {
    add('Alta', 'Mitigar distorção harmônica', 'Avaliar filtro passivo/ativo, ressonância com banco de capacitores e contribuição de cargas não lineares.')
  }
  if (summary.interharmonicVMax > summary.limits.interharmonicV || summary.interharmonicIMax > summary.limits.interharmonicI) {
    add('Média', 'Investigar inter-harmônicas', 'Verificar conversores, inversores e ciclos de controle que modulam corrente fora das ordens harmônicas inteiras.')
  }
  if (summary.transientCount > 0) {
    add('Alta', 'Instalar proteção contra surtos', 'Correlacionar transitórios com manobras, chaveamento de capacitores e partidas; revisar DPS e aterramento.')
  }
  if (summary.unbalance > summary.limits.unbalance) {
    add('Média', 'Balancear cargas por fase', 'Redistribuir cargas monofásicas e verificar conexões de neutro para reduzir VUF/IUF.')
  }
  if (summary.fpAvg < summary.limits.fp) {
    add('Média', 'Corrigir fator de potência', 'Dimensionar compensação reativa com atenção a harmônicas e risco de ressonância.')
  }
  if ((summary.prodistVoltage?.Crítica?.pct ?? 0) > 0 || (summary.prodistVoltage?.Precária?.pct ?? 0) > 5) {
    add('Alta', 'Adequar nível de tensão', 'Revisar taps, queda de tensão em alimentadores e carregamento para reduzir tempo em faixa precária/crítica.')
  }
  if (!measurement.classAReady) {
    add('Baixa', 'Melhorar rastreabilidade da medição', 'Usar aquisição com forma de onda, taxa compatível e sincronismo para aproximar requisitos Classe A.')
  }
  if (!recommendations.length && events.length === 0) {
    add('Baixa', 'Manter monitoramento periódico', 'Indicadores dentro dos limites configurados; manter campanha e comparar sazonalidade de carga.')
  }
  return recommendations
}

function normalizeAngle(angle) {
  let value = angle
  while (value <= -180) value += 360
  while (value > 180) value -= 360
  return value
}

function buildPhasors(rows, frequency, voltageStats, currentStats) {
  const timestamps = rows.map(row => row.timestamp)
  const voltagePhasors = PHASES.map(phase => {
    const key = `v${phase.toLowerCase()}`
    const values = rows.map(row => row[key]).filter(Number.isFinite)
    const fundamental = harmonicSpectrum(values, timestamps, frequency, 'voltage')?.find(h => h.order === 1)
    return {
      phase,
      mag: fundamental?.magnitude || voltageStats[phase].rms,
      ang: fundamental?.angle ?? ({ A: 0, B: -120, C: 120 }[phase]),
    }
  })
  const vaRef = voltagePhasors[0]?.ang ?? 0

  const currentPhasors = PHASES.map(phase => {
    const key = `i${phase.toLowerCase()}`
    const values = rows.map(row => row[key]).filter(Number.isFinite)
    const fundamental = harmonicSpectrum(values, timestamps, frequency, 'current')?.find(h => h.order === 1)
    return {
      phase,
      mag: fundamental?.magnitude || currentStats[phase].rms,
      ang: fundamental?.angle ?? ({ A: -25, B: -145, C: 95 }[phase]),
    }
  })

  return {
    Va: { mag: toFixedNumber(voltagePhasors[0].mag, 2), ang: toFixedNumber(normalizeAngle(voltagePhasors[0].ang - vaRef), 1) },
    Vb: { mag: toFixedNumber(voltagePhasors[1].mag, 2), ang: toFixedNumber(normalizeAngle(voltagePhasors[1].ang - vaRef), 1) },
    Vc: { mag: toFixedNumber(voltagePhasors[2].mag, 2), ang: toFixedNumber(normalizeAngle(voltagePhasors[2].ang - vaRef), 1) },
    Ia: { mag: toFixedNumber(currentPhasors[0].mag, 2), ang: toFixedNumber(normalizeAngle(currentPhasors[0].ang - vaRef), 1) },
    Ib: { mag: toFixedNumber(currentPhasors[1].mag, 2), ang: toFixedNumber(normalizeAngle(currentPhasors[1].ang - vaRef), 1) },
    Ic: { mag: toFixedNumber(currentPhasors[2].mag, 2), ang: toFixedNumber(normalizeAngle(currentPhasors[2].ang - vaRef), 1) },
  }
}

function buildPower(rows, phasors, summary) {
  const pValues = rows.map(row => row.p).filter(Number.isFinite)
  const qValues = rows.map(row => row.q).filter(Number.isFinite)
  const pKw = pValues.length ? mean(pValues) : (phasors.Va.mag * phasors.Ia.mag + phasors.Vb.mag * phasors.Ib.mag + phasors.Vc.mag * phasors.Ic.mag) * summary.fpAvg / 1000
  const qKvar = qValues.length ? mean(qValues) : pKw * Math.tan(Math.acos(clamp(summary.fpAvg, 0, 1)))
  const sKva = Math.sqrt(pKw * pKw + qKvar * qKvar)
  return {
    pKw: toFixedNumber(pKw, 2),
    qKvar: toFixedNumber(qKvar, 2),
    sKva: toFixedNumber(sKva, 2),
    fp: toFixedNumber(sKva > 0 ? Math.abs(pKw) / sKva : summary.fpAvg, 4),
    distortionKva: toFixedNumber(sKva * (summary.thdIAvg / 100), 2),
    displacementFp: toFixedNumber(Math.cos(Math.atan2(qKvar, pKw || 1)), 4),
  }
}

function aggregateByDuration(series, durationMs, nominalVoltage) {
  if (!series.length) return { durationMs, count: 0, min: 0, max: 0, avg: 0, compliancePct: 100, points: [] }
  const points = []
  let bucket = []
  let start = series[0].timestamp
  series.forEach(point => {
    if (point.timestamp - start >= durationMs && bucket.length) {
      points.push(bucket)
      bucket = []
      start = point.timestamp
    }
    bucket.push(point)
  })
  if (bucket.length) points.push(bucket)

  const reduced = points.map(group => {
    const Vavg = mean(group.map(point => point.Vavg).filter(Number.isFinite))
    const freq = mean(group.map(point => point.freq).filter(Number.isFinite))
    const fp = mean(group.map(point => point.fp).filter(Number.isFinite))
    return {
      label: group[0].label,
      timestamp: group[0].timestamp,
      Vavg: toFixedNumber(Vavg, 3),
      freq: toFixedNumber(freq, 4),
      fp: toFixedNumber(fp, 4),
      prodist: prodistVoltageClass(nominalVoltage > 0 ? Vavg / nominalVoltage : 1),
    }
  })
  const voltages = reduced.map(point => point.Vavg).filter(Number.isFinite)
  return {
    durationMs,
    count: reduced.length,
    min: toFixedNumber(Math.min(...voltages, nominalVoltage), 3),
    max: toFixedNumber(Math.max(...voltages, nominalVoltage), 3),
    avg: toFixedNumber(mean(voltages), 3),
    compliancePct: toFixedNumber(100 * reduced.filter(point => point.prodist === 'Adequada').length / Math.max(1, reduced.length), 1),
    points: reduced.slice(0, 96),
  }
}

function buildMeasurementProfile(rows, sampleRate, frequency, nominalVoltage, rmsSeries) {
  const cycles = 10
  const windowMs = cycles * 1000 / (frequency || DEFAULT_FREQ)
  const samplesPerWindow = Math.max(1, Math.round(sampleRate * cycles / (frequency || DEFAULT_FREQ)))
  const windows = []
  for (let i = 0; i < rows.length; i += samplesPerWindow) {
    const slice = rows.slice(i, i + samplesPerWindow)
    if (slice.length < Math.max(8, samplesPerWindow * 0.6)) continue
    const Va = bucketChannel(slice, 'va')
    const Vb = bucketChannel(slice, 'vb')
    const Vc = bucketChannel(slice, 'vc')
    windows.push({
      label: formatDateLabel(slice[0].timestamp, windows.length),
      timestamp: slice[0].timestamp,
      Va: toFixedNumber(Va, 3),
      Vb: toFixedNumber(Vb, 3),
      Vc: toFixedNumber(Vc, 3),
      Vavg: toFixedNumber(mean([Va, Vb, Vc].filter(value => value > 0)), 3),
    })
  }

  const freqOk = rmsSeries.length
    ? 100 * rmsSeries.filter(point => point.freq >= DEFAULT_LIMITS.freqMin && point.freq <= DEFAULT_LIMITS.freqMax).length / rmsSeries.length
    : 100
  const hasWaveform = PHASES.every(phase => isInstantaneous(rows.map(row => row[`v${phase.toLowerCase()}`]).filter(Number.isFinite)))
  const hasThreePhaseVoltage = PHASES.every(phase => rows.some(row => Number.isFinite(row[`v${phase.toLowerCase()}`])))
  const classAReady = sampleRate >= DEFAULT_FREQ * 64 * 0.98 && hasWaveform && hasThreePhaseVoltage

  return {
    method: 'IEC 61000-4-30 aproximado',
    measurementClass: classAReady ? 'Classe A aproximada' : 'Classe S/dados agregados',
    windowCycles: cycles,
    windowMs: toFixedNumber(windowMs, 2),
    samplesPerWindow,
    sampleRate: toFixedNumber(sampleRate, 2),
    frequencyCompliancePct: toFixedNumber(freqOk, 1),
    voltageWindowMin: toFixedNumber(Math.min(...windows.map(window => window.Vavg), nominalVoltage), 3),
    voltageWindowMax: toFixedNumber(Math.max(...windows.map(window => window.Vavg), nominalVoltage), 3),
    hasWaveform,
    hasThreePhaseVoltage,
    classAReady,
    aggregations: {
      cycles10: { count: windows.length, points: windows.slice(0, 96) },
      cycles150: aggregateByDuration(rmsSeries, 150 * 1000 / (frequency || DEFAULT_FREQ), nominalVoltage),
      minutes10: aggregateByDuration(rmsSeries, 10 * 60 * 1000, nominalVoltage),
      hours2: aggregateByDuration(rmsSeries, 2 * 60 * 60 * 1000, nominalVoltage),
    },
    windows: windows.slice(0, 96),
  }
}

function buildPhaseResult(phase, voltageValues, currentValues, timestamps, frequency, fallbackThdV, fallbackThdI) {
  const vRms = channelRms(voltageValues)
  const iRms = channelRms(currentValues)
  const vHarmonics = harmonicSpectrum(voltageValues, timestamps, frequency, 'voltage') ?? fallbackHarmonics(fallbackThdV, vRms || 1, 'voltage')
  const iHarmonics = harmonicSpectrum(currentValues, timestamps, frequency, 'current') ?? fallbackHarmonics(fallbackThdI, iRms || 1, 'current')
  const interharmonics = interharmonicSpectrum(voltageValues, timestamps, frequency, 'voltage')
  const currentInterharmonics = interharmonicSpectrum(currentValues, timestamps, frequency, 'current')
  return {
    phase,
    vrms: toFixedNumber(vRms, 3),
    irms: toFixedNumber(iRms, 3),
    thdV: toFixedNumber(calcTHD(vHarmonics), 3),
    thdI: toFixedNumber(calcTHD(iHarmonics), 3),
    harmonics: vHarmonics,
    currentHarmonics: iHarmonics,
    interharmonics,
    currentInterharmonics,
    interharmonicVMax: toFixedNumber(maxSpectrumPct(interharmonics), 3),
    interharmonicIMax: toFixedNumber(maxSpectrumPct(currentInterharmonics), 3),
    waveformBased: isInstantaneous(voltageValues),
  }
}

function buildDefaultRows() {
  const sampleRate = 3840
  const duration = 2
  const count = sampleRate * duration
  const base = new Date(2024, 4, 31, 14, 20, 0).getTime()
  const vRms = 220
  const iRms = 118
  const rows = []
  for (let i = 0; i < count; i += 1) {
    const t = i / sampleRate
    const timestamp = base + t * 1000
    const sagB = t > 0.7 && t < 0.96 ? 0.64 : 1
    const swellA = t > 1.28 && t < 1.36 ? 1.16 : 1
    const transientA = Math.exp(-(((t - 1.55) / 0.0007) ** 2)) * vRms * Math.SQRT2 * 1.1
    const flicker = 1 + 0.006 * Math.sin(2 * Math.PI * 8.8 * t)
    const angle = 2 * Math.PI * DEFAULT_FREQ * t
    const harmonic = theta => 0.028 * Math.sin(5 * theta + 0.2) + 0.019 * Math.sin(7 * theta - 0.5) + 0.008 * Math.sin(11 * theta)
    const currentHarmonic = theta => 0.07 * Math.sin(5 * theta - 0.4) + 0.04 * Math.sin(7 * theta + 0.1)
    const va = vRms * Math.SQRT2 * swellA * flicker * (Math.sin(angle) + harmonic(angle)) + transientA
    const vb = vRms * Math.SQRT2 * sagB * flicker * (Math.sin(angle - 2 * Math.PI / 3) + harmonic(angle - 2 * Math.PI / 3))
    const vc = vRms * Math.SQRT2 * 0.99 * flicker * (Math.sin(angle + 2 * Math.PI / 3) + harmonic(angle + 2 * Math.PI / 3))
    const ia = iRms * Math.SQRT2 * (Math.sin(angle - 0.43) + currentHarmonic(angle))
    const ib = iRms * Math.SQRT2 * 0.96 * (Math.sin(angle - 2 * Math.PI / 3 - 0.47) + currentHarmonic(angle - 2 * Math.PI / 3))
    const ic = iRms * Math.SQRT2 * 1.04 * (Math.sin(angle + 2 * Math.PI / 3 - 0.39) + currentHarmonic(angle + 2 * Math.PI / 3))
    rows.push({
      timestamp,
      Va: toFixedNumber(va, 5),
      Vb: toFixedNumber(vb, 5),
      Vc: toFixedNumber(vc, 5),
      Ia: toFixedNumber(ia, 5),
      Ib: toFixedNumber(ib, 5),
      Ic: toFixedNumber(ic, 5),
      Freq_Hz: toFixedNumber(DEFAULT_FREQ + 0.025 * Math.sin(2 * Math.PI * 0.4 * t), 4),
      FP: 0.914,
    })
  }
  return rows
}

export function calcTHD(harmonics) {
  const fund = harmonics.find(h => h.order === 1)?.magnitude ?? 0
  if (!fund) return 0
  const sumSq = harmonics
    .filter(h => h.order > 1)
    .reduce((sum, h) => sum + h.magnitude ** 2, 0)
  return (100 * Math.sqrt(sumSq)) / fund
}

export function generateHarmonics(thdPct, fundamental = 100) {
  const orders = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]
  const weights = orders
    .filter(order => order > 1)
    .map(order => ({ order, weight: 1 / Math.pow(order, 1.3) }))
  const norm = Math.sqrt(weights.reduce((sum, item) => sum + item.weight ** 2, 0)) || 1
  return orders.map(order => {
    if (order === 1) return { order: 1, magnitude: fundamental, limitPct: 100, percent: 100 }
    const weight = weights.find(item => item.order === order)?.weight ?? 0
    const magnitude = fundamental * (thdPct / 100) * weight / norm
    return {
      order,
      magnitude: toFixedNumber(magnitude, 5),
      percent: toFixedNumber((magnitude / fundamental) * 100, 3),
      limitPct: harmonicLimitPct(order, 'voltage'),
    }
  })
}

export function voltageUnbalance(Va, Vb, Vc) {
  const Vavg = (Va + Vb + Vc) / 3
  if (!Vavg) return 0
  const maxDev = Math.max(Math.abs(Va - Vavg), Math.abs(Vb - Vavg), Math.abs(Vc - Vavg))
  return +((maxDev / Vavg) * 100).toFixed(3)
}

export function energySeries(days = 31) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(2024, 4, i + 1)
    const label = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
    const energy = 3800 + Math.sin(i * 0.4) * 500 + seededNoise(i, 1) * 300
    const demand = 1600 + Math.sin(i * 0.3) * 180 + seededNoise(i, 2) * 120
    const fp = 0.88 + seededNoise(i, 3) * 0.08
    return {
      label,
      energy: +energy.toFixed(0),
      demand: +demand.toFixed(0),
      fp: +fp.toFixed(3),
    }
  })
}

export function buildDemoPowerQualityDataset() {
  return {
    fileName: 'demo_qe_calculado.csv',
    sourceType: 'Demonstração calculada',
    rows: buildDefaultRows(),
    importedAt: new Date().toISOString(),
  }
}

export function normalizePowerQualityRows(dataset) {
  const rows = dataset?.rows?.length ? dataset.rows : buildDefaultRows()
  const columns = dataset?.columns?.length ? dataset.columns : Object.keys(rows[0] ?? {})
  const map = Object.fromEntries(Object.keys(COLUMN_ALIASES).map(key => [key, findColumn(columns, key)]))

  const rawNumbers = rows.map(row => ({
    row,
    va: parseNumber(row[map.va]),
    vb: parseNumber(row[map.vb]),
    vc: parseNumber(row[map.vc]),
    ia: parseNumber(row[map.ia]),
    ib: parseNumber(row[map.ib]),
    ic: parseNumber(row[map.ic]),
    freq: parseNumber(row[map.freq]),
    p: parseNumber(row[map.p]),
    q: parseNumber(row[map.q]),
    fp: parseNumber(row[map.fp]),
  }))

  const vScale = {
    va: inferScale(map.va, rawNumbers.map(item => item.va).filter(Number.isFinite), 'voltage'),
    vb: inferScale(map.vb, rawNumbers.map(item => item.vb).filter(Number.isFinite), 'voltage'),
    vc: inferScale(map.vc, rawNumbers.map(item => item.vc).filter(Number.isFinite), 'voltage'),
  }
  const iScale = {
    ia: inferScale(map.ia, rawNumbers.map(item => item.ia).filter(Number.isFinite), 'current'),
    ib: inferScale(map.ib, rawNumbers.map(item => item.ib).filter(Number.isFinite), 'current'),
    ic: inferScale(map.ic, rawNumbers.map(item => item.ic).filter(Number.isFinite), 'current'),
  }

  const normalized = rawNumbers.map((item, index) => {
    const timestamp = parseTimestamp(map.timestamp ? item.row[map.timestamp] : null, index)
    return {
      index,
      timestamp,
      va: Number.isFinite(item.va) ? item.va * vScale.va : null,
      vb: Number.isFinite(item.vb) ? item.vb * vScale.vb : null,
      vc: Number.isFinite(item.vc) ? item.vc * vScale.vc : null,
      ia: Number.isFinite(item.ia) ? item.ia * iScale.ia : null,
      ib: Number.isFinite(item.ib) ? item.ib * iScale.ib : null,
      ic: Number.isFinite(item.ic) ? item.ic * iScale.ic : null,
      freq: Number.isFinite(item.freq) ? item.freq : DEFAULT_FREQ,
      p: Number.isFinite(item.p) ? item.p : null,
      q: Number.isFinite(item.q) ? item.q : null,
      fp: Number.isFinite(item.fp) ? item.fp : null,
    }
  }).filter(row => [row.va, row.vb, row.vc, row.ia, row.ib, row.ic].some(Number.isFinite))

  return {
    rows: normalized.length ? normalized : normalizePowerQualityRows(buildDemoPowerQualityDataset()).rows,
    columns,
    map,
    sourceName: dataset?.fileName ?? 'demo_qe_calculado.csv',
    sourceType: dataset?.sourceType ?? (dataset?.rows?.length ? 'Arquivo importado' : 'Demonstração calculada'),
  }
}

export function analyzePowerQuality(dataset = null) {
  const normalized = normalizePowerQualityRows(dataset)
  const rows = normalized.rows
  const timestamps = rows.map(row => row.timestamp)
  const sampleRate = inferSampleRate(rows)
  const freqValues = rows.map(row => row.freq).filter(Number.isFinite)
  const frequency = mean(freqValues) || DEFAULT_FREQ

  const voltageValues = {
    A: rows.map(row => row.va).filter(Number.isFinite),
    B: rows.map(row => row.vb).filter(Number.isFinite),
    C: rows.map(row => row.vc).filter(Number.isFinite),
  }
  const currentValues = {
    A: rows.map(row => row.ia).filter(Number.isFinite),
    B: rows.map(row => row.ib).filter(Number.isFinite),
    C: rows.map(row => row.ic).filter(Number.isFinite),
  }

  const nominalVoltage = inferNominalVoltage([...voltageValues.A, ...voltageValues.B, ...voltageValues.C])
  const standardLimits = {
    ...DEFAULT_LIMITS,
    thdV: voltageThdLimit(nominalVoltage),
    thdI: currentThdLimit(50),
  }
  const voltageStats = Object.fromEntries(PHASES.map(phase => [phase, { rms: channelRms(voltageValues[phase]), avg: channelAverage(voltageValues[phase]) }]))
  const currentStats = Object.fromEntries(PHASES.map(phase => [phase, { rms: channelRms(currentValues[phase]), avg: channelAverage(currentValues[phase]) }]))

  const fallbackThdV = normalized.sourceType === 'Demonstração calculada' ? 4.1 : 2.5
  const fallbackThdI = normalized.sourceType === 'Demonstração calculada' ? 8.3 : 6.5
  const phaseResults = Object.fromEntries(PHASES.map(phase => {
    const result = buildPhaseResult(
      phase,
      voltageValues[phase],
      currentValues[phase],
      timestamps,
      frequency,
      fallbackThdV,
      fallbackThdI,
    )
    return [`Fase ${phase}`, result]
  }))

  const thdVAvg = mean(PHASES.map(phase => phaseResults[`Fase ${phase}`].thdV))
  const thdIAvg = mean(PHASES.map(phase => phaseResults[`Fase ${phase}`].thdI))
  const interharmonicVMax = Math.max(...PHASES.map(phase => phaseResults[`Fase ${phase}`].interharmonicVMax), 0)
  const interharmonicIMax = Math.max(...PHASES.map(phase => phaseResults[`Fase ${phase}`].interharmonicIMax), 0)
  const unbalance = voltageUnbalance(voltageStats.A.rms, voltageStats.B.rms, voltageStats.C.rms)
  const rmsSeries = buildRmsSeries(rows, nominalVoltage)
  const pst95 = percentile(rmsSeries.map(point => point.pst), 0.95)
  const measurement = buildMeasurementProfile(rows, sampleRate, frequency, nominalVoltage, rmsSeries)
  const transientEvents = detectTransientEvents(rows, nominalVoltage)
  const fpValues = rows.map(row => row.fp).filter(value => Number.isFinite(value) && value > 0)
  const fpFromPower = rows
    .map(row => Number.isFinite(row.p) && Number.isFinite(row.q) ? Math.abs(row.p) / Math.sqrt(row.p * row.p + row.q * row.q) : null)
    .filter(Number.isFinite)
  const fpAvg = mean(fpValues.length ? fpValues : fpFromPower) || 0.92

  const voltageCompliancePct = rmsSeries.length
    ? 100 * rmsSeries.filter(point => {
      const values = [point.Va, point.Vb, point.Vc].filter(Number.isFinite)
      return values.every(value => {
        const pu = nominalVoltage > 0 ? value / nominalVoltage : 1
        return pu >= DEFAULT_LIMITS.voltageMinPu && pu <= DEFAULT_LIMITS.voltageMaxPu
      })
    }).length / rmsSeries.length
    : 100
  const prodistVoltage = prodistVoltageSummary(rmsSeries, nominalVoltage)

  const baseSummary = {
    sampleCount: rows.length,
    sampleRate: toFixedNumber(sampleRate, 2),
    freqAvg: toFixedNumber(frequency, 4),
    nominalVoltage: toFixedNumber(nominalVoltage, 3),
    vrmsAvg: toFixedNumber(mean(PHASES.map(phase => voltageStats[phase].rms)), 3),
    irmsAvg: toFixedNumber(mean(PHASES.map(phase => currentStats[phase].rms)), 3),
    thdVAvg: toFixedNumber(thdVAvg, 3),
    thdIAvg: toFixedNumber(thdIAvg, 3),
    interharmonicVMax: toFixedNumber(interharmonicVMax, 3),
    interharmonicIMax: toFixedNumber(interharmonicIMax, 3),
    transientCount: transientEvents.length,
    unbalance: toFixedNumber(unbalance, 3),
    pst95: toFixedNumber(pst95, 3),
    fpAvg: toFixedNumber(fpAvg, 4),
    voltageCompliancePct: toFixedNumber(voltageCompliancePct, 1),
    frequencyCompliancePct: measurement.frequencyCompliancePct,
    prodistVoltage,
    limits: standardLimits,
    lastTimestamp: rows[rows.length - 1]?.timestamp ?? Date.now(),
  }

  const events = addIndexEvents([...detectVoltageEvents(rmsSeries, nominalVoltage), ...transientEvents], baseSummary)
  const summary = {
    ...baseSummary,
    eventsCount: events.length,
  }

  const phasors = buildPhasors(rows, frequency, voltageStats, currentStats)
  const power = buildPower(rows, phasors, summary)
  const conformity = buildConformity(summary)
  const recommendations = buildRecommendations(summary, events, measurement)

  const geral = {
    phase: 'Geral',
    vrms: summary.vrmsAvg,
    irms: summary.irmsAvg,
    thdV: summary.thdVAvg,
    thdI: summary.thdIAvg,
    harmonics: fallbackHarmonics(summary.thdVAvg, summary.vrmsAvg || 1, 'voltage'),
    currentHarmonics: fallbackHarmonics(summary.thdIAvg, summary.irmsAvg || 1, 'current'),
    interharmonics: PHASES.flatMap(phase => phaseResults[`Fase ${phase}`].interharmonics).sort((a, b) => b.percent - a.percent).slice(0, 12),
    currentInterharmonics: PHASES.flatMap(phase => phaseResults[`Fase ${phase}`].currentInterharmonics).sort((a, b) => b.percent - a.percent).slice(0, 12),
    interharmonicVMax: summary.interharmonicVMax,
    interharmonicIMax: summary.interharmonicIMax,
    waveformBased: Object.values(phaseResults).some(phase => phase.waveformBased),
  }

  return {
    sourceName: normalized.sourceName,
    sourceType: normalized.sourceType,
    imported: Boolean(dataset?.rows?.length),
    sampleCount: rows.length,
    sampleRate: summary.sampleRate,
    nominalVoltage,
    nominalFrequency: DEFAULT_FREQ,
    normalizedRows: rows,
    rmsSeries,
    phases: {
      ...phaseResults,
      Geral: geral,
    },
    phasors,
    power,
    measurement,
    recommendations,
    events,
    eventSummary: eventSummary(events),
    conformity,
    summary,
  }
}

export function demoEvents() {
  return analyzePowerQuality(buildDemoPowerQualityDataset()).events.slice(0, 8)
}

export const SEV_CLASS = {
  'Crítico': 'badge badge-red',
  Alto: 'badge badge-red',
  Médio: 'badge badge-yellow',
  Baixo: 'badge badge-green',
}
