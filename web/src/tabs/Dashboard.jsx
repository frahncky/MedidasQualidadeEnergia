import { useState, useMemo, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { demoEvents, SEV_CLASS } from '../utils/powerQuality'
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

function buildSeries(period) {
  if (period === 'Dia') {
    return Array.from({ length: 24 }, (_, i) => ({
      label: `${String(i).padStart(2, '0')}h`,
      energy: +(160 + Math.sin((i - 8) / 3) * 90 + (i > 7 && i < 20 ? 200 : 0) + Math.random() * 20).toFixed(0),
      demand: +(800 + Math.sin((i - 8) / 4) * 600 + (i > 7 && i < 20 ? 400 : 0) + Math.random() * 80).toFixed(0),
      fp: +(0.88 + Math.random() * 0.08).toFixed(3),
    }))
  }
  if (period === 'Semana') {
    return ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d, i) => ({
      label: d,
      energy: +(3500 + Math.sin(i * 0.8) * 500 + (i < 5 ? 800 : -400) + Math.random() * 200).toFixed(0),
      demand: +(1500 + Math.sin(i * 0.6) * 200 + Math.random() * 100).toFixed(0),
      fp: +(0.88 + Math.random() * 0.08).toFixed(3),
    }))
  }
  return Array.from({ length: 31 }, (_, i) => {
    const d = new Date(2024, 4, i + 1)
    const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    return {
      label,
      energy: +(3800 + Math.sin(i * 0.4) * 500 + Math.random() * 300).toFixed(0),
      demand: +(1600 + Math.sin(i * 0.3) * 180 + Math.random() * 120).toFixed(0),
      fp: +(0.88 + Math.random() * 0.08).toFixed(3),
    }
  })
}

function buildKPI(installation) {
  const base = {
    'Subestação Principal': { energy: '125,43 MWh', reactive: '34,18 MVArh', demand: '1,786 MW', fp: '0,92 ind.', thdv: '2,34 %', thdi: '6,87 %', events: '23', cost: 'R$ 86.742' },
    'Laboratório LQE':      { energy: '12,81 MWh',  reactive: '3,42 MVArh',  demand: '185 kW',   fp: '0,94 ind.', thdv: '1,92 %', thdi: '4,15 %', events: '5',  cost: 'R$ 7.843' },
    'Fábrica Norte':        { energy: '98,72 MWh',  reactive: '28,14 MVArh', demand: '1,420 MW', fp: '0,91 ind.', thdv: '3,11 %', thdi: '8,42 %', events: '31', cost: 'R$ 64.521' },
    'Almoxarifado':         { energy: '8,34 MWh',   reactive: '2,18 MVArh',  demand: '120 kW',   fp: '0,96 ind.', thdv: '1,44 %', thdi: '3,28 %', events: '2',  cost: 'R$ 5.104' },
  }
  const d = base[installation] ?? base['Subestação Principal']
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

const HARMONIC_DATA = [1, 3, 5, 7, 9, 11, 13].map(n => ({
  order: `${n}ª`,
  mag: n === 1 ? 100 : +(8 / Math.pow(n, 1.2)).toFixed(2),
  limit: +(5 / Math.sqrt(n)).toFixed(2),
}))

export default function Dashboard({ onNavigate }) {
  const { installation, setInstallation, period, setPeriod } = useAppContext()
  const toast = useToast()
  const [loadType, setLoadType] = useState('Todas')
  const [loading, setLoading] = useState(false)
  const [seed, setSeed] = useState(0)

  const series = useMemo(() => buildSeries(period), [period, seed])
  const kpi = useMemo(() => buildKPI(installation), [installation, seed])
  const instInfo = INST_INFO_MAP[installation] ?? INST_INFO_MAP['Subestação Principal']
  const events = useMemo(() => demoEvents(), [])

  const STATUS = [
    { label: 'Aquisição de Dados', val: 'Online',           color: '#16a34a' },
    { label: 'Sincronismo de Tempo', val: 'OK',             color: '#16a34a' },
    { label: 'Qualidade dos Dados', val: '98,7%',           color: '#1d4ed8' },
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
                <BarChart data={HARMONIC_DATA} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
                    ['V RMS (V)', '220,1', '218,9', '221,4'],
                    ['I RMS (A)', '125,3', '122,8', '127,5'],
                    ['FP', '0,93', '0,91', '0,92'],
                    ['THD-V (%)', '2,34', '2,41', '2,28'],
                    ['THD-I (%)', '6,87', '7,12', '6,61'],
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
