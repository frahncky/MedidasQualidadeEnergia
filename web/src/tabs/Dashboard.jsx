import { useState, useMemo, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { SEV_CLASS } from '../utils/powerQuality'
import { useAppContext } from '../context/AppContext'
import { useToast } from '../components/Toast'

const INSTALLATIONS = ['Subestação Principal', 'Laboratório LQE', 'Fábrica Norte', 'Almoxarifado']
const LOAD_TYPES = ['Todas', 'Resistiva', 'Motor', 'Eletrônica', 'Iluminação']

const PIE_DATA = [
  { name: 'Motores', value: 48, color: '#1d4ed8' },
  { name: 'Iluminação', value: 22, color: '#16a34a' },
  { name: 'Ar Cond.', value: 15, color: '#ea580c' },
  { name: 'TI / Eletrôn.', value: 8, color: '#9333ea' },
  { name: 'Outros', value: 7, color: '#94a3b8' },
]

const INST_INFO_MAP = {
  'Subestação Principal': [
    ['Nome', 'Subestação Principal'], ['Tensão Nominal', '13,8 kV'],
    ['Transformador', '13,8/0,38 kV – 2,0 MVA'], ['Frequência', '60 Hz'],
    ['Ponto de Medição', 'Geral BT'], ['Norma', 'IEEE 519 / PRODIST'],
  ],
  'Laboratório LQE': [
    ['Nome', 'Laboratório LQE'], ['Tensão Nominal', '0,38 kV'],
    ['Transformador', '0,38 kV – 500 kVA'], ['Frequência', '60 Hz'],
    ['Ponto de Medição', 'Quadro Geral'], ['Norma', 'PRODIST'],
  ],
  'Fábrica Norte': [
    ['Nome', 'Fábrica Norte'], ['Tensão Nominal', '13,8 kV'],
    ['Transformador', '13,8/0,22 kV – 1,5 MVA'], ['Frequência', '60 Hz'],
    ['Ponto de Medição', 'Entrada MT'], ['Norma', 'IEEE 519 / PRODIST'],
  ],
  'Almoxarifado': [
    ['Nome', 'Almoxarifado'], ['Tensão Nominal', '0,22 kV'],
    ['Transformador', '0,22 kV – 200 kVA'], ['Frequência', '60 Hz'],
    ['Ponto de Medição', 'Quadro Parcial'], ['Norma', 'PRODIST'],
  ],
}

const ENERGY_TARIFF_BRL_KWH = 0.69
const BILLING_WINDOW_MIN_HOURS = 0.25

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '-'
}

function fmtEnergy(kWh) {
  if (!Number.isFinite(kWh)) return 'N/D'
  const abs = Math.abs(kWh)
  if (abs >= 1000) return `${fmt(kWh / 1000, 2)} MWh`
  if (abs >= 1) return `${fmt(kWh, 1)} kWh`
  return `${fmt(kWh * 1000, 0)} Wh`
}

function fmtReactiveEnergy(kvarh) {
  if (!Number.isFinite(kvarh)) return 'N/D'
  const abs = Math.abs(kvarh)
  if (abs >= 1000) return `${fmt(kvarh / 1000, 2)} MVArh`
  if (abs >= 1) return `${fmt(kvarh, 1)} kVArh`
  return `${fmt(kvarh * 1000, 0)} VArh`
}

function fmtPower(kW) {
  if (!Number.isFinite(kW)) return 'N/D'
  const abs = Math.abs(kW)
  if (abs >= 1000) return `${fmt(kW / 1000, 3)} MW`
  return `${fmt(kW, abs < 10 ? 1 : 0)} kW`
}

function fmtApparent(kva) {
  if (!Number.isFinite(kva)) return 'N/D'
  const abs = Math.abs(kva)
  if (abs >= 1000) return `${fmt(kva / 1000, 3)} MVA`
  return `${fmt(kva, abs < 10 ? 1 : 0)} kVA`
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

function bucket(values, count) {
  const size = Math.max(1, Math.ceil(values.length / count))
  return Array.from({ length: count }, (_, index) => values.slice(index * size, (index + 1) * size)).filter(group => group.length)
}

function avg(values) {
  const clean = values.filter(Number.isFinite)
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0
}

function spanHours(points) {
  const timestamps = points.map(point => point?.timestamp).filter(Number.isFinite)
  if (timestamps.length >= 2) return Math.max(0, (Math.max(...timestamps) - Math.min(...timestamps)) / 3600000)
  const durationMs = points.reduce((sum, point) => sum + (Number.isFinite(point?.durationMs) ? point.durationMs : 0), 0)
  return Math.max(0, durationMs / 3600000)
}

function measuredRows(analysis, key) {
  return (analysis.normalizedRows ?? []).filter(row => Number.isFinite(row?.[key]))
}

function estimateActivePowerKw(point, analysis) {
  const fallback = Math.abs(analysis.power?.pKw || 0)
  if (!point) return fallback
  const voltage = point.Vavg || avg([point.Va, point.Vb, point.Vc].filter(value => value > 0))
  const current = point.Iavg || avg([point.Ia, point.Ib, point.Ic].filter(value => value > 0))
  const fp = Math.abs(point.fp || analysis.summary?.fpAvg || analysis.power?.fp || 0.92)
  const estimated = voltage > 0 && current > 0 ? (3 * voltage * current * fp) / 1000 : fallback
  return Number.isFinite(estimated) && estimated > 0 ? estimated : fallback
}

function integrateEnergy(points, key, fallbackHours = 0) {
  if (!points.length) return 0
  if (points.length === 1) return Math.abs(points[0]?.[key] || 0) * fallbackHours

  let total = 0
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]
    const cur = points[i]
    const dtHours = Math.max(0, ((cur.timestamp ?? 0) - (prev.timestamp ?? 0)) / 3600000)
    const pAvg = (Math.abs(prev[key] || 0) + Math.abs(cur[key] || 0)) / 2
    total += pAvg * dtHours
  }
  return total || Math.abs(avg(points.map(point => point[key]))) * fallbackHours
}

function buildWindowStats(analysis) {
  const pRows = measuredRows(analysis, 'p')
  const qRows = measuredRows(analysis, 'q')
  const windowHours = spanHours(analysis.normalizedRows ?? analysis.rmsSeries ?? [])
  const hasMeasuredPower = pRows.length > 0
  const measuredEnergy = pRows.length >= 2
    ? integrateEnergy(pRows, 'p')
    : Math.abs(avg(pRows.map(row => row.p))) * windowHours
  const estimatedPower = estimateActivePowerKw(null, analysis)
  const energyKWh = hasMeasuredPower ? measuredEnergy : estimatedPower * windowHours
  const reactiveKvarh = qRows.length >= 2
    ? integrateEnergy(qRows, 'q')
    : Math.abs(analysis.power?.qKvar || 0) * windowHours
  const maxDemandKw = hasMeasuredPower
    ? Math.max(...pRows.map(row => Math.abs(row.p)).filter(Number.isFinite), 0)
    : 0
  const apparentKva = Math.abs(analysis.power?.sKva || 0)

  return {
    windowHours,
    hasMeasuredPower,
    billingReady: hasMeasuredPower && pRows.length >= 2 && windowHours >= BILLING_WINDOW_MIN_HOURS,
    energyKWh,
    reactiveKvarh,
    maxDemandKw,
    apparentKva,
    estimatedPower,
  }
}

function labelForPoint(point, index, windowHours) {
  if (!Number.isFinite(point?.timestamp)) return `A${index + 1}`
  const date = new Date(point.timestamp)
  if (windowHours < 1) return date.toLocaleTimeString('pt-BR', { minute: '2-digit', second: '2-digit' })
  if (windowHours < 24) return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (windowHours < 24 * 7) return `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${date.getHours()}h`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function buildSeries(period, analysis, stats) {
  const countByPeriod = { Dia: 24, Semana: 7, Mês: 31 }
  const pointCount = countByPeriod[period] ?? 24
  const source = stats.hasMeasuredPower
    ? measuredRows(analysis, 'p')
    : (analysis.rmsSeries ?? []).map(point => ({ ...point, p: estimateActivePowerKw(point, analysis) }))
  const groups = bucket(source, pointCount)
  const fallbackBucketHours = groups.length ? stats.windowHours / groups.length : 0
  let cumulativeEnergy = 0

  return groups.map((group, index) => {
    const bucketHours = spanHours(group) || fallbackBucketHours
    const demand = Math.abs(avg(group.map(row => row.p).filter(Number.isFinite)))
    const energy = integrateEnergy(group, 'p', bucketHours)
    cumulativeEnergy += energy

    return {
      label: labelForPoint(group[0], index, stats.windowHours),
      energy: +cumulativeEnergy.toFixed(cumulativeEnergy < 1 ? 3 : 1),
      demand: +demand.toFixed(demand < 10 ? 2 : 1),
      fp: +(avg(group.map(row => row.fp)) || analysis.summary.fpAvg).toFixed(3),
    }
  })
}

function buildKPI(analysis, stats) {
  const cost = stats.billingReady ? stats.energyKWh * ENERGY_TARIFF_BRL_KWH : NaN
  const energyDetail = stats.hasMeasuredPower
    ? `janela medida: ${fmtDuration(stats.windowHours)}`
    : `estimada na amostra: ${fmtDuration(stats.windowHours)}`
  const d = {
    energy: fmtEnergy(stats.energyKWh),
    reactive: fmtReactiveEnergy(stats.reactiveKvarh),
    demand: stats.hasMeasuredPower ? fmtPower(stats.maxDemandKw) : fmtApparent(stats.apparentKva),
    fp: `${fmt(analysis.summary.fpAvg, 3)} ind.`,
    thdv: `${fmt(analysis.summary.thdVAvg, 2)} %`,
    thdi: `${fmt(analysis.summary.thdIAvg, 2)} %`,
    events: String(analysis.events.length),
    cost: fmtMoney(cost),
  }
  return [
    { name: 'Energia Ativa',   value: d.energy,  detail: energyDetail, color: '#16a34a', bg: '#dcfce7', icon: '⚡', tone: stats.hasMeasuredPower ? 'ok' : 'warn' },
    { name: 'Energia Reativa', value: d.reactive, detail: `janela: ${fmtDuration(stats.windowHours)}`, color: '#9333ea', bg: '#f3e8ff', icon: 'φ', tone: 'muted' },
    { name: stats.hasMeasuredPower ? 'Demanda Máxima' : 'Potência Aparente', value: d.demand, detail: stats.hasMeasuredPower ? 'P_kW medido' : 'estimada por fasores', color: '#ea580c', bg: '#ffedd5', icon: '◎', tone: stats.hasMeasuredPower ? 'ok' : 'warn' },
    { name: 'FP Médio',        value: d.fp,        detail: 'média da amostra', color: '#1d4ed8', bg: '#dbeafe', icon: '◯', tone: 'muted' },
    { name: 'THD-V Médio',     value: d.thdv,     detail: 'média da amostra', color: '#0284c7', bg: '#e0f2fe', icon: '~', tone: 'muted' },
    { name: 'THD-I Médio',     value: d.thdi,     detail: 'média da amostra', color: '#7c3aed', bg: '#ede9fe', icon: '≈', tone: 'muted' },
    { name: 'Eventos Detec.',  value: d.events,   detail: 'detectados na janela', color: '#dc2626', bg: '#fee2e2', icon: '⚠', tone: analysis.events.length ? 'warn' : 'ok' },
    { name: 'Custo Estimado',  value: d.cost,     detail: stats.billingReady ? 'tarifa sobre janela medida' : 'sem base de faturamento', color: '#15803d', bg: '#dcfce7', icon: '$', tone: stats.billingReady ? 'ok' : 'warn' },
  ]
}

export default function Dashboard({ onNavigate }) {
  const { installation, setInstallation, period, setPeriod, pqAnalysis, analysisStatus } = useAppContext()
  const toast = useToast()
  const [loadType, setLoadType] = useState('Todas')
  const [loading, setLoading] = useState(false)
  const [seed, setSeed] = useState(0)

  const windowStats = useMemo(() => buildWindowStats(pqAnalysis), [pqAnalysis])
  const series = useMemo(() => buildSeries(period, pqAnalysis, windowStats), [period, seed, pqAnalysis, windowStats])
  const kpi = useMemo(() => buildKPI(pqAnalysis, windowStats), [pqAnalysis, windowStats])
  const instInfo = INST_INFO_MAP[installation] ?? INST_INFO_MAP['Subestação Principal']
  const events = useMemo(() => pqAnalysis.events.slice(0, 8), [pqAnalysis.events])
  const harmonicData = useMemo(() => (pqAnalysis.phases['Fase A']?.harmonics ?? [])
    .filter(h => h.order <= 13)
    .map(h => ({ order: `${h.order}ª`, mag: h.percent ?? 0, limit: h.limitPct })), [pqAnalysis])
  const dataBasis = windowStats.hasMeasuredPower ? 'P_kW medido' : 'potência estimada por fasores'
  const basisColor = windowStats.billingReady ? '#16a34a' : '#d97706'
  const detailColor = tone => tone === 'warn' ? '#d97706' : tone === 'ok' ? '#16a34a' : '#64748b'

  const STATUS = [
    { label: 'Aquisição de Dados', val: 'Online',           color: '#16a34a' },
    { label: 'Sincronismo de Tempo', val: 'OK',             color: '#16a34a' },
    { label: 'Qualidade dos Dados', val: `${fmt(pqAnalysis.conformity.score, 1)}%`, color: '#1d4ed8' },
    { label: 'Motor PQ', val: analysisStatus.running ? 'Analisando' : analysisStatus.source, color: analysisStatus.running ? '#d97706' : '#16a34a' },
    { label: 'Última Atualização', val: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }), color: '#64748b' },
  ]

  const handleAtualizar = useCallback(() => {
    setLoading(true)
    setTimeout(() => { setSeed(s => s + 1); setLoading(false) }, 700)
  }, [])

  return (
    <div className="dashboard-page">

      {loading && (
        <div className="loading-overlay">
          <div className="loading-box">↻ Atualizando dados…</div>
        </div>
      )}

      {/* Filter bar */}
      <div className="filter-bar">
        <label>Instalação:</label>
        <select value={installation} onChange={e => setInstallation(e.target.value)} style={{ width: 184 }}>
          {INSTALLATIONS.map(i => <option key={i}>{i}</option>)}
        </select>
        <label>Tipo de Carga:</label>
        <select value={loadType} onChange={e => setLoadType(e.target.value)} style={{ width: 156 }}>
          {LOAD_TYPES.map(l => <option key={l}>{l}</option>)}
        </select>
        <span style={{ fontSize: 11, color: basisColor, fontWeight: 700, whiteSpace: 'nowrap' }}>
          Janela: {fmtDuration(windowStats.windowHours)} · {dataBasis}
        </span>
        <div className="spacer" />
        {['Dia', 'Semana', 'Mês'].map(p => (
          <button key={p}
            className={`btn btn-sm ${p === period ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setPeriod(p)}>{p}</button>
        ))}
        <button className="btn btn-primary btn-sm" onClick={handleAtualizar} disabled={loading}>
          {loading ? '…' : 'Atualizar'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => { toast('Abrindo gerador de relatórios', 'info'); onNavigate?.('relatorios') }}>
          Gerar Relatório
        </button>
      </div>

      {/* KPI cards */}
      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        <div className="kpi-row">
          {kpi.map(k => (
            <div key={k.name} className="kpi-card">
              <div className="kpi-card__icon" style={{ background: k.color }}>{k.icon}</div>
              <div className="kpi-card__info">
                <div className="kpi-card__name">{k.name}</div>
                <div className="kpi-card__value" style={{ color: k.color }}>{k.value}</div>
                <div className="kpi-card__delta" style={{ color: detailColor(k.tone) }}>{k.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="dashboard-grid">

        {/* Left column */}
        <div className="dashboard-col">
          <div className="panel" style={{ flex: 2 }}>
            <div className="panel__head">
              Potência e Energia da Janela — {period}
              <span className="panel__head-actions">
                {['Dia', 'Semana', 'Mês'].map(p => (
                  <button key={p} className={`btn btn-sm ${p === period ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setPeriod(p)}>{p}</button>
                ))}
              </span>
            </div>
            <div style={{ height: 'calc(100% - 38px)', padding: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={period === 'Mês' ? 4 : 0} />
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} label={{ value: 'kWh janela', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} label={{ value: 'kW', angle: 90, position: 'insideRight', fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => [Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 3 }), n]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="l" type="monotone" dataKey="energy" stroke="#1d4ed8" dot={false} name="Energia acumulada (kWh)" strokeWidth={2} />
                  <Line yAxisId="r" type="monotone" dataKey="demand" stroke="#ea580c" dot={false} name={windowStats.hasMeasuredPower ? 'Potência ativa (kW)' : 'Potência estimada (kW)'} strokeWidth={1.5} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel__head">Espectro Harmônico de Tensão (Fase A)</div>
            <div style={{ height: 'calc(100% - 38px)', padding: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={harmonicData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="order" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="mag" fill="#1d4ed8" name="Magnitude (%)" radius={[3, 3, 0, 0]} />
                  <Line type="monotone" dataKey="limit" stroke="#dc2626" dot={false} name="Limite IEEE 519" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Center column */}
        <div className="dashboard-col">
          <div className="panel" style={{ flexShrink: 0 }}>
            <div className="panel__head">Alarmes e Eventos Recentes</div>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              <table className="tbl" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr><th>Data/Hora</th><th>Tipo</th><th>Descrição</th><th>Sev.</th><th>Fase</th><th>Dur.</th></tr>
                </thead>
                <tbody>
                  {events.map((e, i) => (
                    <tr key={i}>
                      <td>{e.ts}</td><td>{e.tipo}</td><td>{e.desc}</td>
                      <td><span className={SEV_CLASS[e.sev] ?? 'badge'}>{e.sev}</span></td>
                      <td>{e.fase}</td><td>{e.dur}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel" style={{ flex: 1 }}>
            <div className="panel__head">Linha do Tempo — Fator de Potência</div>
            <div style={{ height: 'calc(100% - 38px)', padding: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={period === 'Mês' ? 4 : 0} />
                  <YAxis domain={[0.8, 1.05]} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={v => [v.toFixed(3), 'FP']} />
                  <ReferenceLine y={0.92} stroke="#16a34a" strokeDasharray="3 2" label={{ value: 'Meta FP', fontSize: 9 }} />
                  <Line type="monotone" dataKey="fp" stroke="#7c3aed" dot={false} name="Fator de Potência" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel" style={{ flexShrink: 0 }}>
            <div className="panel__head">Resumo de Cargas por Tipo</div>
            <div style={{ display: 'flex', gap: 10, padding: 8, alignItems: 'center' }}>
              <PieChart width={120} height={120}>
                <Pie data={PIE_DATA} cx={55} cy={55} innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={2}>
                  {PIE_DATA.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={v => [`${v}%`]} />
              </PieChart>
              <div style={{ flex: 1 }}>
                {PIE_DATA.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginBottom: 4 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{d.name}</span>
                    <span style={{ fontWeight: 700, color: d.color }}>{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="dashboard-col">
          <div className="panel">
            <div className="panel__head">Resumo da Instalação</div>
            <div className="panel__body">
              {instInfo.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>{k}</span>
                  <span style={{ textAlign: 'right', color: 'var(--c-text)', maxWidth: '55%' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">Status do Sistema</div>
            <div className="panel__body">
              {STATUS.map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>{s.label}</span>
                  <span style={{ fontWeight: 700, color: s.color }}>● {s.val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ flex: 1 }}>
            <div className="panel__head">Resumo por Fase</div>
            <div style={{ overflow: 'auto', height: 'calc(100% - 38px)' }}>
              <table className="tbl">
                <thead><tr><th>Param.</th><th>A</th><th>B</th><th>C</th></tr></thead>
                <tbody>
                  {[
                    ['V RMS (V)', fmt(pqAnalysis.phases['Fase A'].vrms, 1), fmt(pqAnalysis.phases['Fase B'].vrms, 1), fmt(pqAnalysis.phases['Fase C'].vrms, 1)],
                    ['I RMS (A)', fmt(pqAnalysis.phases['Fase A'].irms, 1), fmt(pqAnalysis.phases['Fase B'].irms, 1), fmt(pqAnalysis.phases['Fase C'].irms, 1)],
                    ['FP', fmt(pqAnalysis.summary.fpAvg, 3), fmt(pqAnalysis.summary.fpAvg, 3), fmt(pqAnalysis.summary.fpAvg, 3)],
                    ['THD-V (%)', fmt(pqAnalysis.phases['Fase A'].thdV, 2), fmt(pqAnalysis.phases['Fase B'].thdV, 2), fmt(pqAnalysis.phases['Fase C'].thdV, 2)],
                    ['THD-I (%)', fmt(pqAnalysis.phases['Fase A'].thdI, 2), fmt(pqAnalysis.phases['Fase B'].thdI, 2), fmt(pqAnalysis.phases['Fase C'].thdI, 2)],
                  ].map(row => (
                    <tr key={row[0]}>
                      {row.map((c, i) => <td key={i} style={i === 0 ? { fontWeight: 600, color: 'var(--c-text-muted)' } : {}}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
