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

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '-'
}

function fmtEnergy(kWh) {
  return Math.abs(kWh) >= 1000 ? `${fmt(kWh / 1000, 2)} MWh` : `${fmt(kWh, 0)} kWh`
}

function fmtPower(kW) {
  return Math.abs(kW) >= 1000 ? `${fmt(kW / 1000, 3)} MW` : `${fmt(kW, 0)} kW`
}

function bucket(values, count) {
  const size = Math.max(1, Math.ceil(values.length / count))
  return Array.from({ length: count }, (_, index) => values.slice(index * size, (index + 1) * size)).filter(group => group.length)
}

function avg(values) {
  const clean = values.filter(Number.isFinite)
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0
}

function shapedDemand(baseDemand, index, count) {
  const dailyShape = count === 24 ? (index > 7 && index < 20 ? 1.16 : 0.68) : 1
  return baseDemand * dailyShape * (0.94 + 0.08 * Math.sin(index * 0.7))
}

function buildSeries(period, analysis) {
  const source = analysis.rmsSeries ?? []
  const baseDemand = Math.max(1, analysis.power?.pKw || 1)

  if (period === 'Dia') {
    const groups = bucket(source, 24)
    return Array.from({ length: 24 }, (_, i) => {
      const group = groups[i] ?? []
      const demand = avg(group.map(row => row.pKw).filter(value => Math.abs(value) > 0.001)) || shapedDemand(baseDemand, i, 24)
      return {
      label: `${String(i).padStart(2, '0')}h`,
      energy: +(demand * 1).toFixed(0),
      demand: +demand.toFixed(0),
      fp: +(avg(group.map(row => row.fp)) || analysis.summary.fpAvg).toFixed(3),
    }})
  }
  if (period === 'Semana') {
    const groups = bucket(source, 7)
    return ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d, i) => {
      const group = groups[i] ?? []
      const demand = avg(group.map(row => row.pKw).filter(value => Math.abs(value) > 0.001)) || shapedDemand(baseDemand, i, 7)
      return {
        label: d,
        energy: +(demand * 24).toFixed(0),
        demand: +demand.toFixed(0),
        fp: +(avg(group.map(row => row.fp)) || analysis.summary.fpAvg).toFixed(3),
      }
    })
  }
  const groups = bucket(source, 31)
  return Array.from({ length: 31 }, (_, i) => {
    const d = new Date(2024, 4, i + 1)
    const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    const group = groups[i] ?? []
    const demand = avg(group.map(row => row.pKw).filter(value => Math.abs(value) > 0.001)) || shapedDemand(baseDemand, i, 31)
    return {
      label,
      energy: +(demand * 24).toFixed(0),
      demand: +demand.toFixed(0),
      fp: +(avg(group.map(row => row.fp)) || analysis.summary.fpAvg).toFixed(3),
    }
  })
}

function buildKPI(analysis) {
  const monthlyEnergy = Math.max(0, analysis.power.pKw * 24 * 31)
  const monthlyReactive = Math.max(0, Math.abs(analysis.power.qKvar) * 24 * 31)
  const cost = monthlyEnergy * 0.69
  const d = {
    energy: fmtEnergy(monthlyEnergy),
    reactive: Math.abs(monthlyReactive) >= 1000 ? `${fmt(monthlyReactive / 1000, 2)} MVArh` : `${fmt(monthlyReactive, 0)} kVArh`,
    demand: fmtPower(analysis.power.sKva),
    fp: `${fmt(analysis.summary.fpAvg, 3)} ind.`,
    thdv: `${fmt(analysis.summary.thdVAvg, 2)} %`,
    thdi: `${fmt(analysis.summary.thdIAvg, 2)} %`,
    events: String(analysis.events.length),
    cost: `R$ ${cost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`,
  }
  return [
    { name: 'Energia Ativa',   value: d.energy,  delta: '+8,7%',  color: '#16a34a', bg: '#dcfce7', icon: '⚡' },
    { name: 'Energia Reativa', value: d.reactive, delta: '+6,1%',  color: '#9333ea', bg: '#f3e8ff', icon: 'φ' },
    { name: 'Demanda Máxima',  value: d.demand,   delta: '+4,3%',  color: '#ea580c', bg: '#ffedd5', icon: '◎' },
    { name: 'FP Médio',        value: d.fp,        delta: '+0,03',  color: '#1d4ed8', bg: '#dbeafe', icon: '◯' },
    { name: 'THD-V Médio',     value: d.thdv,     delta: '-0,21pp',color: '#0284c7', bg: '#e0f2fe', icon: '~' },
    { name: 'THD-I Médio',     value: d.thdi,     delta: '-0,64pp',color: '#7c3aed', bg: '#ede9fe', icon: '≈' },
    { name: 'Eventos Detec.',  value: d.events,   delta: '+4',     color: '#dc2626', bg: '#fee2e2', icon: '⚠' },
    { name: 'Custo Estimado',  value: d.cost,     delta: '+9,2%',  color: '#15803d', bg: '#dcfce7', icon: '$' },
  ]
}

export default function Dashboard({ onNavigate }) {
  const { installation, setInstallation, period, setPeriod, pqAnalysis, analysisStatus } = useAppContext()
  const toast = useToast()
  const [loadType, setLoadType] = useState('Todas')
  const [loading, setLoading] = useState(false)
  const [seed, setSeed] = useState(0)

  const series = useMemo(() => buildSeries(period, pqAnalysis), [period, seed, pqAnalysis])
  const kpi = useMemo(() => buildKPI(pqAnalysis), [pqAnalysis])
  const instInfo = INST_INFO_MAP[installation] ?? INST_INFO_MAP['Subestação Principal']
  const events = useMemo(() => pqAnalysis.events.slice(0, 8), [pqAnalysis.events])
  const harmonicData = useMemo(() => (pqAnalysis.phases['Fase A']?.harmonics ?? [])
    .filter(h => h.order <= 13)
    .map(h => ({ order: `${h.order}ª`, mag: h.percent ?? 0, limit: h.limitPct })), [pqAnalysis])

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
                <div className="kpi-card__delta">{k.delta} vs. mês ant.</div>
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
              Potência Ativa e Energia Acumulada — {period}
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
                  <YAxis yAxisId="l" tick={{ fontSize: 10 }} label={{ value: 'kWh', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} label={{ value: 'kW', angle: 90, position: 'insideRight', fontSize: 10 }} />
                  <Tooltip formatter={(v, n) => [v.toLocaleString('pt-BR'), n]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="l" type="monotone" dataKey="energy" stroke="#1d4ed8" dot={false} name="Energia (kWh)" strokeWidth={2} />
                  <Line yAxisId="r" type="monotone" dataKey="demand" stroke="#ea580c" dot={false} name="Demanda (kW)" strokeWidth={1.5} strokeDasharray="4 2" />
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
