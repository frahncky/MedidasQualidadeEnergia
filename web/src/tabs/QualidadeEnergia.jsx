import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell
} from 'recharts'
import { SEV_CLASS } from '../utils/powerQuality'
import { useAppContext } from '../context/AppContext'
import { useToast } from '../components/Toast'
import { exportCSV } from '../utils/export'
import Fasores from './Fasores'

const PHASE_OPTIONS = ['Fase A', 'Fase B', 'Fase C', 'Geral']
const PHASE_SERIES_KEY = { 'Fase A': 'Va', 'Fase B': 'Vb', 'Fase C': 'Vc', Geral: 'Vavg' }

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '-'
}

function formatVoltage(value) {
  if (!Number.isFinite(value)) return '-'
  return Math.abs(value) >= 1000 ? `${fmt(value / 1000, 2)} kV` : `${fmt(value, 1)} V`
}

function formatCurrent(value) {
  return Number.isFinite(value) ? `${fmt(value, 1)} A` : '-'
}

function formatPct(value, digits = 2) {
  return Number.isFinite(value) ? `${fmt(value, digits)} %` : '-'
}

function eventRows(events, fase) {
  return events.filter(event => fase === 'Geral' || event.fase === fase.slice(-1) || event.fase === 'ABC')
}

function summaryRows(summary, total) {
  const names = ['Afundamento', 'Elevação', 'Interrupção', 'Transitório', 'Desequilíbrio', 'Flicker', 'Harmônicas', 'Inter-harmônicas', 'FP baixo']
  return names.map(name => {
    const count = summary[name] ?? 0
    const pct = total > 0 ? (100 * count / total) : 0
    return [name, String(count), `${fmt(pct, 0)}%`]
  })
}

export default function QualidadeEnergia({ onNavigate }) {
  const {
    installation: instalacao,
    setInstallation: setInstalacao,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    pqAnalysis,
    hasImportedDataset,
    setImportedDataset,
    analysisStatus,
  } = useAppContext()
  const toast = useToast()
  const [sub, setSub] = useState('indicadores')
  const [fase, setFase] = useState('Fase A')
  const [loading, setLoading] = useState(false)
  const [disturbance, setDisturbance] = useState('afundamento')

  const phaseData = pqAnalysis.phases[fase] ?? pqAnalysis.phases['Fase A']
  const phaseEvents = useMemo(() => eventRows(pqAnalysis.events, fase), [pqAnalysis.events, fase])
  const series = useMemo(() => {
    const key = PHASE_SERIES_KEY[fase] ?? 'Va'
    return pqAnalysis.rmsSeries.map(point => ({
      ...point,
      V: point[key] ?? point.Vavg,
      fp: point.fp || pqAnalysis.summary.fpAvg,
      freq: point.freq || pqAnalysis.summary.freqAvg,
    }))
  }, [pqAnalysis, fase])

  const miniKpis = useMemo(() => [
    { name: 'Tensão RMS',      value: formatVoltage(phaseData.vrms),            ref: `Nom: ${formatVoltage(pqAnalysis.nominalVoltage)}`, color: '#1d4ed8', ok: pqAnalysis.summary.voltageCompliancePct >= 95 },
    { name: 'Corrente RMS',    value: formatCurrent(phaseData.irms),            ref: `${pqAnalysis.sampleCount.toLocaleString('pt-BR')} amostras`, color: '#16a34a', ok: true },
    { name: 'THD-V Médio',     value: formatPct(phaseData.thdV),                ref: 'IEEE 519: <=5%', color: '#0284c7', ok: phaseData.thdV <= 5 },
    { name: 'THD-I Médio',     value: formatPct(phaseData.thdI),                ref: 'IEEE 519: <=8%', color: '#7c3aed', ok: phaseData.thdI <= 8 },
    { name: 'Inter-harm V',    value: formatPct(phaseData.interharmonicVMax),   ref: 'IEC: <=2%', color: '#0f766e', ok: phaseData.interharmonicVMax <= 2 },
    { name: 'Desequilíbrio V', value: formatPct(pqAnalysis.summary.unbalance),  ref: 'PRODIST: <=2%', color: '#d97706', ok: pqAnalysis.summary.unbalance <= 2 },
    { name: 'Flicker Pst 95%', value: fmt(pqAnalysis.summary.pst95, 2),         ref: 'IEC: <=1,0', color: '#9333ea', ok: pqAnalysis.summary.pst95 <= 1 },
    { name: 'Transitórios',    value: String(pqAnalysis.summary.transientCount), ref: 'Alta freq.', color: '#be123c', ok: pqAnalysis.summary.transientCount === 0 },
    { name: 'Frequência',      value: `${fmt(pqAnalysis.summary.freqAvg, 3)} Hz`, ref: 'PRODIST: 59,9-60,1', color: '#059669', ok: pqAnalysis.summary.freqAvg >= 59.9 && pqAnalysis.summary.freqAvg <= 60.1 },
    { name: 'Eventos Totais',  value: String(phaseEvents.length),               ref: hasImportedDataset ? pqAnalysis.sourceName : 'Demonstração', color: '#dc2626', ok: phaseEvents.length === 0 },
    { name: 'Conformidade',    value: `${fmt(pqAnalysis.conformity.score, 1)} %`, ref: 'Meta: >=95%', color: '#16a34a', ok: pqAnalysis.conformity.score >= 95 },
  ], [phaseData, pqAnalysis, phaseEvents.length, hasImportedDataset])

  const harmonics = phaseData.harmonics ?? []
  const harmonicRows = harmonics
    .filter(h => h.order > 1)
    .map(h => ({ name: `${h.order}ª`, mag: h.percent ?? 0, limit: h.limitPct }))

  const confPie = useMemo(() => [
    { name: 'Conforme',  value: pqAnalysis.conformity.conforming,    color: '#16a34a' },
    { name: 'Não conf.', value: pqAnalysis.conformity.nonConforming, color: '#dc2626' },
  ], [pqAnalysis.conformity])

  const voltageDomain = [
    Math.max(0, pqAnalysis.nominalVoltage * 0.85),
    pqAnalysis.nominalVoltage * 1.15,
  ]

  function handleAtualizar() {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      toast('Indicadores recalculados com os dados atuais', 'success')
    }, 500)
  }

  function handleSimularDisturbio() {
    const rows = pqAnalysis.normalizedRows
    if (!rows?.length) return
    const start = rows[0].timestamp
    const end = rows[rows.length - 1].timestamp
    const span = Math.max(1, end - start)
    const f = pqAnalysis.summary.freqAvg || 60

    const nextRows = rows.map(row => {
      const pos = (row.timestamp - start) / span
      const t = (row.timestamp - start) / 1000
      let Va = row.va
      let Vb = row.vb
      let Vc = row.vc
      let Ia = row.ia
      let Ib = row.ib
      let Ic = row.ic

      if (disturbance === 'afundamento' && pos > 0.32 && pos < 0.52) Vb *= 0.55
      if (disturbance === 'elevacao' && pos > 0.28 && pos < 0.42) Va *= 1.2
      if (disturbance === 'interrupcao' && pos > 0.48 && pos < 0.56) {
        Va *= 0.03; Vb *= 0.03; Vc *= 0.03
      }
      if (disturbance === 'transitorio') {
        const pulse = Math.exp(-(((pos - 0.62) / 0.003) ** 2)) * pqAnalysis.nominalVoltage * Math.SQRT2 * 1.4
        Va += pulse
      }
      if (disturbance === 'harmonicas') {
        const h5 = Math.sin(2 * Math.PI * f * 5 * t)
        const h7 = Math.sin(2 * Math.PI * f * 7 * t)
        Va += pqAnalysis.nominalVoltage * Math.SQRT2 * 0.055 * h5
        Vb += pqAnalysis.nominalVoltage * Math.SQRT2 * 0.045 * h5
        Vc += pqAnalysis.nominalVoltage * Math.SQRT2 * 0.04 * h7
        Ia += (pqAnalysis.summary.irmsAvg || 1) * Math.SQRT2 * 0.12 * h5
        Ib += (pqAnalysis.summary.irmsAvg || 1) * Math.SQRT2 * 0.1 * h7
        Ic += (pqAnalysis.summary.irmsAvg || 1) * Math.SQRT2 * 0.09 * h5
      }

      return {
        timestamp: row.timestamp,
        Va,
        Vb,
        Vc,
        Ia,
        Ib,
        Ic,
        Freq_Hz: row.freq,
        FP: row.fp,
        P_kW: row.p,
        Q_kVAr: row.q,
      }
    })

    setImportedDataset({
      fileName: `sim_${disturbance}.csv`,
      sourceType: 'Simulação de distúrbio',
      columns: ['timestamp', 'Va', 'Vb', 'Vc', 'Ia', 'Ib', 'Ic', 'Freq_Hz', 'FP', 'P_kW', 'Q_kVAr'],
      rows: nextRows,
      totalRows: nextRows.length,
      delimiter: ',',
      importedAt: new Date().toISOString(),
    })
    toast('Distúrbio aplicado e análise recalculada', 'success')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
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
              {PHASE_OPTIONS.map(o => <option key={o}>{o}</option>)}
            </select>
            <div className="spacer" />
            <span style={{ fontSize: 11, color: analysisStatus.running ? '#d97706' : 'var(--c-text-muted)' }}>
              {analysisStatus.running ? 'Analisando em segundo plano…' : `${pqAnalysis.sourceType}: ${pqAnalysis.sourceName}`}
            </span>
            <select value={disturbance} onChange={e => setDisturbance(e.target.value)} style={{ width: 136 }}>
              <option value="afundamento">Afundamento</option>
              <option value="elevacao">Elevação</option>
              <option value="interrupcao">Interrupção</option>
              <option value="transitorio">Transitório</option>
              <option value="harmonicas">Harmônicas</option>
            </select>
            <button className="btn btn-ghost btn-sm" onClick={handleSimularDisturbio} disabled={analysisStatus.running}>Simular</button>
            <button className="btn btn-primary btn-sm" onClick={handleAtualizar} disabled={loading}>
              {loading ? '…' : 'Atualizar'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate?.('relatorios')}>Relatório</button>
          </div>

          <div style={{ padding: '8px 12px', flexShrink: 0 }}>
            <div className="mini-kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))' }}>
              {miniKpis.map(k => (
                <div key={k.name} className="mini-kpi">
                  <div className="mini-kpi__name">{k.name}</div>
                  <div className="mini-kpi__value" style={{ color: k.color }}>{k.value}</div>
                  <div className="mini-kpi__ref" style={{ color: k.ok ? '#16a34a' : '#dc2626' }}>
                    {k.ok ? 'OK' : '!'} {k.ref}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '320px 320px', gap: 14, padding: '0 14px', minHeight: 670 }}>
            <div className="panel">
              <div className="panel__head">Espectro Harmônico — {fase} — THD = {fmt(phaseData.thdV, 2)}%</div>
              <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
                <ResponsiveContainer>
                  <BarChart data={harmonicRows} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip formatter={value => [`${fmt(value, 3)}%`, 'Magnitude']} />
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
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis domain={voltageDomain} tick={{ fontSize: 9 }} tickFormatter={value => Math.abs(value) >= 1000 ? (value / 1000).toFixed(1) : value.toFixed(0)} />
                    <Tooltip formatter={value => [formatVoltage(value), 'Vrms']} />
                    <ReferenceLine y={pqAnalysis.nominalVoltage} stroke="#16a34a" strokeDasharray="3 2" label={{ value: 'Vnom', fontSize: 9, fill: '#16a34a' }} />
                    <ReferenceLine y={pqAnalysis.nominalVoltage * 1.1} stroke="#dc2626" strokeDasharray="3 2" label={{ value: '+10%', fontSize: 9, fill: '#dc2626' }} />
                    <ReferenceLine y={pqAnalysis.nominalVoltage * 0.9} stroke="#dc2626" strokeDasharray="3 2" label={{ value: '-10%', fontSize: 9, fill: '#dc2626' }} />
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
                  <Tooltip formatter={value => [`${fmt(value, 1)}%`]} />
                </PieChart>
                <div>
                  {confPie.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span>{d.name}</span>
                      <span style={{ fontWeight: 700, color: d.color, marginLeft: 'auto' }}>{fmt(d.value, 1)}%</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 10, color: '#64748b', marginTop: 8 }}>
                    Base: {pqAnalysis.sampleCount.toLocaleString('pt-BR')} amostras<br />
                    {pqAnalysis.measurement.measurementClass}<br />
                    Janela: {pqAnalysis.measurement.windowCycles} ciclos ({fmt(pqAnalysis.measurement.windowMs, 1)} ms)
                  </div>
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel__head">Fator de Potência ao Longo do Período</div>
              <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
                <ResponsiveContainer>
                  <LineChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis domain={[0.75, 1.0]} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={value => [fmt(value, 3), 'FP']} />
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
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis domain={[0, 2]} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={value => [fmt(value, 3), 'Pst']} />
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
                    <XAxis dataKey="label" tick={{ fontSize: 9 }} interval="preserveStartEnd" />
                    <YAxis domain={[59.8, 60.2]} tick={{ fontSize: 9 }} />
                    <Tooltip formatter={value => [`${fmt(value, 4)} Hz`, 'f']} />
                    <ReferenceLine y={60} stroke="#16a34a" strokeDasharray="3 2" />
                    <Line type="monotone" dataKey="freq" stroke="#059669" dot={false} strokeWidth={1.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ height: 190, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 8, padding: '8px 12px 10px', flexShrink: 0 }}>
            <div className="panel">
              <div className="panel__head">Alarmes e Eventos Recentes
                <span className="panel__head-actions"><button className="btn btn-ghost btn-sm" onClick={() => { exportCSV(phaseEvents.map(e => ({ DataHora: e.ts, Tipo: e.tipo, Descricao: e.desc, Severidade: e.sev, Fase: e.fase, Duracao: e.dur })), 'eventos_qe.csv'); toast('CSV exportado com sucesso', 'success') }}>Exportar CSV</button></span>
              </div>
              <div style={{ overflow: 'auto', height: 'calc(100% - 38px)' }}>
                <table className="tbl">
                  <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Descrição</th><th>Sev.</th><th>Fase</th><th>Duração</th></tr></thead>
                  <tbody>
                    {phaseEvents.map((e, i) => (
                      <tr key={`${e.ts}-${e.tipo}-${i}`}>
                        <td>{e.ts}</td><td>{e.tipo}</td><td>{e.desc}</td>
                        <td><span className={SEV_CLASS[e.sev] ?? 'badge'}>{e.sev}</span></td>
                        <td>{e.fase}</td><td>{e.dur}</td>
                      </tr>
                    ))}
                    {phaseEvents.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--c-text-muted)' }}>Nenhum evento detectado para o filtro atual.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <div className="panel__head">Resumo Estatístico — {fase}</div>
              <div className="panel__body">
                {summaryRows(pqAnalysis.eventSummary, pqAnalysis.events.length).map(([t, n, p]) => (
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
