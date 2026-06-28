/** Power quality indices */

export function calcTHD(harmonics) {
  // harmonics: [{order, magnitude}], fundamental = order 1
  const fund = harmonics.find(h => h.order === 1)?.magnitude ?? 1
  const sumSq = harmonics
    .filter(h => h.order > 1)
    .reduce((s, h) => s + h.magnitude ** 2, 0)
  return (100 * Math.sqrt(sumSq)) / fund
}

export function generateHarmonics(thdPct, fundamental = 100) {
  const orders = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25]
  const harmonics = orders.map(n => {
    if (n === 1) return { order: 1, magnitude: fundamental, limitPct: 100 }
    const mag = n === 1 ? fundamental : (fundamental * thdPct / 100) / Math.pow(n, 1.3)
    return { order: n, magnitude: +mag.toFixed(3), limitPct: +(5 / Math.sqrt(n)).toFixed(2) }
  })
  return harmonics
}

export function voltageUnbalance(Va, Vb, Vc) {
  const Vavg = (Va + Vb + Vc) / 3
  const maxDev = Math.max(Math.abs(Va - Vavg), Math.abs(Vb - Vavg), Math.abs(Vc - Vavg))
  return +((maxDev / Vavg) * 100).toFixed(3)
}

export function energySeries(days = 31) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(2024, 4, i + 1)
    const label = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}`
    const energy = 3800 + Math.sin(i * 0.4) * 500 + Math.random() * 300
    const demand = 1600 + Math.sin(i * 0.3) * 180 + Math.random() * 120
    const fp = 0.88 + Math.random() * 0.08
    return {
      label,
      energy: +energy.toFixed(0),
      demand: +demand.toFixed(0),
      fp: +fp.toFixed(3),
    }
  })
}

export function demoEvents() {
  return [
    { ts: '31/05 14:22', tipo: 'Afundamento', desc: 'Tensão 0,58 pu', sev: 'Alto',   fase: 'B',   dur: '1,24 s' },
    { ts: '31/05 10:17', tipo: 'Surto',       desc: 'Sobretensão 1,45 pu', sev: 'Médio', fase: 'A', dur: '80 ms' },
    { ts: '30/05 22:11', tipo: 'Desequilíbrio', desc: 'VUF 2,8%',       sev: 'Médio', fase: 'ABC', dur: '—' },
    { ts: '30/05 16:45', tipo: 'Flicker',     desc: 'Pst = 1,25',       sev: 'Baixo', fase: 'ABC', dur: '10 min' },
    { ts: '29/05 09:33', tipo: 'Interrupção', desc: '0,00 pu',          sev: 'Crítico', fase: 'ABC', dur: '240 ms' },
    { ts: '28/05 07:15', tipo: 'Afundamento', desc: 'Tensão 0,72 pu',   sev: 'Baixo', fase: 'C',   dur: '380 ms' },
    { ts: '27/05 19:50', tipo: 'Harmônicas',  desc: 'THD-I 12,4%',      sev: 'Médio', fase: 'A',   dur: '—' },
  ]
}

export const SEV_CLASS = {
  'Crítico': 'badge badge-red',
  'Alto':    'badge badge-red',
  'Médio':   'badge badge-yellow',
  'Baixo':   'badge badge-green',
}
