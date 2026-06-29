import { useMemo, useState } from 'react'

const LOAD_TYPES = [
  { id: 'R', label: 'R - Resistiva', short: 'R', fields: ['R'], color: '#1d4ed8' },
  { id: 'L', label: 'L - Indutiva', short: 'L', fields: ['L'], color: '#dc2626' },
  { id: 'C', label: 'C - Capacitiva', short: 'C', fields: ['C'], color: '#16a34a' },
  { id: 'LC', label: 'LC - Monofásica', short: 'LC', fields: ['L', 'C'], color: '#0f766e' },
  { id: 'RL', label: 'RL - Resistiva/Indutiva', short: 'RL', fields: ['R', 'L'], color: '#9333ea' },
  { id: 'RC', label: 'RC - Resistiva/Capacitiva', short: 'RC', fields: ['R', 'C'], color: '#0284c7' },
  { id: 'RLC', label: 'RLC - Série', short: 'RLC', fields: ['R', 'L', 'C'], color: '#d97706' },
]

const DEFAULT_LOADS = {
  cc: [{ id: 1, type: 'R', qty: 1, R: 100, L: 0.05, C: 0.0001 }],
  ca: [
    { id: 1, type: 'R', qty: 1, R: 100, L: 0.05, C: 0.0001 },
    { id: 2, type: 'LC', qty: 1, R: 0, L: 0.08, C: 0.000047 },
  ],
}

const FIELD_META = {
  R: { label: 'R (ohm)', step: '0.1', min: '0' },
  L: { label: 'L (H)', step: '0.001', min: '0' },
  C: { label: 'C (F)', step: '0.000001', min: '0' },
}

const fmt = (n, d = 2) => Number.isFinite(n) ? n.toFixed(d).replace('.', ',') : '-'
const fmtUnit = (n, unit, d = 2) => `${fmt(n, d)} ${unit}`
const toNumber = (value, fallback = 0) => {
  const parsed = Number(String(value).replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : fallback
}
const loadType = id => LOAD_TYPES.find(type => type.id === id) ?? LOAD_TYPES[0]
const hasField = (type, field) => loadType(type).fields.includes(field)
const nextId = loads => Math.max(0, ...loads.map(load => load.id)) + 1
const signatureOf = load => [load.type, load.R, load.L, load.C].join('|')

function complexDivRealByZ(v, re, im) {
  const den = re * re + im * im
  if (den < 1e-18) return [v / 1e-9, 0]
  return [v * re / den, -v * im / den]
}

function complexAdd(a, b) {
  return [a[0] + b[0], a[1] + b[1]]
}

function calcBranch(load, source) {
  const type = load.type
  const qty = Math.max(1, Math.round(toNumber(load.qty, 1)))
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
      Z: open ? Infinity : effectiveR,
      I,
      Ire: I,
      Iim: 0,
      Itotal: I * qty,
      P: V * I * qty,
      Q: 0,
      fp: I > 0 ? 1 : 0,
      nature: open ? 'Aberta em CC' : pureInductor ? 'Curto indutivo' : 'Resistiva',
    }
  }

  const w = 2 * Math.PI * Math.max(0.001, source.f)
  const XL = L > 0 ? w * L : 0
  const XC = C > 0 ? 1 / (w * C) : 0
  const X = XL - XC
  const [Ire, Iim] = complexDivRealByZ(V, R, X)
  const I = Math.hypot(Ire, Iim)
  const P = V * Ire * qty
  const Q = -V * Iim * qty
  const S = V * I * qty

  return {
    ...load,
    qty,
    R,
    L,
    C,
    Z: Math.hypot(R, X),
    I,
    Ire,
    Iim,
    Itotal: I * qty,
    P,
    Q,
    fp: S > 1e-9 ? Math.abs(P) / S : 0,
    nature: Q > 0.001 ? 'Indutiva' : Q < -0.001 ? 'Capacitiva' : 'Resistiva',
  }
}

function calcCircuit(loads, source) {
  const branches = loads.map(load => calcBranch(load, source))
  const totalI = branches.reduce((sum, branch) => complexAdd(sum, [branch.Ire * branch.qty, branch.Iim * branch.qty]), [0, 0])
  const I = Math.hypot(totalI[0], totalI[1])
  const V = source.mode === 'cc' ? source.Vdc : source.Vac
  const P = branches.reduce((sum, branch) => sum + branch.P, 0)
  const Q = branches.reduce((sum, branch) => sum + branch.Q, 0)
  const S = V * I

  return {
    branches,
    totals: {
      V,
      I,
      P,
      Q,
      S,
      fp: S > 1e-9 ? Math.abs(P) / S : 0,
      Z: I > 1e-9 ? V / I : Infinity,
      nature: source.mode === 'cc' ? 'CC permanente' : Q > 0.001 ? 'Indutivo' : Q < -0.001 ? 'Capacitivo' : 'Resistivo',
    },
  }
}

function expandLoadBranches(branches) {
  return branches.flatMap(branch =>
    Array.from({ length: Math.max(1, Math.round(branch.qty)) }, (_, index) => ({
      ...branch,
      qty: 1,
      copy: index + 1,
      visualId: `${branch.id}-${index}`,
    }))
  )
}

function ComponentGlyph({ field, x, y, color }) {
  if (field === 'R') {
    return (
      <g>
        <rect x={x - 18} y={y - 13} width="36" height="26" rx="4" fill="var(--c-surface)" stroke={color} strokeWidth="2" />
        <text x={x} y={y + 4} textAnchor="middle" fontSize="13" fontWeight="800" fill={color}>R</text>
      </g>
    )
  }

  if (field === 'L') {
    return (
      <g fill="none" stroke={color} strokeWidth="2">
        <path d={`M ${x - 18} ${y + 7} c 6 -18 12 -18 18 0 c 6 -18 12 -18 18 0`} />
        <text x={x} y={y + 25} textAnchor="middle" fontSize="12" fontWeight="800" fill={color} stroke="none">L</text>
      </g>
    )
  }

  return (
    <g stroke={color} strokeWidth="2">
      <line x1={x - 17} y1={y - 8} x2={x + 17} y2={y - 8} />
      <line x1={x - 17} y1={y + 8} x2={x + 17} y2={y + 8} />
      <text x={x} y={y + 28} textAnchor="middle" fontSize="12" fontWeight="800" fill={color} stroke="none">C</text>
    </g>
  )
}

function DynamicCircuitSvg({ source, branches, onRemoveBranch }) {
  const physicalBranches = expandLoadBranches(branches)
  const count = physicalBranches.length
  const firstX = 190
  const gap = 122
  const lastX = count ? firstX + (count - 1) * gap : firstX
  const W = Math.max(760, lastX + 130)
  const H = 250
  const topY = 62
  const bottomY = 178
  const sourceX = 86
  const busEndX = Math.max(620, lastX + 72)

  return (
    <svg className="sim-circuit-svg" viewBox={`0 0 ${W} ${H}`} style={{ width: W, height: H }}>
      <defs>
        <marker id="sim-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M 0 0 L 8 4 L 0 8 z" fill="#ea580c" />
        </marker>
      </defs>

      <rect x="10" y="10" width={W - 20} height={H - 20} rx="8" fill="var(--c-surface-2)" stroke="var(--c-border)" />
      <line x1={sourceX} y1={topY} x2={busEndX} y2={topY} stroke="#dc2626" strokeWidth="4" strokeLinecap="round" />
      <line x1={sourceX} y1={bottomY} x2={busEndX} y2={bottomY} stroke="#2563eb" strokeWidth="4" strokeLinecap="round" />
      <text x={sourceX + 10} y="39" fontSize="12" fontWeight="800" fill="var(--c-text)">Barramento {source.mode.toUpperCase()}</text>
      <text x={busEndX - 5} y="39" textAnchor="end" fontSize="11" fill="var(--c-text-muted)">
        {count ? `${count} carga${count === 1 ? '' : 's'} física${count === 1 ? '' : 's'}` : 'sem cargas'}
      </text>

      <line x1={sourceX} y1={topY} x2={sourceX} y2="91" stroke="var(--c-text)" strokeWidth="2" />
      <line x1={sourceX} y1="149" x2={sourceX} y2={bottomY} stroke="var(--c-text)" strokeWidth="2" />
      <circle cx={sourceX} cy="120" r="31" fill="var(--c-surface)" stroke="var(--c-text)" strokeWidth="2" />
      {source.mode === 'ca' ? (
        <path d={`M ${sourceX - 20} 120 c 8 -17 16 -17 24 0 c 8 17 16 17 24 0`} fill="none" stroke="#0f766e" strokeWidth="2.5" />
      ) : (
        <g stroke="var(--c-text)" strokeWidth="2">
          <line x1={sourceX - 13} y1="111" x2={sourceX + 13} y2="111" />
          <line x1={sourceX} y1="98" x2={sourceX} y2="124" />
          <line x1={sourceX - 13} y1="133" x2={sourceX + 13} y2="133" />
        </g>
      )}
      <text x={sourceX} y="217" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--c-text)">
        {source.mode === 'ca' ? `${fmt(source.Vac, 0)} Vca / ${fmt(source.f, 0)} Hz` : `${fmt(source.Vdc, 0)} Vcc`}
      </text>

      {count === 0 && (
        <g>
          <line x1="205" y1="120" x2="555" y2="120" stroke="var(--c-border)" strokeDasharray="6 7" strokeWidth="2" />
          <text x="380" y="116" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--c-text-muted)">
            Adicione cargas para expandir o circuito
          </text>
        </g>
      )}

      {physicalBranches.map((branch, index) => {
        const x = firstX + index * gap
        const type = loadType(branch.type)
        const fields = type.fields
        const usableTop = topY + 25
        const usableBottom = bottomY - 25
        const step = fields.length > 1 ? (usableBottom - usableTop) / (fields.length - 1) : 0
        const points = fields.map((field, fieldIndex) => ({
          field,
          y: fields.length === 1 ? (topY + bottomY) / 2 : usableTop + step * fieldIndex,
        }))

        return (
          <g key={branch.visualId}>
            <line x1={x} y1={topY} x2={x} y2={bottomY} stroke="var(--c-text)" strokeWidth="2" />
            <circle cx={x} cy={topY} r="5" fill="#dc2626" />
            <circle cx={x} cy={bottomY} r="5" fill="#2563eb" />
            <path d={`M ${x - 22} ${topY + 15} L ${x - 22} ${bottomY - 15}`} stroke="#ea580c" strokeWidth="1.8" markerEnd="url(#sim-arrow)" />
            {points.map(point => (
              <ComponentGlyph key={`${branch.visualId}-${point.field}`} field={point.field} x={x} y={point.y} color={type.color} />
            ))}
            <rect x={x - 38} y="190" width="76" height="33" rx="6" fill="var(--c-surface)" stroke="var(--c-border)" />
            <text x={x} y="204" textAnchor="middle" fontSize="11" fontWeight="800" fill={type.color}>
              {type.short}{branch.copy > 1 ? `.${branch.copy}` : ''}
            </text>
            <text x={x} y="217" textAnchor="middle" fontSize="9" fill="var(--c-text-muted)">
              {fmtUnit(branch.I, 'A', 2)}
            </text>
            <g className="sim-circuit-remove" onClick={() => onRemoveBranch(branch.id)} role="button" aria-label={`Excluir uma carga ${type.short}`}>
              <title>Excluir uma carga {type.short}</title>
              <circle cx={x + 34} cy="48" r="10" fill="#fee2e2" stroke="#dc2626" />
              <text x={x + 34} y="52" textAnchor="middle" fontSize="12" fontWeight="900" fill="#dc2626">x</text>
            </g>
          </g>
        )
      })}
    </svg>
  )
}

export default function Simulacao({ initialMode = 'ca', lockedMode = null, embedded = false, title = 'Montador de Cargas' } = {}) {
  const fixedMode = lockedMode ?? initialMode
  const [source, setSource] = useState({ mode: fixedMode, Vac: 127, Vdc: 12, f: 60 })
  const [loads, setLoads] = useState(DEFAULT_LOADS[fixedMode] ?? DEFAULT_LOADS.ca)
  const [draft, setDraft] = useState({ type: fixedMode === 'cc' ? 'R' : 'LC', qty: 1, R: 10, L: 0.05, C: 0.0001 })

  const circuit = useMemo(() => calcCircuit(loads, source), [loads, source])
  const selectedType = loadType(draft.type)
  const totalPhysicalLoads = loads.reduce((sum, load) => sum + load.qty, 0)

  function updateSource(key, value) {
    setSource(prev => ({
      ...prev,
      [key]: key === 'mode' ? (lockedMode ?? value) : Math.max(0, toNumber(value, prev[key])),
    }))
  }

  function updateDraft(key, value) {
    setDraft(prev => ({ ...prev, [key]: value }))
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
    const signature = signatureOf(normalized)
    setLoads(prev => {
      const existing = prev.find(load => signatureOf(load) === signature)
      if (!existing) return [...prev, normalized]
      return prev.map(load => load.id === existing.id ? { ...load, qty: load.qty + normalized.qty } : load)
    })
  }

  function changeQty(id, delta) {
    setLoads(prev => prev.flatMap(load => {
      if (load.id !== id) return [load]
      const nextQty = load.qty + delta
      return nextQty > 0 ? [{ ...load, qty: nextQty }] : []
    }))
  }

  function resetLoads() {
    setLoads(DEFAULT_LOADS[source.mode] ?? [])
  }

  const summaryCards = [
    ['Fonte', source.mode === 'ca' ? `${fmt(source.Vac, 0)} Vca` : `${fmt(source.Vdc, 0)} Vcc`, source.mode === 'ca' ? `${fmt(source.f, 1)} Hz` : 'Regime permanente'],
    ['Cargas', `${totalPhysicalLoads}`, 'ramos físicos no desenho'],
    ['Corrente Total', fmtUnit(circuit.totals.I, 'A', 3), circuit.totals.nature],
    ['Potência / FP', `${fmtUnit(circuit.totals.P, 'W', 1)} / ${source.mode === 'ca' ? fmt(circuit.totals.fp, 3) : '1,000'}`, `Zeq ${fmtUnit(circuit.totals.Z, 'ohm', 2)}`],
  ]

  return (
    <div className={`sim-page${embedded ? ' sim-page--embedded' : ''}`}>
      <div className="sim-sidebar">
        <div className="panel">
          <div className="panel__head">{title}</div>
          <div className="panel__body sim-form-grid">
            <label className="form-label">Modo</label>
            <div className="sim-segmented">
              {(lockedMode ? [lockedMode] : ['cc', 'ca']).map(mode => (
                <button key={mode} className={`btn btn-sm ${source.mode === mode ? 'btn-primary' : 'btn-ghost'}`} onClick={() => updateSource('mode', mode)} disabled={Boolean(lockedMode)}>
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
            {source.mode === 'ca' ? (
              <>
                <label className="form-label">Tensão RMS</label>
                <input className="form-input" type="number" value={source.Vac} onChange={event => updateSource('Vac', event.target.value)} />
                <label className="form-label">Frequência</label>
                <input className="form-input" type="number" value={source.f} onChange={event => updateSource('f', event.target.value)} />
              </>
            ) : (
              <>
                <label className="form-label">Tensão CC</label>
                <input className="form-input" type="number" value={source.Vdc} onChange={event => updateSource('Vdc', event.target.value)} />
              </>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">Adicionar Carga</div>
          <div className="panel__body sim-form-grid">
            <label className="form-label">Tipo</label>
            <select className="form-select" value={draft.type} onChange={event => updateDraft('type', event.target.value)}>
              {LOAD_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
            </select>
            <label className="form-label">Quantidade</label>
            <input className="form-input" type="number" min="1" value={draft.qty} onChange={event => updateDraft('qty', event.target.value)} />
            {selectedType.fields.map(field => (
              <div className="sim-field-pair" key={field}>
                <label className="form-label">{FIELD_META[field].label}</label>
                <input
                  className="form-input"
                  type="number"
                  min={FIELD_META[field].min}
                  step={FIELD_META[field].step}
                  value={draft[field]}
                  onChange={event => updateDraft(field, event.target.value)}
                />
              </div>
            ))}
            <button className="btn btn-primary" onClick={addLoad}>Adicionar ao circuito</button>
            <button className="btn btn-ghost" onClick={resetLoads}>Restaurar exemplo</button>
          </div>
        </div>

        <div className="info-note">
          Cada unidade aparece como um ramo no desenho. Use +, -, Remover ou o x no diagrama para expandir ou reduzir o circuito.
        </div>
      </div>

      <div className="sim-workspace">
        <div className="sim-summary-grid">
          {summaryCards.map(([label, value, detail]) => (
            <div className="mini-kpi" key={label}>
              <div className="mini-kpi__name">{label}</div>
              <div className="mini-kpi__value" style={{ color: 'var(--c-primary)' }}>{value}</div>
              <div className="mini-kpi__ref">{detail}</div>
            </div>
          ))}
        </div>

        <div className="panel sim-circuit-panel">
          <div className="panel__head">Circuito Expansível</div>
          <div className="sim-circuit-scroll">
            <DynamicCircuitSvg source={source} branches={circuit.branches} onRemoveBranch={id => changeQty(id, -1)} />
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">Cargas no Circuito</div>
          <div className="scroll-x">
            <table className="tbl">
              <thead>
                <tr><th>Qtd.</th><th>Tipo</th><th>R</th><th>L</th><th>C</th><th>|Z|</th><th>I total</th><th>P</th><th>Q</th><th>Natureza</th><th>Ações</th></tr>
              </thead>
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
                    <td>{branch.nature}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => changeQty(branch.id, 1)}>+</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => changeQty(branch.id, -1)}>-</button>
                      <button className="btn btn-danger btn-sm" onClick={() => setLoads(prev => prev.filter(load => load.id !== branch.id))}>Remover</button>
                    </td>
                  </tr>
                ))}
                {loads.length === 0 && <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--c-text-muted)' }}>Adicione uma carga para iniciar.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
