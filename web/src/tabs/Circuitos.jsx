import { useState, useMemo } from 'react'
import {
  CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'

/* ─── helpers ────────────────────────────────────────────────────────────── */

const SI_MULTIPLIERS = {
  G: 1e9,
  M: 1e6,
  k: 1e3,
  K: 1e3,
  m: 1e-3,
  u: 1e-6,
  U: 1e-6,
  µ: 1e-6,
  μ: 1e-6,
  n: 1e-9,
  p: 1e-12,
}

function parseNum(str, unit = '') {
  if (str === '' || str == null) return NaN
  const raw = String(str).trim()
  if (!raw) return NaN

  const text = raw
    .replace(/\s+/g, '')
    .replace(',', '.')
    .replace(/[−–—]/g, '-')

  const compact = text.match(/^([+-]?\d+)([pnumuµμkKMG])(\d+)(.*)$/)
  if (compact) {
    const [, whole, prefix, frac, suffix] = compact
    const value = Number(`${whole}.${frac}`)
    return scaleByUnit(value, `${prefix}${suffix}`, unit)
  }

  const match = text.match(/^([+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?)(.*)$/)
  if (!match) return NaN

  const value = Number(match[1])
  if (!Number.isFinite(value)) return NaN
  return scaleByUnit(value, match[2], unit)
}

function scaleByUnit(value, sourceUnit = '', targetUnit = '') {
  if (!sourceUnit) return value
  const sourceScale = unitScale(sourceUnit)
  const targetScale = targetUnit ? unitScale(targetUnit) : 1
  return value * sourceScale / targetScale
}

function unitScale(unit = '') {
  const clean = String(unit).trim()
  if (!clean) return 1
  const prefix = clean[0]
  return Object.prototype.hasOwnProperty.call(SI_MULTIPLIERS, prefix)
    ? SI_MULTIPLIERS[prefix]
    : 1
}
function fmt(n, d = 2) {
  if (isNaN(n) || !isFinite(n)) return '—'
  return n.toFixed(d).replace('.', ',')
}
function fmtInput(n, d = 3) {
  if (isNaN(n) || !isFinite(n)) return ''
  return n.toFixed(d).replace(/\.?0+$/, '').replace('.', ',')
}
function fmtNominalPhaseVoltage(n) {
  if (isNaN(n) || !isFinite(n)) return '—'
  const nearest10 = Math.round(n / 10) * 10
  if (n >= 200 && n < 1000 && Math.abs(n - nearest10) <= 1) return fmt(nearest10, 0)
  return fmt(n, 1)
}
function nominalLineVoltageFromPhase(Vph) {
  const line = Vph * Math.sqrt(3)
  const nearest10 = Math.round(line / 10) * 10
  return line >= 200 && line < 1000 && Math.abs(line - nearest10) <= 2
    ? nearest10
    : line
}
function fmtSgn(n, d = 2) {
  if (isNaN(n) || !isFinite(n)) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(d).replace('.', ',') + '%'
}
function errClr(pct) {
  const a = Math.abs(pct)
  return a < 1 ? '#16a34a' : a < 5 ? '#d97706' : '#dc2626'
}

/* ─── complex number helpers ─────────────────────────────────────────────── */
// Represent complex numbers as [real, imag]
const cx = {
  add:   (a,b) => [a[0]+b[0], a[1]+b[1]],
  sub:   (a,b) => [a[0]-b[0], a[1]-b[1]],
  mul:   (a,b) => [a[0]*b[0]-a[1]*b[1], a[0]*b[1]+a[1]*b[0]],
  div:   (a,b) => { const d = b[0]**2+b[1]**2 || 1e-30; return [(a[0]*b[0]+a[1]*b[1])/d, (a[1]*b[0]-a[0]*b[1])/d] },
  neg:   (a)   => [-a[0], -a[1]],
  mag:   (a)   => Math.sqrt(a[0]**2+a[1]**2),
  arg:   (a)   => Math.atan2(a[1],a[0]),
  polar: (r,θ) => [r*Math.cos(θ), r*Math.sin(θ)],
  P:     (V,I) => V[0]*I[0]+V[1]*I[1],    // Re(V·I*) = active power
  Q:     (V,I) => V[1]*I[0]-V[0]*I[1],    // Im(V·I*) = reactive power
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

// Parallel: Vs is reference; branch currents IR, IL, IC; total I_total at angle phi
function calcMonoPara(p) {
  const Vs = parseNum(p.Vs) || 127
  const f  = parseNum(p.f)  || 60
  const R  = parseNum(p.R)  || 0
  const L  = parseNum(p.L)  || 0
  const C  = parseNum(p.C)  || 0
  const t  = p.loadType

  const hasR = ['R','RL','RC','RLC','M'].includes(t)
  const hasL = ['L','RL','RLC','M'].includes(t)
  const hasC = ['C','RC','RLC'].includes(t)

  const XL = hasL && L > 0 ? 2*Math.PI*f*L : 0
  const XC = hasC && C > 0 ? 1/(2*Math.PI*f*C) : 0

  const G  = hasR && R > 0 ? 1/R  : 0   // conductance
  const BL = XL > 0 ? 1/XL : 0          // inductive susceptance (lags)
  const BC = XC > 0 ? 1/XC : 0          // capacitive susceptance (leads)
  const B  = BC - BL                     // net susceptance (+ = cap, - = ind)

  const Y   = Math.sqrt(G**2 + B**2) || 1e-10
  const Z   = 1/Y
  const I_R = Vs * G
  const I_L = Vs * BL
  const I_C = Vs * BC
  const I   = Vs * Y
  const FP  = G / Y
  const phi = Math.atan2(BL - BC, G)    // lag positive: ind > 0, cap < 0

  const P   = Vs**2 * G
  const Q_L = Vs**2 * BL
  const Q_C = Vs**2 * BC
  const Q   = Q_L - Q_C                 // net reactive (+ = inductive)
  const S   = Vs * I
  const nat = phi > 0.001 ? 'Indutivo' : phi < -0.001 ? 'Capacitivo' : 'Resistivo puro'

  return { Vs, f, G, BL, BC, B, Y, Z, I_R, I_L, I_C, I, FP, phi, P, Q_L, Q_C, Q, S, nat, hasR, hasL, hasC, XL, XC }
}

/* ─── CA Trifásico — load analysis system ───────────────────────────────── */

const TRI_LOAD_TYPES = [
  { id:'R',   label:'Resistiva (R)',          color:'#1d4ed8', fields:['R'] },
  { id:'L',   label:'Indutiva pura (L)',      color:'#dc2626', fields:['L'] },
  { id:'C',   label:'Capacitiva pura (C)',    color:'#0284c7', fields:['C'] },
  { id:'LC',  label:'LC',                     color:'#0f766e', fields:['L','C'] },
  { id:'RL',  label:'Indutiva (RL)',           color:'#9333ea', fields:['R','L'] },
  { id:'RC',  label:'Capacitiva (RC)',         color:'#0284c7', fields:['R','C'] },
  { id:'RLC', label:'RLC',                    color:'#d97706', fields:['R','L','C'] },
  { id:'M3F', label:'Motor Trifásico',         color:'#16a34a', fields:['Pn','eta','FPm'] },
  { id:'M1F', label:'Motor Monofásico (fase A)', color:'#64748b', fields:['Pn','eta','FPm'] },
  { id:'CAP', label:'Banco de Capacitores',   color:'#dc2626', fields:['Cuf'] },
]

const DEFAULT_TRI_LOADS = {
  ligacao:'Y', balanco:'eq', loadType:'RLC',
  R:'10', L:'', C:'', Cuf:'50',
  Pn:'37', eta:'92', FPm:'0,87',
  // per-phase for unbalanced
  A_lt:'RLC', A_R:'10', A_L:'0,05', A_C:'',
  B_lt:'RLC', B_R:'20', B_L:'',     B_C:'',
  C_lt:'RLC', C_R:'15', C_L:'',     C_C:'2mF',
  VL:'13800', freq:'60', vUnbalA:'', vUnbalB:'', vUnbalC:'',
}

// Returns impedance [Re, Im] per-phase (Y-equivalent) for a given load spec
function phaseZ(lt, vals, f, VL) {
  const R  = parseNum(vals.R)  || 0
  const L  = parseNum(vals.L)  || 0
  const Cv = parseNum(vals.C)  || 0
  const XL = 2*Math.PI*f*L
  const XC = Cv > 0 ? 1/(2*Math.PI*f*Cv) : 0

  if (lt === 'R')   return [R || 1, 0]
  if (lt === 'L')   return [0.001, XL || 1]
  if (lt === 'C')   return [0.001, -(XC || 1e6)]
  if (lt === 'LC')  return [0.001, XL - (XC || 0)]
  if (lt === 'RL')  return [R, XL]
  if (lt === 'RC')  return [R, -XC]
  if (lt === 'RLC') return [R, XL - XC]

  if (lt === 'M3F' || lt === 'M1F') {
    const Pn  = (parseNum(vals.Pn, 'kW') || 10) * 1000  // kW → W
    const eta = (parseNum(vals.eta) || 90) / 100
    const FPm = parseNum(vals.FPm) || 0.85
    if (Pn <= 0 || VL <= 0) return [10, 2]
    const P_el = Pn / eta
    const S_m  = P_el / (FPm || 0.01)
    const V_ph = VL / Math.sqrt(3)
    const I_m  = S_m / (Math.sqrt(3) * VL)
    const Zm   = V_ph / (I_m || 1e-10)
    const phim = Math.acos(Math.min(FPm, 1))
    return [Zm * FPm, Zm * Math.sin(phim)]
  }

  if (lt === 'CAP') {
    const Cuf = (parseNum(vals.Cuf, 'µF') || 10) * 1e-6  // μF → F
    const XCap = Cuf > 0 ? 1/(2*Math.PI*f*Cuf) : 1e6
    return [0, -XCap]
  }

  return [R || 1, XL - XC]
}

// Balanced Y or Δ load analysis
function calcTriBal(p) {
  const VL = parseNum(p.VL) || 13800
  const f  = parseNum(p.freq) || 60
  const lt = p.loadType
  const lig = p.ligacao // 'Y' or 'D'
  const vals = { R: p.R, L: p.L, C: p.C, Pn: p.Pn, eta: p.eta, FPm: p.FPm, Cuf: p.Cuf }

  let Z_Y = phaseZ(lt, vals, f, VL)  // Y-equivalent per phase
  if (lig === 'D') Z_Y = [Z_Y[0]/3, Z_Y[1]/3]  // Δ → Y conversion

  const V_ph  = VL / Math.sqrt(3)
  const Z_mag = cx.mag(Z_Y) || 1e-10
  const phi   = cx.arg(Z_Y)          // angle: ind > 0
  const I_ph  = V_ph / Z_mag         // phase current in Y equivalent
  const I_line = lig === 'D' ? Math.sqrt(3) * I_ph : I_ph
  const I_delta = lig === 'D' ? I_ph : null  // current through Δ branch

  const FP  = Math.cos(phi)
  const P1  = V_ph * I_ph * FP       // per phase
  const Q1  = V_ph * I_ph * Math.abs(Math.sin(phi))
  const P   = 3 * P1
  const Q   = phi > 0 ? 3 * Q1 : -3 * Q1  // ind positive
  const S   = Math.sqrt(P**2 + Q**2)
  const nat = phi > 0.001 ? 'Indutivo' : phi < -0.001 ? 'Capacitivo' : 'Resistivo'

  // Phasors for diagram (A=0°, B=-120°, C=-240°)
  const phaseA = { V: cx.polar(V_ph, 0),           I: cx.polar(I_ph, -phi) }
  const phaseB = { V: cx.polar(V_ph, -2*Math.PI/3), I: cx.polar(I_ph, -2*Math.PI/3 - phi) }
  const phaseC = { V: cx.polar(V_ph,  2*Math.PI/3), I: cx.polar(I_ph,  2*Math.PI/3 - phi) }

  return { VL, V_ph, f, Z_Y, Z_mag, phi, I_ph, I_line, I_delta, FP, P, Q, S, nat, P1, Q1, lig, phaseA, phaseB, phaseC }
}

// Unbalanced Y load (with neutral wire)
function calcTriUnbalY(p) {
  const VL = parseNum(p.VL) || 13800
  const f  = parseNum(p.freq) || 60
  const V_ph = VL / Math.sqrt(3)

  const phases = ['A','B','C']
  const angles = [0, -2*Math.PI/3, 2*Math.PI/3]

  const results = phases.map((ph, i) => {
    const lt   = p[ph+'_lt'] || 'RL'
    const vals = { R: p[ph+'_R'], L: p[ph+'_L'], C: p[ph+'_C'], Pn: p[ph+'_Pn'], eta: p[ph+'_eta'], FPm: p[ph+'_FPm'], Cuf: p[ph+'_Cuf'] }
    const Z    = phaseZ(lt, vals, f, VL)
    const V    = cx.polar(V_ph, angles[i])
    const I    = cx.div(V, Z)
    const phi  = cx.arg(Z)
    const P    = cx.P(V, I)
    const Q    = cx.Q(V, I)
    return { ph, V, I, Z, phi, P, Q, S: cx.mag(V)*cx.mag(I), I_mag: cx.mag(I), FP: Math.cos(phi) }
  })

  const IA = results[0].I, IB = results[1].I, IC = results[2].I
  const IN = cx.neg(cx.add(cx.add(IA,IB),IC))
  const P_tot = results.reduce((s,r)=>s+r.P, 0)
  const Q_tot = results.reduce((s,r)=>s+r.Q, 0)
  const S_tot = Math.sqrt(P_tot**2 + Q_tot**2)

  return { results, IN, P_tot, Q_tot, S_tot, FP_tot: P_tot/S_tot, VL, V_ph }
}

// Unbalanced Δ load
function calcTriUnbalD(p) {
  const VL = parseNum(p.VL) || 13800
  const f  = parseNum(p.freq) || 60

  // Δ branch voltages (line-to-line): AB, BC, CA
  const V_AB = cx.polar(VL, Math.PI/6)       // standard ref
  const V_BC = cx.polar(VL, Math.PI/6 - 2*Math.PI/3)
  const V_CA = cx.polar(VL, Math.PI/6 + 2*Math.PI/3)

  function branchI(ph, Vab) {
    const lt   = p[ph+'_lt'] || 'RL'
    const vals = { R: p[ph+'_R'], L: p[ph+'_L'], C: p[ph+'_C'], Cuf: p[ph+'_Cuf'] }
    const Z    = phaseZ(lt, vals, f, VL)
    const I    = cx.div(Vab, Z)
    const P    = cx.P(Vab, I)
    const Q    = cx.Q(Vab, I)
    return { Z, I, I_mag: cx.mag(I), P, Q, S: cx.mag(Vab)*cx.mag(I), phi: cx.arg(Z), FP: Math.cos(cx.arg(Z)) }
  }

  const brAB = branchI('A', V_AB)
  const brBC = branchI('B', V_BC)
  const brCA = branchI('C', V_CA)

  // Line currents: IA = IAB - ICA, IB = IBC - IAB, IC = ICA - IBC
  const IA = cx.sub(brAB.I, brCA.I)
  const IB = cx.sub(brBC.I, brAB.I)
  const IC = cx.sub(brCA.I, brBC.I)

  const P_tot = brAB.P + brBC.P + brCA.P
  const Q_tot = brAB.Q + brBC.Q + brCA.Q
  const S_tot = Math.sqrt(P_tot**2 + Q_tot**2)

  return {
    brAB, brBC, brCA, IA, IB, IC, P_tot, Q_tot, S_tot, FP_tot: P_tot/S_tot,
    VL, phaseA:{I:IA}, phaseB:{I:IB}, phaseC:{I:IC}
  }
}

const TRI_LOAD_BASE = {
  type: 'RLC',
  qty: '1',
  R: '10',
  L: '',
  C: '',
  Cuf: '50',
  Pn: '37',
  eta: '92',
  FPm: '0,87',
}

const TRI_DEFAULT_CIRCUIT_LOADS = [
  { id: 1, ...TRI_LOAD_BASE, scope: 'A' },
]

const TRI_CONNECTION_OPTIONS = [
  { id: 'A', label: 'AN' },
  { id: 'B', label: 'BN' },
  { id: 'C', label: 'CN' },
  { id: 'AB', label: 'AB' },
  { id: 'BC', label: 'BC' },
  { id: 'CA', label: 'CA' },
  { id: 'ABC', label: 'ABC' },
]

const TRI_DIRECT_CONNECTION_OPTIONS = TRI_CONNECTION_OPTIONS.filter(option => option.id !== 'ABC')
const TRI_STAR_TARGETS = ['A', 'B', 'C']
const TRI_DELTA_TARGETS = ['AB', 'BC', 'CA']
const TRI_PHASES = ['A', 'B', 'C']

function triPhaseVoltageDeltaPct(p, phase) {
  const raw = parseNum(p[`vUnbal${phase}`])
  if (!Number.isFinite(raw)) return 0
  return Math.max(-100, Math.min(raw, 100))
}

function triVoltageMapFromParams(p) {
  const VL = parseNum(p.VL) || 13800
  const V_ph = VL / Math.sqrt(3)
  const deltas = Object.fromEntries(TRI_PHASES.map(phase => [phase, triPhaseVoltageDeltaPct(p, phase)]))
  const phases = {
    A: cx.polar(V_ph * (1 + deltas.A / 100), 0),
    B: cx.polar(V_ph * (1 + deltas.B / 100), -2*Math.PI/3),
    C: cx.polar(V_ph * (1 + deltas.C / 100), 2*Math.PI/3),
  }
  const lines = {
    AB: cx.sub(phases.A, phases.B),
    BC: cx.sub(phases.B, phases.C),
    CA: cx.sub(phases.C, phases.A),
  }
  return {
    VL,
    V_ph,
    phaseRef: Math.max(...TRI_PHASES.map(phase => cx.mag(phases[phase])), V_ph),
    unbalancePct: Math.max(...TRI_PHASES.map(phase => Math.abs(deltas[phase]))),
    phaseDeltasPct: deltas,
    phases,
    lines,
    all: { ...phases, ...lines },
  }
}

const TRI_EXAMPLE_MIXED_LOADS = [
  { scope: 'A', type: 'RLC', R: '10', L: '0,05', C: '' },
  { scope: 'AB', type: 'RLC', R: '10', L: '0,05', C: '1mF' },
  { scope: 'BC', type: 'RLC', R: '20', L: '', C: '' },
  { scope: 'CA', type: 'RLC', R: '15', L: '0,03', C: '' },
]

function triLoadWithDefaults(load) {
  return {
    ...TRI_LOAD_BASE,
    ...load,
    type: 'RLC',
    qty: String(load.qty ?? TRI_LOAD_BASE.qty),
  }
}

function triExampleLoads() {
  return TRI_EXAMPLE_MIXED_LOADS.map((load, index) => ({
    ...triLoadWithDefaults(load),
    id: index + 1,
  }))
}

function triNextLoadId(loads) {
  return Math.max(0, ...loads.map(load => load.id || 0)) + 1
}

function triAbcTargets(load) {
  return load.abcLigacao === 'D' ? TRI_DELTA_TARGETS : TRI_STAR_TARGETS
}

function triLoadFromDraft(draft, scope, overrides = {}) {
  return triLoadWithDefaults({
    ...draft,
    ...overrides,
    scope,
  })
}

function triAbcTargetLoad(draft, target) {
  const p = `${target}_`
  return triLoadWithDefaults({
    scope: target,
    type: draft[`${p}type`] ?? draft.type,
    qty: '1',
    R: draft[`${p}R`] ?? draft.R,
    L: draft[`${p}L`] ?? draft.L,
    C: draft[`${p}C`] ?? draft.C,
    Cuf: draft[`${p}Cuf`] ?? draft.Cuf,
    Pn: draft[`${p}Pn`] ?? draft.Pn,
    eta: draft[`${p}eta`] ?? draft.eta,
    FPm: draft[`${p}FPm`] ?? draft.FPm,
  })
}

function triLoadsFromDraft(draft, startId) {
  if (draft.scope !== 'ABC') {
    return [{ ...triLoadFromDraft(draft, draft.scope), id: startId }]
  }

  return [{
    ...triLoadWithDefaults(draft),
    id: startId,
    scope: 'ABC',
    abcLigacao: draft.abcLigacao || 'Y',
    abcBalanco: draft.abcBalanco || 'eq',
  }]
}

const TRI_SCOPE_LABELS = {
  ABC: 'Três fases',
  A: 'Fase A',
  B: 'Fase B',
  C: 'Fase C',
  AB: 'Entre A-B',
  BC: 'Entre B-C',
  CA: 'Entre C-A',
}

function triScopeShort(scope) {
  if (scope === 'ABC') return 'ABC'
  if (['A', 'B', 'C'].includes(scope)) return `${scope}N`
  if (['AB', 'BC', 'CA'].includes(scope)) return scope
  return TRI_SCOPE_LABELS[scope] || scope
}

function triLoadTargets(load) {
  if (load.scope === 'ABC') return triAbcTargets(load)
  const validTargets = ['A', 'B', 'C', 'AB', 'BC', 'CA']
  if (!validTargets.includes(load.scope)) return []
  return [load.scope]
}

function triTargetLoad(load, target) {
  if (load.scope !== 'ABC') {
    return load.scope === target ? load : null
  }
  if (!triAbcTargets(load).includes(target)) return null
  if (load.abcBalanco === 'deseq') {
    return { ...triAbcTargetLoad(load, target), id: load.id, parentScope: 'ABC' }
  }
  return { ...triLoadFromDraft(load, target), id: load.id, parentScope: 'ABC' }
}

function triLoadVals(load) {
  return {
    R: load.R,
    L: load.L,
    C: load.C,
    Cuf: load.Cuf,
    Pn: load.Pn,
    eta: load.eta,
    FPm: load.FPm,
  }
}

function triLoadAdmittance(load, f, VL) {
  const Z = phaseZ(load.type, triLoadVals(load), f, VL)
  const den = Z[0]**2 + Z[1]**2 || 1e-30
  const qty = Math.max(1, Math.round(parseNum(load.qty) || 1))
  return [qty * Z[0] / den, -qty * Z[1] / den]
}

function triBranchAdmittance(loads, target, f, VL) {
  return loads.reduce((sum, load) => {
    const branchLoad = triTargetLoad(load, target)
    if (!branchLoad) return sum
    return cx.add(sum, triLoadAdmittance(branchLoad, f, VL))
  }, [0, 0])
}

function triBranchLoadCopies(loads, target) {
  return loads.flatMap(load => {
    const branchLoad = triTargetLoad(load, target)
    if (!branchLoad) return []
    const qty = Math.max(1, Math.round(parseNum(branchLoad.qty) || 1))
    return Array.from({ length: qty }, (_, index) => ({ ...branchLoad, copy: index + 1, target }))
  })
}

function calcTriCircuitLoads(p, loads) {
  const VL = parseNum(p.VL) || 13800
  const f = parseNum(p.freq) || 60
  const voltageMap = triVoltageMapFromParams(p)
  const phaseDefs = TRI_PHASES.map(phase => [phase, voltageMap.phases[phase]])
  const branchDefs = TRI_DELTA_TARGETS.map(target => [target, voltageMap.lines[target]])

  const phaseResults = phaseDefs.map(([target, V]) => {
    const Y = triBranchAdmittance(loads, target, f, VL)
    const I = cx.mul(V, Y)
    const P = cx.P(V, I)
    const Q = cx.Q(V, I)
    const S = cx.mag(V) * cx.mag(I)
    return {
      ph: target,
      target,
      V,
      I,
      P,
      Q,
      S,
      I_mag: cx.mag(I),
      FP: S > 1e-9 ? Math.abs(P) / S : 1,
      phi: Math.atan2(Q, P || 1e-30),
      loads: triBranchLoadCopies(loads, target),
    }
  })

  const branches = branchDefs.map(([target, V]) => {
    const Y = triBranchAdmittance(loads, target, f, VL)
    const I = cx.mul(V, Y)
    const P = cx.P(V, I)
    const Q = cx.Q(V, I)
    const S = cx.mag(V) * cx.mag(I)
    return {
      target,
      V,
      I,
      P,
      Q,
      S,
      I_mag: cx.mag(I),
      FP: S > 1e-9 ? Math.abs(P) / S : 1,
      phi: Math.atan2(Q, P || 1e-30),
      loads: triBranchLoadCopies(loads, target),
    }
  })

  const brAB = branches[0]
  const brBC = branches[1]
  const brCA = branches[2]
  const IA = cx.add(phaseResults[0].I, cx.sub(brAB.I, brCA.I))
  const IB = cx.add(phaseResults[1].I, cx.sub(brBC.I, brAB.I))
  const IC = cx.add(phaseResults[2].I, cx.sub(brCA.I, brBC.I))
  const IN = cx.neg(cx.add(cx.add(phaseResults[0].I, phaseResults[1].I), phaseResults[2].I))
  const allResults = [...phaseResults, ...branches]
  const P_tot = allResults.reduce((sum, r) => sum + r.P, 0)
  const Q_tot = allResults.reduce((sum, r) => sum + r.Q, 0)
  const S_tot = Math.sqrt(P_tot**2 + Q_tot**2)

  return {
    ligacao: 'MIX',
    VL,
    V_ph: voltageMap.phaseRef,
    voltageUnbalancePct: voltageMap.unbalancePct,
    phaseVoltageDeltasPct: voltageMap.phaseDeltasPct,
    phaseVoltages: voltageMap.phases,
    lineVoltages: voltageMap.lines,
    branches,
    results: phaseResults,
    IN,
    P_tot,
    Q_tot,
    S_tot,
    FP_tot: S_tot > 1e-9 ? Math.abs(P_tot) / S_tot : 1,
    lineCurrents: { A: IA, B: IB, C: IC },
  }
}

function triPhaseVoltageMap(circuit) {
  return Object.fromEntries((circuit.results || []).map(result => [result.ph, result.V]))
}

function triWattmeterReadings(circuit, config) {
  const voltages = triPhaseVoltageMap(circuit)
  const currents = circuit.lineCurrents || {}
  const mode = config.mode || '0'
  const onePhase = TRI_PHASES.includes(config.phase) ? config.phase : 'A'
  const refPhase = TRI_PHASES.includes(config.ref) ? config.ref : 'B'

  function reading(phase, ref, index) {
    const V = ref === 'N' ? voltages[phase] : cx.sub(voltages[phase], voltages[ref])
    const I = currents[phase] || [0, 0]
    const P = cx.P(V || [0, 0], I)
    return {
      id: `W${index + 1}`,
      phase,
      ref,
      voltageLabel: ref === 'N' ? `${phase}N` : `${phase}${ref}`,
      P,
    }
  }

  const readings = mode === '0'
    ? []
    : mode === '1'
      ? [reading(onePhase, 'N', 0)]
      : mode === '2'
        ? TRI_PHASES.filter(phase => phase !== refPhase).map((phase, index) => reading(phase, refPhase, index))
        : TRI_PHASES.map((phase, index) => reading(phase, 'N', index))

  const total = readings.reduce((sum, item) => sum + item.P, 0)
  const error = total - circuit.P_tot
  const neutral = circuit.IN ? cx.mag(circuit.IN) : 0
  const aronApplicable = mode !== '2' || neutral <= 1e-6

  return {
    mode,
    ref: refPhase,
    readings,
    total,
    error,
    neutral,
    aronApplicable,
  }
}

/* ─── CA Trifásico — system-level constants & calc ───────────────────────── */

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
  const V = parseNum(p.v1_tensao, 'kV') * 1000
  const P = parseNum(p.l1_p, 'kW') * 1000
  const Q = parseNum(p.l1_q, 'kvar') * 1000
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
  return `* Circuito Trifásico — SMQE\nFONTE_CA  V1  3  ${parseNum(p.v1_tensao, 'kV')*1000}  ${p.v1_freq}  LIG:${p.v1_ligacao}\nDISJUNTOR Q1  3  ${p.q1_inominal} A\nTC        TC1 3  ${p.tc1_primario}/${p.tc1_secundario} A\nRESISTOR  R1  3  ${p.r1_valor} Ω\nCARGA_RLC L1  3  ${p.l1_p} kW  ${p.l1_q} kvar\n\n* I_linha = ${fmt(c.I)} A\n* FP      = ${fmt(c.FP,4)}  (φ=${fmt(c.phi,1)}°)\n* V_carga = ${fmt(c.V_load/1000,3)} kV\n* η       = ${fmt(c.eta)}%\nFIM`
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
      <input className="form-input" style={{ width: 76, height: 26, fontSize: 12, textAlign: 'right' }}
        value={value} onChange={e => onChange(e.target.value)} />
      <span style={{ fontSize: 11, color: 'var(--c-text-light)', width: 24, flexShrink: 0 }}>{unit}</span>
    </div>
  )
}

function PSelect({ label, value, onChange, options }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
      <span style={{ fontSize: 11, color: 'var(--c-text-muted)', flex: 1 }}>{label}</span>
      <select className="form-input" style={{ width: 76, height: 26, fontSize: 12 }} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      <span style={{ width: 24 }} />
    </div>
  )
}

function ReadoutField({ label, unit, value, onChange }) {
  const editable = typeof onChange === 'function'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
      <span style={{ fontSize: 11, color: 'var(--c-text-muted)', flex: 1, minWidth: 0 }}>{label}</span>
      <input
        className="form-input"
        style={{ width: 76, height: 26, fontSize: 12, textAlign: 'right', color: editable ? 'var(--c-text)' : 'var(--c-text-muted)' }}
        value={value}
        readOnly={!editable}
        onChange={editable ? event => onChange(event.target.value) : undefined}
      />
      <span style={{ fontSize: 11, color: 'var(--c-text-light)', width: 24, flexShrink: 0 }}>{unit}</span>
    </div>
  )
}

function TriPhaseVoltageUnbalanceFields({ p, voltageDrafts, onPercentChange, onVoltageChange }) {
  const voltageMap = triVoltageMapFromParams(p)
  const phaseColors = { A:'#dc2626', B:'#16a34a', C:'#2563eb' }
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display:'grid', gridTemplateColumns:'20px 1fr 1fr', gap:5, alignItems:'center', marginBottom:4 }}>
        <span />
        <span style={{ fontSize:9.5, color:'var(--c-text-muted)', textAlign:'right', fontWeight:700 }}>Δ%</span>
        <span style={{ fontSize:9.5, color:'var(--c-text-muted)', textAlign:'right', fontWeight:700 }}>VFN</span>
      </div>
      {TRI_PHASES.map(phase => {
        const phaseDelta = voltageMap.phaseDeltasPct?.[phase] ?? 0
        const phaseVoltage = cx.mag(voltageMap.phases[phase])
        const voltageValue = voltageDrafts[phase] ?? (Math.abs(phaseDelta) > 0.0005 ? fmt(phaseVoltage, 1) : fmtNominalPhaseVoltage(phaseVoltage))
        return (
          <div key={phase} style={{ display:'grid', gridTemplateColumns:'20px 1fr 1fr', gap:5, alignItems:'center', marginBottom:5 }}>
            <span style={{ fontSize:11, fontWeight:900, color:phaseColors[phase] }}>{phase}</span>
            <input
              className="form-input"
              style={{ width:'100%', height:24, fontSize:11, textAlign:'right', padding:'0 5px' }}
              value={p[`vUnbal${phase}`] ?? ''}
              onChange={event => onPercentChange(phase, event.target.value)}
            />
            <input
              className="form-input"
              style={{ width:'100%', height:24, fontSize:11, textAlign:'right', padding:'0 5px' }}
              value={voltageValue}
              onChange={event => onVoltageChange(phase, event.target.value)}
            />
          </div>
        )
      })}
    </div>
  )
}

function Result({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
      <span style={{ fontSize: 11, color: 'var(--c-text-muted)', flex: '1 1 auto', minWidth: 0, paddingRight: 8 }}>{label}</span>
      <span style={{ fontWeight: 700, fontSize: 12, color: highlight ? 'var(--c-danger)' : 'var(--c-text)', textAlign: 'right', whiteSpace: 'nowrap' }}>{value}</span>
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
    <>
    <div style={{ display:'grid', gridTemplateColumns:'210px 1fr 250px', gap:12, padding:12, flex:'1 1 auto', minHeight:0, overflow:'auto' }}>

      {/* Left: params */}
      <div className="panel" style={{ display:'flex', flexDirection:'column', minHeight:0, minWidth:0 }}>
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
    </>
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
  const [p, setP]     = useState(DEFAULT_MONO)
  const [cfg, setCfg] = useState('serie')   // 'serie' | 'paralelo'
  const sp  = (k, v)  => setP(prev => ({ ...prev, [k]: v }))
  const lt  = LOAD_TYPES.find(l => l.id === p.loadType)

  const cs = useMemo(() => calcMono(p),     [p])  // série
  const cp = useMemo(() => calcMonoPara(p), [p])  // paralelo
  const c  = cfg === 'serie' ? cs : cp

  const isSerie = cfg === 'serie'

  return (
    <>
    <div style={{ display:'grid', gridTemplateColumns:'210px 1fr 240px', gap:12, padding:12, flex:'1 1 auto', minHeight:0, overflow:'auto' }}>

      {/* Left: config toggle + type + params */}
      <div className="panel" style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
        <div className="panel__head">Configuração</div>
        <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>

          {/* Série / Paralelo toggle */}
          <div style={{ display:'flex', gap:6, marginBottom:14 }}>
            {['serie','paralelo'].map(m => (
              <button key={m} className={`btn btn-sm${cfg===m?'':' btn-ghost'}`}
                style={{ flex:1, background: cfg===m?'#1d4ed8':undefined, color: cfg===m?'#fff':undefined }}
                onClick={() => setCfg(m)}>
                {m === 'serie' ? '— Série' : '∥ Paralelo'}
              </button>
            ))}
          </div>

          <div style={{ fontSize:11, color:'var(--c-text-muted)', marginBottom:10, lineHeight:1.5 }}>
            {isSerie
              ? 'Componentes em série: mesma corrente, tensões somadas vetorialmente.'
              : 'Componentes em paralelo: mesma tensão, correntes somadas vetorialmente.'}
          </div>

          <Section title="Tipo de Carga">
            {LOAD_TYPES.map(t => (
              <button key={t.id} className="btn btn-sm"
                style={{ width:'100%', textAlign:'left', marginBottom:4,
                  background: p.loadType===t.id ? t.color : 'transparent',
                  color: p.loadType===t.id ? '#fff' : 'var(--c-text)',
                  border: `1px solid ${t.color}`,
                }}
                onClick={() => sp('loadType', t.id)}>{t.label}</button>
            ))}
          </Section>

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

      {/* Center: circuit + phasor */}
      <div style={{ display:'flex', flexDirection:'column', gap:12, minHeight:0 }}>
        <div className="panel" style={{ flexShrink:0 }}>
          <div className="panel__head">Circuito {isSerie ? 'Série' : 'Paralelo'} — {lt?.label ?? ''}</div>
          {isSerie ? <MonoCircuit c={cs} lt={lt} /> : <MonoCircuitPara c={cp} lt={lt} />}
        </div>
        <div className="panel" style={{ flex:1, minHeight:0 }}>
          <div className="panel__head">
            Diagrama Fasorial — ref.: {isSerie ? 'corrente I' : 'tensão Vs'}
          </div>
          {isSerie ? <MonoPhasor c={cs} /> : <MonoPhasorPara c={cp} />}
        </div>
      </div>

      {/* Right: results */}
      <div className="panel" style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
        <div className="panel__head">Resultados</div>
        <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>
          <Section title={`Regime: ${c.nat}`}>
            {isSerie ? <>
              <Result label="Impedância |Z|"  value={`${fmt(c.Z,3)} Ω`} />
              {c.hasL && <Result label="Reatância XL" value={`${fmt(c.XL,3)} Ω`} />}
              {c.hasC && <Result label="Reatância XC" value={`${fmt(c.XC,3)} Ω`} />}
              <Result label="Reatância X"    value={`${fmt(c.X,3)} Ω`} />
            </> : <>
              <Result label="Admitância |Y|" value={`${fmt(c.Y,5)} S`} />
              <Result label="Impedância |Z|" value={`${fmt(c.Z,3)} Ω`} />
              {c.hasR && <Result label="Condutância G" value={`${fmt(c.G,5)} S`} />}
              {c.hasL && <Result label="Suscept. BL"   value={`${fmt(c.BL,5)} S`} />}
              {c.hasC && <Result label="Suscept. BC"   value={`${fmt(c.BC,5)} S`} />}
            </>}
          </Section>
          <Section title={isSerie ? 'Corrente e Quedas de Tensão' : 'Tensão e Correntes de Ramo'}>
            {isSerie ? <>
              <Result label="Corrente I"    value={`${fmt(c.I,4)} A`} />
              {c.hasR && <Result label="VR (R)"  value={`${fmt(c.VR,2)} V`} />}
              {c.hasL && <Result label="VL (L)"  value={`${fmt(c.VL,2)} V`} />}
              {c.hasC && <Result label="VC (C)"  value={`${fmt(c.VC,2)} V`} />}
            </> : <>
              <Result label="Tensão Vs"     value={`${fmt(c.Vs,2)} V`} />
              <Result label="I total"        value={`${fmt(c.I,4)} A`} />
              {c.hasR && <Result label="IR (R)" value={`${fmt(c.I_R,4)} A`} />}
              {c.hasL && <Result label="IL (L)" value={`${fmt(c.I_L,4)} A`} />}
              {c.hasC && <Result label="IC (C)" value={`${fmt(c.I_C,4)} A`} />}
            </>}
          </Section>
          <Section title="Potências">
            <Result label="Pot. ativa P"    value={`${fmt(c.P,1)} W`} />
            <Result label="Pot. reativa Q"  value={`${fmt(Math.abs(c.Q ?? c.Q_L-c.Q_C),1)} var (${c.nat})`} />
            <Result label="Pot. aparente S" value={`${fmt(c.S,1)} VA`} />
            <Result label="Fat. potência FP" value={fmt(c.FP,4)} highlight={c.FP < 0.92 && c.S > 1} />
            <Result label="Ângulo φ"        value={`${fmt(c.phi*180/Math.PI,2)}°`} />
          </Section>
          <Section title="O que cada instrumento lê">
            <div style={{ fontSize:11, lineHeight:1.9, color:'var(--c-text-muted)' }}>
              <b>Amperímetro:</b> {fmt(c.I,4)} A (total)<br/>
              <b>Voltímetro:</b>  {fmt(c.Vs,2)} V<br/>
              <b>Wattímetro:</b>  {fmt(c.P,1)} W<br/>
              <b>Varmetro:</b>    {fmt(Math.abs(c.Q ?? c.Q_L-c.Q_C),1)} var<br/>
              <b>Fasímetro:</b>   φ = {fmt(c.phi*180/Math.PI,2)}° ({c.nat})<br/>
              <b>Cos φ metro:</b> FP = {fmt(c.FP,4)}
            </div>
          </Section>
        </div>
      </div>
    </div>
    </>
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

/* ─── MonoCircuitPara SVG ────────────────────────────────────────────────── */

function MonoCircuitPara({ c, lt }) {
  const clr = lt?.color ?? '#334155'
  const { hasR, hasL, hasC } = c
  // Top rail y=20, bottom rail y=100, parallel branches between them
  return (
    <svg viewBox="0 0 480 115" style={{ width:'100%', height:110 }}>
      {/* source */}
      <circle cx="38" cy="60" r="22" fill="var(--c-surface)" stroke="#334155" strokeWidth="2"/>
      <text x="38" y="56" textAnchor="middle" fontSize="14">~</text>
      <text x="38" y="70" textAnchor="middle" fontSize="9">{fmt(c.Vs,0)}V</text>
      {/* rails */}
      <line x1="38" y1="38" x2="38"  y2="20"  stroke="#334155" strokeWidth="2"/>
      <line x1="38" y1="20" x2="430" y2="20"  stroke="#334155" strokeWidth="2"/>
      <line x1="430" y1="20" x2="430" y2="100" stroke="#334155" strokeWidth="2"/>
      <line x1="38" y1="82" x2="38"  y2="100" stroke="#334155" strokeWidth="2"/>
      <line x1="38" y1="100" x2="430" y2="100" stroke="#334155" strokeWidth="2"/>
      {/* ammeter (measures total I) */}
      <circle cx="76" cy="20" r="12" fill="var(--c-surface)" stroke="#1d4ed8" strokeWidth="2"/>
      <text x="76" y="24" textAnchor="middle" fontSize="10" fontWeight="800" fill="#1d4ed8">A</text>
      <text x="76" y="42" textAnchor="middle" fontSize="8" fill="#1d4ed8">{fmt(c.I,3)} A</text>
      {/* R branch at x=150 */}
      {hasR && <>
        <line x1="150" y1="20" x2="150" y2="34" stroke="#334155" strokeWidth="2"/>
        <rect x="137" y="34" width="26" height="32" fill="var(--c-surface)" stroke={clr} strokeWidth="2" rx="2"/>
        <text x="150" y="54" textAnchor="middle" fontSize="10" fontWeight="700" fill={clr}>R</text>
        <line x1="150" y1="66" x2="150" y2="100" stroke="#334155" strokeWidth="2"/>
        <text x="150" y="112" textAnchor="middle" fontSize="8" fill={clr}>IR={fmt(c.I_R,3)}A</text>
      </>}
      {/* L branch at x=250 */}
      {hasL && <>
        <line x1="250" y1="20" x2="250" y2="32" stroke="#334155" strokeWidth="2"/>
        <path d="M242 32 q8-14 16 0 M242 46 q8-14 16 0" fill="none" stroke={clr} strokeWidth="2"/>
        <line x1="250" y1="60" x2="250" y2="100" stroke="#334155" strokeWidth="2"/>
        <text x="250" y="112" textAnchor="middle" fontSize="8" fill={clr}>IL={fmt(c.I_L,3)}A</text>
      </>}
      {/* C branch at x=350 */}
      {hasC && <>
        <line x1="350" y1="20" x2="350" y2="46" stroke="#334155" strokeWidth="2"/>
        <line x1="338" y1="46" x2="362" y2="46" stroke={clr} strokeWidth="2.5"/>
        <line x1="338" y1="52" x2="362" y2="52" stroke={clr} strokeWidth="2.5"/>
        <line x1="350" y1="52" x2="350" y2="100" stroke="#334155" strokeWidth="2"/>
        <text x="350" y="112" textAnchor="middle" fontSize="8" fill={clr}>IC={fmt(c.I_C,3)}A</text>
      </>}
      {/* voltmeter across source */}
      <circle cx="410" cy="60" r="12" fill="var(--c-surface)" stroke="#7c3aed" strokeWidth="2"/>
      <text x="410" y="64" textAnchor="middle" fontSize="10" fontWeight="800" fill="#7c3aed">V</text>
      <line x1="410" y1="20" x2="410" y2="48" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 2"/>
      <line x1="410" y1="72" x2="410" y2="100" stroke="#7c3aed" strokeWidth="1.5" strokeDasharray="3 2"/>
      <text x="435" y="64" textAnchor="start" fontSize="8" fill="#7c3aed">{fmt(c.Vs,1)}V</text>
    </svg>
  )
}

/* ─── MonoPhasorPara SVG — reference: Vs (horizontal) ────────────────────── */

function MonoPhasorPara({ c }) {
  const W = 420, H = 200, ox = 120, oy = H / 2
  const Imax = Math.max(c.I, 0.001)
  const sc   = 70 / Imax   // current scale
  // Branch currents relative to Vs (horizontal reference)
  const IR_x = ox + sc * c.I_R, IR_y = oy           // horizontal (in-phase)
  const IL_x = ox,              IL_y = oy + sc * c.I_L  // vertical down (lags 90°)
  const IC_x = ox,              IC_y = oy - sc * c.I_C  // vertical up (leads 90°)
  // I_total: horizontal = I_R, vertical = I_C - I_L
  const IT_x = ox + sc * c.I_R
  const IT_y = oy - sc * (c.I_C - c.I_L)

  function Arr({ x2, y2, color, label, sub, dashed }) {
    const dx = x2 - ox, dy = y2 - oy
    const len = Math.sqrt(dx*dx + dy*dy)
    if (len < 3) return null
    const ux = dx/len, uy = dy/len
    const hx = x2 - 8*ux, hy = y2 - 8*uy
    return (
      <g>
        <line x1={ox} y1={oy} x2={hx} y2={hy} stroke={color} strokeWidth={dashed?1.5:2} strokeDasharray={dashed?'5 3':undefined}/>
        <polygon points={`${x2},${y2} ${hx-5*uy},${hy+5*ux} ${hx+5*uy},${hy-5*ux}`} fill={color}/>
        <text x={x2+12*ux} y={y2+12*uy+4} textAnchor="middle" fontSize="9" fill={color} fontWeight="700">{label}</text>
        {sub && <text x={x2+12*ux} y={y2+12*uy+15} textAnchor="middle" fontSize="8" fill={color}>{sub}</text>}
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'calc(100% - 38px)' }}>
      <line x1="0" y1={oy} x2={W} y2={oy} stroke="#e2e8f0"/>
      <line x1={ox} y1="0" x2={ox} y2={H} stroke="#e2e8f0"/>
      <text x="4" y="12" fontSize="9" fill="#94a3b8">Im↑</text>
      <text x={W-30} y={oy-3} fontSize="9" fill="#94a3b8">Re→</text>

      {/* Vs: horizontal reference */}
      <line x1={ox} y1={oy} x2={ox+75} y2={oy} stroke="#1d4ed8" strokeWidth="2.5"/>
      <polygon points={`${ox+75},${oy} ${ox+67},${oy-4} ${ox+67},${oy+4}`} fill="#1d4ed8"/>
      <text x={ox+85} y={oy+4} fontSize="10" fill="#1d4ed8" fontWeight="700">Vs={fmt(c.Vs,1)}V</text>

      {/* Branch currents (dashed) */}
      {c.hasR && <Arr x2={IR_x} y2={IR_y} color="#16a34a" label="IR" sub={`${fmt(c.I_R,3)}A`} dashed/>}
      {c.hasL && <Arr x2={IL_x} y2={IL_y} color="#dc2626" label="IL" sub={`${fmt(c.I_L,3)}A`} dashed/>}
      {c.hasC && <Arr x2={IC_x} y2={IC_y} color="#0284c7" label="IC" sub={`${fmt(c.I_C,3)}A`} dashed/>}
      {/* Total current I (solid) */}
      <Arr x2={IT_x} y2={IT_y} color="#ea580c" label="I" sub={`${fmt(c.I,3)}A`}/>

      {/* phi arc between Vs (0°) and I_total */}
      {Math.abs(c.phi) > 0.02 && (() => {
        const r = 30
        const ex = ox + r, ey = oy + r * Math.sin(c.phi)  // phi>0 = I below Vs
        const sweep = c.phi > 0 ? 1 : 0
        return <>
          <path d={`M ${ex} ${oy} A ${r} ${r} 0 0 ${sweep} ${ox+r*Math.cos(c.phi)} ${oy+r*Math.sin(c.phi)}`}
            fill="none" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2"/>
          <text x={ox+r+5} y={oy+r*Math.sin(c.phi/2)} fontSize="9" fill="#64748b">φ={fmt(c.phi*180/Math.PI,1)}°</text>
        </>
      })()}

      {/* legend */}
      {[
        ['#1d4ed8',`Vs — ${fmt(c.Vs,1)} V (referência)`],
        ['#ea580c',`I — ${fmt(c.I,3)} A (total)`],
        c.hasR?['#16a34a',`IR — ${fmt(c.I_R,3)} A (R, fase com Vs)`]:null,
        c.hasL?['#dc2626',`IL — ${fmt(c.I_L,3)} A (L, −90° de Vs)`]:null,
        c.hasC?['#0284c7',`IC — ${fmt(c.I_C,3)} A (C, +90° de Vs)`]:null,
      ].filter(Boolean).map(([col,txt],i)=>(
        <g key={i}>
          <rect x={230} y={8+i*17} width={9} height={9} fill={col} rx="2"/>
          <text x={242} y={18+i*17} fontSize="9" fill="var(--c-text)">{txt}</text>
        </g>
      ))}
      <text x={W/2} y={H-4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#334155">
        {c.nat}  ·  FP = {fmt(c.FP,4)}  ·  φ = {fmt(c.phi*180/Math.PI,2)}°
      </text>
    </svg>
  )
}

/* ─── TriPhasor3F SVG ────────────────────────────────────────────────────── */

function TriPhasor3F({ VA_I, VB_I, VC_I, V_ph, inLabel }) {
  const W = 330, H = 210, ox = W/2, oy = H/2
  const scV = 62 / (V_ph || 1)
  const iMags = [cx.mag(VA_I.I), cx.mag(VB_I.I), cx.mag(VC_I.I)]
  const maxI  = Math.max(...iMags, 0.01)
  const scI   = 46 / maxI

  function Arr({ z, color, label, dashed, scale }) {
    const x2 = ox + scale * z[0], y2 = oy - scale * z[1]
    const dx = x2 - ox, dy = y2 - oy
    const len = Math.sqrt(dx*dx + dy*dy)
    if (len < 4) return null
    const ux = dx/len, uy = dy/len
    const hx = x2 - 7*ux, hy = y2 - 7*uy
    return (
      <g>
        <line x1={ox} y1={oy} x2={hx} y2={hy} stroke={color} strokeWidth={dashed?1.5:2} strokeDasharray={dashed?'5 3':undefined}/>
        <polygon points={`${x2},${y2} ${hx-4*uy},${hy+4*ux} ${hx+4*uy},${hy-4*ux}`} fill={color}/>
        <text x={x2+10*ux} y={y2-10*uy} textAnchor="middle" fontSize="9" fill={color} fontWeight="700">{label}</text>
      </g>
    )
  }

  const pairs = [
    { V: VA_I.V, I: VA_I.I, vClr:'#dc2626', iClr:'#f97316', lV:'VA', lI:'IA' },
    { V: VB_I.V, I: VB_I.I, vClr:'#16a34a', iClr:'#65a30d', lV:'VB', lI:'IB' },
    { V: VC_I.V, I: VC_I.I, vClr:'#2563eb', iClr:'#7c3aed', lV:'VC', lI:'IC' },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'calc(100% - 38px)' }}>
      <line x1="0" y1={oy} x2={W} y2={oy} stroke="#e2e8f0"/>
      <line x1={ox} y1="0" x2={ox} y2={H} stroke="#e2e8f0"/>
      <text x="4" y="12" fontSize="9" fill="#94a3b8">Im↑</text>
      <text x={W-22} y={oy-3} fontSize="9" fill="#94a3b8">Re→</text>
      {pairs.flatMap(({V,I,vClr,iClr,lV,lI}) => [
        V ? <Arr key={lV} z={V} color={vClr} label={lV} scale={scV}/> : null,
        I ? <Arr key={lI} z={I} color={iClr} label={lI} dashed scale={scI}/> : null,
      ])}
      {/* Legend */}
      {pairs.map(({vClr,iClr,lV,lI},i)=>(
        <g key={i}>
          <rect x={10} y={8+i*28} width={8} height={8} fill={vClr} rx="1"/>
          <text x={21} y={16+i*28} fontSize="8" fill="var(--c-text)">{lV} (tensão)</text>
          <rect x={10} y={19+i*28} width={8} height={8} fill={iClr} rx="1"/>
          <text x={21} y={27+i*28} fontSize="8" fill="var(--c-text)">{lI} (corrente)</text>
        </g>
      ))}
      <text x={ox} y={H-4} textAnchor="middle" fontSize="10" fill="#64748b">
        Escala V: ×{(1/scV).toFixed(1)}  ·  Escala I: ×{(1/scI).toFixed(3)}  ·  {inLabel}
      </text>
    </svg>
  )
}

/* ─── LoadParamFields helper ─────────────────────────────────────────────── */

function LoadParamFields({ lt, prefix, vals, onChange }) {
  const T = TRI_LOAD_TYPES.find(t => t.id === lt) ?? TRI_LOAD_TYPES.find(t => t.id === 'RLC')
  const has = f => T.fields.includes(f)
  const p   = prefix ? prefix+'_' : ''
  return <>
    {has('R')   && <PField label="R" unit="Ω" value={vals[p+'R']   ?? ''}     onChange={v=>onChange(p+'R',v)}/>}
    {has('L')   && <PField label="L" unit="H" value={vals[p+'L']   ?? ''}     onChange={v=>onChange(p+'L',v)}/>}
    {has('C')   && <PField label="C" unit="F" value={vals[p+'C']   ?? ''}     onChange={v=>onChange(p+'C',v)}/>}
    {has('Pn')  && <PField label="Pn"  unit="kW" value={vals[p+'Pn']  ?? '37'}  onChange={v=>onChange(p+'Pn',v)}/>}
    {has('eta') && <PField label="η"   unit="%"  value={vals[p+'eta'] ?? '92'}  onChange={v=>onChange(p+'eta',v)}/>}
    {has('FPm') && <PField label="FP motor" unit="" value={vals[p+'FPm'] ?? '0,87'} onChange={v=>onChange(p+'FPm',v)}/>}
    {has('Cuf') && <PField label="C" unit="μF" value={vals[p+'Cuf'] ?? '50'}   onChange={v=>onChange(p+'Cuf',v)}/>}
  </>
}

function TriConnectionPicker({ value, onChange, includeABC = true }) {
  const options = includeABC ? TRI_CONNECTION_OPTIONS : TRI_DIRECT_CONNECTION_OPTIONS
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:4, marginBottom:8 }}>
      {options.map(option => (
        <button key={option.id} className={`btn btn-sm${value === option.id ? '' : ' btn-ghost'}`}
          style={{ justifyContent:'center', fontSize:9, padding:'3px 4px' }}
          onClick={()=>onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

function TriAbcLoadFields({ load, onChange }) {
  const abcLoad = {
    ...load,
    abcLigacao: load.abcLigacao || 'Y',
    abcBalanco: load.abcBalanco || 'eq',
  }

  return (
    <>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        {[['Y','Estrela'],['D','Triângulo']].map(([value, label]) => (
          <button key={value} className={`btn btn-sm${abcLoad.abcLigacao === value ? '' : ' btn-ghost'}`}
            style={{ flex:1, justifyContent:'center', fontSize:10 }}
            onClick={()=>onChange('abcLigacao', value)}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        {[['eq','Equilibrado'],['deseq','Desequilibrado']].map(([value, label]) => (
          <button key={value} className={`btn btn-sm${abcLoad.abcBalanco === value ? '' : ' btn-ghost'}`}
            style={{ flex:1, justifyContent:'center', fontSize:10 }}
            onClick={()=>onChange('abcBalanco', value)}>
            {label}
          </button>
        ))}
      </div>
      {abcLoad.abcBalanco === 'eq' ? (
        <LoadParamFields lt="RLC" prefix="" vals={abcLoad} onChange={onChange}/>
      ) : (
        triAbcTargets(abcLoad).map(target => {
          const targetLoad = triAbcTargetLoad(abcLoad, target)
          const setTarget = (key, value) => onChange(`${target}_${key}`, value)
          return (
            <div key={target} className="surface-box" style={{ padding:8, marginBottom:7 }}>
              <div style={{ fontSize:11, fontWeight:800, marginBottom:7 }}>{triScopeShort(target)}</div>
              <LoadParamFields lt="RLC" prefix="" vals={targetLoad} onChange={setTarget}/>
            </div>
          )
        })
      )}
    </>
  )
}

function TriInlineLoadEditor({ load, onChange, onClose, onRemove }) {
  return (
    <div
      style={{
        height:'100%',
        boxSizing:'border-box',
        display:'flex',
        flexDirection:'column',
        padding:9,
        border:'1px solid var(--c-primary)',
        borderRadius:8,
        background:'var(--c-surface)',
        boxShadow:'0 18px 38px rgba(15,23,42,.26)',
        color:'var(--c-text)',
        fontSize:11,
        overflow:'hidden',
      }}
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
    >
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8, flex:'0 0 auto' }}>
        <b style={{ fontSize:12 }}>Editar carga</b>
        <span style={{ marginLeft:'auto', color:'var(--c-text-muted)', fontWeight:800 }}>{triScopeShort(load.scope)}</span>
        <button
          className="btn btn-ghost btn-sm"
          style={{ width:24, height:24, padding:0, justifyContent:'center' }}
          onClick={onClose}
          title="Fechar"
        >
          ×
        </button>
      </div>
      <div style={{ flex:'1 1 auto', minHeight:0, overflow:'auto', paddingRight:4 }}>
        <TriConnectionPicker value={load.scope} onChange={v=>onChange('scope', v)} />
        {load.scope === 'ABC' ? (
          <TriAbcLoadFields load={load} onChange={onChange} />
        ) : (
          <>
            <PField label="Qtd." unit="" value={load.qty} onChange={v=>onChange('qty', v)} />
            <LoadParamFields lt="RLC" prefix="" vals={load} onChange={onChange}/>
          </>
        )}
      </div>
      <div style={{ display:'flex', gap:6, marginTop:8, flex:'0 0 auto' }}>
        <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:'center' }} onClick={onClose}>
          Fechar
        </button>
        <button className="btn btn-ghost btn-sm" style={{ flex:1, justifyContent:'center', color:'var(--c-danger)' }} onClick={onRemove}>
          Remover
        </button>
      </div>
    </div>
  )
}

function triType(id) {
  return TRI_LOAD_TYPES.find(t => t.id === id) ?? TRI_LOAD_TYPES[0]
}

function triHasValue(value) {
  return value != null && String(value).trim() !== ''
}

function triValueWithUnit(value, unit) {
  const text = String(value).trim()
  return /[a-zA-ZΩµμ%]/.test(text) ? text : `${text} ${unit}`
}

function triSpecParts(spec) {
  return spec.type.fields.map(field => {
    if (field === 'R') return triHasValue(spec.vals.R) ? `R ${triValueWithUnit(spec.vals.R, 'Ω')}` : ''
    if (field === 'L') return triHasValue(spec.vals.L) ? `L ${triValueWithUnit(spec.vals.L, 'H')}` : ''
    if (field === 'C') return triHasValue(spec.vals.C) ? `C ${triValueWithUnit(spec.vals.C, 'F')}` : ''
    if (field === 'Cuf') return triHasValue(spec.vals.Cuf) ? `C ${triValueWithUnit(spec.vals.Cuf, 'μF')}` : ''
    if (field === 'Pn') return triHasValue(spec.vals.Pn) ? `Pn ${triValueWithUnit(spec.vals.Pn, 'kW')}` : ''
    if (field === 'eta') return triHasValue(spec.vals.eta) ? `η ${triValueWithUnit(spec.vals.eta, '%')}` : ''
    if (field === 'FPm') return triHasValue(spec.vals.FPm) ? `FP ${spec.vals.FPm}` : ''
    return ''
  }).filter(Boolean)
}

function triSpecFullLine(spec) {
  return triSpecParts(spec).join(' · ') || 'Sem elementos'
}

function triSpecTextLines(spec, size = 2) {
  const parts = triSpecParts(spec)
  if (parts.length === 0) return ['Sem elementos']
  const lines = []
  for (let i = 0; i < parts.length; i += size) {
    lines.push(parts.slice(i, i + size).join(' · '))
  }
  return lines
}

function TriCircuitBuilderSvg({ p, circuit, loads, wattmeterReadings, selectedLoadId, onSelectLoad, onUpdateLoad, onRemoveLoad, onCloseEditor }) {
  const colors = { A:'#dc2626', B:'#16a34a', C:'#2563eb', N:'#64748b', AB:'#dc2626', BC:'#16a34a', CA:'#2563eb' }
  const visualCount = Math.max(1, loads.length)
  const W = Math.max(880, 260 + visualCount * 200)
  const H = 515
  const y = { A:64, B:106, C:148, N:392 }
  const loadW = 176
  const loadH = 148
  const loadTop = 192
  const loadBottom = loadTop + loadH
  const sourceY = y.B
  const sourceUnbalanceLines = circuit.voltageUnbalancePct
    ? TRI_PHASES.map(phase => {
      const pct = circuit.phaseVoltageDeltasPct?.[phase] ?? 0
      return {
        phase,
        text: `${phase}: ${pct >= 0 ? '+' : ''}${fmt(pct, 1)}%`,
      }
    })
    : []
  const phaseCurrentLabels = ['A', 'B', 'C'].map(ph => {
    const I = circuit.lineCurrents?.[ph] || [0, 0]
    return `I${ph} = ${fmt(cx.mag(I), 3)} ∠ ${fmt(cx.arg(I) * 180 / Math.PI, 1)}° A`
  })
  const neutralCurrentLabel = circuit.IN
    ? `IN = ${fmt(cx.mag(circuit.IN), 3)} ∠ ${fmt(cx.arg(circuit.IN) * 180 / Math.PI, 1)}° A`
    : null
  const wattmeterSummaryLines = wattmeterReadings?.readings?.length ? [
    `${wattmeterReadings.mode === '2' ? 'Aron (3 fios)' : 'Wattímetros'} · ${wattmeterReadings.readings.map(item => `${item.id}=${fmt(item.P/1000, 4)} kW`).join(' · ')}`,
    wattmeterReadings.readings.length > 1
      ? wattmeterReadings.mode === '2' && !wattmeterReadings.aronApplicable
        ? `Aron não aplicável ao total · IN = ${fmt(wattmeterReadings.neutral, 4)} A`
        : `Soma W = ${fmt(wattmeterReadings.total/1000, 4)} kW · ΔP = ${fmt(wattmeterReadings.error/1000, 4)} kW`
      : null,
  ].filter(Boolean) : []
  const summaryLines = [
    `Resumo total · P = ${fmt(circuit.P_tot/1000, 2)} kW · Q = ${fmt(circuit.Q_tot/1000, 2)} kvar · S = ${fmt(circuit.S_tot/1000, 2)} kVA · FP = ${fmt(circuit.FP_tot, 4)}`,
    ...wattmeterSummaryLines,
    phaseCurrentLabels.join(' · '),
    neutralCurrentLabel,
  ].filter(Boolean)
  const summaryBoxH = 18 + summaryLines.length * 14
  const summaryBoxY = H - summaryBoxH - 12
  const selectedLoadIndex = loads.findIndex(load => load.id === selectedLoadId)
  const selectedLoad = selectedLoadIndex >= 0 ? loads[selectedLoadIndex] : null

  function loadCenterX(index) {
    return 292 + index * 200
  }

  function PhaseBuses() {
    return (
      <>
        {['A','B','C'].map(ph => (
          <g key={ph}>
            <line x1="112" y1={y[ph]} x2={W-45} y2={y[ph]} stroke={colors[ph]} strokeWidth="3" />
            <text x="125" y={y[ph]-8} fontSize="13" fontWeight="800" fill={colors[ph]}>{ph}</text>
          </g>
        ))}
        <g>
          <line x1="112" y1={y.N} x2={W-45} y2={y.N} stroke={colors.N} strokeWidth="2" strokeDasharray="5 4" />
          <text x="125" y={y.N-8} fontSize="13" fontWeight="800" fill={colors.N}>N</text>
        </g>
      </>
    )
  }

  function WattmeterInstruments() {
    const readings = wattmeterReadings?.readings || []
    if (!readings.length) return null
    return (
      <g>
        {readings.map(item => {
          const mx = 152
          const my = y[item.phase]
          const refY = item.ref === 'N' ? y.N : y[item.ref]
          const leadX = mx + 14
          return (
            <g key={item.id}>
              <line x1={leadX} y1={my} x2={leadX} y2={refY} stroke="#d97706" strokeWidth="1.6" strokeDasharray="4 4" opacity=".9" />
              <circle cx={leadX} cy={refY} r="3.2" fill="#d97706" />
              <circle cx={mx} cy={my} r="11" fill="var(--c-surface)" stroke="#d97706" strokeWidth="2" />
              <text x={mx} y={my + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="#d97706">W</text>
              <text x={mx} y={my - 15} textAnchor="middle" fontSize="8" fontWeight="800" fill="#92400e">{item.id}</text>
              <title>{`${item.id}: I${item.phase}, V${item.voltageLabel}, ${fmt(item.P/1000, 4)} kW`}</title>
            </g>
          )
        })}
      </g>
    )
  }

  function phaseTerminals(load, targets) {
    const phaseOrder = ['A', 'B', 'C']
    return [...new Set(targets.flatMap(target => target === 'ABC' ? phaseOrder : target.split('')))]
      .sort((a, b) => phaseOrder.indexOf(a) - phaseOrder.indexOf(b))
  }

  function terminalXMap(terminals, center) {
    const spread = terminals.length <= 1 ? 0 : terminals.length === 2 ? 34 : 48
    return terminals.reduce((map, terminal, index) => {
      const offset = terminals.length <= 1 ? 0 : -spread + (2 * spread * index) / (terminals.length - 1)
      return { ...map, [terminal]: center + offset }
    }, {})
  }

  function triAbcModeText(load) {
    const ligacao = load.abcLigacao === 'D' ? 'Triângulo' : 'Estrela'
    const balanco = load.abcBalanco === 'deseq' ? 'deseq.' : 'eq.'
    return `${ligacao} · ${balanco}`
  }

  function triTargetSpecText(load, target) {
    const branchLoad = triTargetLoad(load, target) || load
    const spec = { type: triType(branchLoad.type), vals: triLoadVals(branchLoad) }
    const detail = triSpecParts(spec).slice(0, 2).join(' · ')
    return `${triScopeShort(target)} · ${detail || 'Sem elementos'}`
  }

  function editorPosition(index, load) {
    const popoverW = 270
    const popoverH = load.scope === 'ABC' && load.abcBalanco === 'deseq' ? 332 : 286
    const rectX = loadCenterX(index) - loadW/2
    const rightX = rectX + loadW - 18
    const leftX = rectX - popoverW + 18
    const x = rightX + popoverW > W - 24 ? Math.max(24, leftX) : rightX
    const y0 = loadTop - 50
    const y = Math.min(Math.max(48, y0), H - popoverH - 24)
    return { x, y, w: popoverW, h: popoverH }
  }

  function CircuitLoadRect({ load, index }) {
    const x = loadCenterX(index)
    const targets = triLoadTargets(load)
    const terminals = phaseTerminals(load, targets)
    const terminalXs = terminalXMap(terminals, x)
    const spec = { type: triType(load.type), vals: triLoadVals(load) }
    const qty = Math.max(1, Math.round(parseNum(load.qty) || 1))
    const scope = triScopeShort(load.scope)
    const isAbc = load.scope === 'ABC'
    const power = triLoadContribution(load, p)
    const currentLines = targets.map(target => ({ label: target, ...triLoadCurrentInfo(load, p, target) }))
    const specLines = isAbc && load.abcBalanco === 'deseq'
      ? targets.map(target => triTargetSpecText(load, target))
      : triSpecTextLines(spec, 2)
    const accentColor = isAbc && load.abcBalanco === 'deseq' ? '#475569' : spec.type.color
    const headerText = isAbc
      ? `ABC · ${triAbcModeText(load)} · x${qty}`
      : `${scope} · x${qty}`
    const titleText = isAbc
      ? `${scope}: ${triAbcModeText(load)} — ${specLines.join(' | ')}`
      : `${scope}: ${triSpecFullLine(spec)}`
    const powerY = loadTop + 45 + specLines.length * 11
    const currentY = powerY + 34
    const hasNeutral = targets.some(target => ['A', 'B', 'C'].includes(target))
    const selected = selectedLoadId === load.id
    const rectX = x - loadW/2
    const rectY = loadTop

    return (
      <g
        onClick={() => onSelectLoad?.(load.id)}
        style={{ cursor:'pointer' }}
      >
        {terminals.map(terminal => {
          const tx = terminalXs[terminal]
          return (
            <g key={terminal}>
              <line x1={tx} y1={y[terminal]} x2={tx} y2={loadTop} stroke={colors[terminal]} strokeWidth="2.2" />
              <circle cx={tx} cy={y[terminal]} r="4" fill={colors[terminal]} />
              <circle cx={tx} cy={loadTop} r="3.5" fill={colors[terminal]} />
            </g>
          )
        })}
        {hasNeutral && (
          <g>
            <line x1={x} y1={loadBottom} x2={x} y2={y.N} stroke={colors.N} strokeWidth="2" strokeDasharray="4 3" />
            <circle cx={x} cy={loadBottom} r="3.5" fill={colors.N} />
            <circle cx={x} cy={y.N} r="4" fill={colors.N} />
          </g>
        )}
        <rect
          x={rectX}
          y={rectY}
          width={loadW}
          height={loadH}
          rx="8"
          fill="var(--c-surface)"
          stroke={selected ? 'var(--c-primary)' : accentColor}
          strokeWidth={selected ? '3' : '2'}
        />
        <g
          onClick={event => {
            event.stopPropagation()
            onRemoveLoad?.(load.id)
          }}
          style={{ cursor:'pointer' }}
        >
          <circle cx={rectX + loadW - 12} cy={rectY + 12} r="9" fill="#fee2e2" stroke="#dc2626" strokeWidth="1.5" />
          <text x={rectX + loadW - 12} y={rectY + 16} textAnchor="middle" fontSize="12" fontWeight="900" fill="#dc2626">×</text>
          <title>Remover carga</title>
        </g>
        <text x={x} y={loadTop + 18} textAnchor="middle" fontSize="11.5" fontWeight="800" fill={accentColor}>
          {headerText}
        </text>
        {specLines.map((line, lineIndex) => (
          <text key={`${line}-${lineIndex}`} x={x} y={loadTop + 37 + lineIndex * 11} textAnchor="middle" fontSize="8.5" fontWeight="750" fill="var(--c-text)">
            {line}
          </text>
        ))}
        <text x={x} y={powerY} textAnchor="middle" fontSize="8.5" fill="var(--c-text-muted)">
          P {fmt(power.P/1000, 2)} kW · Q {fmt(power.Q/1000, 2)} kvar
        </text>
        <text x={x} y={powerY + 15} textAnchor="middle" fontSize="8.5" fill="var(--c-text-muted)">
          S {fmt(power.S/1000, 2)} kVA · Imax {fmt(power.I, 3)} A
        </text>
        {currentLines.map((line, lineIndex) => (
          <text key={line.label} x={x} y={currentY + lineIndex * 12} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--c-text-muted)">
            I{line.label} {fmt(line.mag, 3)} ∠ {fmt(line.angle, 1)}° A
          </text>
        ))}
        <title>{titleText}</title>
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:W, height:H, maxWidth:'none', display:'block' }}>
      <rect x="10" y="10" width={W-20} height={H-20} rx="8" fill="var(--c-surface-2)" stroke="var(--c-border)" />
      <text x="28" y="34" fontSize="12" fontWeight="800" fill="var(--c-text)">
        Circuito montado · 3F+N · cargas fase-neutro e entre fases
      </text>
      <circle cx="70" cy={sourceY} r="31" fill="var(--c-surface)" stroke="var(--c-text)" strokeWidth="2" />
      <text x="70" y={sourceY + 7} textAnchor="middle" fontSize="24">~</text>
      <text x="70" y={sourceY + 49} textAnchor="middle" fontSize="10" fill="var(--c-text-muted)">{p.VL} V / {p.freq} Hz</text>
      {sourceUnbalanceLines.length > 0 && (
        <g fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
          {sourceUnbalanceLines.map((line, index) => (
            <text
              key={line.phase}
              x="44"
              y={sourceY + 64 + index * 12}
              textAnchor="start"
              fontSize="9"
              fontWeight="800"
              fill={colors[line.phase]}
            >
              {line.text}
            </text>
          ))}
        </g>
      )}
      <PhaseBuses />
      <WattmeterInstruments />
      {loads.map((load, index) => <CircuitLoadRect key={load.id} load={load} index={index} />)}

      {loads.length === 0 && (
        <text x={W/2} y={H/2} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--c-text-muted)">
          Adicione uma carga para montar o circuito trifásico
        </text>
      )}
      <g>
        <rect
          x="20"
          y={summaryBoxY}
          width={W - 40}
          height={summaryBoxH}
          rx="8"
          fill="var(--c-surface)"
          stroke="var(--c-border)"
        />
        {summaryLines.map((line, index) => (
          <text
            key={line}
            x="32"
            y={summaryBoxY + 19 + index * 14}
            fontSize="10.5"
            fontWeight={index === 0 ? '800' : '700'}
            fill={line.startsWith('Aron não aplicável') ? 'var(--c-danger)' : 'var(--c-text-muted)'}
          >
            {line}
          </text>
        ))}
      </g>
      {selectedLoad && (() => {
        const pos = editorPosition(selectedLoadIndex, selectedLoad)
        const anchorX = loadCenterX(selectedLoadIndex)
        const anchorY = loadTop + 26
        const sideX = pos.x > anchorX ? pos.x : pos.x + pos.w
        return (
          <g>
            <line x1={anchorX} y1={anchorY} x2={sideX} y2={pos.y + 24} stroke="var(--c-primary)" strokeWidth="2" strokeDasharray="4 4" />
            <circle cx={anchorX} cy={anchorY} r="4" fill="var(--c-primary)" />
            <foreignObject
              x={pos.x}
              y={pos.y}
              width={pos.w}
              height={pos.h}
              style={{ overflow:'visible', pointerEvents:'auto' }}
            >
              <div xmlns="http://www.w3.org/1999/xhtml" style={{ height:'100%' }}>
                <TriInlineLoadEditor
                  load={selectedLoad}
                  onChange={(key, value) => onUpdateLoad?.(selectedLoad.id, key, value)}
                  onClose={onCloseEditor}
                  onRemove={() => onRemoveLoad?.(selectedLoad.id)}
                />
              </div>
            </foreignObject>
          </g>
        )
      })()}
    </svg>
  )
}

function triLoadCurrentInfo(load, p, target) {
  const VL = parseNum(p.VL) || 13800
  const f = parseNum(p.freq) || 60
  const branchLoad = triTargetLoad(load, target) || load
  const Y = triLoadAdmittance(branchLoad, f, VL)
  const voltages = triVoltageMapFromParams(p).all
  const V = voltages[target] || [0, 0]
  const I = cx.mul(V, Y)

  return { mag: cx.mag(I), angle: cx.arg(I) * 180 / Math.PI }
}

function triLoadContribution(load, p) {
  const VL = parseNum(p.VL) || 13800
  const f = parseNum(p.freq) || 60
  const targets = triLoadTargets(load)
  const voltages = triVoltageMapFromParams(p).all

  return targets.reduce((sum, target) => {
    const branchLoad = triTargetLoad(load, target)
    if (!branchLoad) return sum
    const Y = triLoadAdmittance(branchLoad, f, VL)
    const V = voltages[target]
    const I = cx.mul(V, Y)
    const P = cx.P(V, I)
    const Q = cx.Q(V, I)
    const S = cx.mag(V) * cx.mag(I)
    return {
      P: sum.P + P,
      Q: sum.Q + Q,
      S: sum.S + S,
      I: Math.max(sum.I, cx.mag(I)),
    }
  }, { P: 0, Q: 0, S: 0, I: 0 })
}

function triFixed(value, digits = 4) {
  return Number.isFinite(value) ? +value.toFixed(digits) : 0
}

function triCircuitEvolutionPoint(circuit, name) {
  return {
    name,
    fp: triFixed(circuit.S_tot > 1e-9 ? Math.abs(circuit.P_tot) / circuit.S_tot : 1),
    ia: triFixed(cx.mag(circuit.lineCurrents.A)),
    ib: triFixed(cx.mag(circuit.lineCurrents.B)),
    ic: triFixed(cx.mag(circuit.lineCurrents.C)),
    in: triFixed(cx.mag(circuit.IN)),
  }
}

function triLoadChartData(loads, p) {
  const points = [triCircuitEvolutionPoint(calcTriCircuitLoads(p, []), '0')]
  loads.forEach((load, index) => {
    const label = load.scope === 'ABC'
      ? `${index + 1} ABC`
      : `${index + 1} ${triScopeShort(load.scope)}`
    points.push(triCircuitEvolutionPoint(calcTriCircuitLoads(p, loads.slice(0, index + 1)), label))
  })
  return points
}

function TriLoadCharts({ data }) {
  const chartData = data.length ? data : [{ name:'0', fp:1, ia:0, ib:0, ic:0, in:0 }]
  const tick = { fontSize: 9 }
  const tooltipStyle = {
    background:'var(--c-surface)',
    border:'1px solid var(--c-border)',
    color:'var(--c-text)',
    fontSize:11,
  }
  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:8, height:'calc(100% - 38px)', padding:8, minHeight:0 }}>
      <div style={{ minHeight:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={tick} interval={0} />
            <YAxis tick={tick} domain={[0, 1]} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => fmt(value, 4)} />
            <Line type="monotone" dataKey="fp" name="FP" stroke="#7c3aed" strokeWidth={2.4} dot={false} activeDot={{ r:4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ minHeight:0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={tick} interval={0} />
            <YAxis tick={tick} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${fmt(value, 4)} A`, name]} />
            <Legend wrapperStyle={{ fontSize: 10 }} />
            <Line type="monotone" dataKey="ia" name="IA" stroke="#dc2626" strokeWidth={2} dot={false} activeDot={{ r:4 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="ib" name="IB" stroke="#16a34a" strokeWidth={2} dot={false} activeDot={{ r:4 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="ic" name="IC" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r:4 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="in" name="IN" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r:4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/* ─── SubCATri ────────────────────────────────────────────────────────────── */

function SubCATri() {
  const [p, setP]           = useState(DEFAULT_TRI_LOADS)
  const [triLoads, setTriLoads] = useState(TRI_DEFAULT_CIRCUIT_LOADS)
  const [loadDraft, setLoadDraft] = useState({ ...TRI_LOAD_BASE, scope:'A', abcLigacao:'Y', abcBalanco:'eq' })
  const [selectedLoadId, setSelectedLoadId] = useState(null)
  const [wattmeter, setWattmeter] = useState({ mode:'0', phase:'A', ref:'B' })
  const [phaseVoltageDrafts, setPhaseVoltageDrafts] = useState({})
  const [nominalPhaseVoltageDraft, setNominalPhaseVoltageDraft] = useState(null)
  const sp = (k, v) => {
    if (k === 'VL') {
      setPhaseVoltageDrafts({})
      setNominalPhaseVoltageDraft(null)
    }
    setP(prev => ({...prev, [k]: v}))
  }
  const sd = (k, v) => setLoadDraft(prev => ({ ...prev, [k]: v }))
  const sw = (k, v) => setWattmeter(prev => ({ ...prev, [k]: v }))

  const triCircuit = useMemo(() => calcTriCircuitLoads(p, triLoads), [p, triLoads])
  const triCharts = useMemo(() => triLoadChartData(triLoads, p), [triLoads, p])
  const wattmeterReadings = useMemo(() => triWattmeterReadings(triCircuit, wattmeter), [triCircuit, wattmeter])
  const nominalPhaseVoltage = (parseNum(p.VL) || 13800) / Math.sqrt(3)
  const nominalPhaseVoltageValue = nominalPhaseVoltageDraft ?? fmtNominalPhaseVoltage(nominalPhaseVoltage)

  function setNominalPhaseVoltageValue(value) {
    setNominalPhaseVoltageDraft(value)
    setPhaseVoltageDrafts({})
    if (!String(value).trim()) {
      setP(prev => ({ ...prev, VL: '' }))
      return
    }

    const actual = parseNum(value, 'V')
    if (!Number.isFinite(actual) || actual <= 0) return
    const nextVL = nominalLineVoltageFromPhase(actual)
    setP(prev => ({ ...prev, VL: fmtInput(nextVL, 3) }))
  }

  function setPhaseVoltagePercent(phase, value) {
    const VL = parseNum(p.VL) || 13800
    const Vph = VL / Math.sqrt(3)
    const pct = triPhaseVoltageDeltaPct({ [`vUnbal${phase}`]: value }, phase)
    const nextVoltage = Vph * (1 + pct / 100)
    setPhaseVoltageDrafts(prev => ({
      ...prev,
      [phase]: fmt(nextVoltage, 1),
    }))
    sp(`vUnbal${phase}`, value)
  }

  function setPhaseVoltageValue(phase, value) {
    setPhaseVoltageDrafts(prev => ({
      ...prev,
      [phase]: value,
    }))
    if (!String(value).trim()) {
      sp(`vUnbal${phase}`, '')
      return
    }

    const VL = parseNum(p.VL) || 13800
    const Vph = VL / Math.sqrt(3)
    const actual = parseNum(value, 'V')
    if (!Number.isFinite(actual) || Vph <= 0) return
    const pct = Math.max(-100, Math.min((actual / Vph - 1) * 100, 100))
    sp(`vUnbal${phase}`, fmt(pct, 3))
  }

  function addTriLoad() {
    const startId = triNextLoadId(triLoads)
    setTriLoads(prev => [
      ...prev,
      ...triLoadsFromDraft(loadDraft, startId),
    ])
    setSelectedLoadId(startId)
  }

  function updateTriLoad(id, key, value) {
    setTriLoads(prev => prev.map(load => {
      if (load.id !== id) return load
      const next = { ...load, [key]: value }
      if (key === 'scope' && value === 'ABC') {
        next.abcLigacao = next.abcLigacao || 'Y'
        next.abcBalanco = next.abcBalanco || 'eq'
        next.qty = '1'
      }
      return triLoadWithDefaults(next)
    }))
  }

  function removeTriLoad(id) {
    setTriLoads(prev => prev.filter(load => load.id !== id))
    setSelectedLoadId(prev => prev === id ? null : prev)
  }

  function applyExampleLoads() {
    const loads = triExampleLoads()
    setTriLoads(loads)
    setSelectedLoadId(loads[0]?.id ?? null)
  }

  // Resolve unified phasor data
  const phasors = useMemo(() => {
    const rs = triCircuit.results
    return {
      VA_I: { V: rs[0].V, I: triCircuit.lineCurrents.A },
      VB_I: { V: rs[1].V, I: triCircuit.lineCurrents.B },
      VC_I: { V: rs[2].V, I: triCircuit.lineCurrents.C },
      V_ph: triCircuit.V_ph,
    }
  }, [triCircuit])

  const pLabel = triCircuit.voltageUnbalancePct > 0
    ? '3F+N · Deseq. V por fase'
    : '3F+N'

  // ── Análise de Cargas mode ────────────────────────────────────────────────
  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px minmax(0, 1fr) 300px', gap:12, padding:12, flex:'1 1 auto', minHeight:0, width:'100%', maxWidth:'100%', boxSizing:'border-box', overflow:'hidden' }}>

      {/* LEFT: config */}
      <div className="panel" style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
        <div className="panel__head">Configuração CA Trifásico</div>
        <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>

          <Section title="Fonte">
            <PField label="V linha" unit="V" value={p.VL}   onChange={v=>sp('VL',v)}/>
            <ReadoutField label="V fase" unit="V" value={nominalPhaseVoltageValue} onChange={setNominalPhaseVoltageValue}/>
            <PField label="Freq."   unit="Hz" value={p.freq} onChange={v=>sp('freq',v)}/>
            <TriPhaseVoltageUnbalanceFields
              p={p}
              voltageDrafts={phaseVoltageDrafts}
              onPercentChange={setPhaseVoltagePercent}
              onVoltageChange={setPhaseVoltageValue}
            />
          </Section>

          <Section title="Wattímetro">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0, 1fr))', gap:5, marginBottom:8 }}>
              {[['0','Sem'],['1','1W'],['2','2W'],['3','3W']].map(([value, label]) => (
                <button key={value} className={`btn btn-sm${wattmeter.mode === value ? '' : ' btn-ghost'}`}
                  style={{ justifyContent:'center', fontSize:10 }}
                  onClick={()=>sw('mode', value)}>
                  {label}
                </button>
              ))}
            </div>
            {wattmeter.mode === '1' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:5 }}>
                {TRI_PHASES.map(phase => (
                  <button key={phase} className={`btn btn-sm${wattmeter.phase === phase ? '' : ' btn-ghost'}`}
                    style={{ justifyContent:'center', fontSize:10 }}
                    onClick={()=>sw('phase', phase)}>
                    Fase {phase}
                  </button>
                ))}
              </div>
            )}
            {wattmeter.mode === '2' && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:5 }}>
                {TRI_PHASES.map(phase => (
                  <button key={phase} className={`btn btn-sm${wattmeter.ref === phase ? '' : ' btn-ghost'}`}
                    style={{ justifyContent:'center', fontSize:10 }}
                    onClick={()=>sw('ref', phase)}>
                    Ref. {phase}
                  </button>
                ))}
              </div>
            )}
          </Section>

          <Section title="Nova carga">
            <TriConnectionPicker value={loadDraft.scope} onChange={v=>sd('scope', v)} />
            {loadDraft.scope === 'ABC' ? (
              <TriAbcLoadFields load={loadDraft} onChange={sd} />
            ) : (
              <>
                <PField label="Qtd." unit="" value={loadDraft.qty} onChange={v=>sd('qty', v)} />
                <LoadParamFields lt="RLC" prefix="" vals={loadDraft} onChange={sd}/>
              </>
            )}
            <button className="btn btn-primary btn-sm" style={{ width:'100%', justifyContent:'center', marginTop:6 }} onClick={addTriLoad}>
              Adicionar carga
            </button>
          </Section>

          <Section title="Circuito">
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={applyExampleLoads}>Exemplo</button>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={()=>{
                setTriLoads([])
                setSelectedLoadId(null)
              }}>Limpar</button>
            </div>
          </Section>
        </div>
      </div>

      {/* Center: mounted circuit + continuous charts */}
      <div style={{ display:'flex', flexDirection:'column', gap:12, minHeight:0, minWidth:0, overflow:'hidden' }}>
        <div className="panel" style={{ flex:'1 1 auto', minHeight:300 }}>
          <div className="panel__head">Circuito Montado — {pLabel}</div>
          <div style={{ height:'calc(100% - 38px)', overflowX:'auto', overflowY:'hidden', maxWidth:'100%' }}>
            <TriCircuitBuilderSvg
              p={p}
              circuit={triCircuit}
              loads={triLoads}
              wattmeterReadings={wattmeterReadings}
              selectedLoadId={selectedLoadId}
              onSelectLoad={setSelectedLoadId}
              onUpdateLoad={updateTriLoad}
              onRemoveLoad={removeTriLoad}
              onCloseEditor={() => setSelectedLoadId(null)}
            />
          </div>
        </div>

        <div className="panel" style={{ flex:'0 0 260px', minHeight:260 }}>
          <div className="panel__head">Evolução do FP e Correntes</div>
          <TriLoadCharts data={triCharts} />
        </div>
      </div>

      {/* Right: phasor diagram + per-phase results */}
      <div style={{ display:'flex', flexDirection:'column', gap:12, minHeight:0, minWidth:0 }}>
        <div className="panel" style={{ flex:'0 0 230px', minHeight:230 }}>
          <div className="panel__head">Diagrama Fasorial — {pLabel}</div>
          <TriPhasor3F {...phasors} inLabel={pLabel}/>
        </div>

        <div className="panel" style={{ display:'flex', flexDirection:'column', flex:'1 1 auto', minHeight:0, minWidth:0 }}>
          <div className="panel__head">Resultados</div>
          <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>
            <Section title="Fase-Neutro">
              {triCircuit.results.map(r=>(
                <Result key={r.ph} label={`${r.ph}-N · ${fmt(cx.mag(r.V),0)} V`} value={`${fmt(r.I_mag,4)} A · ${fmt(r.P/1000,3)} kW`} highlight={r.FP<0.92&&r.S>0}/>
              ))}
            </Section>
            <Section title="Entre Fases">
              {triCircuit.branches.map(br => (
                <Result key={br.target} label={`${br.target} · ${fmt(cx.mag(br.V),0)} V`} value={`${fmt(br.I_mag,4)} A · ${fmt(br.P/1000,3)} kW`} highlight={br.FP<0.92&&br.S>0}/>
              ))}
            </Section>
            <Section title="Correntes">
              <Result label="IA" value={`${fmt(cx.mag(triCircuit.lineCurrents.A),4)} A`}/>
              <Result label="IB" value={`${fmt(cx.mag(triCircuit.lineCurrents.B),4)} A`}/>
              <Result label="IC" value={`${fmt(cx.mag(triCircuit.lineCurrents.C),4)} A`}/>
              <Result label="IN" value={`${fmt(cx.mag(triCircuit.IN),4)} A`} />
            </Section>
            {wattmeterReadings.readings.length > 0 && (
              <Section title={wattmeter.mode === '2' ? 'Aron (3 fios)' : 'Wattímetros'}>
                {wattmeterReadings.readings.map(item => (
                  <Result
                    key={item.id}
                    label={`${item.id} · V${item.voltageLabel} · I${item.phase}`}
                    value={`${fmt(item.P/1000,4)} kW`}
                  />
                ))}
                <Result
                  label={wattmeter.mode === '1' ? 'Leitura' : wattmeter.mode === '2' ? 'P Aron' : 'Soma dos W'}
                  value={`${fmt(wattmeterReadings.total/1000,4)} kW`}
                  highlight={wattmeter.mode === '2' && !wattmeterReadings.aronApplicable}
                />
                {wattmeter.mode !== '1' && wattmeterReadings.aronApplicable && (
                  <Result
                    label="Dif. vs total"
                    value={`${fmt(wattmeterReadings.error/1000,4)} kW`}
                    highlight={Math.abs(wattmeterReadings.error) > Math.max(1, Math.abs(triCircuit.P_tot) * 0.001)}
                  />
                )}
                {wattmeter.mode === '2' && !wattmeterReadings.aronApplicable && (
                  <div style={{ fontSize:10.5, lineHeight:1.45, color:'var(--c-danger)', marginTop:4 }}>
                    IN = {fmt(wattmeterReadings.neutral,4)} A: Aron mede total apenas em 3 fios.
                  </div>
                )}
              </Section>
            )}
            <Section title="Total">
              <Result label="P" value={`${fmt(triCircuit.P_tot/1000,3)} kW`}/>
              <Result label="Q" value={`${fmt(triCircuit.Q_tot/1000,3)} kvar`}/>
              <Result label="S" value={`${fmt(triCircuit.S_tot/1000,3)} kVA`}/>
              <Result label="FP" value={fmt(triCircuit.FP_tot,4)} highlight={triCircuit.FP_tot<0.92&&triCircuit.S_tot>0}/>
            </Section>
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
      </div>

      {sub==='cc'      && <SubCC />}
      {sub==='ca-mono' && <SubCAMono />}
      {sub==='ca-tri'  && <SubCATri />}
    </div>
  )
}
