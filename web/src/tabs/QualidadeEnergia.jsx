import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell
} from 'recharts'
import { calcTHD, generateHarmonics, demoEvents, SEV_CLASS, energySeries } from '../utils/powerQuality'
import { useAppContext } from '../context/AppContext'
import { useToast } from '../components/Toast'
import { exportCSV } from '../utils/export'
import Fasores from './Fasores'

const PHASE_DATA = {
  'Fase A': { thdV: 6.87, thdVPct: '2,34 %', thdIPct: '6,87 %', vrms: '13,81 kV', irms: '612 A', unb: '0,92 %', conformidade: 982 },
  'Fase B': { thdV: 7.12, thdVPct: '2,41 %', thdIPct: '7,12 %', vrms: '13,84 kV', irms: '608 A', unb: '1,05 %', conformidade: 975 },
  'Fase C': { thdV: 6.61, thdVPct: '2,28 %', thdIPct: '6,61 %', vrms: '13,79 kV', irms: '615 A', unb: '0,78 %', conformidade: 989 },
  'Geral':  { thdV: 6.87, thdVPct: '2,34 %', thdIPct: '6,87 %', vrms: '13,81 kV', irms: '612 A', unb: '0,92 %', conformidade: 982 },
}

const BASE_SERIES = energySeries()

export default function QualidadeEnergia({ onNavigate }) {
  const { installation: instalacao, setInstallation: setInstalacao, dateFrom, setDateFrom, dateTo, setDateTo } = useAppContext()
  const toast = useToast()
  const [sub, setSub] = useState('indicadores')
  const [fase, setFase] = useState('Fase A')
  const [loading, setLoading] = useState(false)
  const [seed, setSeed] = useState(0)

  const pd = PHASE_DATA[fase] ?? PHASE_DATA['Fase A']

  const miniKpis = useMemo(() => [
    { name: 'Tensão RMS',      value: pd.vrms,     ref: 'Nom: 13,8 kV',   color: '#1d4ed8', ok: true  },
    { name: 'Corrente RMS',    value: pd.irms,     ref: 'Nom: 600 A',     color: '#16a34a', ok: true  },
    { name: 'THD-V Médio',     value: pd.thdVPct,  ref: 'IEEE 519: ≤5%',  color: '#0284c7', ok: true  },
    { name: 'THD-I Médio',     value: pd.thdIPct,  ref: 'IEEE 519: ≤8%',  color: '#7c3aed', ok: true  },
    { name: 'Desequilíbrio V', value: pd.unb,      ref: 'PRODIST: ≤2%',   color: '#d97706', ok: true  },
    { name: 'Flicker Pst 95%', value: '0,58',      ref: 'IEC: ≤1,0',      color: '#9333ea', ok: true  },
    { name: 'Frequência',      value: '60,02 Hz',  ref: 'PRODIST: ±0,2%', color: '#059669', ok: true  },
    { name: 'Eventos Totais',  value: '128',       ref: 'Mês corrente',   color: '#dc2626', ok: false },
    { name: 'Conformidade',    value: `${(pd.conformidade / 10).toFixed(1)} %`, ref: 'Meta: ≥95%', color: '#16a34a', ok: true },
  ], [fase, seed])

  const harmonics = useMemo(() => generateHarmonics(pd.thdV), [fase, seed])
  const thd = useMemo(() => calcTHD(harmonics).toFixed(2), [harmonics])

  const series = useMemo(() => BASE_SERIES.map((s, i) => ({
    ...s,
    V: 220 + Math.sin(i * 0.3 + (fase === 'Fase B' ? 0.5 : fase === 'Fase C' ? -0.5 : 0)) * 2 + Math.random() - 0.5,
    pst: +(0.4 + Math.random() * 0.6).toFixed(3),
    freq: +(60 + Math.sin(i * 0.5) * 0.08 + Math.random() * 0.04 - 0.02).toFixed(4),
  })), [fase, seed])

  const confPie = useMemo(() => [
    { name: 'Conforme',   value: pd.conformidade,         color: '#16a34a' },
    { name: 'Não conf.',  value: 1000 - pd.conformidade,  color: '#dc2626' },
  ], [fase])

  const events = useMemo(() => demoEvents(), [])

  function handleAtualizar() {
    setLoading(true)
    setTimeout(() => { setSeed(s => s + 1); setLoading(false) }, 700)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'visible' }}>

      {/* Inner sub-tab nav */}
      <div className="inner-nav">
        <span className="inner-nav__label">Análise:</span>
        <button className={`inner-nav-btn${sub === 'indicadores' ? ' active' : ''}`} onClick={() => setSub('indicadores')}>
          ≈ Indicadores &amp; Conformidade
        </button>
        <button className={`inner-nav-btn${sub === 'fasores' ? ' active' : ''}`} onClick={() => setSub('fasores')}>
          ⊙ Fasores &amp; Trifásico
        </button>
      </div>

      {sub === 'fasores' ? <Fasores /> : (
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 1100, overflow: 'visible', position: 'relative' }}>

          {loading && (
            <div className="loading-overlay" style={{ position: 'absolute' }}>
              <div className="loading-box">↻ Atualizando…</div>
            </div>
          )}

          {/* Filter bar */}
          <div className="filter-bar">
            <label>Período:</label>
            <input type="text" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 110 }} />
            <span style={{ color: '#64748b', fontSize: 11 }}>até</span>
            <input type="text" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 110 }} />
            <label>Instalação:</label>
            <select value={instalacao} onChange={e => setInstalacao(e.target.value)} style={{ width: 180 }}>
              {['Subestação Principal', 'Laboratório LQE', 'Fábrica Norte'].map(o => <option key={o}>{o}</option>)}
            </select>
            <label>Sistema:</label>
            <select value={fase} onChange={e => setFase(e.target.value)} style={{ width: 110 }}>
              {['Fase A', 'Fase B', 'Fase C', 'Geral'].map(o => <option key={o}>{o}</option>)}
            </select>
            <div className="spacer" />
            <button className="btn btn-primary btn-sm" onClick={handleAtualizar} disabled={loading}>
              {loading ? '…' : 'Atualizar'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('relatorios')}>Relatório</button>
          </div>

          {/* Mini KPIs */}
          <div style={{ padding: '8px 12px', flexShrink: 0 }}>
            <div className="mini-kpi-row" style={{ gridTemplateColumns: 'repeat(9,1fr)' }}>
              {miniKpis.map(k => (
                <div key={k.name} className="mini-kpi">
                  <div className="mini-kpi__name">{k.name}</div>
                  <div className="mini-kpi__value" style={{ color: k.color }}>{k.value}</div>
                  <div className="mini-kpi__ref" style={{ color: k.ok ? '#16a34a' : '#dc2626' }}>
                    {k.ok ? '✓' : '!'} {k.ref}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts 2×3 */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '320px 320px', gap: 14, padding: '0 14px', minHeight: 670 }}>

            <div className="panel">
              <div className="panel__head">Espectro Harmônico — {fase} — THD = {thd}%</div>
              <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
                <ResponsiveContainer>
                  <BarChart data={harmonics.filter(h => h.order > 1).map(h => ({ name: `${h.order}ª`, mag: h.magnitude, limit: h.limitPct }))} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Bar dataKey="mag" fill="#1d4ed8" name="THD-V (%)" radius={[3, 3, 0, 0]} />
                    <Line type="monotone" dataKey="limit" stroke="#dc2626" dot={false} name="Limite" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">Tensão RMS — {fase} — {dateFrom} a {dateTo}</div>
              <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={4} />
                    <YAxis domain={[215, 225]} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={v => [v.toFixed(2) + 'V', 'Vrms']} />
                    <ReferenceLine y={220} stroke="#16a34a" strokeDasharray="3 2" label={{ value: 'Vnom', fontSize: 9, fill: '#16a34a' }} />
                    <ReferenceLine y={231} stroke="#dc2626" strokeDasharray="3 2" label={{ value: '+5%', fontSize: 9, fill: '#dc2626' }} />
                    <ReferenceLine y={209} stroke="#dc2626" strokeDasharray="3 2" label={{ value: '-5%', fontSize: 9, fill: '#dc2626' }} />
                    <Line type="monotone" dataKey="V" stroke="#1d4ed8" dot={false} name="Vrms" strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">Conformidade IEEE 519 / PRODIST</div>
              <div style={{ height: 'calc(100% - 38px)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 8 }}>
                <PieChart width={130} height={130}>
                  <Pie data={confPie} cx={60} cy={60} innerRadius={38} outerRadius={60} dataKey="value" paddingAngle={2}>
                    {confPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={v => [`${(v / 10).toFixed(1)}%`]} />
                </PieChart>
                <div>
                  {confPie.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span>{d.name}</span>
                      <span style={{ fontWeight: 700, color: d.color, marginLeft: 'auto' }}>{(d.value / 10).toFixed(1)}%</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>Base: 1000 ciclos<br />Período: {dateFrom.slice(3)}</div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">Fator de Potência ao Longo do Período</div>
              <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={4} />
                    <YAxis domain={[0.82, 1.0]} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={v => [v.toFixed(3), 'FP']} />
                    <ReferenceLine y={0.92} stroke="#16a34a" strokeDasharray="3 2" label={{ value: 'Meta', fontSize: 9 }} />
                    <Line type="monotone" dataKey="fp" stroke="#7c3aed" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">Flicker Pst — Série Temporal</div>
              <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={4} />
                    <YAxis domain={[0, 2]} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={v => [v.toFixed(3), 'Pst']} />
                    <ReferenceLine y={1.0} stroke="#dc2626" strokeDasharray="3 2" label={{ value: 'Limite', fontSize: 9, fill: '#dc2626' }} />
                    <Line type="monotone" dataKey="pst" stroke="#d97706" dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">Frequência do Sistema</div>
              <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={4} />
                    <YAxis domain={[59.8, 60.2]} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={v => [v.toFixed(4) + 'Hz', 'f']} />
                    <ReferenceLine y={60} stroke="#16a34a" strokeDasharray="3 2" />
                    <Line type="monotone" dataKey="freq" stroke="#059669" dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Bottom: events + stats */}
          <div style={{ height: 190, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 8, padding: '8px 12px 10px', flexShrink: 0 }}>
            <div className="panel">
              <div className="panel__head">Alarmes e Eventos Recentes
                <span className="panel__head-actions"><button className="btn btn-ghost btn-sm" onClick={() => { exportCSV(events.map(e=>({DataHora:e.ts,Tipo:e.tipo,Descricao:e.desc,Severidade:e.sev,Fase:e.fase,Duracao:e.dur})), 'eventos_qe.csv'); toast('CSV exportado com sucesso', 'success') }}>Exportar CSV</button></span>
              </div>
              <div style={{ overflow: 'auto', height: 'calc(100% - 38px)' }}>
                <table className="tbl">
                  <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Descrição</th><th>Sev.</th><th>Fase</th><th>Duração</th></tr></thead>
                  <tbody>
                    {events
                      .filter(e => fase === 'Geral' || e.fase === fase.slice(-1) || e.fase === 'ABC')
                      .map((e, i) => (
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
            <div className="panel">
              <div className="panel__head">Resumo Estatístico — {fase}</div>
              <div className="panel__body">
                {[
                  ['Afundamentos', '18', '14%'], ['Surtos', '5', '4%'], ['Interrupções', '3', '2%'],
                  ['Desequilíbrio', '47', '37%'], ['Flicker', '32', '25%'], ['Harmônicas', '23', '18%'],
                ].map(([t, n, p]) => (
                  <div key={t} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                    <span style={{ color: 'var(--c-text-muted)' }}>{t}</span>
                    <span><strong>{n}</strong> <span style={{ color: 'var(--c-text-light)' }}>({p})</span></span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
