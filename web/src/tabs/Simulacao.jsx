import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'

const LOAD_TYPES = [
  { id: 'R', label: 'R - Resistiva', short: 'R', fields: ['R'], color: '#1d4ed8' },
  { id: 'L', label: 'L - Indutiva', short: 'L', fields: ['L'], color: '#dc2626' },
  { id: 'C', label: 'C - Capacitiva', short: 'C', fields: ['C'], color: '#16a34a' },
  { id: 'LC', label: 'LC - Monofásica', short: 'LC', fields: ['L', 'C'], color: '#0f766e' },
  { id: 'RL', label: 'RL - Resistiva/Indutiva', short: 'RL', fields: ['R', 'L'], color: '#9333ea' },
  { id: 'RC', label: 'RC - Resistiva/Capacitiva', short: 'RC', fields: ['R', 'C'], color: '#0284c7' },
  { id: 'RLC', label: 'RLC - Série', short: 'RLC', fields: ['R', 'L', 'C'], color: '#d97706' },
]

const DEFAULT_LOADS = [
  { id: 1, type: 'R', qty: 1, R: 100, L: 0.05, C: 0.0001 },
  { id: 2, type: 'LC', qty: 1, R: 10, L: 0.08, C: 0.000047 },
]

const FIELD_META = {
  R: { label: 'R (ohm)', step: '0.1', min: '0' },
  L: { label: 'L (H)', step: '0.001', min: '0' },
  C: { label: 'C (F)', step: '0.000001', min: '0' },
}

const fmt = (n, d = 2) => Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '-'
const fmtUnit = (n, unit, d = 2) => `${fmt(n, d)} ${unit}`
const nextId = loads => Math.max(0, ...loads.map(load => load.id)) + 1
const loadType = id => LOAD_TYPES.find(type => type.id === id) ?? LOAD_TYPES[0]

function hasField(type, field) {
  return loadType(type).fields.includes(field)
}

function toNumber(value, fallback = 0) {
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}

function complexDivRealByZ(v, re, im) {
  const den = re * re + im * im
  if (den < 1e-18) return [v / 1e-9, 0]
  return [v * re / den, -v * im / den]
}

function complexAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1]]
}

function complexMag(a) {
  return Math.hypot(a[0], a[1])
}

function calcBranch(load, source, frequency = source.f) {
  const type = load.type
  const qty = Math.max(1, toNumber(load.qty, 1))
  const R = hasField(type, 'R') ? Math.max(0, toNumber(load.R, 0)) : 0
  const L = hasField(type, 'L') ? Math.max(0, toNumber(load.L, 0)) : 0
  const C = hasField(type, 'C') ? Math.max(0, toNumber(load.C, 0)) : 0
  const V = source.mode === 'cc' ? source.Vdc : source.Vac

  if (source.mode === 'cc') {
    const hasCapacitor = C > 0
    const pureInductor = L > 0 && R === 0 && !hasCapacitor
    const effectiveR = pureInductor ? 0.01 : R
    const open = hasCapacitor || (!pureInductor && effectiveR <= 0)
    const I = open ? 0 : V / effectiveR
    return {
      ...load,
      qty,
      R,
      L,
      C,
      XL: 0,
      XC: hasCapacitor ? Infinity : 0,
      Z: open ? Infinity : effectiveR,
      I,
      Ire: I,
      Iim: 0,
      Itotal: I * qty,
      P: V * I * qty,
      Q: 0,
      S: V * I * qty,
      fp: I > 0 ? 1 : 0,
      nature: open ? 'Aberta em CC' : pureInductor ? 'Curto indutivo' : 'Resistiva',
      warning: hasCapacitor ? 'Capacitor bloqueia CC em regime permanente' : pureInductor ? 'Indutor ideal vira curto em CC' : '',
    }
  }

  const w = 2 * Math.PI * Math.max(0.001, frequency)
  const XL = L > 0 ? w * L : 0
  const XC = C > 0 ? 1 / (w * C) : 0
  const X = XL - XC
  const [Ire, Iim] = complexDivRealByZ(V, R, X)
  const I = Math.hypot(Ire, Iim)
  const P = V * Ire * qty
  const Q = -V * Iim * qty
  const S = V * I * qty
  const fp = S > 1e-9 ? Math.abs(P) / S : 0
  return {
    ...load,
    qty,
    R,
    L,
    C,
    XL,
    XC,
    X,
    Z: Math.hypot(R, X),
    I,
    Ire,
    Iim,
    Itotal: I * qty,
    P,
    Q,
    S,
    fp,
    nature: Q > 0.001 ? 'Indutiva' : Q < -0.001 ? 'Capacitiva' : 'Resistiva',
    warning: type === 'LC' && Math.abs(X) < 0.5 ? 'LC perto da ressonância: corrente elevada' : '',
  }
}

function calcCircuit(loads, source) {
  const branches = loads.map(load => calcBranch(load, source))
  const totalI = branches.reduce((sum, branch) => complexAdd(sum, [branch.Ire * branch.qty, branch.Iim * branch.qty]), [0, 0])
  const I = complexMag(totalI)
  const V = source.mode === 'cc' ? source.Vdc : source.Vac
  const P = branches.reduce((sum, branch) => sum + branch.P, 0)
  const Q = branches.reduce((sum, branch) => sum + branch.Q, 0)
  const S = V * I
  const fp = S > 1e-9 ? Math.abs(P) / S : 0
  const Z = I > 1e-9 ? V / I : Infinity
  const theta = Math.atan2(totalI[1], totalI[0])
  return {
    branches,
    totals: {
      V,
      I,
      P,
      Q,
      S,
      fp,
      Z,
      theta,
      nature: source.mode === 'cc' ? 'CC permanente' : Q > 0.001 ? 'Indutivo' : Q < -0.001 ? 'Capacitivo' : 'Resistivo',
    },
  }
}

function waveformData(source, totals, points = 180) {
  if (source.mode === 'cc') {
    return Array.from({ length: 60 }, (_, i) => ({
      t: i,
      v: +source.Vdc.toFixed(4),
      i: +totals.I.toFixed(4),
      p: +(source.Vdc * totals.I).toFixed(4),
    }))
  }
  const w = 2 * Math.PI * source.f
  const cycles = 2
  return Array.from({ length: points }, (_, index) => {
    const t = (index / (points - 1)) * cycles / source.f
    const v = source.Vac * Math.SQRT2 * Math.sin(w * t)
    const i = totals.I * Math.SQRT2 * Math.sin(w * t + totals.theta)
    return {
      t: +(t * 1000).toFixed(3),
      v: +v.toFixed(4),
      i: +i.toFixed(4),
      p: +(v * i).toFixed(2),
    }
  })
}

function frequencyData(loads, source) {
  const freqs = Array.from({ length: 90 }, (_, index) => {
    const min = Math.log10(1)
    const max = Math.log10(10000)
    return Math.pow(10, min + (max - min) * index / 89)
  })
  return freqs.map(f => {
    const tempSource = { ...source, mode: 'ca', f }
    const branches = loads.map(load => calcBranch(load, tempSource, f))
    const totalI = branches.reduce((sum, branch) => complexAdd(sum, [branch.Ire * branch.qty, branch.Iim * branch.qty]), [0, 0])
    const imagQ = branches.reduce((sum, branch) => sum + branch.Q, 0)
    const I = complexMag(totalI)
    return {
      f: +f.toFixed(2),
      Z: I > 1e-9 ? +(source.Vac / I).toFixed(4) : 999999,
      Q: +imagQ.toFixed(2),
    }
  })
}

function loadSignature(load) {
  return [load.type, load.R, load.L, load.C].join('|')
}

export default function Simulacao() {
  const [source, setSource] = useState({ mode: 'ca', Vac: 127, Vdc: 12, f: 60 })
  const [loads, setLoads] = useState(DEFAULT_LOADS)
  const [draft, setDraft] = useState({ type: 'LC', qty: 1, R: 10, L: 0.05, C: 0.0001 })
  const [running, setRunning] = useState(false)

  const circuit = useMemo(() => calcCircuit(loads, source), [loads, source])
  const wave = useMemo(() => waveformData(source, circuit.totals), [source, circuit])
  const freq = useMemo(() => frequencyData(loads, source), [loads, source])
  const selectedType = loadType(draft.type)

  function updateSource(key, value) {
    setSource(prev => ({ ...prev, [key]: key === 'mode' ? value : Math.max(0, toNumber(value, prev[key])) }))
  }

  function updateDraft(key, value) {
    setDraft(prev => ({ ...prev, [key]: key === 'type' ? value : value }))
  }

  function addLoad() {
    const normalized = {
      id: nextId(loads),
      type: draft.type,
      qty: Math.max(1, Math.round(toNumber(draft.qty, 1))),
      R: toNumber(draft.R, 0),
      L: toNumber(draft.L, 0),
      C: toNumber(draft.C, 0),
    }
    const signature = loadSignature(normalized)
    setLoads(prev => {
      const existing = prev.find(load => loadSignature(load) === signature)
      if (!existing) return [...prev, normalized]
      return prev.map(load => load.id === existing.id ? { ...load, qty: load.qty + normalized.qty } : load)
    })
  }

  function changeQty(id, delta) {
    setLoads(prev => prev.map(load => load.id === id ? { ...load, qty: Math.max(1, load.qty + delta) } : load))
  }

  function removeLoad(id) {
    setLoads(prev => prev.filter(load => load.id !== id))
  }

  function resetLoads() {
    setLoads(DEFAULT_LOADS)
  }

  function handleRun() {
    setRunning(true)
    setTimeout(() => setRunning(false), 350)
  }

  const summaryCards = [
    ['Fonte', source.mode === 'ca' ? `${fmt(source.Vac, 0)} Vca` : `${fmt(source.Vdc, 0)} Vcc`, source.mode === 'ca' ? `${fmt(source.f, 1)} Hz` : 'Regime permanente'],
    ['Corrente Total', fmtUnit(circuit.totals.I, 'A', 3), circuit.totals.nature],
    ['Potência Ativa', fmtUnit(circuit.totals.P, 'W', 1), `${loads.reduce((sum, load) => sum + load.qty, 0)} cargas`],
    ['FP / Eq.', source.mode === 'ca' ? fmt(circuit.totals.fp, 3) : '1,000', `Zeq ${fmtUnit(circuit.totals.Z, 'ohm', 2)}`],
  ]

  return (
    <div className="sim-page">
      <div className="sim-sidebar">
        <div className="panel">
          <div className="panel__head">Fonte do Barramento</div>
          <div className="panel__body sim-form-grid">
            <label className="form-label">Modo</label>
            <div className="sim-segmented">
              {['cc', 'ca'].map(mode => (
                <button key={mode} className={`btn btn-sm ${source.mode === mode ? 'btn-primary' : 'btn-ghost'}`} onClick={() => updateSource('mode', mode)}>
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
            {source.mode === 'ca' ? (
              <>
                <label className="form-label">Tensão RMS</label>
                <input className="form-input" type="number" value={source.Vac} onChange={e => updateSource('Vac', e.target.value)} />
                <label className="form-label">Frequência</label>
                <input className="form-input" type="number" value={source.f} onChange={e => updateSource('f', e.target.value)} />
              </>
            ) : (
              <>
                <label className="form-label">Tensão CC</label>
                <input className="form-input" type="number" value={source.Vdc} onChange={e => updateSource('Vdc', e.target.value)} />
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">Adicionar Carga Monofásica</div>
          <div className="panel__body sim-form-grid">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={draft.type} onChange={e => updateDraft('type', e.target.value)}>
              {LOAD_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
            <label className="form-label">Quantidade</label>
            <input className="form-input" type="number" min="1" value={draft.qty} onChange={e => updateDraft('qty', e.target.value)} />
            {selectedType.fields.map(field => (
              <div className="sim-field-pair" key={field}>
                <label className="form-label">{FIELD_META[field].label}</label>
                <input
                  className="form-input"
                  type="number"
                  min={FIELD_META[field].min}
                  step={FIELD_META[field].step}
                  value={draft[field]}
                  onChange={e => updateDraft(field, e.target.value)}
                />
              </div>
            ))}
            <button className="btn btn-primary" onClick={addLoad}>Adicionar ao circuito</button>
            <button className="btn btn-ghost" onClick={resetLoads}>Restaurar exemplo</button>
          </div>
        </div>

        <div className="info-note">
          As cargas entram em paralelo no barramento. Em CC, capacitor fica aberto e indutor ideal vira curto em regime permanente.
        </div>
      </div>

      <div className="sim-workspace">
        <div className="action-bar">
          <button className="btn btn-success btn-sm" onClick={handleRun}>{running ? '...' : 'Executar'}</button>
          <button className="btn btn-dark btn-sm" onClick={() => setLoads([])}>Limpar circuito</button>
          <button className="btn btn-dark btn-sm" onClick={resetLoads}>Exemplo</button>
          <div style={{ flex: 1 }} />
          <span className="status-dot">● {loads.length ? 'Circuito montado' : 'Sem cargas'}</span>
          <span className="timer">{source.mode.toUpperCase()}</span>
        </div>

        <div className="sim-summary-grid">
          {summaryCards.map(([label, value, detail]) => (
            <div className="mini-kpi" key={label}>
              <div className="mini-kpi__name">{label}</div>
              <div className="mini-kpi__value" style={{ color: 'var(--c-primary)' }}>{value}</div>
              <div className="mini-kpi__ref">{detail}</div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel__head">Cargas no Circuito</div>
          <div className="scroll-x">
            <table className="tbl">
              <thead><tr><th>Qtd.</th><th>Tipo</th><th>R</th><th>L</th><th>C</th><th>|Z|</th><th>I total</th><th>P</th><th>Q</th><th>Natureza</th><th>Ações</th></tr></thead>
              <tbody>
                {circuit.branches.map(branch => (
                  <tr key={branch.id}>
                    <td>{branch.qty}</td>
                    <td><span className="badge badge-blue" style={{ background: loadType(branch.type).color, color: '#fff' }}>{loadType(branch.type).short}</span></td>
                    <td>{hasField(branch.type, 'R') ? fmtUnit(branch.R, 'ohm', 2) : '-'}</td>
                    <td>{hasField(branch.type, 'L') ? fmtUnit(branch.L, 'H', 4) : '-'}</td>
                    <td>{hasField(branch.type, 'C') ? fmtUnit(branch.C, 'F', 6) : '-'}</td>
                    <td>{fmtUnit(branch.Z, 'ohm', 2)}</td>
                    <td>{fmtUnit(branch.Itotal, 'A', 3)}</td>
                    <td>{fmtUnit(branch.P, 'W', 1)}</td>
                    <td>{source.mode === 'ca' ? fmtUnit(branch.Q, 'VAr', 1) : '-'}</td>
                    <td>{branch.warning || branch.nature}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => changeQty(branch.id, 1)}>+</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => changeQty(branch.id, -1)}>-</button>
                      <button className="btn btn-danger btn-sm" onClick={() => removeLoad(branch.id)}>Remover</button>
                    </td>
                  </tr>
                ))}
                {loads.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--c-text-muted)' }}>Adicione uma carga para iniciar a simulação.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="sim-chart-grid">
          <div className="panel">
            <div className="panel__head">Formas de Onda do Barramento</div>
            <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={wave} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="t" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="v" stroke="#1d4ed8" dot={false} name={source.mode === 'ca' ? 'v(t) V' : 'Vcc'} strokeWidth={2} />
                  <Line type="monotone" dataKey="i" stroke="#ea580c" dot={false} name={source.mode === 'ca' ? 'i(t) A' : 'Icc'} strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">Potência Instantânea / Total</div>
            <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={wave} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="t" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="p" stroke="#7c3aed" dot={false} name="p(t) W" strokeWidth={1.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">Corrente por Carga</div>
            <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={circuit.branches.map(branch => ({ name: `${loadType(branch.type).short} x${branch.qty}`, I: +branch.Itotal.toFixed(4), color: loadType(branch.type).color }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="I" name="I total (A)">
                    {circuit.branches.map(branch => <Cell key={branch.id} fill={loadType(branch.type).color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">Resposta em Frequência do Circuito</div>
            <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={freq} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="f" type="number" scale="log" domain={['auto', 'auto']} tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="Z" stroke="#0284c7" dot={false} name="|Zeq| ohm" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}