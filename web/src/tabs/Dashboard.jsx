import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { energySeries, demoEvents, SEV_CLASS } from '../utils/powerQuality'

const KPI = [
  { name: 'Energia Ativa',    value: '125,43 MWh', delta: '+8,7%',  color: '#16a34a', bg: '#dcfce7', icon: '⚡' },
  { name: 'Energia Reativa',  value: '34,18 MVArh',delta: '+6,1%',  color: '#9333ea', bg: '#f3e8ff', icon: 'φ' },
  { name: 'Demanda Máxima',   value: '1,786 MW',   delta: '+4,3%',  color: '#ea580c', bg: '#ffedd5', icon: '◎' },
  { name: 'FP Médio',         value: '0,92 ind.',  delta: '+0,03',  color: '#1d4ed8', bg: '#dbeafe', icon: '◯' },
  { name: 'THD-V Médio',      value: '2,34 %',     delta: '-0,21pp',color: '#0284c7', bg: '#e0f2fe', icon: '~' },
  { name: 'THD-I Médio',      value: '6,87 %',     delta: '-0,64pp',color: '#7c3aed', bg: '#ede9fe', icon: '≈' },
  { name: 'Eventos Detec.',   value: '23',          delta: '+4',     color: '#dc2626', bg: '#fee2e2', icon: '⚠' },
  { name: 'Custo Estimado',   value: 'R$ 86.742',  delta: '+9,2%',  color: '#15803d', bg: '#dcfce7', icon: '$' },
]

const SERIES = energySeries()
const EVENTS = demoEvents()
const PIE_DATA = [
  { name: 'Motores', value: 48, color: '#1d4ed8' },
  { name: 'Iluminação', value: 22, color: '#16a34a' },
  { name: 'Ar Cond.', value: 15, color: '#ea580c' },
  { name: 'TI / Eletrôn.', value: 8, color: '#9333ea' },
  { name: 'Outros', value: 7, color: '#94a3b8' },
]

const PERIODS = ['Dia', 'Semana', 'Mês', 'Personalizado']
const INST_INFO = [
  ['Nome', 'Subestação Principal'],
  ['Tensão Nominal', '13,8 kV'],
  ['Transformador', '13,8/0,38 kV – 2,0 MVA'],
  ['Frequência', '60 Hz'],
  ['Ponto de Medição', 'Geral BT'],
  ['Norma', 'IEEE 519 / PRODIST'],
]
const STATUS = [
  { label: 'Aquisição de Dados', val: 'Online',           color: '#16a34a' },
  { label: 'Sincronismo de Tempo', val: 'OK',             color: '#16a34a' },
  { label: 'Qualidade dos Dados', val: '98,7%',           color: '#1d4ed8' },
  { label: 'Última Atualização', val: '31/05/2024 14:25', color: '#64748b' },
]

export default function Dashboard() {
  const [period, setPeriod] = useState('Mês')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Filter bar */}
      <div className="filter-bar">
        <label>Período:</label>
        <input type="text" defaultValue="01/05/2024 00:00" style={{ width: 148 }} />
        <span style={{ color: '#64748b', fontSize: 11 }}>até</span>
        <input type="text" defaultValue="31/05/2024 23:59" style={{ width: 148 }} />
        <select defaultValue="Subestação Principal" style={{ width: 184 }}>
          <option>Subestação Principal</option><option>Laboratório LQE</option>
        </select>
        <select defaultValue="Todas" style={{ width: 156 }}>
          <option>Todas</option><option>Resistiva</option><option>Motor</option>
        </select>
        <div className="spacer" />
        {PERIODS.map(p => (
          <button key={p}
            className={`btn btn-sm ${p === period ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setPeriod(p)}>{p}</button>
        ))}
        <button className="btn btn-primary btn-sm">Atualizar</button>
        <button className="btn btn-ghost btn-sm">Gerar Relatório</button>
      </div>

      {/* KPI cards */}
      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        <div className="kpi-row">
          {KPI.map(k => (
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

      {/* Body: 3-col layout */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '5fr 5fr 3fr', gap: 10, padding: '0 12px 12px', overflow: 'hidden', minHeight: 0 }}>

        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div className="panel" style={{ flex: 2 }}>
            <div className="panel__head">Potência Ativa e Energia Acumulada
              <span className="panel__head-actions">
                {['Dia','Semana','Mês'].map(p => (
                  <button key={p} className={`btn btn-sm ${p===period?'btn-primary':'btn-ghost'}`} onClick={()=>setPeriod(p)}>{p}</button>
                ))}
              </span>
            </div>
            <div style={{ height: 'calc(100% - 38px)', padding: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={SERIES} margin={{ top: 4, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
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
                <BarChart data={[1,3,5,7,9,11,13].map(n => ({
                  order: `${n}ª`, mag: n===1?100: +(8/Math.pow(n,1.2)).toFixed(2), limit: +(5/Math.sqrt(n)).toFixed(2)
                }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="order" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="mag" fill="#1d4ed8" name="Magnitude (%)" radius={[3,3,0,0]} />
                  <Line type="monotone" dataKey="limit" stroke="#dc2626" dot={false} name="Limite IEEE 519" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Center column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div className="panel" style={{ flexShrink: 0 }}>
            <div className="panel__head">Alarmes e Eventos Recentes</div>
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
              <table className="tbl" style={{ tableLayout: 'fixed' }}>
                <thead>
                  <tr><th>Data/Hora</th><th>Tipo</th><th>Descrição</th><th>Sev.</th><th>Fase</th><th>Dur.</th></tr>
                </thead>
                <tbody>
                  {EVENTS.map((e, i) => (
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
            <div className="panel__head">Linha do Tempo de Qualidade de Energia</div>
            <div style={{ height: 'calc(100% - 38px)', padding: 8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={SERIES} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div className="panel">
            <div className="panel__head">Resumo da Instalação</div>
            <div className="panel__body">
              {INST_INFO.map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 5, borderBottom: '1px solid #f1f5f9', paddingBottom: 4 }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>{k}</span>
                  <span style={{ textAlign: 'right', color: '#1e293b', maxWidth: '55%' }}>{v}</span>
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
                      {row.map((c, i) => <td key={i} style={i===0?{fontWeight:600,color:'#475569'}:{}}>{c}</td>)}
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
