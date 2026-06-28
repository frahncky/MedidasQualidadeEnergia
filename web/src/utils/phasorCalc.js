/** Phasor diagram utilities */

export function phasorToXY(magnitude, angleDeg, cx, cy, scale) {
  const rad = (angleDeg * Math.PI) / 180
  return {
    x: cx + scale * magnitude * Math.cos(rad),
    y: cy - scale * magnitude * Math.sin(rad),
  }
}

export function symmetricalComponents(Va, Vb, Vc, aVa, aVb, aVc) {
  const toRect = (mag, deg) => ({
    re: mag * Math.cos((deg * Math.PI) / 180),
    im: mag * Math.sin((deg * Math.PI) / 180),
  })
  const add = (a, b) => ({ re: a.re + b.re, im: a.im + b.im })
  const a = toRect(1, 120)
  const a2 = toRect(1, 240)
  const mulC = (c, v) => ({
    re: c.re * v.re - c.im * v.im,
    im: c.re * v.im + c.im * v.re,
  })
  const vA = toRect(Va, aVa)
  const vB = toRect(Vb, aVb)
  const vC = toRect(Vc, aVc)
  const V0 = { re: (vA.re + vB.re + vC.re) / 3, im: (vA.im + vB.im + vC.im) / 3 }
  const V1 = { re: (vA.re + mulC(a, vB).re + mulC(a2, vC).re) / 3, im: (vA.im + mulC(a, vB).im + mulC(a2, vC).im) / 3 }
  const V2 = { re: (vA.re + mulC(a2, vB).re + mulC(a, vC).re) / 3, im: (vA.im + mulC(a2, vB).im + mulC(a, vC).im) / 3 }
  const mag = v => Math.sqrt(v.re ** 2 + v.im ** 2)
  const ang = v => (Math.atan2(v.im, v.re) * 180) / Math.PI
  return {
    V0: { mag: +mag(V0).toFixed(2), ang: +ang(V0).toFixed(1) },
    V1: { mag: +mag(V1).toFixed(2), ang: +ang(V1).toFixed(1) },
    V2: { mag: +mag(V2).toFixed(2), ang: +ang(V2).toFixed(1) },
    VUF: +((mag(V2) / mag(V1)) * 100).toFixed(2),
  }
}

export const DEMO_PHASORS = {
  Va: { mag: 127.0, ang: 0 },
  Vb: { mag: 126.5, ang: -120.3 },
  Vc: { mag: 127.8, ang: 119.7 },
  Ia: { mag: 82.4, ang: -23.6 },
  Ib: { mag: 80.9, ang: -143.1 },
  Ic: { mag: 83.1, ang: 96.8 },
}
