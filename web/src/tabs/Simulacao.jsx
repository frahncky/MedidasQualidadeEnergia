import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts'
import { calcRLC, timeSeries, bodeSeries, resonanceFreq } from '../utils/rlcCalc'

const SIM_TYPES = [
  { id: 'cc',       label: 'CC Resistivo',            desc: 'Resistor puro em CC',             color: '#1d4ed8', bg: '#dbeafe' },
  { id: 'rlc-s',    label: 'RLC Série CA',             desc: 'Z = R + j(ωL − 1/ωC)',           color: '#16a34a', bg: '#dcfce7' },
  { id: 'rlc-p',    label: 'RLC Paralelo CA',          desc: 'Admitâncias em paralelo',         color: '#ea580c', bg: '#ffedd5' },
  { id: '3f',       label: 'Trifásico Equilibrado Y',  desc: '3F balanceado, ligação Y',        color: '#9333ea', bg: '#f3e8ff' },
  { id: 'fp',       label: 'Correção de FP',           desc: 'Banco de capacitores',            color: '#0284c7', bg: '#e0f2fe' },
  { id: 'res',      label: 'Ressonância RLC',          desc: 'Resposta em frequência / Bode',   color: '#dc2626', bg: '#fee2e2' },
  { id: 'var',      label: 'Variação de Carga',        desc: 'Varredura paramétrica de carga',  color: '#d97706', bg: '#fef3c7' },
]

const fmt = (n, dec = 2) => typeof n === 'number' ? n.toFixed(dec).replace('.', ',') : n

export default function Simulacao() {
  const [simType, setSimType] = useState('rlc-s')
  const [params, setParams] = useState({ R: 10, L: 0.05, C: 0.0001, f: 60, Vs: 127, angle: 0 })
  const [running, setRunning] = useState(false)
  const [ran, setRan] = useState(true)

  const set = (key, val) => setParams(p => ({ ...p, [key]: parseFloat(val) || 0 }))

  const res = useMemo(() => {
    if (simType === 'cc') {
      const I = params.Vs / params.R
      return { Z: params.R, phi: 0, I, VR: params.Vs, VL: 0, VC: 0, P: params.Vs * I, Q: 0, S: params.Vs * I, FP: 1, XL: 0, XC: 0, ...params }
    }
    return calcRLC(params)
  }, [params, simType])

  const tData = useMemo(() => ran ? timeSeries(res) : [], [res, ran])
  const bData = useMemo(() => ran && simType === 'res' ? bodeSeries(params) : null, [params, simType, ran])
  const f0 = useMemo(() => resonanceFreq(params.L, params.C), [params.L, params.C])

  const handleRun = () => { setRunning(true); setTimeout(() => { setRan(true); setRunning(false) }, 300) }

  const TABLE_ROWS = [
    ['Impedância', 'Z', fmt(res.Z), 'Ω', '√(R²+(XL−XC)²)'],
    ['Reatância ind.', 'XL', fmt(res.XL), 'Ω', 'ωL'],
    ['Reatância cap.', 'XC', fmt(res.XC), 'Ω', '1/ωC'],
    ['Corrente RMS', 'I', fmt(res.I), 'A', 'Vs/Z'],
    ['Tensão no R', 'VR', fmt(res.VR), 'V', 'I×R'],
    ['Tensão no L', 'VL', fmt(res.VL), 'V', 'I×XL'],
    ['Tensão no C', 'VC', fmt(res.VC), 'V', 'I×XC'],
    ['Potência Ativa', 'P', fmt(res.P, 1), 'W', 'I²×R'],
    ['Potência Reativa', 'Q', fmt(res.Q, 1), 'VAr', 'I²×X'],
    ['Pot. Aparente', 'S', fmt(res.S, 1), 'VA', 'Vs×I'],
    ['Fator de Potência', 'FP', fmt(res.FP, 4), '—', 'cos(φ)'],
    ['Ângulo φ', 'φ', fmt(res.phi * 180 / Math.PI, 2) + '°', '—', 'arctan(X/R)'],
  ]

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', gap: 0 }}>

      {/* Left: type selector + params */}
      <div style={{ width: 256, display: 'flex', flexDirection: 'column', gap: 8, padding: 10, flexShrink: 0, borderRight: '1px solid #e2e8f0', overflow: 'auto' }}>
        <div className="panel">
          <div className="panel__head">Tipo de Simulação</div>
          <div className="panel__body sim-type-list">
            {SIM_TYPES.map(t => (
              <div key={t.id}
                className={`sim-type-card${simType === t.id ? ' active' : ''}`}
                onClick={() => { setSimType(t.id); setRan(false) }}>
                <div className="sim-type-card__icon" style={{ background: t.bg, color: t.color }}>{t.label.slice(0,2)}</div>
                <div>
                  <div className="sim-type-card__name">{t.label}</div>
                  <div className="sim-type-card__desc">{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">Parâmetros do Circuito</div>
          <div className="panel__body">
            {[
              ['R (Ω)', 'R', params.R],
              ['L (H)', 'L', params.L],
              ['C (F)', 'C', params.C],
              ['Freq. (Hz)', 'f', params.f],
              ['Vs (V)', 'Vs', params.Vs],
              ['Ângulo (°)', 'angle', params.angle],
            ].map(([label, key, val]) => (
              <div className="form-row" key={key} style={{ marginBottom: 6 }}>
                <label className="form-label" style={{ minWidth: 80, fontSize: 11 }}>{label}</label>
                <input className="form-input" type="number" step="any" value={val}
                  onChange={e => set(key, e.target.value)} onBlur={() => setRan(false)} />
              </div>
            ))}
            {f0 && <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4, textAlign: 'center' }}>f₀ = {f0.toFixed(2)} Hz</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-success" style={{ flex: 1 }} onClick={handleRun} disabled={running}>
            {running ? '⏳' : '▶'} Executar
          </button>
          <button className="btn btn-ghost" onClick={() => { setParams({ R:10,L:0.05,C:0.0001,f:60,Vs:127,angle:0 }); setRan(false) }}>
            ⟳
          </button>
        </div>
      </div>

      {/* Right: results */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: 10, overflow: 'hidden', minWidth: 0 }}>

        {/* Action bar */}
        <div className="action-bar">
          <button className="btn btn-success btn-sm" onClick={handleRun}>▶ Executar</button>
          <button className="btn btn-dark btn-sm">⏸ Pausar</button>
          <button className="btn btn-dark btn-sm" onClick={() => setRan(false)}>⟳ Reiniciar</button>
          <button className="btn btn-dark btn-sm">Comparar Cenários</button>
          <button className="btn btn-dark btn-sm">Exportar</button>
          <div style={{ flex: 1 }} />
          <span className="status-dot">● {ran ? 'Pronto' : 'Aguardando'}</span>
          <span className="timer">T = {(2/params.f*1000).toFixed(1)} ms</span>
        </div>

        {/* Results table */}
        <div className="panel" style={{ flexShrink: 0 }}>
          <div className="panel__head">Resultados da Simulação — {SIM_TYPES.find(t=>t.id===simType)?.label}</div>
          <div style={{ overflow: 'auto', maxHeight: 160 }}>
            <table className="tbl">
              <thead><tr><th>Grandeza</th><th>Símbolo</th><th>Valor</th><th>Unidade</th><th>Equação</th></tr></thead>
              <tbody>
                {TABLE_ROWS.map(row => (
                  <tr key={row[0]}>
                    <td style={{ fontWeight: 600, color: '#475569' }}>{row[0]}</td>
                    <td style={{ fontFamily: 'monospace', color: '#7c3aed' }}>{row[1]}</td>
                    <td style={{ fontWeight: 700, color: '#1d4ed8' }}>{row[2]}</td>
                    <td>{row[3]}</td>
                    <td style={{ color: '#64748b', fontSize: 11 }}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts grid */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, minHeight: 0 }}>

          <div className="panel">
            <div className="panel__head">Formas de Onda — v(t), i(t)</div>
            <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="t" tick={{ fontSize: 9 }} label={{ value: 'ms', position: 'insideRight', fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v, n) => [v.toFixed(2), n]} labelFormatter={t => `t = ${t} ms`} />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#e2e8f0" />
                  <Line type="monotone" dataKey="v" stroke="#1d4ed8" dot={false} name="v(t) V" strokeWidth={2} />
                  <Line type="monotone" dataKey="i" stroke="#ea580c" dot={false} name="i(t) A" strokeWidth={1.5} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">Diagrama Fasorial</div>
            <div style={{ height: 'calc(100% - 38px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhasorDiagram res={res} />
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">Potências — p(t), P, Q, S</div>
            <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="t" tick={{ fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v,n) => [v.toFixed(1), n]} />
                  <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#e2e8f0" />
                  <Line type="monotone" dataKey="p" stroke="#7c3aed" dot={false} name="p(t) W" strokeWidth={1.5} />
                  <ReferenceLine y={res.P} stroke="#16a34a" strokeDasharray="4 2" label={{ value: `P=${res.P.toFixed(0)}W`, fontSize:9, fill:'#16a34a' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">Resposta em Frequência — |Z(f)|</div>
            <div style={{ height: 'calc(100% - 38px)', padding: 6 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bData ?? bodeSeries(params)} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="f" tick={{ fontSize: 9 }} scale="log" type="number" domain={['auto','auto']} label={{ value: 'Hz', position: 'insideRight', fontSize: 9 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip formatter={(v,n) => [v.toFixed(2)+'Ω', n]} labelFormatter={f => `f = ${f} Hz`} />
                  {f0 && <ReferenceLine x={f0} stroke="#dc2626" strokeDasharray="3 2" label={{ value:`f₀=${f0.toFixed(1)}Hz`, fontSize:9, fill:'#dc2626' }} />}
                  <Line type="monotone" dataKey="Z" stroke="#0284c7" dot={false} name="|Z| Ω" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhasorDiagram({ res }) {
  const size = 200; const cx = size/2; const cy = size/2; const scale = 70 / Math.max(res.Vs, 1)
  const arrow = (mag, deg, color, label) => {
    const rad = deg * Math.PI / 180
    const ex = cx + scale * mag * Math.cos(rad)
    const ey = cy - scale * mag * Math.sin(rad)
    const angle = Math.atan2(cy - ey, ex - cx)
    return (
      <g key={label}>
        <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={color} strokeWidth={2} markerEnd={`url(#arr-${color.replace('#','')})`} />
        <text x={ex + 8 * Math.cos(angle)} y={ey - 8 * Math.sin(angle)} fontSize={9} fill={color} textAnchor="middle">{label}</text>
      </g>
    )
  }
  const phiDeg = -(res.phi * 180 / Math.PI)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        {['1d4ed8','ea580c','16a34a'].map(c => (
          <marker key={c} id={`arr-${c}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill={`#${c}`} />
          </marker>
        ))}
      </defs>
      <line x1={0} y1={cy} x2={size} y2={cy} stroke="#e2e8f0" strokeWidth={1} />
      <line x1={cx} y1={0} x2={cx} y2={size} stroke="#e2e8f0" strokeWidth={1} />
      {arrow(res.Vs, 0, '#1d4ed8', `Vs=${res.Vs.toFixed(0)}V`)}
      {arrow(res.I * (size/6), phiDeg, '#ea580c', `I=${res.I.toFixed(2)}A`)}
      {res.P > 0 && arrow(res.VR, 0, '#16a34a', `VR`)}
      <text x={4} y={12} fontSize={9} fill="#64748b">Im</text>
      <text x={size-20} y={cy-4} fontSize={9} fill="#64748b">Re</text>
    </svg>
  )
}
