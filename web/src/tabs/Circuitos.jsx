import { useState, useMemo } from 'react'
import Simulacao from './Simulacao'

/* ─── helpers ────────────────────────────────────────────────────────────── */

function parseNum(str) {
  if (str === '' || str == null) return NaN
  return parseFloat(String(str).replace(',', '.'))
}
function fmt(n, d = 2) {
  if (isNaN(n) || !isFinite(n)) return '—'
  return n.toFixed(d).replace('.', ',')
}
function fmtSgn(n, d = 2) {
  if (isNaN(n) || !isFinite(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(d).replace('.', ',') + '%'
}
function errClr(pct) {
  const a = Math.abs(pct)
  return a < 1 ? '#16a34a' : a < 5 ? '#d97706' : '#dc2626'
}

/* ─── CC constants & calc ────────────────────────────────────────────────── */

const CC_PRESETS = [
  { label: 'R pequena 10 Ω',  p: { V: '12', RL: '10',    rA: '0,1',  RV: '10000' } },
  { label: 'R média 100 Ω',   p: { V: '12', RL: '100',   rA: '0,1',  RV: '10000' } },
  { label: 'R grande 10 kΩ',  p: { V: '12', RL: '10000', rA: '0,1',  RV: '10000' } },
  { label: 'rA alto 5 Ω',     p: { V: '12', RL: '100',   rA: '5',    RV: '10000' } },
  { label: 'RV baixo 500 Ω',  p: { V: '12', RL: '100',   rA: '0,1',  RV: '500'   } },
]
const DEFAULT_CC = { V: '12', RL: '100', rA: '0,1', RV: '10000' }

function calcCC(p) {
  const V = parseNum(p.V), RL = parseNum(p.RL)
  const rA = parseNum(p.rA), RV = parseNum(p.RV)
  if ([V, RL, rA, RV].some(isNaN) || RL <= 0 || RV <= 0) return null

  const I_true = V / RL
  const V_true = V

  // Montagem Curta: source → rA → RL → back; V across source terminals (outside)
  const I_mc = V / (RL + rA)
  const V_mc = V
  const R_mc = V_mc / I_mc       // = RL + rA
  const eI_mc = (I_mc / I_true - 1) * 100
  const eR_mc = (R_mc / RL - 1) * 100   // ≈ +rA/RL

  // Montagem Longa: source → rA → (RL ∥ RV) → back; V across RL
  const Rpar = RL * RV / (RL + RV)
  const I_ml = V / (rA + Rpar)
  const V_ml = I_ml * Rpar
  const I_RV = V_ml / RV
  const R_ml = V_ml / I_ml       // = Rpar < RL
  const eI_ml = (I_ml / I_true - 1) * 100
  const eV_ml = (V_ml / V_true - 1) * 100
  const eR_ml = (R_ml / RL - 1) * 100   // ≈ −RL/RV

  const crossover = Math.sqrt(rA * RV)
  const mc_better = Math.abs(eR_mc) <= Math.abs(eR_ml)

  return { I_true, V_true,
    I_mc, V_mc, R_mc, eI_mc, eR_mc,
    I_ml, V_ml, R_ml, I_RV, eI_ml, eV_ml, eR_ml,
    crossover, mc_better, Rpar }
}

/* ─── CA Monofásico constants & calc ─────────────────────────────────────── */

const LOAD_TYPES = [
  { id: 'R',   label: 'R — Resistiva',             color: '#1d4ed8', fields: ['R'] },
  { id: 'L',   label: 'L — Indutiva',              color: '#dc2626', fields: ['L'] },
  { id: 'C',   label: 'C — Capacitiva',            color: '#16a34a', fields: ['C'] },
  { id: 'RL',  label: 'RL — Resist.-Indutiva',     color: '#9333ea', fields: ['R', 'L'] },
  { id: 'RC',  label: 'RC — Resist.-Capacitiva',   color: '#0284c7', fields: ['R', 'C'] },
  { id: 'RLC', label: 'RLC — Série',               color: '#d97706', fields: ['R', 'L', 'C'] },
  { id: 'M',   label: 'M — Motor (RL aprox.)',     color: '#64748b', fields: ['R', 'L'] },
]
const DEFAULT_MONO = { Vs: '127', f: '60', loadType: 'RL', R: '10', L: '0,05', C: '0,001' }

function calcMono(p) {
  const Vs = parseNum(p.Vs) || 127
  const f  = parseNum(p.f)  || 60
  const R  = parseNum(p.R)  || 0
  const L  = parseNum(p.L)  || 0
  const C  = parseNum(p.C)  || 0
  const t  = p.loadType

  const hasR = ['R', 'RL', 'RC', 'RLC', 'M'].includes(t)
  const hasL = ['L', 'RL', 'RLC', 'M'].includes(t)
  const hasC = ['C', 'RC', 'RLC'].includes(t)

  const Re  = hasR ? R : 0
  const XL  = hasL ? 2 * Math.PI * f * L : 0
  const XC  = hasC && C > 0 ? 1 / (2 * Math.PI * f * C) : 0
  const X   = XL - XC
  const Z   = Math.sqrt(Re ** 2 + X ** 2) || 1e-10

  const I   = Vs / Z
  const VR  = I * Re
  const VLv = I * XL
  const VCv = I * XC
  const FP  = Re / Z
  const phi = Math.atan2(X, Re)
  const P   = Vs * I * Math.abs(FP)
  const Q   = Vs * I * Math.abs(Math.sin(phi))
  const S   = Vs * I
  const nat = X > 0.001 ? 'Indutivo' : X < -0.001 ? 'Capacitivo' : 'Resistivo puro'

  return { Vs, f, R: Re, XL, XC, X, Z, I, VR, VL: VLv, VC: VCv, FP, phi, P, Q, S, nat, hasR, hasL, hasC }
}

/* ─── CA Trifásico constants & calc ──────────────────────────────────────── */

const TRI_DEFAULT = {
  v1_tensao: '13,8', v1_freq: '60', v1_ligacao: 'Y',
  q1_inominal: '630', tc1_primario: '300', tc1_secundario: '5',
  r1_valor: '0,5', l1_p: '1000', l1_q: '400',
}
const TRI_PRESETS = [
  { label: 'Subestação 13,8 kV',      p: { ...TRI_DEFAULT } },
  { label: 'Baixa Tensão 380 V',      p: { v1_tensao: '0,38', v1_freq: '60', v1_ligacao: 'Y', q1_inominal: '400', tc1_primario: '400', tc1_secundario: '5', r1_valor: '0,1', l1_p: '200', l1_q: '100' } },
  { label: 'Sobrecarga',              p: { ...TRI_DEFAULT, l1_p: '1800', l1_q: '600' } },
  { label: 'Baixo Fator de Potência', p: { ...TRI_DEFAULT, l1_p: '500',  l1_q: '800' } },
]

function calcTri(p) {
  const V = parseNum(p.v1_tensao) * 1000
  const P = parseNum(p.l1_p) * 1000
  const Q = parseNum(p.l1_q) * 1000
  const R = parseNum(p.r1_valor)
  const I_q  = parseNum(p.q1_inominal)
  const I_tc = parseNum(p.tc1_primario)
  if (!V || V === 0) return { V:0,S:0,FP:1,phi:0,I:0,V_drop:0,V_load:0,Ploss:0,eta:100,q_pct:0,tc_pct:0,vd_pct:0 }
  const S      = Math.sqrt(P**2 + Q**2)
  const FP     = S > 0 ? P/S : 1
  const phi    = Math.atan2(Q,P) * 180 / Math.PI
  const I      = S / (Math.sqrt(3) * V)
  const V_drop = Math.sqrt(3) * R * I
  const V_load = V - V_drop
  const Ploss  = 3 * R * I**2
  const eta    = P > 0 ? (P/(P+Ploss))*100 : 100
  const q_pct  = (I/I_q)*100
  const tc_pct = (I/I_tc)*100
  const vd_pct = (V_drop/V)*100
  return { V,S,FP,phi,I,V_drop,V_load,Ploss,eta,q_pct,tc_pct,vd_pct }
}

function validateTri(p, c) {
  const msgs = []
  if (c.q_pct > 100)   msgs.push({ sev:'Erro',  text:`Q1: ${fmt(c.I)} A excede ${p.q1_inominal} A — disjuntor opera.` })
  else if(c.q_pct>80)  msgs.push({ sev:'Aviso', text:`Q1: Carregamento ${fmt(c.q_pct)}% — verifique margem.` })
  if (c.tc_pct > 100)  msgs.push({ sev:'Erro',  text:`TC1: ${fmt(c.I)} A supera ${p.tc1_primario} A — saturação.` })
  else if(c.tc_pct>90) msgs.push({ sev:'Aviso', text:`TC1: ${fmt(c.tc_pct)}% — próximo da saturação.` })
  if (c.FP < 0.92 && c.S > 0) msgs.push({ sev:'Aviso', text:`FP ${fmt(c.FP,3)} < 0,92 (ANEEL). Instale banco de capacitores.` })
  if (c.vd_pct > 5)    msgs.push({ sev:'Aviso', text:`Queda ${fmt(c.vd_pct)}% acima de 5%. Verifique bitola.` })
  const Rv = parseNum(p.r1_valor)
  if (!isNaN(Rv) && Rv > 0 && Rv < 0.05) msgs.push({ sev:'Info', text:`R1 = ${p.r1_valor} Ω — comportamento próximo do ideal.` })
  if (msgs.length === 0) msgs.push({ sev:'OK', text:'Circuito válido — todos os parâmetros dentro dos limites.' })
  return msgs
}

function genNetlist(p, c) {
  return `* Circuito Trifásico — SMQE\nFONTE_CA  V1  3  ${parseNum(p.v1_tensao)*1000}  ${p.v1_freq}  LIG:${p.v1_ligacao}\nDISJUNTOR Q1  3  ${p.q1_inominal} A\nTC        TC1 3  ${p.tc1_primario}/${p.tc1_secundario} A\nRESISTOR  R1  3  ${p.r1_valor} Ω\nCARGA_RLC L1  3  ${p.l1_p} kW  ${p.l1_q} kvar\n\n* I_linha = ${fmt(c.I)} A\n* FP      = ${fmt(c.FP,4)}  (φ=${fmt(c.phi,1)}°)\n* V_carga = ${fmt(c.V_load/1000,3)} kV\n* η       = ${fmt(c.eta)}%\nFIM`
}

/* ─── Shared UI primitives ───────────────────────────────────────────────── */

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
  const ok = !isNaN(pct) && isFinite(pct)
  const clr = !ok ? '#94a3b8' : pct > 100 ? '#ef4444' : pct > 80 ? '#f97316' : '#22c55e'
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: clr }}>{ok ? `${fmt(pct,1)}%` : '—'}</span>
      </div>
      <div style={{ height: 5, background: 'var(--c-border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${ok ? Math.min(pct,100) : 0}%`, height: '100%', background: clr, transition: 'width .3s' }} />
      </div>
    </div>
  )
}

function MsgItem({ sev, text }) {
  const st = sev==='Erro'  ? { background:'#fee2e2', color:'#991b1b', borderLeft:'3px solid #ef4444' }
           : sev==='Aviso' ? { background:'#fef9c3', color:'#713f12', borderLeft:'3px solid #f59e0b' }
           : sev==='OK'    ? { background:'#dcfce7', color:'#166534', borderLeft:'3px solid #22c55e' }
           :                 { background:'#dbeafe', color:'#1e40af', borderLeft:'3px solid #3b82f6' }
  return (
    <div style={{ ...st, padding:'7px 10px', borderRadius:6, marginBottom:6, fontSize:12 }}>
      <b>{sev}:</b> {text}
    </div>
  )
}

/* ─── SubCC ──────────────────────────────────────────────────────────────── */

function SubCC() {
  const [p, setP] = useState(DEFAULT_CC)
  const c = useMemo(() => calcCC(p), [p])
  const sp = (k, v) => setP(prev => ({ ...prev, [k]: v }))
  const RL = parseNum(p.RL)

  return (
    <div style={{ display:'grid', gridTemplateColumns:'210px 1fr 250px', gap:12, padding:12, flex:'1 1 auto', minHeight:0, overflow:'auto' }}>

      {/* Left: params */}
      <div className="panel" style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
        <div className="panel__head">Parâmetros</div>
        <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--c-text-muted)', marginBottom:6 }}>CENÁRIO RÁPIDO</div>
            {CC_PRESETS.map(pr => (
              <button key={pr.label} className="btn btn-ghost btn-sm" style={{ width:'100%', textAlign:'left', marginBottom:3 }}
                onClick={() => setP(pr.p)}>{pr.label}</button>
            ))}
            <button className="btn btn-ghost btn-sm" style={{ width:'100%', textAlign:'left', marginBottom:3 }}
              onClick={() => setP(DEFAULT_CC)}>⟳ Resetar</button>
          </div>

          <Section title="Fonte CC">
            <PField label="Tensão V" unit="V" value={p.V} onChange={v => sp('V', v)} />
          </Section>
          <Section title="Carga">
            <PField label="Resistência R_L" unit="Ω" value={p.RL} onChange={v => sp('RL', v)} />
          </Section>
          <Section title="Amperímetro">
            <PField label="R. interna r_A" unit="Ω" value={p.rA} onChange={v => sp('rA', v)} />
            {c && <div style={{ fontSize:11, color:'var(--c-text-muted)' }}>r_A/R_L = {fmt(parseNum(p.rA)/RL*100,3)}%</div>}
          </Section>
          <Section title="Voltímetro">
            <PField label="R. interna R_V" unit="Ω" value={p.RV} onChange={v => sp('RV', v)} />
            {c && <div style={{ fontSize:11, color:'var(--c-text-muted)' }}>R_L/R_V = {fmt(RL/parseNum(p.RV)*100,3)}%</div>}
          </Section>
          {c && (
            <Section title="Ponto de cruzamento">
              <div style={{ fontSize:12 }}>R_L★ = √(r_A × R_V) = <b>{fmt(c.crossover,2)} Ω</b></div>
              <div style={{ marginTop:6, fontSize:12, fontWeight:700, color: c.mc_better ? '#1d4ed8' : '#16a34a' }}>
                {RL > c.crossover ? 'R_L > R_L★ → Montagem Curta' : 'R_L < R_L★ → Montagem Longa'}
              </div>
            </Section>
          )}
        </div>
      </div>

      {/* Center: diagram + table */}
      <div style={{ display:'flex', flexDirection:'column', gap:12, minHeight:0 }}>
        <div className="panel" style={{ flexShrink:0 }}>
          <div className="panel__head">Posição dos Instrumentos — Efeito no Circuito</div>
          {c ? <CCDual c={c} p={p} /> : <div className="panel__body" style={{ color:'var(--c-text-muted)' }}>Preencha os parâmetros.</div>}
        </div>

        <div className="panel" style={{ flex:1 }}>
          <div className="panel__head">Comparação dos Métodos de Medição</div>
          {c && (
            <div style={{ overflow:'auto', height:'calc(100% - 38px)' }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Grandeza</th>
                    <th>Valor Real</th>
                    <th>M. Curta lê</th>
                    <th>Erro Curta</th>
                    <th>M. Longa lê</th>
                    <th>Erro Longa</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Corrente I (A)</td>
                    <td>{fmt(c.I_true,5)}</td>
                    <td>{fmt(c.I_mc,5)}</td>
                    <td style={{ fontWeight:700, color:errClr(c.eI_mc) }}>{fmtSgn(c.eI_mc)}</td>
                    <td>{fmt(c.I_ml,5)}</td>
                    <td style={{ fontWeight:700, color:errClr(c.eI_ml) }}>{fmtSgn(c.eI_ml)}</td>
                  </tr>
                  <tr>
                    <td>Tensão V (V)</td>
                    <td>{fmt(c.V_true,3)}</td>
                    <td>{fmt(c.V_mc,3)}</td>
                    <td style={{ fontWeight:700, color:'#16a34a' }}>+0,00%</td>
                    <td>{fmt(c.V_ml,3)}</td>
                    <td style={{ fontWeight:700, color:errClr(c.eV_ml) }}>{fmtSgn(c.eV_ml)}</td>
                  </tr>
                  <tr style={{ background:'var(--c-surface-2,#f8fafc)' }}>
                    <td><b>Resistência R (Ω)</b></td>
                    <td><b>{fmt(RL,3)}</b></td>
                    <td>{fmt(c.R_mc,4)}</td>
                    <td style={{ fontWeight:700, color:errClr(c.eR_mc) }}>{fmtSgn(c.eR_mc)}</td>
                    <td>{fmt(c.R_ml,4)}</td>
                    <td style={{ fontWeight:700, color:errClr(c.eR_ml) }}>{fmtSgn(c.eR_ml)}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ padding:'10px 12px', fontSize:12, lineHeight:1.7, color:'var(--c-text-muted)', borderTop:'1px solid var(--c-border)' }}>
                <b style={{ color:'var(--c-text)' }}>Montagem Curta</b> (V externo): A mede corrente total pelo circuito série (r_A + R_L) → sobrestima R em <b>+r_A</b>. Ideal para R_L <i>grande</i>.<br/>
                <b style={{ color:'var(--c-text)' }}>Montagem Longa</b> (V interno): A mede corrente total incluindo a do voltímetro → subestima R em <b>−R_L/R_V</b>. Ideal para R_L <i>pequena</i>.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: analysis */}
      <div className="panel" style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
        <div className="panel__head">Análise de Erros</div>
        <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>
          {c && <>
            <Section title="Valores reais (instrumentos ideais)">
              <Result label="I verdadeiro" value={`${fmt(c.I_true,5)} A`} />
              <Result label="V verdadeiro" value={`${fmt(c.V_true,3)} V`} />
              <Result label="R verdadeiro" value={`${fmt(RL,3)} Ω`} />
            </Section>
            <Section title="Efeito do amperímetro (r_A)">
              <div style={{ fontSize:11, lineHeight:1.7, color:'var(--c-text-muted)' }}>
                r_A = {p.rA} Ω em série com R_L.<br/>
                Queda em r_A: {fmt(c.I_mc * parseNum(p.rA),4)} V<br/>
                Erro em I (Curta): {fmtSgn(c.eI_mc)}<br/>
                Erro em R (Curta): {fmtSgn(c.eR_mc)}
              </div>
            </Section>
            <Section title="Efeito do voltímetro (R_V)">
              <div style={{ fontSize:11, lineHeight:1.7, color:'var(--c-text-muted)' }}>
                R_V = {p.RV} Ω em paralelo com R_L.<br/>
                R_eq = {fmt(c.Rpar,3)} Ω (R_L ∥ R_V)<br/>
                Corrente desviada: {fmt(c.I_RV*1000,4)} mA<br/>
                Erro em R (Longa): {fmtSgn(c.eR_ml)}
              </div>
            </Section>
            <Section title="Recomendação">
              <div style={{ background: c.mc_better?'#dbeafe':'#dcfce7', border:`1px solid ${c.mc_better?'#93c5fd':'#86efac'}`, borderRadius:6, padding:10, fontSize:12, lineHeight:1.7 }}>
                <b>Use {c.mc_better ? 'Montagem Curta' : 'Montagem Longa'}</b><br/>
                R_L = {p.RL} Ω {RL > c.crossover ? '>' : '<'} {fmt(c.crossover,2)} Ω (R_L★)<br/>
                Erro em R: <b>{fmtSgn(c.mc_better ? c.eR_mc : c.eR_ml)}</b> vs {fmtSgn(c.mc_better ? c.eR_ml : c.eR_mc)}
              </div>
            </Section>
          </>}
        </div>
      </div>
    </div>
  )
}

/* ─── CC dual-circuit SVG ────────────────────────────────────────────────── */

function CCDual({ c, p }) {
  return (
    <svg viewBox="0 0 760 195" style={{ width:'100%', height:185 }}>
      {/* Titles */}
      <text x="170" y="13" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d4ed8">Montagem Curta — Voltímetro Externo</text>
      <text x="590" y="13" textAnchor="middle" fontSize="11" fontWeight="700" fill="#16a34a">Montagem Longa — Voltímetro Interno</text>

      {/* ── LEFT: source → [rA] → [RL] → back; V across source ── */}
      <circle cx="40" cy="105" r="20" fill="var(--c-surface)" stroke="#334155" strokeWidth="2"/>
      <text x="40" y="101" textAnchor="middle" fontSize="10" fontWeight="700">+</text>
      <text x="40" y="112" textAnchor="middle" fontSize="9">{p.V}V</text>
      {/* wires */}
      <line x1="40" y1="85"  x2="40"  y2="65"  stroke="#334155" strokeWidth="2"/>
      <line x1="40" y1="65"  x2="300" y2="65"  stroke="#334155" strokeWidth="2"/>
      <line x1="300" y1="65" x2="300" y2="145" stroke="#334155" strokeWidth="2"/>
      <line x1="40"  y1="125" x2="40"  y2="145" stroke="#334155" strokeWidth="2"/>
      <line x1="40"  y1="145" x2="300" y2="145" stroke="#334155" strokeWidth="2"/>
      {/* ammeter */}
      <circle cx="110" cy="65" r="14" fill="var(--c-surface)" stroke="#1d4ed8" strokeWidth="2"/>
      <text x="110" y="69" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1d4ed8">A</text>
      {/* RL */}
      <rect x="175" y="53" width="70" height="24" fill="var(--c-surface)" stroke="#334155" strokeWidth="2" rx="3"/>
      <text x="210" y="69" textAnchor="middle" fontSize="11" fontWeight="700">R_L</text>
      {/* voltmeter OUTSIDE — dashed above */}
      <line x1="40"  y1="65" x2="40"  y2="38" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="4 2"/>
      <line x1="40"  y1="38" x2="300" y2="38" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="4 2"/>
      <line x1="300" y1="38" x2="300" y2="65" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="4 2"/>
      <circle cx="170" cy="38" r="13" fill="var(--c-surface)" stroke="#7c3aed" strokeWidth="2"/>
      <text x="170" y="42" textAnchor="middle" fontSize="11" fontWeight="800" fill="#7c3aed">V</text>
      {/* readings */}
      <text x="110" y="91"  textAnchor="middle" fontSize="9" fill={errClr(c.eI_mc)}>I={fmt(c.I_mc,4)} A ({fmtSgn(c.eI_mc)})</text>
      <text x="170" y="23"  textAnchor="middle" fontSize="9" fill="#16a34a">V={fmt(c.V_mc,2)} V (0,00%)</text>
      <text x="170" y="170" textAnchor="middle" fontSize="10" fontWeight="700" fill={errClr(c.eR_mc)}>R_calc = {fmt(c.R_mc,3)} Ω  ({fmtSgn(c.eR_mc)})</text>

      {/* ── RIGHT: source → [rA] → (RL ∥ V) → back ── */}
      <circle cx="460" cy="105" r="20" fill="var(--c-surface)" stroke="#334155" strokeWidth="2"/>
      <text x="460" y="101" textAnchor="middle" fontSize="10" fontWeight="700">+</text>
      <text x="460" y="112" textAnchor="middle" fontSize="9">{p.V}V</text>
      {/* wires */}
      <line x1="460" y1="85"  x2="460" y2="65"  stroke="#334155" strokeWidth="2"/>
      <line x1="460" y1="65"  x2="720" y2="65"  stroke="#334155" strokeWidth="2"/>
      <line x1="720" y1="65"  x2="720" y2="145" stroke="#334155" strokeWidth="2"/>
      <line x1="460" y1="125" x2="460" y2="145" stroke="#334155" strokeWidth="2"/>
      <line x1="460" y1="145" x2="720" y2="145" stroke="#334155" strokeWidth="2"/>
      {/* ammeter */}
      <circle cx="530" cy="65" r="14" fill="var(--c-surface)" stroke="#1d4ed8" strokeWidth="2"/>
      <text x="530" y="69" textAnchor="middle" fontSize="11" fontWeight="800" fill="#1d4ed8">A</text>
      {/* RL */}
      <rect x="610" y="53" width="70" height="24" fill="var(--c-surface)" stroke="#334155" strokeWidth="2" rx="3"/>
      <text x="645" y="69" textAnchor="middle" fontSize="11" fontWeight="700">R_L</text>
      {/* voltmeter INSIDE — dashed, parallel with RL */}
      <line x1="610" y1="65"  x2="610" y2="115" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="4 2"/>
      <line x1="610" y1="115" x2="680" y2="115" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="4 2"/>
      <line x1="680" y1="65"  x2="680" y2="115" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="4 2"/>
      <circle cx="645" cy="115" r="13" fill="var(--c-surface)" stroke="#7c3aed" strokeWidth="2"/>
      <text x="645" y="119" textAnchor="middle" fontSize="11" fontWeight="800" fill="#7c3aed">V</text>
      {/* readings */}
      <text x="530" y="91"  textAnchor="middle" fontSize="9" fill={errClr(c.eI_ml)}>I={fmt(c.I_ml,4)} A ({fmtSgn(c.eI_ml)})</text>
      <text x="645" y="140" textAnchor="middle" fontSize="9" fill={errClr(c.eV_ml)}>V={fmt(c.V_ml,2)} V ({fmtSgn(c.eV_ml)})</text>
      <text x="590" y="170" textAnchor="middle" fontSize="10" fontWeight="700" fill={errClr(c.eR_ml)}>R_calc = {fmt(c.R_ml,3)} Ω  ({fmtSgn(c.eR_ml)})</text>
    </svg>
  )
}

/* ─── SubCAMono ──────────────────────────────────────────────────────────── */

function SubCAMono() {
  const [p, setP] = useState(DEFAULT_MONO)
  const c = useMemo(() => calcMono(p), [p])
  const sp = (k, v) => setP(prev => ({ ...prev, [k]: v }))
  const lt = LOAD_TYPES.find(l => l.id === p.loadType)

  return (
    <div style={{ display:'grid', gridTemplateColumns:'210px 1fr 240px', gap:12, padding:12, flex:'1 1 auto', minHeight:0, overflow:'auto' }}>

      {/* Left: type + params */}
      <div className="panel" style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
        <div className="panel__head">Tipo de Carga</div>
        <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>
          {LOAD_TYPES.map(t => (
            <button key={t.id}
              className="btn btn-sm"
              style={{ width:'100%', textAlign:'left', marginBottom:4,
                background: p.loadType===t.id ? t.color : 'transparent',
                color: p.loadType===t.id ? '#fff' : 'var(--c-text)',
                border: `1px solid ${t.color}`,
              }}
              onClick={() => sp('loadType', t.id)}>{t.label}</button>
          ))}

          <div style={{ marginTop:12 }}>
            <Section title="Fonte CA">
              <PField label="Tensão Vs"  unit="V"  value={p.Vs} onChange={v => sp('Vs',v)} />
              <PField label="Frequência" unit="Hz" value={p.f}  onChange={v => sp('f', v)} />
            </Section>
            <Section title="Carga">
              {lt?.fields.includes('R') && <PField label="Resistência R" unit="Ω" value={p.R} onChange={v => sp('R',v)} />}
              {lt?.fields.includes('L') && <PField label="Indutância L"  unit="H" value={p.L} onChange={v => sp('L',v)} />}
              {lt?.fields.includes('C') && <PField label="Capacitância C" unit="F" value={p.C} onChange={v => sp('C',v)} />}
            </Section>
          </div>
        </div>
      </div>

      {/* Center: circuit + phasor */}
      <div style={{ display:'flex', flexDirection:'column', gap:12, minHeight:0 }}>
        <div className="panel" style={{ flexShrink:0 }}>
          <div className="panel__head">Circuito CA Monofásico — {lt?.label ?? ''}</div>
          <MonoCircuit c={c} lt={lt} />
        </div>
        <div className="panel" style={{ flex:1, minHeight:0 }}>
          <div className="panel__head">Diagrama Fasorial — referência: corrente I</div>
          <MonoPhasor c={c} />
        </div>
      </div>

      {/* Right: results */}
      <div className="panel" style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
        <div className="panel__head">Resultados</div>
        <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>
          <Section title={`Regime: ${c.nat}`}>
            <Result label="Impedância Z"   value={`${fmt(c.Z,3)} Ω`} />
            {c.hasL && <Result label="Reatância XL"  value={`${fmt(c.XL,3)} Ω`} />}
            {c.hasC && <Result label="Reatância XC"  value={`${fmt(c.XC,3)} Ω`} />}
            <Result label="Reatância X"    value={`${fmt(c.X,3)} Ω`} />
          </Section>
          <Section title="Correntes e Tensões">
            <Result label="Corrente I"     value={`${fmt(c.I,4)} A`} />
            {c.hasR && <Result label="Queda VR (R)"  value={`${fmt(c.VR,2)} V`} />}
            {c.hasL && <Result label="Queda VL (L)"  value={`${fmt(c.VL,2)} V`} />}
            {c.hasC && <Result label="Queda VC (C)"  value={`${fmt(c.VC,2)} V`} />}
          </Section>
          <Section title="Potências">
            <Result label="Pot. ativa P"    value={`${fmt(c.P,1)} W`} />
            <Result label="Pot. reativa Q"  value={`${fmt(c.Q,1)} var`} />
            <Result label="Pot. aparente S" value={`${fmt(c.S,1)} VA`} />
            <Result label="Fat. potência FP" value={fmt(c.FP,4)} highlight={c.FP < 0.92 && c.S > 1} />
            <Result label="Ângulo φ"        value={`${fmt(c.phi*180/Math.PI,2)}°`} />
          </Section>
          <Section title="O que cada instrumento lê">
            <div style={{ fontSize:11, lineHeight:1.9, color:'var(--c-text-muted)' }}>
              <b>Amperímetro:</b> {fmt(c.I,4)} A (RMS)<br/>
              <b>Voltímetro:</b>  {fmt(c.Vs,2)} V (RMS)<br/>
              <b>Wattímetro:</b>  {fmt(c.P,1)} W<br/>
              <b>Varmetro:</b>    {fmt(c.Q,1)} var<br/>
              <b>Fasímetro:</b>   φ = {fmt(c.phi*180/Math.PI,2)}° ({c.nat})<br/>
              <b>Cos φ metro:</b> FP = {fmt(c.FP,4)}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

/* ─── MonoCircuit SVG ────────────────────────────────────────────────────── */

function MonoCircuit({ c, lt }) {
  const clr = lt?.color ?? '#334155'
  const { hasR, hasL, hasC } = c
  return (
    <svg viewBox="0 0 480 110" style={{ width:'100%', height:105 }}>
      {/* source */}
      <circle cx="40" cy="60" r="22" fill="var(--c-surface)" stroke="#334155" strokeWidth="2"/>
      <text x="40" y="56" textAnchor="middle" fontSize="14">~</text>
      <text x="40" y="68" textAnchor="middle" fontSize="9">Vs</text>
      {/* top & bottom rails */}
      <line x1="40" y1="38" x2="40"  y2="20"  stroke="#334155" strokeWidth="2"/>
      <line x1="40" y1="20" x2="430" y2="20"  stroke="#334155" strokeWidth="2"/>
      <line x1="430" y1="20" x2="430" y2="100" stroke="#334155" strokeWidth="2"/>
      <line x1="40" y1="82" x2="40"  y2="100" stroke="#334155" strokeWidth="2"/>
      <line x1="40" y1="100" x2="430" y2="100" stroke="#334155" strokeWidth="2"/>
      {/* ammeter */}
      <circle cx="76" cy="20" r="12" fill="var(--c-surface)" stroke="#1d4ed8" strokeWidth="2"/>
      <text x="76" y="24" textAnchor="middle" fontSize="10" fontWeight="800" fill="#1d4ed8">A</text>
      <text x="76" y="41" textAnchor="middle" fontSize="8" fill="#1d4ed8">{fmt(c.I,3)} A</text>
      {/* R */}
      {hasR && <>
        <rect x="110" y="10" width="55" height="20" fill="var(--c-surface)" stroke={clr} strokeWidth="2" rx="2"/>
        <text x="137" y="24" textAnchor="middle" fontSize="10" fontWeight="700" fill={clr}>R</text>
        <text x="137" y="41" textAnchor="middle" fontSize="8" fill={clr}>{fmt(c.R,1)} Ω / {fmt(c.VR,1)} V</text>
      </>}
      {/* L */}
      {hasL && <>
        <path d="M200 20 q8-15 16 0 q8-15 16 0 q8-15 16 0" fill="none" stroke={clr} strokeWidth="2"/>
        <text x="224" y="41" textAnchor="middle" fontSize="8" fill={clr}>XL={fmt(c.XL,1)} Ω / {fmt(c.VL,1)} V</text>
      </>}
      {/* C */}
      {hasC && <>
        <line x1="295" y1="20" x2="307" y2="20" stroke="#334155" strokeWidth="2"/>
        <line x1="307" y1="11" x2="307" y2="29" stroke={clr} strokeWidth="2.5"/>
        <line x1="313" y1="11" x2="313" y2="29" stroke={clr} strokeWidth="2.5"/>
        <line x1="313" y1="20" x2="325" y2="20" stroke="#334155" strokeWidth="2"/>
        <text x="310" y="41" textAnchor="middle" fontSize="8" fill={clr}>XC={fmt(c.XC,1)} Ω / {fmt(c.VC,1)} V</text>
      </>}
      {/* voltmeter dashed across load */}
      <line x1="390" y1="20" x2="410" y2="20" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 2"/>
      <line x1="410" y1="20" x2="410" y2="46" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 2"/>
      <circle cx="410" cy="60" r="12" fill="var(--c-surface)" stroke="#7c3aed" strokeWidth="2"/>
      <text x="410" y="64" textAnchor="middle" fontSize="10" fontWeight="800" fill="#7c3aed">V</text>
      <line x1="410" y1="74" x2="410" y2="100" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 2"/>
      <line x1="390" y1="100" x2="410" y2="100" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 2"/>
      <text x="435" y="64" textAnchor="start" fontSize="8" fill="#7c3aed">{fmt(c.Vs,1)} V</text>
      {/* current arrow */}
      <polygon points="165,17 175,20 165,23" fill="#334155" opacity="0.5"/>
    </svg>
  )
}

/* ─── MonoPhasor SVG ─────────────────────────────────────────────────────── */

function MonoPhasor({ c }) {
  const W = 420, H = 200, cx = 130, cy = H / 2
  const sc = Math.min(80 / (c.Vs || 1), 200)
  const VrL = (c.VR / c.Vs) * 80
  const VlL = (c.VL / c.Vs) * 80
  const VcL = (c.VC / c.Vs) * 80
  const VsX = cx + VrL
  const VsY = cy - (VlL - VcL)

  function Arrow({ x1, y1, x2, y2, color, label, sub }) {
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.sqrt(dx*dx + dy*dy)
    if (len < 3) return null
    const ux = dx/len, uy = dy/len
    const hx = x2 - 8*ux, hy = y2 - 8*uy
    const lx = x2 + 14*ux, ly = y2 + 14*uy
    return (
      <g>
        <line x1={x1} y1={y1} x2={hx} y2={hy} stroke={color} strokeWidth="2"/>
        <polygon points={`${x2},${y2} ${hx-5*uy},${hy+5*ux} ${hx+5*uy},${hy-5*ux}`} fill={color}/>
        <text x={lx} y={ly+4} textAnchor="middle" fontSize="10" fill={color} fontWeight="700">{label}</text>
        {sub && <text x={lx} y={ly+15} textAnchor="middle" fontSize="9" fill={color}>{sub}</text>}
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'calc(100% - 38px)' }}>
      {/* axes */}
      <line x1="0" y1={cy} x2={W} y2={cy} stroke="#e2e8f0" strokeWidth="1"/>
      <line x1={cx} y1="0" x2={cx} y2={H} stroke="#e2e8f0" strokeWidth="1"/>
      <text x="4" y="12" fontSize="9" fill="#94a3b8">Im↑</text>
      <text x={W-30} y={cy-3} fontSize="9" fill="#94a3b8">Re→</text>

      {/* VR along I axis */}
      {c.hasR && VrL>2 && <Arrow x1={cx} y1={cy} x2={cx+VrL} y2={cy} color="#16a34a" label="VR" sub={`${fmt(c.VR,1)}V`}/>}
      {/* VL up from end of VR */}
      {c.hasL && VlL>2 && <Arrow x1={cx+VrL} y1={cy} x2={cx+VrL} y2={cy-VlL} color="#dc2626" label="VL" sub={`${fmt(c.VL,1)}V`}/>}
      {/* VC down from end of VR */}
      {c.hasC && VcL>2 && <Arrow x1={cx+VrL} y1={cy} x2={cx+VrL} y2={cy+VcL} color="#0284c7" label="VC" sub={`${fmt(c.VC,1)}V`}/>}
      {/* Vs resultante */}
      <Arrow x1={cx} y1={cy} x2={VsX} y2={VsY} color="#1d4ed8" label="Vs" sub={`${fmt(c.Vs,1)}V`}/>
      {/* I reference (horizontal) */}
      <Arrow x1={cx} y1={cy} x2={cx+65} y2={cy} color="#ea580c" label="I" sub={`${fmt(c.I,3)}A`}/>

      {/* phi arc */}
      {Math.abs(c.phi) > 0.02 && (() => {
        const r = 28
        const ex = cx + r * Math.cos(-c.phi), ey = cy + r * Math.sin(-c.phi)
        const sweep = c.phi > 0 ? 0 : 1
        return <>
          <path d={`M ${cx+r} ${cy} A ${r} ${r} 0 0 ${sweep} ${ex} ${ey}`}
            fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2"/>
          <text x={cx+r*Math.cos(-c.phi/2)+4} y={cy-r*Math.sin(-c.phi/2)} fontSize="9" fill="#64748b">
            φ={fmt(c.phi*180/Math.PI,1)}°
          </text>
        </>
      })()}

      {/* legend */}
      {[
        ['#ea580c', `I — ${fmt(c.I,3)} A (referência)`],
        ['#1d4ed8', `Vs — ${fmt(c.Vs,1)} V (fonte)`],
        c.hasR ? ['#16a34a', `VR — ${fmt(c.VR,1)} V (R)`] : null,
        c.hasL ? ['#dc2626', `VL — ${fmt(c.VL,1)} V (L, 90° à frente)`] : null,
        c.hasC ? ['#0284c7', `VC — ${fmt(c.VC,1)} V (C, 90° atrás)`] : null,
      ].filter(Boolean).map(([col, txt], i) => (
        <g key={i}>
          <rect x={220} y={8+i*17} width={9} height={9} fill={col} rx="2"/>
          <text x={232} y={18+i*17} fontSize="9" fill="var(--c-text)">{txt}</text>
        </g>
      ))}
      {/* nature */}
      <text x={W/2} y={H-4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">
        {c.nat}  ·  FP = {fmt(c.FP,4)}  ·  φ = {fmt(c.phi*180/Math.PI,2)}°
      </text>
    </svg>
  )
}

/* ─── SubCATri ────────────────────────────────────────────────────────────── */

function SubCATri() {
  const [params, setParams] = useState(TRI_DEFAULT)
  const calc    = useMemo(() => calcTri(params), [params])
  const msgs    = useMemo(() => validateTri(params, calc), [params, calc])
  const netlist = useMemo(() => genNetlist(params, calc), [params, calc])

  function sp(k, v) { setParams(prev => ({ ...prev, [k]: v })) }

  const errCount  = msgs.filter(m => m.sev === 'Erro').length
  const warnCount = msgs.filter(m => m.sev === 'Aviso').length

  const parts = (() => {
    const badge = (pct, t1=100, t2=80) => pct>t1?'Erro':pct>t2?'Aviso':'OK'
    const Rv = parseNum(params.r1_valor)
    return [
      ['V1','Fonte CA','3',`${params.v1_tensao} kV/${params.v1_freq} Hz`,params.v1_ligacao,'OK'],
      ['Q1','Disjuntor','3',`${params.q1_inominal} A`,'—',badge(calc.q_pct)],
      ['TC1','TC','3',`${params.tc1_primario}/${params.tc1_secundario} A`,'—',badge(calc.tc_pct,100,90)],
      ['R1','Resistor','3',`${params.r1_valor} Ω`,'—',(!isNaN(Rv)&&Rv>0&&Rv<0.05)?'Aviso':'OK'],
      ['M1','Medidor','3','V, A, kW, kvar, FP',params.v1_ligacao,'OK'],
      ['L1','Carga RLC','3',`${params.l1_p} kW/${params.l1_q} kvar`,params.v1_ligacao,badge(calc.q_pct)],
    ]
  })()

  return (
    <div className="circuit-editor-grid">
      {/* LEFT: params */}
      <aside className="panel" style={{ gridRow:'1/3', minHeight:0 }}>
        <div className="panel__head">Parâmetros do Circuito</div>
        <div className="panel__body scroll-y" style={{ height:'calc(100% - 38px)', overflow:'auto' }}>
          <Section title="Fonte CA (V1)">
            <PField label="Tensão"     unit="kV" value={params.v1_tensao}  onChange={v=>sp('v1_tensao',v)} />
            <PField label="Frequência" unit="Hz" value={params.v1_freq}    onChange={v=>sp('v1_freq',v)} />
            <PSelect label="Ligação" value={params.v1_ligacao} onChange={v=>sp('v1_ligacao',v)} options={['Y','D','Δ']} />
          </Section>
          <Section title="Disjuntor (Q1)">
            <PField label="I nominal" unit="A" value={params.q1_inominal} onChange={v=>sp('q1_inominal',v)} />
            <Indicator label="Carregamento" pct={calc.q_pct} />
          </Section>
          <Section title="TC de Corrente (TC1)">
            <PField label="I primário"   unit="A" value={params.tc1_primario}   onChange={v=>sp('tc1_primario',v)} />
            <PField label="I secundário" unit="A" value={params.tc1_secundario} onChange={v=>sp('tc1_secundario',v)} />
            <Indicator label="Carregamento TC" pct={calc.tc_pct} />
          </Section>
          <Section title="Resistência de linha (R1)">
            <PField label="Resistência" unit="Ω" value={params.r1_valor} onChange={v=>sp('r1_valor',v)} />
          </Section>
          <Section title="Carga RLC (L1)">
            <PField label="Pot. ativa"   unit="kW"   value={params.l1_p} onChange={v=>sp('l1_p',v)} />
            <PField label="Pot. reativa" unit="kvar" value={params.l1_q} onChange={v=>sp('l1_q',v)} />
          </Section>
        </div>
      </aside>

      {/* TOOLBAR */}
      <div className="panel" style={{ gridColumn:'2/4' }}>
        <div className="panel__body" style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--c-text-muted)', marginRight:4 }}>Cenário:</span>
          {TRI_PRESETS.map(pr => (
            <button key={pr.label} className="btn btn-ghost btn-sm" onClick={() => setParams({...pr.p})}>{pr.label}</button>
          ))}
          <span style={{ flex:1 }} />
          <button className="btn btn-ghost btn-sm" onClick={() => setParams(TRI_DEFAULT)}>Resetar</button>
        </div>
      </div>

      {/* CANVAS */}
      <main className="panel" style={{ minHeight:0 }}>
        <div className="panel__body--np" style={{ height:'100%', backgroundImage:'radial-gradient(#dbe4f0 1px,transparent 1px)', backgroundSize:'14px 14px', position:'relative' }}>
          <TriCircuitSvg p={params} c={calc} />
          <div className="surface-box" style={{ position:'absolute', left:12, bottom:12, padding:'4px 10px', fontSize:11, display:'flex', gap:12 }}>
            <span>I = <b>{fmt(calc.I)} A</b></span>
            <span>FP = <b style={{ color:calc.FP<0.92&&calc.S>0?'var(--c-danger)':undefined }}>{fmt(calc.FP,3)}</b></span>
            <span>V<sub>carga</sub> = <b>{fmt(calc.V_load/1000,3)} kV</b></span>
            <span>η = <b>{fmt(calc.eta)}%</b></span>
          </div>
        </div>
      </main>

      {/* RIGHT: results */}
      <aside className="panel" style={{ minHeight:0 }}>
        <div className="panel__head">Resultados Calculados</div>
        <div className="panel__body scroll-y" style={{ height:'calc(100% - 38px)', overflow:'auto' }}>
          <Section title="Correntes e Potências">
            <Result label="Corrente de linha" value={`${fmt(calc.I)} A`} />
            <Result label="Potência aparente" value={`${fmt(calc.S/1000)} kVA`} />
            <Result label="Fator de potência" value={`${fmt(calc.FP,3)} (${fmt(calc.phi,1)}°)`} highlight={calc.FP<0.92&&calc.S>0} />
          </Section>
          <Section title="Tensão e Perdas">
            <Result label="Tensão na fonte"  value={`${params.v1_tensao} kV`} />
            <Result label="Queda de tensão"  value={`${fmt(calc.V_drop)} V (${fmt(calc.vd_pct)}%)`} highlight={calc.vd_pct>5} />
            <Result label="Tensão na carga"  value={`${fmt(calc.V_load/1000,3)} kV`} />
            <Result label="Perdas na linha"  value={`${fmt(calc.Ploss/1000,2)} kW`} />
            <Result label="Rendimento"       value={`${fmt(calc.eta)}%`} />
          </Section>
          <Section title="Carregamento">
            <Indicator label={`Q1 (${params.q1_inominal} A)`}  pct={calc.q_pct} />
            <Indicator label={`TC1 (${params.tc1_primario} A)`} pct={calc.tc_pct} />
          </Section>
        </div>
      </aside>

      {/* NETLIST */}
      <div className="panel">
        <div className="panel__head">Netlist</div>
        <pre style={{ padding:12, fontSize:11, lineHeight:1.65, overflow:'auto', height:'calc(100% - 38px)', margin:0 }}>{netlist}</pre>
      </div>

      {/* VALIDATION */}
      <div className="panel">
        <div className="panel__head">Mensagens / Validação</div>
        <div className="panel__body">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
            <span><b style={{ color:'#dc2626' }}>{errCount}</b> Erros</span>
            <span><b style={{ color:'#d97706' }}>{warnCount}</b> Avisos</span>
          </div>
          {msgs.map((m,i) => <MsgItem key={i} sev={m.sev} text={m.text} />)}
        </div>
      </div>

      {/* PARTS LIST */}
      <div className="panel">
        <div className="panel__head">Lista de Componentes</div>
        <table className="tbl">
          <thead><tr><th>ID</th><th>Tipo</th><th>Fases</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>
            {parts.map(row => (
              <tr key={row[0]}>
                <td>{row[0]}</td><td>{row[1]}</td><td>{row[2]}</td><td>{row[3]}</td>
                <td><span className={`badge badge-${row[5]==='OK'?'green':row[5]==='Erro'?'red':'yellow'}`}>{row[5]}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* SINGLE LINE */}
      <div className="panel">
        <div className="panel__head">Diagrama Unifilar</div>
        <svg viewBox="0 0 260 210" style={{ width:'100%', height:'calc(100% - 38px)' }}>
          <line x1="130" y1="20" x2="130" y2="175" stroke="#111827" strokeWidth="2" />
          <circle cx="130" cy="25" r="13" fill="#fff" stroke="#111827"/><text x="130" y="29" textAnchor="middle" fontSize="10">V1</text>
          <rect x="118" y="60" width="24" height="18" fill="#fff" stroke="#111827"/><text x="152" y="74" fontSize="11">Q1</text>
          <path d="M115 100 q15 -18 30 0 q-15 18 -30 0" fill="none" stroke="#111827"/><text x="152" y="105" fontSize="11">TC1</text>
          <line x1="55" y1="150" x2="205" y2="150" stroke="#111827" strokeWidth="2" />
          <circle cx="90" cy="150" r="18" fill="#fff" stroke="#1d4ed8"/><text x="90" y="156" textAnchor="middle" fill="#1d4ed8">M</text>
          <circle cx="145" cy="150" r="18" fill="#fff" stroke="#111827"/><text x="145" y="156" textAnchor="middle">W</text>
          <circle cx="190" cy="150" r="18" fill="#fff" stroke="#111827"/><text x="190" y="156" textAnchor="middle">L</text>
        </svg>
      </div>

      {/* STATUS */}
      <div className="panel">
        <div className="panel__head">Status</div>
        <div className="panel__body">
          {[['Tensão nominal',`${params.v1_tensao} kV`],['I de linha',`${fmt(calc.I)} A`],['Componentes','6'],['Erros',`${errCount}`]].map(([k,v]) => (
            <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:7 }}>
              <span style={{ color:'#64748b' }}>{k}</span><b>{v}</b>
            </div>
          ))}
          <div className={`result-panel ${errCount>0?'result-panel--warning':warnCount>0?'result-panel--warning':'result-panel--success'}`} style={{ marginTop:16, padding:12, fontWeight:800 }}>
            {errCount>0 ? `${errCount} erro(s) detectado(s)` : warnCount>0 ? `${warnCount} aviso(s)` : 'Projeto válido'}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── TriCircuitSvg ─────────────────────────────────────────────────────── */

function TriCircuitSvg({ p, c }) {
  const wire = { strokeWidth:3, fill:'none' }
  const overload = c.q_pct > 100
  const warn = c.q_pct > 80
  const busColor = overload ? '#ef4444' : warn ? '#f97316' : null
  const busA = busColor || '#b45309'
  const busB = busColor || '#16a34a'
  const busC = busColor || '#dc2626'
  const busN = '#1d4ed8'
  const fpColor = !isNaN(c.FP) && c.FP < 0.92 && c.S > 0 ? '#dc2626' : '#16a34a'
  return (
    <svg viewBox="0 0 980 520" style={{ width:'100%', height:'100%' }}>
      <text x="135" y="110" fill={busA} fontSize="20">A</text>
      <text x="135" y="160" fill={busB} fontSize="20">B</text>
      <text x="135" y="210" fill={busC} fontSize="20">C</text>
      <text x="135" y="405" fill={busN} fontSize="20">N</text>
      <path d="M90 120 H800 V205" stroke={busA} {...wire}/>
      <path d="M90 170 H840"      stroke={busB} {...wire}/>
      <path d="M90 220 H800"      stroke={busC} {...wire}/>
      <path d="M90 410 H800 V260" stroke={busN} {...wire}/>
      <rect x="390" y="90" width="140" height="20" rx="3" fill="var(--c-surface)" opacity=".85"/>
      <text x="460" y="105" textAnchor="middle" fontSize="12" fill={busColor||'#334155'} fontWeight="700">I = {fmt(c.I)} A</text>
      <circle cx="70" cy="245" r="28" fill="#fff" stroke="#111827" strokeWidth="2"/>
      <text x="70" y="251" textAnchor="middle" fontSize="22">~</text>
      <text x="18" y="286" fontSize="10" fill="#64748b">{p.v1_tensao} kV</text>
      <text x="18" y="298" fontSize="10" fill="#64748b">{p.v1_freq} Hz</text>
      <line x1="210" y1="120" x2="250" y2="120" stroke="#111827" strokeWidth="3"/>
      <circle cx="205" cy="120" r="5" fill="#111827"/>
      <circle cx="255" cy="120" r="5" fill="#111827"/>
      <text x="212" y="86">Q1</text>
      <text x="196" y="102" fontSize="11">{p.q1_inominal} A</text>
      <rect x="350" y="100" width="48" height="70" rx="6" fill="#fff" stroke="#111827" strokeWidth="2"/>
      <text x="364" y="92">TC1</text>
      <text x="340" y="186" fontSize="10">{p.tc1_primario}/{p.tc1_secundario} A</text>
      <path d="M360 120 q15 -20 30 0 q-15 20 -30 0" fill="none" stroke="#111827"/>
      <path d="M512 100 l18 35 l18 -35 M512 135 h36" stroke="#111827" strokeWidth="2" fill="none"/>
      <text x="515" y="88">R1</text>
      <text x="510" y="160" fontSize="12">{p.r1_valor} Ω</text>
      <circle cx="490" cy="230" r="28" fill="#fff" stroke="#1d4ed8" strokeWidth="2"/>
      <text x="490" y="238" textAnchor="middle" fill="#1d4ed8" fontSize="20">M</text>
      <circle cx="410" cy="335" r="26" fill="#fff" stroke="#111827" strokeWidth="2"/>
      <text x="410" y="343" textAnchor="middle" fontSize="22">W</text>
      <rect x="800" y="205" width="70" height="85" fill="#fff" stroke="#111827" strokeWidth="2"/>
      <path d="M820 215 v65 m25 -65 v65 m-25 -42 h25" stroke="#111827"/>
      <text x="882" y="222" fontSize="11">Carga RLC</text>
      <text x="882" y="240" fontSize="12">{p.l1_p} kW</text>
      <text x="882" y="256" fontSize="12">{p.l1_q} kvar</text>
      <text x="882" y="272" fontSize="12" fill={fpColor}>FP {fmt(c.FP,3)}</text>
      <line x1="320" y1="120" x2="320" y2="410" stroke="#111827" strokeWidth="2"/>
      <line x1="420" y1="170" x2="420" y2="410" stroke="#111827" strokeWidth="2"/>
      <line x1="550" y1="220" x2="550" y2="410" stroke="#111827" strokeWidth="2"/>
      <text x="320" y="440" textAnchor="middle">Terra</text>
      <line x1="300" y1="425" x2="340" y2="425" stroke="#111827" strokeWidth="2"/>
      <line x1="308" y1="433" x2="332" y2="433" stroke="#111827" strokeWidth="2"/>
    </svg>
  )
}

/* ─── Main export ────────────────────────────────────────────────────────── */

export default function Circuitos() {
  const [sub, setSub] = useState('cc')

  return (
    <div className="circuitos-page">
      <div className="inner-nav">
        <span className="inner-nav__label">Análise:</span>
        <button className={`inner-nav-btn${sub==='cc'      ?' active':''}`} onClick={()=>setSub('cc')}>⚡ CC</button>
        <button className={`inner-nav-btn${sub==='ca-mono' ?' active':''}`} onClick={()=>setSub('ca-mono')}>〜 CA Monofásico</button>
        <button className={`inner-nav-btn${sub==='ca-tri'  ?' active':''}`} onClick={()=>setSub('ca-tri')}>⋈ CA Trifásico</button>
        <button className={`inner-nav-btn${sub==='sim'     ?' active':''}`} onClick={()=>setSub('sim')}>▷ Simulação</button>
      </div>

      {sub==='cc'      && <SubCC />}
      {sub==='ca-mono' && <SubCAMono />}
      {sub==='ca-tri'  && <SubCATri />}
      {sub==='sim'     && <Simulacao />}
    </div>
  )
}
