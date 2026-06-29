import { useState, useMemo } from 'react'

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
  ligacao:'Y', balanco:'eq', loadType:'RL',
  R:'10', L:'0,05', C:'0,001', Cuf:'50',
  Pn:'37', eta:'92', FPm:'0,87',
  // per-phase for unbalanced
  A_lt:'RL', A_R:'10', A_L:'0,05', A_C:'0,001',
  B_lt:'R',  B_R:'20', B_L:'0',    B_C:'0,001',
  C_lt:'RC', C_R:'15', C_L:'0',    C_C:'0,002',
  VL:'13800', freq:'60',
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
    const Pn  = (parseNum(vals.Pn)  || 10) * 1000  // kW → W
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
    const Cuf = (parseNum(vals.Cuf) || 10) * 1e-6  // μF → F
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

const TRI_DEFAULT_CIRCUIT_LOADS = [
  { id: 1, scope: 'ABC', type: 'RL', qty: 1, R: '10', L: '0,05', C: '0,001', Cuf: '50', Pn: '37', eta: '92', FPm: '0,87' },
]

const TRI_SCOPE_LABELS = {
  ABC: 'Três fases',
  A: 'Fase A',
  B: 'Fase B',
  C: 'Fase C',
  AB: 'Ramo AB',
  BC: 'Ramo BC',
  CA: 'Ramo CA',
}

function triScopeOptions(ligacao, balanco) {
  if (balanco === 'eq') return [{ id: 'ABC', label: 'Três fases' }]
  return ligacao === 'Y'
    ? [{ id: 'ABC', label: 'Três fases' }, { id: 'A', label: 'Fase A' }, { id: 'B', label: 'Fase B' }, { id: 'C', label: 'Fase C' }]
    : [{ id: 'ABC', label: 'Três ramos' }, { id: 'AB', label: 'Ramo AB' }, { id: 'BC', label: 'Ramo BC' }, { id: 'CA', label: 'Ramo CA' }]
}

function triLoadTargets(load, ligacao) {
  if (load.scope === 'ABC') return ligacao === 'Y' ? ['A', 'B', 'C'] : ['AB', 'BC', 'CA']
  return [load.scope]
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

function triBranchAdmittance(loads, target, ligacao, f, VL) {
  return loads.reduce((sum, load) => {
    if (!triLoadTargets(load, ligacao).includes(target)) return sum
    return cx.add(sum, triLoadAdmittance(load, f, VL))
  }, [0, 0])
}

function triBranchLoadCopies(loads, target, ligacao) {
  return loads.flatMap(load => {
    if (!triLoadTargets(load, ligacao).includes(target)) return []
    const qty = Math.max(1, Math.round(parseNum(load.qty) || 1))
    return Array.from({ length: qty }, (_, index) => ({ ...load, copy: index + 1, target }))
  })
}

function calcTriCircuitLoads(p, loads) {
  const ligacao = p.ligacao
  const VL = parseNum(p.VL) || 13800
  const f = parseNum(p.freq) || 60

  if (ligacao === 'Y') {
    const V_ph = VL / Math.sqrt(3)
    const phases = ['A', 'B', 'C']
    const angles = [0, -2*Math.PI/3, 2*Math.PI/3]
    const results = phases.map((ph, index) => {
      const Y = triBranchAdmittance(loads, ph, ligacao, f, VL)
      const V = cx.polar(V_ph, angles[index])
      const I = cx.mul(V, Y)
      const P = cx.P(V, I)
      const Q = cx.Q(V, I)
      const S = cx.mag(V) * cx.mag(I)
      return {
        ph,
        target: ph,
        V,
        I,
        P,
        Q,
        S,
        I_mag: cx.mag(I),
        FP: S > 1e-9 ? Math.abs(P) / S : 1,
        phi: Math.atan2(Q, P || 1e-30),
        loads: triBranchLoadCopies(loads, ph, ligacao),
      }
    })
    const IN = cx.neg(cx.add(cx.add(results[0].I, results[1].I), results[2].I))
    const P_tot = results.reduce((sum, r) => sum + r.P, 0)
    const Q_tot = results.reduce((sum, r) => sum + r.Q, 0)
    const S_tot = Math.sqrt(P_tot**2 + Q_tot**2)
    return {
      ligacao,
      VL,
      V_ph,
      results,
      IN,
      P_tot,
      Q_tot,
      S_tot,
      FP_tot: S_tot > 1e-9 ? Math.abs(P_tot) / S_tot : 1,
      lineCurrents: { A: results[0].I, B: results[1].I, C: results[2].I },
    }
  }

  const V_AB = cx.polar(VL, Math.PI/6)
  const V_BC = cx.polar(VL, Math.PI/6 - 2*Math.PI/3)
  const V_CA = cx.polar(VL, Math.PI/6 + 2*Math.PI/3)
  const branchDefs = [
    ['AB', V_AB],
    ['BC', V_BC],
    ['CA', V_CA],
  ]
  const branches = branchDefs.map(([target, V]) => {
    const Y = triBranchAdmittance(loads, target, ligacao, f, VL)
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
      loads: triBranchLoadCopies(loads, target, ligacao),
    }
  })
  const brAB = branches[0]
  const brBC = branches[1]
  const brCA = branches[2]
  const IA = cx.sub(brAB.I, brCA.I)
  const IB = cx.sub(brBC.I, brAB.I)
  const IC = cx.sub(brCA.I, brBC.I)
  const P_tot = branches.reduce((sum, r) => sum + r.P, 0)
  const Q_tot = branches.reduce((sum, r) => sum + r.Q, 0)
  const S_tot = Math.sqrt(P_tot**2 + Q_tot**2)
  return {
    ligacao,
    VL,
    V_ph: VL / Math.sqrt(3),
    branches,
    results: branches,
    P_tot,
    Q_tot,
    S_tot,
    FP_tot: S_tot > 1e-9 ? Math.abs(P_tot) / S_tot : 1,
    lineCurrents: { A: IA, B: IB, C: IC },
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
    <>
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
  const W = 380, H = 280, ox = W/2, oy = H/2
  const scV = 85 / (V_ph || 1)
  const iMags = [cx.mag(VA_I.I), cx.mag(VB_I.I), cx.mag(VC_I.I)]
  const maxI  = Math.max(...iMags, 0.01)
  const scI   = 60 / maxI

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
  const T = TRI_LOAD_TYPES.find(t => t.id === lt) ?? TRI_LOAD_TYPES.find(t => t.id === 'RL')
  const has = f => T.fields.includes(f)
  const p   = prefix ? prefix+'_' : ''
  return <>
    {has('R')   && <PField label="R" unit="Ω" value={vals[p+'R']   ?? '10'}   onChange={v=>onChange(p+'R',v)}/>}
    {has('L')   && <PField label="L" unit="H" value={vals[p+'L']   ?? '0,05'} onChange={v=>onChange(p+'L',v)}/>}
    {has('C')   && <PField label="C" unit="F" value={vals[p+'C']   ?? '0,001'}onChange={v=>onChange(p+'C',v)}/>}
    {has('Pn')  && <PField label="Pn"  unit="kW" value={vals[p+'Pn']  ?? '37'}  onChange={v=>onChange(p+'Pn',v)}/>}
    {has('eta') && <PField label="η"   unit="%"  value={vals[p+'eta'] ?? '92'}  onChange={v=>onChange(p+'eta',v)}/>}
    {has('FPm') && <PField label="FP motor" unit="" value={vals[p+'FPm'] ?? '0,87'} onChange={v=>onChange(p+'FPm',v)}/>}
    {has('Cuf') && <PField label="C" unit="μF" value={vals[p+'Cuf'] ?? '50'}   onChange={v=>onChange(p+'Cuf',v)}/>}
  </>
}

function triType(id) {
  return TRI_LOAD_TYPES.find(t => t.id === id) ?? TRI_LOAD_TYPES[0]
}

function triLoadSpec(p, key, eq = false) {
  const prefix = eq ? '' : `${key}_`
  const typeId = eq ? p.loadType : (p[`${key}_lt`] || 'RL')
  return {
    key,
    type: triType(typeId),
    vals: {
      R: p[`${prefix}R`] ?? p.R,
      L: p[`${prefix}L`] ?? p.L,
      C: p[`${prefix}C`] ?? p.C,
      Cuf: p[`${prefix}Cuf`] ?? p.Cuf,
      Pn: p[`${prefix}Pn`] ?? p.Pn,
      eta: p[`${prefix}eta`] ?? p.eta,
      FPm: p[`${prefix}FPm`] ?? p.FPm,
    },
  }
}

function triSpecLine(spec) {
  const parts = spec.type.fields.map(field => {
    if (field === 'R') return `R ${spec.vals.R ?? '—'} Ω`
    if (field === 'L') return `L ${spec.vals.L ?? '—'} H`
    if (field === 'C') return `C ${spec.vals.C ?? '—'} F`
    if (field === 'Cuf') return `C ${spec.vals.Cuf ?? '—'} μF`
    if (field === 'Pn') return `Pn ${spec.vals.Pn ?? '—'} kW`
    if (field === 'eta') return `η ${spec.vals.eta ?? '—'}%`
    if (field === 'FPm') return `FP ${spec.vals.FPm ?? '—'}`
    return ''
  }).filter(Boolean)
  return parts.slice(0, 2).join(' · ') || spec.type.label
}

function TriLoadBlock({ x, y, spec, label }) {
  const w = 92
  const h = 42
  return (
    <g>
      <rect x={x - w/2} y={y - h/2} width={w} height={h} rx="7" fill="var(--c-surface)" stroke={spec.type.color} strokeWidth="2" />
      <text x={x} y={y - 5} textAnchor="middle" fontSize="12" fontWeight="800" fill={spec.type.color}>{label} · {spec.type.id}</text>
      <text x={x} y={y + 10} textAnchor="middle" fontSize="8.5" fill="var(--c-text-muted)">{triSpecLine(spec)}</text>
      <title>{label}: {spec.type.label} — {triSpecLine(spec)}</title>
    </g>
  )
}

function TriMountedCircuitSvg({ p, rBal, rUBY, rUBD }) {
  const eq = p.balanco === 'eq'
  const isY = p.ligacao === 'Y'
  const specs = eq
    ? ['A','B','C'].map(ph => ({ ...triLoadSpec(p, ph, true), key: ph }))
    : ['A','B','C'].map(ph => triLoadSpec(p, ph))
  const totals = eq
    ? { P: rBal.P, Q: rBal.Q, S: rBal.S, FP: rBal.FP, I: rBal.I_line }
    : isY
      ? { P: rUBY.P_tot, Q: rUBY.Q_tot, S: rUBY.S_tot, FP: rUBY.FP_tot, I: Math.max(...rUBY.results.map(r => r.I_mag), 0) }
      : { P: rUBD.P_tot, Q: rUBD.Q_tot, S: rUBD.S_tot, FP: rUBD.FP_tot, I: Math.max(cx.mag(rUBD.IA), cx.mag(rUBD.IB), cx.mag(rUBD.IC), 0) }
  const W = 760
  const H = 320
  const colors = { A:'#dc2626', B:'#16a34a', C:'#2563eb', N:'#64748b' }
  const y = { A:64, B:112, C:160, N:240 }

  if (!isY) {
    const pa = [420, 65], pb = [600, 160], pc = [420, 255]
    const branchSpecs = [
      { label:'AB', spec: specs[0], x:(pa[0]+pb[0])/2+18, y:(pa[1]+pb[1])/2-8 },
      { label:'BC', spec: specs[1], x:(pb[0]+pc[0])/2+18, y:(pb[1]+pc[1])/2+8 },
      { label:'CA', spec: specs[2], x:pa[0]-30, y:(pa[1]+pc[1])/2 },
    ]
    return (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'100%' }}>
        <rect x="10" y="10" width={W-20} height={H-20} rx="8" fill="var(--c-surface-2)" stroke="var(--c-border)" />
        <text x="28" y="34" fontSize="12" fontWeight="800" fill="var(--c-text)">Circuito montado · Δ Triângulo · {eq ? 'equilibrado' : 'desequilibrado'}</text>
        <circle cx="70" cy="160" r="31" fill="var(--c-surface)" stroke="var(--c-text)" strokeWidth="2" />
        <text x="70" y="167" textAnchor="middle" fontSize="24">~</text>
        <text x="70" y="207" textAnchor="middle" fontSize="10" fill="var(--c-text-muted)">{p.VL} V / {p.freq} Hz</text>
        <line x1="105" y1={y.A} x2={pa[0]} y2={pa[1]} stroke={colors.A} strokeWidth="3" />
        <line x1="105" y1={y.B} x2={pb[0]} y2={pb[1]} stroke={colors.B} strokeWidth="3" />
        <line x1="105" y1={y.C} x2={pc[0]} y2={pc[1]} stroke={colors.C} strokeWidth="3" />
        {['A','B','C'].map(ph => <text key={ph} x="122" y={y[ph]-8} fontSize="13" fontWeight="800" fill={colors[ph]}>{ph}</text>)}
        <polygon points={`${pa[0]},${pa[1]} ${pb[0]},${pb[1]} ${pc[0]},${pc[1]}`} fill="none" stroke="var(--c-text)" strokeWidth="2" />
        {branchSpecs.map(item => <TriLoadBlock key={item.label} {...item} />)}
        <text x="28" y="286" fontSize="11" fill="var(--c-text-muted)">
          P {fmt(totals.P/1000,2)} kW · Q {fmt(totals.Q/1000,2)} kvar · FP {fmt(totals.FP,4)} · Imax {fmt(totals.I,3)} A
        </text>
      </svg>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'100%' }}>
      <rect x="10" y="10" width={W-20} height={H-20} rx="8" fill="var(--c-surface-2)" stroke="var(--c-border)" />
      <text x="28" y="34" fontSize="12" fontWeight="800" fill="var(--c-text)">Circuito montado · Y Estrela · {eq ? 'equilibrado' : 'desequilibrado'}</text>
      <circle cx="70" cy="145" r="31" fill="var(--c-surface)" stroke="var(--c-text)" strokeWidth="2" />
      <text x="70" y="152" textAnchor="middle" fontSize="24">~</text>
      <text x="70" y="194" textAnchor="middle" fontSize="10" fill="var(--c-text-muted)">{p.VL} V / {p.freq} Hz</text>
      {['A','B','C','N'].map(ph => (
        <g key={ph}>
          <line x1="108" y1={y[ph]} x2="660" y2={y[ph]} stroke={colors[ph]} strokeWidth={ph === 'N' ? 2 : 3} strokeDasharray={ph === 'N' ? '5 4' : undefined} />
          <text x="122" y={y[ph]-8} fontSize="13" fontWeight="800" fill={colors[ph]}>{ph}</text>
        </g>
      ))}
      {specs.map((spec, index) => {
        const ph = ['A','B','C'][index]
        const x = 390 + index * 105
        const midY = (y[ph] + y.N) / 2
        return (
          <g key={ph}>
            <line x1={x} y1={y[ph]} x2={x} y2={y.N} stroke="var(--c-text)" strokeWidth="2" />
            <circle cx={x} cy={y[ph]} r="5" fill={colors[ph]} />
            <circle cx={x} cy={y.N} r="5" fill={colors.N} />
            <TriLoadBlock x={x} y={midY} spec={spec} label={`${ph}-N`} />
          </g>
        )
      })}
      <text x="28" y="286" fontSize="11" fill="var(--c-text-muted)">
        P {fmt(totals.P/1000,2)} kW · Q {fmt(totals.Q/1000,2)} kvar · FP {fmt(totals.FP,4)} · Imax {fmt(totals.I,3)} A
      </text>
    </svg>
  )
}

function TriCircuitBuilderSvg({ p, circuit, loads }) {
  const isY = p.ligacao === 'Y'
  const colors = { A:'#dc2626', B:'#16a34a', C:'#2563eb', N:'#64748b', AB:'#dc2626', BC:'#16a34a', CA:'#2563eb' }
  const rows = isY ? ['A', 'B', 'C'] : ['AB', 'BC', 'CA']
  const copiesByTarget = rows.map(target => ({
    target,
    loads: triBranchLoadCopies(loads, target, p.ligacao),
  }))
  const maxLoads = Math.max(1, ...copiesByTarget.map(row => row.loads.length))
  const W = Math.max(760, 320 + maxLoads * 126)
  const H = isY ? 320 : 300
  const y = isY
    ? { A:64, B:112, C:160, N:242 }
    : { A:58, B:108, C:158, AB:84, BC:160, CA:236 }

  function LoadAt({ load, target, index, yPos }) {
    const x = 305 + index * 122
    const spec = { type: triType(load.type), vals: triLoadVals(load) }
    return (
      <g>
        {isY ? (
          <>
            <line x1={x} y1={y[target]} x2={x} y2={y.N} stroke="var(--c-text)" strokeWidth="2" />
            <circle cx={x} cy={y[target]} r="4" fill={colors[target]} />
            <circle cx={x} cy={y.N} r="4" fill={colors.N} />
          </>
        ) : (
          <>
            <line x1={x - 50} y1={yPos} x2={x + 50} y2={yPos} stroke={colors[target]} strokeWidth="2" />
            <circle cx={x - 50} cy={yPos} r="4" fill={colors[target]} />
            <circle cx={x + 50} cy={yPos} r="4" fill={colors[target]} />
          </>
        )}
        <TriLoadBlock x={x} y={isY ? (y[target] + y.N) / 2 : yPos} spec={spec} label={`${target}${load.copy > 1 ? `.${load.copy}` : ''}`} />
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:W, height:H, maxWidth:'none', display:'block' }}>
      <rect x="10" y="10" width={W-20} height={H-20} rx="8" fill="var(--c-surface-2)" stroke="var(--c-border)" />
      <text x="28" y="34" fontSize="12" fontWeight="800" fill="var(--c-text)">
        Circuito montado · {isY ? 'Y Estrela' : 'Δ Triângulo'} · {p.balanco === 'eq' ? 'equilibrado' : 'desequilibrado'}
      </text>
      <circle cx="70" cy={isY ? 145 : 116} r="31" fill="var(--c-surface)" stroke="var(--c-text)" strokeWidth="2" />
      <text x="70" y={isY ? 152 : 123} textAnchor="middle" fontSize="24">~</text>
      <text x="70" y={isY ? 194 : 164} textAnchor="middle" fontSize="10" fill="var(--c-text-muted)">{p.VL} V / {p.freq} Hz</text>

      {isY ? (
        <>
          {['A','B','C','N'].map(ph => (
            <g key={ph}>
              <line x1="110" y1={y[ph]} x2={W-45} y2={y[ph]} stroke={colors[ph]} strokeWidth={ph === 'N' ? 2 : 3} strokeDasharray={ph === 'N' ? '5 4' : undefined} />
              <text x="124" y={y[ph]-8} fontSize="13" fontWeight="800" fill={colors[ph]}>{ph}</text>
            </g>
          ))}
          {copiesByTarget.map(row => row.loads.map((load, index) => (
            <LoadAt key={`${row.target}-${load.id}-${index}`} load={load} target={row.target} index={index} />
          )))}
        </>
      ) : (
        <>
          {['A','B','C'].map(ph => (
            <g key={ph}>
              <line x1="110" y1={y[ph]} x2={W-45} y2={y[ph]} stroke={colors[ph]} strokeWidth="3" />
              <text x="124" y={y[ph]-8} fontSize="13" fontWeight="800" fill={colors[ph]}>{ph}</text>
            </g>
          ))}
          {copiesByTarget.map(row => (
            <g key={row.target}>
              <text x="128" y={y[row.target]+4} fontSize="12" fontWeight="800" fill={colors[row.target]}>{row.target}</text>
              <line x1="168" y1={y[row.target]} x2={W-45} y2={y[row.target]} stroke={colors[row.target]} strokeWidth="2" strokeDasharray="5 4" />
              {row.loads.map((load, index) => <LoadAt key={`${row.target}-${load.id}-${index}`} load={load} target={row.target} index={index} yPos={y[row.target]} />)}
            </g>
          ))}
        </>
      )}

      {loads.length === 0 && (
        <text x={W/2} y={H/2} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--c-text-muted)">
          Adicione uma carga para montar o circuito trifásico
        </text>
      )}
      <text x="28" y={H-24} fontSize="11" fill="var(--c-text-muted)">
        P {fmt(circuit.P_tot/1000,2)} kW · Q {fmt(circuit.Q_tot/1000,2)} kvar · FP {fmt(circuit.FP_tot,4)}
      </text>
    </svg>
  )
}

/* ─── SubCATri ────────────────────────────────────────────────────────────── */

function SubCATri() {
  const [mode, setMode]     = useState('analise')   // 'analise' | 'editor'
  const [p, setP]           = useState(DEFAULT_TRI_LOADS)
  const [triLoads, setTriLoads] = useState(TRI_DEFAULT_CIRCUIT_LOADS)
  const [loadDraft, setLoadDraft] = useState({ scope:'ABC', type:'RL', qty:'1', R:'10', L:'0,05', C:'0,001', Cuf:'50', Pn:'37', eta:'92', FPm:'0,87' })
  const sp = (k, v) => setP(prev => ({...prev, [k]: v}))
  const sd = (k, v) => setLoadDraft(prev => ({ ...prev, [k]: v }))

  // System-level legacy editor state
  const [params, setParams] = useState(TRI_DEFAULT)
  const calc    = useMemo(() => calcTri(params), [params])
  const msgs    = useMemo(() => validateTri(params, calc), [params, calc])
  const netlist = useMemo(() => genNetlist(params, calc), [params, calc])
  function spe(k, v) { setParams(prev => ({...prev, [k]: v})) }
  const errCount  = msgs.filter(m => m.sev === 'Erro').length
  const warnCount = msgs.filter(m => m.sev === 'Aviso').length

  const isEq  = p.balanco === 'eq'
  const isY   = p.ligacao === 'Y'
  const scopeOptions = triScopeOptions(p.ligacao, p.balanco)
  const activeScope = scopeOptions.some(option => option.id === loadDraft.scope) ? loadDraft.scope : scopeOptions[0].id
  const triCircuit = useMemo(() => calcTriCircuitLoads(p, triLoads), [p, triLoads])

  function addTriLoad() {
    const id = Math.max(0, ...triLoads.map(load => load.id)) + 1
    setTriLoads(prev => [...prev, { ...loadDraft, scope: activeScope, id }])
  }

  function changeTriLoadQty(id, delta) {
    setTriLoads(prev => prev.flatMap(load => {
      if (load.id !== id) return [load]
      const qty = Math.max(0, Math.round((parseNum(load.qty) || 1) + delta))
      return qty > 0 ? [{ ...load, qty: String(qty) }] : []
    }))
  }

  function removeTriLoad(id) {
    setTriLoads(prev => prev.filter(load => load.id !== id))
  }

  // Resolve unified phasor data
  const phasors = useMemo(() => {
    if (isY) {
      const rs = triCircuit.results
      return {
        VA_I: { V: rs[0].V, I: rs[0].I }, VB_I: { V: rs[1].V, I: rs[1].I }, VC_I: { V: rs[2].V, I: rs[2].I },
        V_ph: triCircuit.V_ph
      }
    }
    // Δ: use line voltages as V, line currents as I
    return {
      VA_I: { V: cx.polar(triCircuit.V_ph, 0),           I: triCircuit.lineCurrents.A },
      VB_I: { V: cx.polar(triCircuit.V_ph, -2*Math.PI/3), I: triCircuit.lineCurrents.B },
      VC_I: { V: cx.polar(triCircuit.V_ph,  2*Math.PI/3), I: triCircuit.lineCurrents.C },
      V_ph: triCircuit.V_ph
    }
  }, [isY, triCircuit])

  const pLabel = isEq ? `${isY?'Y':'Δ'} Eq.` : `${isY?'Y':'Δ'} Deseq.`

  if (mode === 'editor') {
    // Legacy circuit editor
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
      <div style={{ display:'flex', flexDirection:'column', flex:'1 1 auto', minHeight:0 }}>
        <div style={{ display:'flex', gap:6, padding:'6px 12px', background:'var(--c-surface)', borderBottom:'1px solid var(--c-border)' }}>
          <button className="btn btn-sm btn-ghost" onClick={()=>setMode('analise')}>← Análise de Cargas</button>
          <span style={{ fontWeight:700, fontSize:13 }}>Editor Paramétrico (Sistema)</span>
        </div>
        <div className="circuit-editor-grid" style={{ flex:'1 1 auto', minHeight:0 }}>
          <aside className="panel" style={{ gridRow:'1/3', minHeight:0 }}>
            <div className="panel__head">Parâmetros do Circuito</div>
            <div className="panel__body scroll-y" style={{ height:'calc(100% - 38px)', overflow:'auto' }}>
              <Section title="Fonte CA (V1)">
                <PField label="Tensão" unit="kV" value={params.v1_tensao} onChange={v=>spe('v1_tensao',v)}/>
                <PField label="Frequência" unit="Hz" value={params.v1_freq} onChange={v=>spe('v1_freq',v)}/>
                <PSelect label="Ligação" value={params.v1_ligacao} onChange={v=>spe('v1_ligacao',v)} options={['Y','D','Δ']}/>
              </Section>
              <Section title="Disjuntor (Q1)">
                <PField label="I nominal" unit="A" value={params.q1_inominal} onChange={v=>spe('q1_inominal',v)}/>
                <Indicator label="Carregamento" pct={calc.q_pct}/>
              </Section>
              <Section title="TC de Corrente (TC1)">
                <PField label="I primário" unit="A" value={params.tc1_primario} onChange={v=>spe('tc1_primario',v)}/>
                <PField label="I secundário" unit="A" value={params.tc1_secundario} onChange={v=>spe('tc1_secundario',v)}/>
                <Indicator label="Carregamento TC" pct={calc.tc_pct}/>
              </Section>
              <Section title="Resistência de linha (R1)">
                <PField label="Resistência" unit="Ω" value={params.r1_valor} onChange={v=>spe('r1_valor',v)}/>
              </Section>
              <Section title="Carga (L1)">
                <PField label="Pot. ativa" unit="kW" value={params.l1_p} onChange={v=>spe('l1_p',v)}/>
                <PField label="Pot. reativa" unit="kvar" value={params.l1_q} onChange={v=>spe('l1_q',v)}/>
              </Section>
            </div>
          </aside>
          <div className="panel" style={{ gridColumn:'2/4' }}>
            <div className="panel__body" style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
              {TRI_PRESETS.map(pr=>(
                <button key={pr.label} className="btn btn-ghost btn-sm" onClick={()=>setParams({...pr.p})}>{pr.label}</button>
              ))}
              <span style={{ flex:1 }}/>
              <button className="btn btn-ghost btn-sm" onClick={()=>setParams(TRI_DEFAULT)}>Resetar</button>
            </div>
          </div>
          <main className="panel" style={{ minHeight:0 }}>
            <div className="panel__body--np" style={{ height:'100%', backgroundImage:'radial-gradient(#dbe4f0 1px,transparent 1px)', backgroundSize:'14px 14px', position:'relative' }}>
              <TriCircuitSvg p={params} c={calc}/>
              <div className="surface-box" style={{ position:'absolute', left:12, bottom:12, padding:'4px 10px', fontSize:11, display:'flex', gap:12 }}>
                <span>I = <b>{fmt(calc.I)} A</b></span>
                <span>FP = <b style={{ color:calc.FP<0.92&&calc.S>0?'var(--c-danger)':undefined }}>{fmt(calc.FP,3)}</b></span>
                <span>V<sub>carga</sub> = <b>{fmt(calc.V_load/1000,3)} kV</b></span>
                <span>η = <b>{fmt(calc.eta)}%</b></span>
              </div>
            </div>
          </main>
          <aside className="panel" style={{ minHeight:0 }}>
            <div className="panel__head">Resultados</div>
            <div className="panel__body scroll-y" style={{ height:'calc(100% - 38px)', overflow:'auto' }}>
              <Section title="Correntes e Potências">
                <Result label="Corrente de linha" value={`${fmt(calc.I)} A`}/>
                <Result label="Potência aparente" value={`${fmt(calc.S/1000)} kVA`}/>
                <Result label="Fator de potência" value={`${fmt(calc.FP,3)} (${fmt(calc.phi,1)}°)`} highlight={calc.FP<0.92&&calc.S>0}/>
              </Section>
              <Section title="Tensão e Perdas">
                <Result label="Queda de tensão" value={`${fmt(calc.V_drop)} V (${fmt(calc.vd_pct)}%)`} highlight={calc.vd_pct>5}/>
                <Result label="Tensão na carga" value={`${fmt(calc.V_load/1000,3)} kV`}/>
                <Result label="Perdas na linha" value={`${fmt(calc.Ploss/1000,2)} kW`}/>
                <Result label="Rendimento" value={`${fmt(calc.eta)}%`}/>
              </Section>
              <Section title="Carregamento">
                <Indicator label={`Q1 (${params.q1_inominal} A)`} pct={calc.q_pct}/>
                <Indicator label={`TC1 (${params.tc1_primario} A)`} pct={calc.tc_pct}/>
              </Section>
            </div>
          </aside>
          <div className="panel"><div className="panel__head">Netlist</div>
            <pre style={{ padding:12, fontSize:11, lineHeight:1.65, overflow:'auto', height:'calc(100% - 38px)', margin:0 }}>{netlist}</pre>
          </div>
          <div className="panel"><div className="panel__head">Mensagens</div>
            <div className="panel__body">
              <div style={{ display:'flex', gap:16, marginBottom:10 }}>
                <span><b style={{ color:'#dc2626' }}>{errCount}</b> Erros</span>
                <span><b style={{ color:'#d97706' }}>{warnCount}</b> Avisos</span>
              </div>
              {msgs.map((m,i)=><MsgItem key={i} sev={m.sev} text={m.text}/>)}
            </div>
          </div>
          <div className="panel"><div className="panel__head">Status</div>
            <div className="panel__body">
              <div className={`result-panel ${errCount>0?'result-panel--warning':warnCount>0?'result-panel--warning':'result-panel--success'}`} style={{ padding:12, fontWeight:800 }}>
                {errCount>0?`${errCount} erro(s)`:warnCount>0?`${warnCount} aviso(s)`:'Projeto válido'}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Análise de Cargas mode ────────────────────────────────────────────────
  return (
    <div style={{ display:'grid', gridTemplateColumns:'220px 1fr 260px', gap:12, padding:12, flex:'1 1 auto', minHeight:0, overflow:'auto' }}>

      {/* LEFT: config */}
      <div className="panel" style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
        <div className="panel__head">Configuração CA Trifásico</div>
        <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>

          {/* Mode switch */}
          <button className="btn btn-ghost btn-sm" style={{ width:'100%', marginBottom:10 }}
            onClick={()=>setMode('editor')}>Editor Paramétrico →</button>

          <Section title="Fonte">
            <PField label="V linha" unit="V" value={p.VL}   onChange={v=>sp('VL',v)}/>
            <PField label="Freq."   unit="Hz" value={p.freq} onChange={v=>sp('freq',v)}/>
          </Section>

          <Section title="Ligação">
            <div style={{ display:'flex', gap:6 }}>
              {['Y','D'].map(lig=>(
                <button key={lig} className={`btn btn-sm${p.ligacao===lig?'':' btn-ghost'}`}
                  style={{ flex:1, background:p.ligacao===lig?'#1d4ed8':undefined, color:p.ligacao===lig?'#fff':undefined }}
                  onClick={()=>sp('ligacao',lig)}>
                  {lig==='Y'?'Y — Estrela':'Δ — Triângulo'}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Distribuição">
            <div style={{ display:'flex', gap:6 }}>
              {[['eq','Equilibrada'],['deseq','Desequilibrada']].map(([v,l])=>(
                <button key={v} className={`btn btn-sm${p.balanco===v?'':' btn-ghost'}`}
                  style={{ flex:1, fontSize:10, background:p.balanco===v?'#7c3aed':undefined, color:p.balanco===v?'#fff':undefined }}
                  onClick={()=>sp('balanco',v)}>{l}</button>
              ))}
            </div>
          </Section>

          <Section title="Adicionar Carga">
            <PSelect label="Aplicar em" value={activeScope} onChange={v=>sd('scope',v)} options={scopeOptions.map(option => option.id)} />
            <div style={{ fontSize:10, color:'var(--c-text-muted)', margin:'-4px 0 8px 0' }}>
              {TRI_SCOPE_LABELS[activeScope] || activeScope}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:8 }}>
              {TRI_LOAD_TYPES.map(t=>(
                <button key={t.id} className="btn btn-sm"
                  style={{ fontSize:9, padding:'2px 6px',
                    background:loadDraft.type===t.id?t.color:'transparent',
                    color:loadDraft.type===t.id?'#fff':'var(--c-text)',
                    border:`1px solid ${t.color}` }}
                  onClick={()=>sd('type',t.id)}>{t.id}</button>
              ))}
            </div>
            <PField label="Quantidade" unit="" value={loadDraft.qty} onChange={v=>sd('qty',v)} />
            <LoadParamFields lt={loadDraft.type} prefix="" vals={loadDraft} onChange={sd}/>
            <button className="btn btn-primary btn-sm" style={{ width:'100%', justifyContent:'center', marginTop:6 }} onClick={addTriLoad}>
              Adicionar ao circuito
            </button>
          </Section>

          <Section title="Cargas Montadas">
            <div style={{ display:'flex', gap:6, marginBottom:8 }}>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={()=>setTriLoads(TRI_DEFAULT_CIRCUIT_LOADS)}>Exemplo</button>
              <button className="btn btn-ghost btn-sm" style={{ flex:1 }} onClick={()=>setTriLoads([])}>Limpar</button>
            </div>
            {triLoads.length === 0 ? (
              <div style={{ fontSize:11, color:'var(--c-text-muted)', lineHeight:1.5 }}>Nenhuma carga adicionada.</div>
            ) : triLoads.map(load => {
              const t = triType(load.type)
              return (
                <div key={load.id} className="surface-box" style={{ padding:8, marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span className="badge" style={{ background:t.color, color:'#fff' }}>{load.type}</span>
                    <b style={{ fontSize:11 }}>{TRI_SCOPE_LABELS[load.scope] || load.scope}</b>
                    <span style={{ marginLeft:'auto', fontSize:11, color:'var(--c-text-muted)' }}>x{load.qty}</span>
                  </div>
                  <div style={{ fontSize:10, color:'var(--c-text-muted)', margin:'5px 0' }}>{triSpecLine({ type:t, vals:triLoadVals(load) })}</div>
                  <div style={{ display:'flex', gap:4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>changeTriLoadQty(load.id, 1)}>+</button>
                    <button className="btn btn-ghost btn-sm" onClick={()=>changeTriLoadQty(load.id, -1)}>-</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>removeTriLoad(load.id)}>Remover</button>
                  </div>
                </div>
              )
            })}
          </Section>
        </div>
      </div>

      {/* Center: mounted circuit + phasor diagram */}
      <div style={{ display:'flex', flexDirection:'column', gap:12, minHeight:0 }}>
        <div className="panel" style={{ flex:'1 1 auto', minHeight:300 }}>
          <div className="panel__head">Circuito Montado — {pLabel}</div>
          <div style={{ height:'calc(100% - 38px)', overflow:'auto' }}>
            <TriCircuitBuilderSvg p={p} circuit={triCircuit} loads={triLoads} />
          </div>
        </div>

        <div className="panel" style={{ flex:'1 1 auto', minHeight:230 }}>
          <div className="panel__head">Diagrama Fasorial Trifásico — {pLabel}</div>
          <TriPhasor3F {...phasors} inLabel={pLabel}/>
        </div>

        {/* Total summary */}
        <div className="panel" style={{ flexShrink:0 }}>
          <div className="panel__head">Resumo Total</div>
          <div style={{ display:'flex', gap:16, padding:'8px 14px', fontSize:12, flexWrap:'wrap' }}>
            <span>P = <b>{fmt(triCircuit.P_tot/1000,2)} kW</b></span>
            <span>Q = <b>{fmt(triCircuit.Q_tot/1000,2)} kvar</b></span>
            <span>S = <b>{fmt(triCircuit.S_tot/1000,2)} kVA</b></span>
            <span>FP = <b style={{color:triCircuit.FP_tot<0.92&&triCircuit.S_tot>0?'var(--c-danger)':undefined}}>{fmt(triCircuit.FP_tot,4)}</b></span>
            <span>IA = <b>{fmt(cx.mag(triCircuit.lineCurrents.A),3)} A</b></span>
            <span>IB = <b>{fmt(cx.mag(triCircuit.lineCurrents.B),3)} A</b></span>
            <span>IC = <b>{fmt(cx.mag(triCircuit.lineCurrents.C),3)} A</b></span>
            {isY && <span>|IN| = <b>{fmt(cx.mag(triCircuit.IN),3)} A</b></span>}
          </div>
        </div>
      </div>

      {/* Right: per-phase results */}
      <div className="panel" style={{ display:'flex', flexDirection:'column', minHeight:0 }}>
        <div className="panel__head">Resultados por Fase</div>
        <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>
          {isY ? (
            <>
              {triCircuit.results.map(r=>(
                <Section key={r.ph} title={`Fase ${r.ph}`}>
                  <Result label="|I|" value={`${fmt(r.I_mag,4)} A`}/>
                  <Result label="φ"   value={`${fmt(r.phi*180/Math.PI,2)}°`}/>
                  <Result label="FP"  value={fmt(r.FP,4)} highlight={r.FP<0.92&&r.S>0}/>
                  <Result label="P"   value={`${fmt(r.P/1000,3)} kW`}/>
                  <Result label="Q"   value={`${fmt(r.Q/1000,3)} kvar`}/>
                  <Result label="Cargas" value={`${r.loads.length}`} />
                </Section>
              ))}
              <Section title="Neutro">
                <Result label="|IN|" value={`${fmt(cx.mag(triCircuit.IN),4)} A`} />
              </Section>
            </>
          ) : (
            <>
              {triCircuit.results.map(br => (
                <Section key={br.target} title={`Ramo ${br.target}`}>
                  <Result label="|I ramo|" value={`${fmt(br.I_mag,4)} A`}/>
                  <Result label="φ" value={`${fmt(br.phi*180/Math.PI,2)}°`}/>
                  <Result label="FP" value={fmt(br.FP,4)} highlight={br.FP<0.92&&br.S>0}/>
                  <Result label="P" value={`${fmt(br.P/1000,3)} kW`}/>
                  <Result label="Q" value={`${fmt(br.Q/1000,3)} kvar`}/>
                  <Result label="Cargas" value={`${br.loads.length}`} />
                </Section>
              ))}
              <Section title="Correntes de Linha">
                <Result label="IA" value={`${fmt(cx.mag(triCircuit.lineCurrents.A),4)} A`}/>
                <Result label="IB" value={`${fmt(cx.mag(triCircuit.lineCurrents.B),4)} A`}/>
                <Result label="IC" value={`${fmt(cx.mag(triCircuit.lineCurrents.C),4)} A`}/>
              </Section>
            </>
          )}
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
