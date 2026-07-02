import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { useAppContext } from '../context/AppContext'
import { useToast } from '../components/Toast'

const TARIFAS = {
  'Grupo A4 Verde': { energy: 0.69 },
  'Grupo A4 Azul': { energy: 0.74 },
  'Grupo B1 Residencial': { energy: 0.82 },
  'Grupo A3 Verde': { energy: 0.66 },
}
const INSTALACOES = ['Subestação Principal', 'Laboratório LQE', 'Fábrica Norte']
const MIN_BILLING_WINDOW_HOURS = 0.25
const MIN_ESTIMATED_ENERGY_WINDOW_HOURS = 1 / 60
const BANK_COST_BRL_PER_KVAR = 120

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : 'N/D'
}

function fmtEnergy(kWh) {
  if (!Number.isFinite(kWh)) return 'N/D'
  const abs = Math.abs(kWh)
  if (abs >= 1000) return `${fmt(kWh / 1000, 2)} MWh`
  if (abs >= 1) return `${fmt(kWh, 1)} kWh`
  return `${fmt(kWh * 1000, 0)} Wh`
}

function fmtPower(kW) {
  if (!Number.isFinite(kW)) return 'N/D'
  const abs = Math.abs(kW)
  if (abs >= 1000) return `${fmt(kW / 1000, 3)} MW`
  return `${fmt(kW, abs < 10 ? 1 : 0)} kW`
}

function fmtReactive(kvar) {
  if (!Number.isFinite(kvar)) return 'N/D'
  const abs = Math.abs(kvar)
  if (abs >= 1000) return `${fmt(kvar / 1000, 3)} MVAr`
  return `${fmt(kvar, abs < 10 ? 1 : 0)} kVAr`
}

function fmtReactiveEnergy(kvarh) {
  if (!Number.isFinite(kvarh)) return 'N/D'
  const abs = Math.abs(kvarh)
  if (abs >= 1000) return `${fmt(kvarh / 1000, 2)} MVArh`
  if (abs >= 1) return `${fmt(kvarh, 1)} kVArh`
  return `${fmt(kvarh * 1000, 0)} VArh`
}

function fmtMoney(value) {
  if (!Number.isFinite(value)) return 'N/D'
  const digits = Math.abs(value) < 100 ? 2 : 0
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function fmtDuration(hours) {
  if (!Number.isFinite(hours) || hours <= 0) return 'sem duração'
  if (hours < 1 / 60) return `${fmt(hours * 3600, 1)} s`
  if (hours < 1) return `${fmt(hours * 60, 1)} min`
  if (hours < 48) return `${fmt(hours, 2)} h`
  return `${fmt(hours / 24, 1)} dias`
}

function avg(values) {
  const clean = values.filter(Number.isFinite)
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : NaN
}

function bucket(values, count) {
  if (!values.length) return []
  const size = Math.max(1, Math.ceil(values.length / count))
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) => values.slice(index * size, (index + 1) * size))
}

function spanHours(points) {
  const timestamps = points.map(point => point?.timestamp).filter(Number.isFinite)
  if (timestamps.length >= 2) return Math.max(0, (Math.max(...timestamps) - Math.min(...timestamps)) / 3600000)
  const durationMs = points.reduce((sum, point) => sum + (Number.isFinite(point?.durationMs) ? point.durationMs : 0), 0)
  return Math.max(0, durationMs / 3600000)
}

function integrate(points, key, fallbackHours = 0, forceFallbackHours = false) {
  if (!points.length) return NaN
  if (forceFallbackHours && fallbackHours > 0) return Math.abs(avg(points.map(point => point[key]))) * fallbackHours
  if (points.length === 1) return Math.abs(points[0][key] || 0) * fallbackHours

  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    const previous = points[i - 1]
    const current = points[i]
    const dtHours = Math.max(0, ((current.timestamp ?? 0) - (previous.timestamp ?? 0)) / 3600000)
    const averagePower = (Math.abs(previous[key] || 0) + Math.abs(current[key] || 0)) / 2
    total += averagePower * dtHours
  }
  return total || Math.abs(avg(points.map(point => point[key]))) * fallbackHours
}

function labelFromTimestamp(timestamp, windowHours, index) {
  if (!Number.isFinite(timestamp)) return `A${index + 1}`
  const date = new Date(timestamp)
  if (windowHours < 1) return date.toLocaleTimeString('pt-BR', { minute: '2-digit', second: '2-digit' })
  if (windowHours < 24) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function estimatePowerFromRms(point, analysis) {
  const voltage = point.Vavg || avg([point.Va, point.Vb, point.Vc].filter(value => value > 0))
  const current = point.Iavg || avg([point.Ia, point.Ib, point.Ic].filter(value => value > 0))
  const fp = Math.abs(point.fp || analysis.summary?.fpAvg || analysis.power?.fp || 0.92)
  const estimated = voltage > 0 && current > 0 ? (3 * voltage * current * fp) / 1000 : Math.abs(analysis.power?.pKw || 0)
  return Number.isFinite(estimated) ? estimated : 0
}

function calcCapacitorBank(pKw, fpAtual, fpAlvo) {
  if (!Number.isFinite(pKw) || pKw <= 0) return NaN
  const current = clamp(Math.abs(fpAtual || 0), 0.01, 0.999)
  const target = clamp(Math.abs(fpAlvo || 0.98), 0.01, 0.999)
  if (current >= target) return 0
  const tgAtual = Math.tan(Math.acos(current))
  const tgAlvo = Math.tan(Math.acos(target))
  return +(pKw * (tgAtual - tgAlvo)).toFixed(1)
}

function buildEnergyBars(rows, qRows, windowHours, forceFallbackHours = false) {
  const groups = bucket(rows, 31)
  let cumulative = 0
  return groups.map((group, index) => {
    const groupHours = spanHours(group) || (groups.length ? windowHours / groups.length : 0)
    const energy = integrate(group, 'p', groupHours, forceFallbackHours)
    cumulative += Number.isFinite(energy) ? energy : 0
    const start = group[0]?.timestamp
    const matchingQ = qRows.filter(row => row.timestamp >= group[0]?.timestamp && row.timestamp <= group[group.length - 1]?.timestamp)
    const reactive = Number.isFinite(start) && matchingQ.length ? integrate(matchingQ, 'q', groupHours, forceFallbackHours) : NaN
    return {
      label: labelFromTimestamp(start, windowHours, index),
      energy: +(energy || 0).toFixed(energy < 1 ? 3 : 1),
      reactive: +(reactive || 0).toFixed(reactive < 1 ? 3 : 1),
      cumulative: +cumulative.toFixed(cumulative < 1 ? 3 : 1),
    }
  })
}

function buildLoadProfile(analysis, pRows) {
  const source = pRows.length
    ? pRows.map(row => ({ timestamp: row.timestamp, demand: Math.abs(row.p), fp: row.fp }))
    : (analysis.rmsSeries ?? []).map(row => ({ timestamp: row.timestamp, demand: estimatePowerFromRms(row, analysis), fp: row.fp }))
  return bucket(source, 24).map((group, index) => ({
    h: labelFromTimestamp(group[0]?.timestamp, spanHours(source), index),
    demanda: +avg(group.map(row => row.demand)).toFixed(1),
    fp: +(avg(group.map(row => row.fp)) || analysis.summary?.fpAvg || 0).toFixed(3),
  }))
}

function buildDemandCurve(loadProfile) {
  return loadProfile
    .map(point => point.demanda)
    .filter(Number.isFinite)
    .sort((a, b) => b - a)
    .map((demand, index, arr) => ({
      x: arr.length > 1 ? +((index / (arr.length - 1)) * 100).toFixed(1) : 0,
      demand: +demand.toFixed(1),
    }))
}

function buildMetrics(analysis, tariffName, fpTarget) {
  const tariff = TARIFAS[tariffName] ?? TARIFAS['Grupo A4 Verde']
  const rows = analysis.normalizedRows ?? []
  const pRows = rows.filter(row => Number.isFinite(row?.p) && Number.isFinite(row?.timestamp))
  const qRows = rows.filter(row => Number.isFinite(row?.q) && Number.isFinite(row?.timestamp))
  const measuredWindowHours = spanHours(rows.length ? rows : (analysis.rmsSeries ?? []))
  const sourceWindowHours = Number.isFinite(analysis.sourceWindowHours) ? analysis.sourceWindowHours : 0
  const useSourceWindow = sourceWindowHours > measuredWindowHours
  const windowHours = useSourceWindow ? sourceWindowHours : measuredWindowHours
  const hasMeasuredPower = pRows.length >= 2
  const estimatedRows = hasMeasuredPower ? [] : (analysis.rmsSeries ?? []).map(row => ({
    timestamp: row.timestamp,
    p: estimatePowerFromRms(row, analysis),
    fp: row.fp,
  })).filter(row => Number.isFinite(row.timestamp) && Number.isFinite(row.p))
  const billingReady = hasMeasuredPower && windowHours >= MIN_BILLING_WINDOW_HOURS
  const hasEstimatedPower = !hasMeasuredPower && estimatedRows.length >= 2 && windowHours >= MIN_ESTIMATED_ENERGY_WINDOW_HOURS
  const energyKWh = hasMeasuredPower ? integrate(pRows, 'p', windowHours, useSourceWindow) : hasEstimatedPower ? integrate(estimatedRows, 'p', windowHours, useSourceWindow) : NaN
  const reactiveKvarh = qRows.length >= 2 && windowHours >= MIN_ESTIMATED_ENERGY_WINDOW_HOURS ? integrate(qRows, 'q', windowHours, useSourceWindow) : NaN
  const avgPowerKw = hasMeasuredPower ? Math.abs(avg(pRows.map(row => row.p))) : Math.abs(analysis.power?.pKw || NaN)
  const maxDemandKw = hasMeasuredPower && windowHours >= MIN_ESTIMATED_ENERGY_WINDOW_HOURS ? Math.max(...pRows.map(row => Math.abs(row.p)).filter(Number.isFinite), 0) : NaN
  const fpAvg = clamp(analysis.summary?.fpAvg || analysis.power?.fp || 0, 0, 1)
  const cost = billingReady && Number.isFinite(energyKWh) ? energyKWh * tariff.energy : NaN
  const qCap = billingReady ? calcCapacitorBank(avgPowerKw, fpAvg, fpTarget) : NaN
  const capacitorCost = Number.isFinite(qCap) ? qCap * BANK_COST_BRL_PER_KVAR : NaN
  const savings = billingReady && fpAvg < fpTarget ? cost * clamp((fpTarget - fpAvg) * 1.8, 0, 0.18) : NaN
  const energyBars = billingReady ? buildEnergyBars(pRows, qRows, windowHours, useSourceWindow) : []
  const loadProfile = buildLoadProfile(analysis, pRows)
  const demandCurve = buildDemandCurve(loadProfile)

  return {
    tariff,
    windowHours,
    hasMeasuredPower,
    hasEstimatedPower,
    billingReady,
    energyKWh,
    reactiveKvarh,
    avgPowerKw,
    maxDemandKw,
    fpAvg,
    cost,
    qCap,
    capacitorCost,
    savings,
    energyBars,
    loadProfile,
    demandCurve,
    useSourceWindow,
    basis: billingReady ? 'janela medida' : hasMeasuredPower ? 'amostra curta' : hasEstimatedPower ? 'estimado em janela curta' : 'sem base',
  }
}

function placeholderRows() {
  return [{ label: 'N/D', energy: 0, reactive: 0, cumulative: 0 }]
}

function costPie(metrics) {
  if (!Number.isFinite(metrics.cost)) return [{ name: 'Sem base', value: 1, color: '#cbd5e1', amount: NaN }]
  return [
    { name: metrics.billingReady ? 'Energia ativa' : 'Custo estimado', value: 100, color: '#1d4ed8', amount: metrics.cost },
  ]
}

function scenarioRows(metrics, fpAtual, fpTarget) {
  const partialTarget = Math.max(fpAtual, Math.min(fpTarget, 0.95))
  const fullTarget = Math.max(fpTarget, 0.99)
  const rows = [
    ['Atual', fpAtual, metrics.cost, NaN, NaN, NaN],
    ['Correção parcial', partialTarget, metrics.cost - (metrics.savings * 0.45), calcCapacitorBank(metrics.avgPowerKw, fpAtual, partialTarget), metrics.savings * 0.45, NaN],
    ['Correção padrão', fpTarget, metrics.cost - metrics.savings, metrics.qCap, metrics.savings, metrics.capacitorCost / metrics.savings],
    ['Correção 0,99', fullTarget, metrics.cost - (metrics.savings * 1.08), calcCapacitorBank(metrics.avgPowerKw, fpAtual, fullTarget), metrics.savings * 1.08, metrics.capacitorCost / (metrics.savings * 1.08)],
  ]

  return rows.map(([name, fp, cost, qCap, savings, payback]) => [
    name,
    Number.isFinite(fp) ? fmt(fp, 3) : 'N/D',
    fmtMoney(cost),
    fmtReactive(qCap),
    fmtMoney(savings),
    Number.isFinite(payback) && payback > 0 ? `${Math.ceil(payback)} meses` : 'N/D',
  ])
}

function balanceRows(metrics) {
  return [
    ['Energia ativa', fmtEnergy(metrics.energyKWh), metrics.billingReady ? '100,0%' : 'estimada', metrics.basis],
    ['Energia reativa medida', fmtReactiveEnergy(metrics.reactiveKvarh), 'N/D', metrics.hasMeasuredPower ? 'coluna Q_kVAr' : 'N/D'],
    ['Demanda máxima', fmtPower(metrics.maxDemandKw), 'N/D', metrics.hasMeasuredPower ? 'P_kW medido' : 'N/D'],
    ['Duração da janela', fmtDuration(metrics.windowHours), 'N/D', metrics.billingReady ? 'apta' : 'insuficiente'],
  ]
}

export default function EnergiaDemandaFP() {
  const {
    installation: instalacao,
    setInstallation: setInstalacao,
    resolvedInstallation,
    hasDatasetInstallation,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    pqAnalysis,
    analysisStatus,
  } = useAppContext()
  const toast = useToast()
  const [tarifa, setTarifa] = useState('Grupo A4 Verde')
  const [fpAlvo, setFpAlvo] = useState('0,98')
  const [showEconomy, setShowEconomy] = useState(false)
  const [showSim, setShowSim] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [calculating, setCalculating] = useState(false)

  const fpTarget = clamp(parseFloat(fpAlvo.replace(',', '.')) || 0.98, 0.8, 0.999)
  const metrics = useMemo(() => buildMetrics(pqAnalysis, tarifa, fpTarget), [pqAnalysis, tarifa, fpTarget])
  const chartData = metrics.energyBars.length ? metrics.energyBars : placeholderRows()
  const pie = costPie(metrics)
  const financialRows = [
    ['Custo da janela', fmtMoney(metrics.cost), tarifa],
    ['Economia', fmtMoney(metrics.savings), `FP ${fmt(fpTarget, 3)}`],
    ['Banco capacitivo', fmtReactive(metrics.qCap), fmtMoney(metrics.capacitorCost)],
  ]
  const compareRows = scenarioRows(metrics, metrics.fpAvg, fpTarget)
  const installationOptions = useMemo(() => {
    const options = [resolvedInstallation, instalacao, ...INSTALACOES].filter(Boolean)
    return [...new Set(options)]
  }, [resolvedInstallation, instalacao])

  function handleCalcular() {
    setShowEconomy(false)
    setCalculating(true)
    setTimeout(() => {
      setCalculating(false)
      setShowEconomy(true)
      toast(metrics.billingReady ? 'Análise de economia calculada' : 'Base insuficiente para economia mensal', metrics.billingReady ? 'success' : 'warning')
    }, 500)
  }

  function handleSimular() {
    setShowSim(true)
    toast(metrics.billingReady ? 'Simulação de FP carregada' : 'Simulação limitada por falta de P_kW medido', metrics.billingReady ? 'info' : 'warning')
  }

  function handleComparar() {
    setShowCompare(true)
    toast(metrics.billingReady ? 'Comparativo de cenários gerado' : 'Comparativo sem valores financeiros', metrics.billingReady ? 'info' : 'warning')
  }

  return (
    <div style={{ minHeight: 1250, display: 'flex', flexDirection: 'column', gap: 14, padding: 14, overflow: 'visible' }}>
      <div className="filter-bar" style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <label>Período de Análise</label>
        <input value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }} />
        <span style={{ color: '#64748b' }}>até</span>
        <input value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 150 }} />
        <label>Instalação</label>
        <select value={resolvedInstallation} onChange={e => setInstalacao(e.target.value)} disabled={hasDatasetInstallation}>
          {installationOptions.map(o => <option key={o}>{o}</option>)}
        </select>
        {hasDatasetInstallation && (
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, whiteSpace: 'nowrap' }}>instalação vinda da base</span>
        )}
        <label>Tarifa</label>
        <select value={tarifa} onChange={e => setTarifa(e.target.value)}>
          {Object.keys(TARIFAS).map(o => <option key={o}>{o}</option>)}
        </select>
        <span style={{ fontSize: 11, fontWeight: 700, color: metrics.billingReady ? '#16a34a' : '#d97706', whiteSpace: 'nowrap' }}>
          Base: {metrics.basis} · {fmtDuration(metrics.windowHours)}
        </span>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={handleCalcular} disabled={calculating}>
          {calculating ? '...' : 'Calcular Economia'}
        </button>
        <button className="btn btn-ghost" onClick={handleSimular}>Simular Correção de FP</button>
        <button className="btn btn-ghost" onClick={handleComparar}>Comparar Cenários</button>
      </div>

      {showEconomy && (
        <div className="result-panel result-panel--success" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
          <button onClick={() => setShowEconomy(false)} className="btn-close-panel">x</button>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Análise de Economia — {resolvedInstallation}</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>FP atual: <b>{fmt(metrics.fpAvg, 3)}</b> → FP alvo: <b>{fmt(fpTarget, 3)}</b></div>
          </div>
          {[
            ['Economia Potencial', fmtMoney(metrics.savings), '#16a34a'],
            ['Banco de Capacitores', fmtReactive(metrics.qCap), 'var(--c-primary)'],
            ['Custo da Janela', fmtMoney(metrics.cost), 'var(--c-success)'],
          ].map(([label, val, color]) => (
            <div key={label} className="result-card result-card--success">
              <div style={{ fontSize: 10, color: 'var(--c-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {showSim && (
        <div className="result-panel result-panel--info">
          <button onClick={() => setShowSim(false)} className="btn-close-panel">x</button>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Simulação de Correção de Fator de Potência</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 4 }}>FP Alvo</div>
              <input className="form-input" value={fpAlvo} onChange={e => setFpAlvo(e.target.value)} placeholder="0,98" style={{ width: '100%' }} />
            </div>
            <div className="result-card result-card--info" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Banco de Capacitores Necessário</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--c-primary)', marginTop: 4 }}>{fmtReactive(metrics.qCap)}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>Potência ativa base: {fmtPower(metrics.avgPowerKw)}</div>
            </div>
            <div className="result-card result-card--info" style={{ padding: '10px 14px' }}>
              <div style={{ fontSize: 10, color: 'var(--c-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Custo Estimado do Banco</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#9333ea', marginTop: 4 }}>{fmtMoney(metrics.capacitorCost)}</div>
              <div style={{ fontSize: 11, color: 'var(--c-success)' }}>Payback: {Number.isFinite(metrics.capacitorCost / metrics.savings) ? `${Math.ceil(metrics.capacitorCost / metrics.savings)} meses` : 'N/D'}</div>
            </div>
          </div>
        </div>
      )}

      {showCompare && (
        <div className="result-panel result-panel--purple">
          <button onClick={() => setShowCompare(false)} className="btn-close-panel">x</button>
          <div style={{ fontWeight: 800, marginBottom: 12 }}>Comparação de Cenários de Eficiência</div>
          <table className="tbl">
            <thead><tr><th>Cenário</th><th>FP</th><th>Custo da janela</th><th>Banco kVAr</th><th>Economia</th><th>Payback</th></tr></thead>
            <tbody>
              {compareRows.map((row, i) => (
                <tr key={row[0]} className={i === 2 ? 'tbl-row-highlight' : undefined}>
                  {row.map((cell, j) => <td key={j} style={j === 0 ? { fontWeight: 700 } : j === 4 ? { color: 'var(--c-success)', fontWeight: 700 } : {}}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))' }}>
        {[
          ['Energia Ativa', fmtEnergy(metrics.energyKWh), metrics.billingReady ? `janela: ${fmtDuration(metrics.windowHours)}` : metrics.basis, '#16a34a'],
          ['Custo Estimado', fmtMoney(metrics.cost), Number.isFinite(metrics.cost) ? `${metrics.basis} · R$ ${fmt(metrics.tariff.energy, 3)}/kWh` : 'N/D', '#16a34a'],
          ['Demanda Máxima', fmtPower(metrics.maxDemandKw), metrics.hasMeasuredPower ? 'P_kW medido' : 'N/D', '#ea580c'],
          ['Fator de Potência Médio', `${fmt(metrics.fpAvg, 3)} ind.`, analysisStatus.running ? 'analisando' : metrics.basis, '#1d4ed8'],
          ['Base de Cálculo', metrics.basis, fmtDuration(metrics.windowHours), '#9333ea'],
          ['Custo Médio de Energia', `R$ ${fmt(metrics.tariff.energy, 3)}/kWh`, tarifa, '#d97706'],
          ['Economia Estimada', fmtMoney(metrics.savings), metrics.billingReady ? `FP alvo ${fmt(fpTarget, 3)}` : 'sem base mensal', '#16a34a'],
        ].map(([name, value, delta, color]) => (
          <div key={name} className="kpi-card">
            <div className="kpi-card__icon" style={{ background: color }}>{name[0]}</div>
            <div className="kpi-card__info"><div className="kpi-card__name">{name}</div><div className="kpi-card__value">{value}</div><div className="kpi-card__delta" style={{ color: value === 'N/D' ? '#d97706' : undefined }}>{delta}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr 0.9fr', gap: 10, height: 320 }}>
        <ChartPanel title="Energia da Janela (kWh)">
          <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Bar dataKey="energy" fill="#1d4ed8" name="Ativa" /><Bar dataKey="reactive" fill="#f97316" name="Reativa" /></BarChart>
        </ChartPanel>
        <ChartPanel title={metrics.hasMeasuredPower ? 'Perfil de Carga Medido (kW)' : 'Perfil de Carga Estimado (kW)'}>
          <LineChart data={metrics.loadProfile}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="h" tick={{ fontSize: 10 }} /><YAxis yAxisId="kw" tick={{ fontSize: 10 }} /><YAxis yAxisId="fp" orientation="right" domain={[0, 1.05]} tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Line yAxisId="kw" dataKey="demanda" stroke="#1d4ed8" dot={false} name="Potência" /><Line yAxisId="fp" dataKey="fp" stroke="#16a34a" dot={false} name="FP" /></LineChart>
        </ChartPanel>
        <div className="panel">
          <div className="panel__head">Análise de Tarifas e Custos</div>
          <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={150}><PieChart><Pie data={pie} dataKey="value" innerRadius={45} outerRadius={68}>{pie.map(p => <Cell key={p.name} fill={p.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
            <table className="tbl"><tbody>{pie.map(p => <tr key={p.name}><td><span style={{ color: p.color }}>■</span> {p.name}</td><td>{Number.isFinite(p.amount) ? `${p.value}%` : 'N/D'}</td><td>{fmtMoney(p.amount)}</td></tr>)}</tbody></table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr 1fr 1fr', gap: 10, height: 320 }}>
        <div className="panel">
          <div className="panel__head">Monitoramento do Fator de Potência</div>
          <div className="panel__body" style={{ textAlign: 'center' }}>
            <div style={{ height: 120, borderRadius: '130px 130px 0 0', background: 'conic-gradient(from 270deg, #ef4444 0 45deg, #f59e0b 45deg 95deg, #16a34a 95deg 180deg, transparent 180deg)' }} />
            <div style={{ fontSize: 30, fontWeight: 800 }}>{fmt(metrics.fpAvg, 3)} <span style={{ fontSize: 13 }}>ind.</span></div>
            <div style={{ color: '#64748b' }}>{metrics.basis}</div>
          </div>
        </div>
        <ChartPanel title="Curva de Demanda Ordenada">
          <LineChart data={metrics.demandCurve}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line dataKey="demand" stroke="#1d4ed8" dot={false} name="kW" /></LineChart>
        </ChartPanel>
        <div className="panel">
          <div className="panel__head">Fluxo de Energia</div>
          <div className="panel__body">
            {[
              ['Energia ativa medida', metrics.billingReady ? 100 : 0, '#1d4ed8'],
              ['Rateio setorial importado', 0, '#f97316'],
            ].map(([n, p, c]) => <div key={n} style={{ marginBottom: 13 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{n}</b><span>{metrics.billingReady ? `${p}%` : 'N/D'}</span></div><div className="progress-track" style={{ height: 10 }}><div style={{ width: `${p}%`, height: '100%', background: c, borderRadius: 8 }} /></div></div>)}
          </div>
        </div>
        <ChartPanel title="Energia Acumulada">
          <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="cumulative" fill="#1d4ed8" name="kWh acumulado" /></BarChart>
        </ChartPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, height: 250 }}>
        <DataTable title="Balanço de Energia" rows={balanceRows(metrics)} />
        <DataTable title="Indicadores Financeiros" rows={financialRows} />
        <DataTable title="Comparativo de Cenários" rows={compareRows.slice(0, 4)} />
      </div>
    </div>
  )
}

function ChartPanel({ title, children }) {
  return <div className="panel"><div className="panel__head">{title}</div><div style={{ height: 'calc(100% - 38px)', padding: 8 }}><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></div>
}

function DataTable({ title, rows }) {
  return (
    <div className="panel">
      <div className="panel__head">{title}</div>
      <table className="tbl"><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={j === 0 ? { fontWeight: 700 } : j === r.length - 1 ? { color: '#16a34a', fontWeight: 700 } : undefined}>{c}</td>)}</tr>)}</tbody></table>
    </div>
  )
}
