import { useState, useMemo } from 'react'
import Simulacao from './Simulacao'

/* ── Default parameters ── */

const DEFAULT_PARAMS = {
  v1_tensao:      '13,8',
  v1_freq:        '60',
  v1_ligacao:     'Y',
  q1_inominal:    '630',
  tc1_primario:   '300',
  tc1_secundario: '5',
  r1_valor:       '0,5',
  l1_p:           '1000',
  l1_q:           '400',
}

const PRESETS = [
  { label: 'Subestação 13,8 kV',   params: { ...DEFAULT_PARAMS } },
  { label: 'Baixa Tensão 380 V',   params: { v1_tensao: '0,38', v1_freq: '60', v1_ligacao: 'Y', q1_inominal: '400', tc1_primario: '400', tc1_secundario: '5', r1_valor: '0,1', l1_p: '200', l1_q: '100' } },
  { label: 'Sobrecarga',           params: { ...DEFAULT_PARAMS, l1_p: '1800', l1_q: '600' } },
  { label: 'Baixo Fator de Potência', params: { ...DEFAULT_PARAMS, l1_p: '500', l1_q: '800' } },
]

/* ── Helpers ── */

function parseNum(str) {
  if (str === '' || str === null || str === undefined) return NaN
  return parseFloat(String(str).replace(',', '.'))
}

function fmt(n, d = 2) {
  if (isNaN(n) || !isFinite(n)) return '—'
  return n.toFixed(d).replace('.', ',')
}

/* ── Electrical calculations ── */

function calcCircuit(p) {
  const V    = parseNum(p.v1_tensao) * 1000   // V (line-to-line)
  const P    = parseNum(p.l1_p) * 1000        // W
  const Q    = parseNum(p.l1_q) * 1000        // var
  const R    = parseNum(p.r1_valor)           // Ω
  const I_q  = parseNum(p.q1_inominal)
  const I_tc = parseNum(p.tc1_primario)

  if (!V || V === 0) return { V: 0, S: 0, FP: 1, phi: 0, I: 0, V_drop: 0, V_load: 0, Ploss: 0, eta: 100, q_pct: 0, tc_pct: 0, vd_pct: 0 }

  const S      = Math.sqrt(P ** 2 + Q ** 2)
  const FP     = S > 0 ? P / S : 1
  const phi    = Math.atan2(Q, P) * 180 / Math.PI
  const I      = S / (Math.sqrt(3) * V)
  const V_drop = Math.sqrt(3) * R * I
  const V_load = V - V_drop
  const Ploss  = 3 * R * I ** 2
  const eta    = P > 0 ? (P / (P + Ploss)) * 100 : 100
  const q_pct  = (I / I_q) * 100
  const tc_pct = (I / I_tc) * 100
  const vd_pct = (V_drop / V) * 100

  return { V, S, FP, phi, I, V_drop, V_load, Ploss, eta, q_pct, tc_pct, vd_pct }
}

function validate(p, c) {
  const msgs = []

  if (c.q_pct > 100)
    msgs.push({ sev: 'Erro', text: `Q1: Corrente de linha ${fmt(c.I)} A excede a capacidade nominal de ${p.q1_inominal} A. Disjuntor irá operar.` })
  else if (c.q_pct > 80)
    msgs.push({ sev: 'Aviso', text: `Q1: Corrente em ${fmt(c.q_pct)}% da nominal — verifique margem de segurança.` })

  if (c.tc_pct > 100)
    msgs.push({ sev: 'Erro', text: `TC1: Corrente ${fmt(c.I)} A supera o primário nominal de ${p.tc1_primario} A — risco de saturação e erro de medição.` })
  else if (c.tc_pct > 90)
    msgs.push({ sev: 'Aviso', text: `TC1: TC em ${fmt(c.tc_pct)}% da carga — próximo da saturação.` })

  if (!isNaN(c.FP) && c.FP < 0.92 && c.S > 0)
    msgs.push({ sev: 'Aviso', text: `FP = ${fmt(c.FP, 3)} — abaixo do limite ANEEL/PRODIST (0,92). Instale banco de capacitores.` })

  if (!isNaN(c.vd_pct) && c.vd_pct > 5)
    msgs.push({ sev: 'Aviso', text: `R1: Queda de tensão de ${fmt(c.vd_pct)}% — acima do limite de 5%. Verifique a bitola dos condutores.` })

  const R = parseNum(p.r1_valor)
  if (!isNaN(R) && R > 0 && R < 0.05)
    msgs.push({ sev: 'Info', text: `R1: Resistência muito baixa (${p.r1_valor} Ω) — comportamento próximo do ideal.` })

  if (msgs.length === 0)
    msgs.push({ sev: 'OK', text: 'Circuito válido — todos os parâmetros dentro dos limites operacionais.' })

  return msgs
}

function genNetlist(p, c) {
  const V_kV = parseNum(p.v1_tensao)
  return `* Circuito Trifásico — SMQE
* Gerado automaticamente dos parâmetros

FONTE_CA   V1  3  ${V_kV * 1000}  ${p.v1_freq}  0  LIG:${p.v1_ligacao}
DISJUNTOR  Q1  3  ${p.q1_inominal}
TC         TC1 3  ${p.tc1_primario}  ${p.tc1_secundario}
TP         TP1 3  ${V_kV * 1000}  110  DY1
RESISTOR   R1  3  ${p.r1_valor}
MEDIDOR    M1  3  V A KW KVAR PF
CARGA_RLC  L1  3  ${p.l1_p}  ${p.l1_q}  ${fmt(c.FP, 4).replace(',', '.')}  IND
TERRA      G1  10
CONEXAO    NEUTRO  N

* --- Resultados calculados ---
* I_linha    = ${fmt(c.I)} A
* S          = ${fmt(c.S / 1000)} kVA
* FP         = ${fmt(c.FP, 4)}  (φ = ${fmt(c.phi, 1)}°)
* V_carga    = ${fmt(c.V_load / 1000, 3)} kV
* Queda_V    = ${fmt(c.vd_pct)}%
* Rendimento = ${fmt(c.eta)}%

FIM`
}

function genParts(p, c) {
  const badge = (pct, th1 = 100, th2 = 80) => pct > th1 ? 'Erro' : pct > th2 ? 'Aviso' : 'OK'
  const R = parseNum(p.r1_valor)
  return [
    ['V1',  'Fonte CA',  '3', `${p.v1_tensao} kV / ${p.v1_freq} Hz`, p.v1_ligacao, 'OK'],
    ['Q1',  'Disjuntor', '3', `${p.q1_inominal} A`,                  '—',          badge(c.q_pct)],
    ['TC1', 'TC',        '3', `${p.tc1_primario}/${p.tc1_secundario} A`, '—',       badge(c.tc_pct, 100, 90)],
    ['TP1', 'TP',        '3', `${p.v1_tensao} kV/√3 / 110 V`,        'DY1',        'OK'],
    ['R1',  'Resistor',  '3', `${p.r1_valor} Ω`,                     '—',          (!isNaN(R) && R > 0 && R < 0.05) ? 'Aviso' : 'OK'],
    ['M1',  'Medidor',   '3', 'V, A, kW, kvar, PF',                  p.v1_ligacao, 'OK'],
    ['L1',  'Carga RLC', '3', `${p.l1_p} kW / ${p.l1_q} kvar`,      p.v1_ligacao, badge(c.q_pct)],
  ]
}

/* ── Main component ── */

export default function Circuitos() {
  const [sub, setSub]       = useState('editor')
  const [params, setParams] = useState(DEFAULT_PARAMS)

  const calc    = useMemo(() => calcCircuit(params), [params])
  const msgs    = useMemo(() => validate(params, calc), [params, calc])
  const netlist = useMemo(() => genNetlist(params, calc), [params, calc])
  const parts   = useMemo(() => genParts(params, calc), [params, calc])

  function setParam(key, value) { setParams(prev => ({ ...prev, [key]: value })) }

  const errCount  = msgs.filter(m => m.sev === 'Erro').length
  const warnCount = msgs.filter(m => m.sev === 'Aviso').length
  const infoCount = msgs.filter(m => m.sev === 'Info').length

  return (
    <div className="circuitos-page">
      <div className="inner-nav">
        <span className="inner-nav__label">Módulo:</span>
        <button className={`inner-nav-btn${sub === 'editor' ? ' active' : ''}`} onClick={() => setSub('editor')}>
          ⊡ Editor de Circuitos
        </button>
        <button className={`inner-nav-btn${sub === 'simulacao' ? ' active' : ''}`} onClick={() => setSub('simulacao')}>
          ▷ Simulação de Circuitos
        </button>
      </div>

      {sub === 'simulacao' ? <Simulacao /> : (
        <div className="circuit-editor-grid">

          {/* ── LEFT: Parameter editor ── */}
          <aside className="panel" style={{ gridRow: '1 / 3', minHeight: 0 }}>
            <div className="panel__head">Parâmetros do Circuito</div>
            <div className="panel__body scroll-y" style={{ height: 'calc(100% - 38px)', overflow: 'auto' }}>

              <Section title="Fonte CA (V1)">
                <PField label="Tensão" unit="kV" value={params.v1_tensao}  onChange={v => setParam('v1_tensao', v)} />
                <PField label="Frequência" unit="Hz" value={params.v1_freq} onChange={v => setParam('v1_freq', v)} />
                <PSelect label="Ligação" value={params.v1_ligacao} onChange={v => setParam('v1_ligacao', v)} options={['Y', 'D', 'Δ']} />
              </Section>

              <Section title="Disjuntor (Q1)">
                <PField label="I nominal" unit="A" value={params.q1_inominal} onChange={v => setParam('q1_inominal', v)} />
                <Indicator label="Carregamento atual" pct={calc.q_pct} />
              </Section>

              <Section title="TC de Corrente (TC1)">
                <PField label="I primário" unit="A" value={params.tc1_primario}   onChange={v => setParam('tc1_primario', v)} />
                <PField label="I secundário" unit="A" value={params.tc1_secundario} onChange={v => setParam('tc1_secundario', v)} />
                <Indicator label="Carregamento atual" pct={calc.tc_pct} />
              </Section>

              <Section title="Resistência de linha (R1)">
                <PField label="Resistência" unit="Ω" value={params.r1_valor} onChange={v => setParam('r1_valor', v)} />
              </Section>

              <Section title="Carga RLC (L1)">
                <PField label="Pot. ativa" unit="kW"   value={params.l1_p} onChange={v => setParam('l1_p', v)} />
                <PField label="Pot. reativa" unit="kvar" value={params.l1_q} onChange={v => setParam('l1_q', v)} />
              </Section>

            </div>
          </aside>

          {/* ── TOOLBAR: Preset scenarios ── */}
          <div className="panel" style={{ gridColumn: '2 / 4' }}>
            <div className="panel__body" style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', marginRight: 4 }}>Cenário:</span>
              {PRESETS.map(pr => (
                <button key={pr.label} className="btn btn-ghost btn-sm" onClick={() => setParams({ ...pr.params })}>
                  {pr.label}
                </button>
              ))}
              <span style={{ flex: 1 }} />
              <button className="btn btn-ghost btn-sm" onClick={() => setParams(DEFAULT_PARAMS)}>Resetar</button>
            </div>
          </div>

          {/* ── MAIN: Circuit canvas ── */}
          <main className="panel" style={{ minHeight: 0 }}>
            <div className="panel__body--np" style={{ height: '100%', backgroundImage: 'radial-gradient(#dbe4f0 1px, transparent 1px)', backgroundSize: '14px 14px', position: 'relative' }}>
              <CircuitSvg p={params} c={calc} />
              <div className="surface-box" style={{ position: 'absolute', left: 12, bottom: 12, padding: '4px 10px', fontSize: 11, display: 'flex', gap: 12 }}>
                <span>I = <b>{fmt(calc.I)} A</b></span>
                <span>FP = <b style={{ color: calc.FP < 0.92 && calc.S > 0 ? 'var(--c-danger)' : undefined }}>{fmt(calc.FP, 3)}</b></span>
                <span>V<sub>carga</sub> = <b>{fmt(calc.V_load / 1000, 3)} kV</b></span>
                <span>η = <b>{fmt(calc.eta)}%</b></span>
              </div>
            </div>
          </main>

          {/* ── RIGHT: Results ── */}
          <aside className="panel" style={{ minHeight: 0 }}>
            <div className="panel__head">Resultados Calculados</div>
            <div className="panel__body scroll-y" style={{ height: 'calc(100% - 38px)', overflow: 'auto' }}>

              <Section title="Correntes e Potências">
                <Result label="Corrente de linha" value={`${fmt(calc.I)} A`} />
                <Result label="Potência aparente" value={`${fmt(calc.S / 1000)} kVA`} />
                <Result label="Fator de potência" value={`${fmt(calc.FP, 3)} (${fmt(calc.phi, 1)}°)`} highlight={calc.FP < 0.92 && calc.S > 0} />
              </Section>

              <Section title="Tensão e Perdas">
                <Result label="Tensão na fonte"  value={`${params.v1_tensao} kV`} />
                <Result label="Queda de tensão"  value={`${fmt(calc.V_drop)} V  (${fmt(calc.vd_pct)}%)`} highlight={calc.vd_pct > 5} />
                <Result label="Tensão na carga"  value={`${fmt(calc.V_load / 1000, 3)} kV`} />
                <Result label="Perdas na linha"  value={`${fmt(calc.Ploss / 1000, 2)} kW`} />
                <Result label="Rendimento"       value={`${fmt(calc.eta)}%`} />
              </Section>

              <Section title="Carregamento">
                <Indicator label={`Q1  (${params.q1_inominal} A)`}  pct={calc.q_pct} />
                <Indicator label={`TC1 (${params.tc1_primario} A)`} pct={calc.tc_pct} />
              </Section>

            </div>
          </aside>

          {/* ── NETLIST ── */}
          <div className="panel">
            <div className="panel__head">Netlist (gerada automaticamente)</div>
            <pre style={{ padding: 12, fontSize: 11, lineHeight: 1.65, color: 'var(--c-text)', overflow: 'auto', height: 'calc(100% - 38px)', margin: 0 }}>
              {netlist}
            </pre>
          </div>

          {/* ── VALIDATION ── */}
          <div className="panel">
            <div className="panel__head">Mensagens / Validação</div>
            <div className="panel__body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
                <span><b style={{ color: '#dc2626' }}>{errCount}</b> Erros</span>
                <span><b style={{ color: '#d97706' }}>{warnCount}</b> Avisos</span>
                <span><b style={{ color: '#1d4ed8' }}>{infoCount}</b> Infos</span>
              </div>
              {msgs.map((m, i) => <MsgItem key={i} sev={m.sev} text={m.text} />)}
            </div>
          </div>

          {/* ── PARTS LIST ── */}
          <div className="panel">
            <div className="panel__head">Lista de Componentes</div>
            <table className="tbl">
              <thead><tr><th>ID</th><th>Tipo</th><th>Fases</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>
                {parts.map(row => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td>
                    <td><span className={`badge ${row[5] === 'OK' ? 'badge-green' : row[5] === 'Erro' ? 'badge-red' : 'badge-yellow'}`}>{row[5]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── UNIFILAR ── */}
          <div className="panel">
            <div className="panel__head">Diagrama Unifilar</div>
            <MiniSingleLine />
          </div>

          {/* ── STATUS ── */}
          <div className="panel">
            <div className="panel__head">Status do Editor</div>
            <div className="panel__body">
              <Info k="Tensão nominal"   v={`${params.v1_tensao} kV`} />
              <Info k="Componentes"      v="7" />
              <Info k="Corrente de linha" v={`${fmt(calc.I)} A`} />
              <Info k="Erros"            v={`${errCount}`} />
              <div className={`result-panel ${errCount > 0 ? 'result-panel--warning' : warnCount > 0 ? 'result-panel--warning' : 'result-panel--success'}`}
                style={{ marginTop: 16, padding: 12, fontWeight: 800 }}>
                {errCount > 0 ? `${errCount} erro(s) detectado(s)` : warnCount > 0 ? `${warnCount} aviso(s)` : 'Projeto válido'}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}

/* ── Circuit SVG with dynamic labels ── */

function CircuitSvg({ p, c }) {
  const wire    = { strokeWidth: 3, fill: 'none' }
  const overload = c.q_pct > 100
  const warn     = c.q_pct > 80
  const busColor = overload ? '#ef4444' : warn ? '#f97316' : null
  const busA = busColor || '#b45309'
  const busB = busColor || '#16a34a'
  const busC = busColor || '#dc2626'
  const busN = '#1d4ed8'
  const fpColor = !isNaN(c.FP) && c.FP < 0.92 && c.S > 0 ? '#dc2626' : '#16a34a'

  return (
    <svg viewBox="0 0 980 520" style={{ width: '100%', height: '100%' }}>
      {/* Phase labels */}
      <text x="135" y="110" fill={busA} fontSize="20">A</text>
      <text x="135" y="160" fill={busB} fontSize="20">B</text>
      <text x="135" y="210" fill={busC} fontSize="20">C</text>
      <text x="135" y="405" fill={busN} fontSize="20">N</text>

      {/* Bus wires — color shifts with overload */}
      <path d="M90 120 H800 V205" stroke={busA} {...wire} />
      <path d="M90 170 H840"      stroke={busB} {...wire} />
      <path d="M90 220 H800"      stroke={busC} {...wire} />
      <path d="M90 410 H800 V260" stroke={busN} {...wire} />

      {/* Calculated current label on bus */}
      <rect x="390" y="90" width="140" height="20" rx="3" fill="var(--c-surface)" opacity=".85" />
      <text x="460" y="105" textAnchor="middle" fontSize="12" fill={busColor || '#334155'} fontWeight="700">
        I = {fmt(c.I)} A
      </text>

      {/* Source V1 */}
      <circle cx="70" cy="245" r="28" fill="#fff" stroke="#111827" strokeWidth="2" />
      <text x="70" y="251" textAnchor="middle" fontSize="22">~</text>
      <text x="18" y="286" fontSize="10" fill="#64748b">{p.v1_tensao} kV</text>
      <text x="18" y="298" fontSize="10" fill="#64748b">{p.v1_freq} Hz</text>

      {/* Breaker Q1 — dynamic label */}
      <line x1="210" y1="120" x2="250" y2="120" stroke="#111827" strokeWidth="3" />
      <circle cx="205" cy="120" r="5" fill="#111827" />
      <circle cx="255" cy="120" r="5" fill="#111827" />
      <text x="212" y="86">Q1</text>
      <text x="196" y="102" fontSize="11">{p.q1_inominal} A</text>

      {/* TC1 — dynamic label */}
      <rect x="350" y="100" width="48" height="70" rx="6" fill="#fff" stroke="#111827" strokeWidth="2" />
      <text x="364" y="92">TC1</text>
      <text x="340" y="186" fontSize="10">{p.tc1_primario}/{p.tc1_secundario} A</text>
      <path d="M360 120 q15 -20 30 0 q-15 20 -30 0" fill="none" stroke="#111827" />

      {/* R1 — dynamic label */}
      <path d="M512 100 l18 35 l18 -35 M512 135 h36" stroke="#111827" strokeWidth="2" fill="none" />
      <text x="515" y="88">R1</text>
      <text x="510" y="160" fontSize="12">{p.r1_valor} Ω</text>

      {/* Medidor M1 */}
      <circle cx="490" cy="230" r="28" fill="#fff" stroke="#1d4ed8" strokeWidth="2" />
      <text x="490" y="238" textAnchor="middle" fill="#1d4ed8" fontSize="20">M</text>

      {/* Wattmeter W */}
      <circle cx="410" cy="335" r="26" fill="#fff" stroke="#111827" strokeWidth="2" />
      <text x="410" y="343" textAnchor="middle" fontSize="22">W</text>

      {/* Load L1 — dynamic labels */}
      <rect x="800" y="205" width="70" height="85" fill="#fff" stroke="#111827" strokeWidth="2" />
      <path d="M820 215 v65 m25 -65 v65 m-25 -42 h25" stroke="#111827" />
      <text x="882" y="222" fontSize="11">Carga RLC</text>
      <text x="882" y="240" fontSize="12">{p.l1_p} kW</text>
      <text x="882" y="256" fontSize="12">{p.l1_q} kvar</text>
      <text x="882" y="272" fontSize="12" fill={fpColor}>FP {fmt(c.FP, 3)}</text>

      {/* Neutral tie lines */}
      <line x1="320" y1="120" x2="320" y2="410" stroke="#111827" strokeWidth="2" />
      <line x1="420" y1="170" x2="420" y2="410" stroke="#111827" strokeWidth="2" />
      <line x1="550" y1="220" x2="550" y2="410" stroke="#111827" strokeWidth="2" />

      {/* Ground */}
      <text x="320" y="440" textAnchor="middle">Terra</text>
      <line x1="300" y1="425" x2="340" y2="425" stroke="#111827" strokeWidth="2" />
      <line x1="308" y1="433" x2="332" y2="433" stroke="#111827" strokeWidth="2" />
    </svg>
  )
}

/* ── Sub-components ── */

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', textTransform: 'uppercase', letterSpacing: '.3px', paddingBottom: 5, marginBottom: 8, borderBottom: '1px solid var(--c-border)' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function PField({ label, unit, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
      <span style={{ fontSize: 11, color: 'var(--c-text-muted)', flex: 1, minWidth: 0 }}>{label}</span>
      <input className="form-input" style={{ width: 70, height: 26, fontSize: 12, textAlign: 'right' }}
        value={value} onChange={e => onChange(e.target.value)} />
      <span style={{ fontSize: 11, color: 'var(--c-text-light)', width: 28, flexShrink: 0 }}>{unit}</span>
    </div>
  )
}

function PSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
      <span style={{ fontSize: 11, color: 'var(--c-text-muted)', flex: 1 }}>{label}</span>
      <select className="form-input" style={{ width: 70, height: 26, fontSize: 12 }} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <span style={{ width: 28 }} />
    </div>
  )
}

function Result({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
      <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 12, color: highlight ? 'var(--c-danger)' : 'var(--c-text)' }}>{value}</span>
    </div>
  )
}

function Indicator({ label, pct }) {
  const safe  = !isNaN(pct) && isFinite(pct)
  const color = !safe ? '#94a3b8' : pct > 100 ? '#ef4444' : pct > 80 ? '#f97316' : '#22c55e'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{safe ? `${fmt(pct, 1)}%` : '—'}</span>
      </div>
      <div style={{ height: 5, background: 'var(--c-border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${safe ? Math.min(pct, 100) : 0}%`, height: '100%', background: color, transition: 'width .3s, background .3s' }} />
      </div>
    </div>
  )
}

function MsgItem({ sev, text }) {
  const s = sev === 'Erro'
    ? { background: '#fee2e2', color: '#991b1b', borderLeft: '3px solid #ef4444' }
    : sev === 'Aviso'
    ? { background: '#fef9c3', color: '#713f12', borderLeft: '3px solid #f59e0b' }
    : sev === 'OK'
    ? { background: '#dcfce7', color: '#166534', borderLeft: '3px solid #22c55e' }
    : { background: '#dbeafe', color: '#1e40af', borderLeft: '3px solid #3b82f6' }
  return (
    <div style={{ ...s, padding: '7px 10px', borderRadius: 6, marginBottom: 6, fontSize: 12 }}>
      <b>{sev}:</b> {text}
    </div>
  )
}

function MiniSingleLine() {
  return (
    <svg viewBox="0 0 260 210" style={{ width: '100%', height: 'calc(100% - 38px)' }}>
      <line x1="130" y1="20" x2="130" y2="175" stroke="#111827" strokeWidth="2" />
      <circle cx="130" cy="25" r="13" fill="#fff" stroke="#111827" /><text x="130" y="29" textAnchor="middle" fontSize="10">V1</text>
      <rect x="118" y="60" width="24" height="18" fill="#fff" stroke="#111827" /><text x="152" y="74" fontSize="11">Q1</text>
      <path d="M115 100 q15 -18 30 0 q-15 18 -30 0" fill="none" stroke="#111827" /><text x="152" y="105" fontSize="11">TC1</text>
      <line x1="55" y1="150" x2="205" y2="150" stroke="#111827" strokeWidth="2" />
      <circle cx="90" cy="150" r="18" fill="#fff" stroke="#1d4ed8" /><text x="90" y="156" textAnchor="middle" fill="#1d4ed8">M</text>
      <circle cx="145" cy="150" r="18" fill="#fff" stroke="#111827" /><text x="145" y="156" textAnchor="middle">W</text>
      <circle cx="190" cy="150" r="18" fill="#fff" stroke="#111827" /><text x="190" y="156" textAnchor="middle">L</text>
      <text x="25" y="192" fill="#1d4ed8">N</text><line x1="45" y1="185" x2="210" y2="185" stroke="#1d4ed8" strokeDasharray="5 4" />
    </svg>
  )
}

function Info({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
      <span style={{ color: '#64748b' }}>{k}</span><b>{v}</b>
    </div>
  )
}
