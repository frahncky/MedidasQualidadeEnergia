/** RLC circuit calculations */

export function calcRLC({ R, L, C, f, Vs, angle = 0 }) {
  const w = 2 * Math.PI * f
  const XL = w * L
  const XC = C > 0 ? 1 / (w * C) : Infinity
  const X = XL - XC
  const Z = Math.sqrt(R * R + X * X)
  const phi = Math.atan2(X, R)            // phase angle (rad)
  const I = Vs / Z
  const VR = I * R
  const VL = I * XL
  const VC = I * (C > 0 ? XC : 0)
  const P = I * I * R
  const Q = I * I * X
  const S = Vs * I
  const FP = Math.cos(phi)

  return { XL, XC, X, Z, phi, I, VR, VL, VC, P, Q, S, FP, R, L, C, f, Vs, w }
}

export function timeSeries({ Vs, Z, phi, w, angle = 0 }, points = 200) {
  const T = (2 * Math.PI) / w
  const t = Array.from({ length: points }, (_, i) => i * (2 * T) / points)
  const v = t.map(ti => Vs * Math.SQRT2 * Math.sin(w * ti + angle * Math.PI / 180))
  const iAmp = (Vs * Math.SQRT2) / Z
  const i = t.map(ti => iAmp * Math.sin(w * ti + angle * Math.PI / 180 - phi))
  const p = t.map((ti, idx) => v[idx] * i[idx])
  return t.map((ti, idx) => ({
    t: +(ti * 1000).toFixed(3),
    v: +v[idx].toFixed(4),
    i: +i[idx].toFixed(4),
    p: +p[idx].toFixed(2),
  }))
}

export function bodeSeries({ R, L, C }, fMin = 1, fMax = 10000, points = 200) {
  const freqs = Array.from({ length: points }, (_, i) => {
    const logMin = Math.log10(fMin)
    const logMax = Math.log10(fMax)
    return Math.pow(10, logMin + (logMax - logMin) * i / (points - 1))
  })
  return freqs.map(f => {
    const w = 2 * Math.PI * f
    const XL = w * L
    const XC = C > 0 ? 1 / (w * C) : 0
    const Z = Math.sqrt(R * R + (XL - XC) ** 2)
    return { f: +f.toFixed(2), Z: +Z.toFixed(4) }
  })
}

export function resonanceFreq(L, C) {
  if (L <= 0 || C <= 0) return null
  return 1 / (2 * Math.PI * Math.sqrt(L * C))
}
