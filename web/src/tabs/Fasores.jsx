import { useState, useMemo } from 'react'
import { DEMO_PHASORS, phasorToXY, symmetricalComponents } from '../utils/phasorCalc'

const COLORS = { Va:'#1d4ed8', Vb:'#16a34a', Vc:'#dc2626', Ia:'#7c3aed', Ib:'#0284c7', Ic:'#d97706' }

export default function Fasores() {
  const [ph, setPh] = useState(DEMO_PHASORS)
  const [frozen, setFrozen] = useState(false)
  const [window_, setWindow] = useState('10 ciclos')
  const [sistema, setSistema] = useState('Trifásico 3F+N')
  const [metodo, setMetodo] = useState('FFT (Hann)')
  const [freq, setFreq] = useState('60,00 Hz')

  const sc = useMemo(() =>
    symmetricalComponents(ph.Va.mag, ph.Vb.mag, ph.Vc.mag, ph.Va.ang, ph.Vb.ang, ph.Vc.ang),
    [ph])

  const phasors = [
    { key:'Va', label:'Va', mag:ph.Va.mag, ang:ph.Va.ang, color:COLORS.Va },
    { key:'Vb', label:'Vb', mag:ph.Vb.mag, ang:ph.Vb.ang, color:COLORS.Vb },
    { key:'Vc', label:'Vc', mag:ph.Vc.mag, ang:ph.Vc.ang, color:COLORS.Vc },
    { key:'Ia', label:'Ia', mag:ph.Ia.mag, ang:ph.Ia.ang, color:COLORS.Ia },
    { key:'Ib', label:'Ib', mag:ph.Ib.mag, ang:ph.Ib.ang, color:COLORS.Ib },
    { key:'Ic', label:'Ic', mag:ph.Ic.mag, ang:ph.Ic.ang, color:COLORS.Ic },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:1080, overflow:'visible' }}>

      {/* Action bar */}
      <div className="filter-bar">
        <select value={window_} onChange={e=>setWindow(e.target.value)} style={{width:160}}>
          {['10 ciclos (166,67 ms)','1 ciclo','100 ms','1 s'].map(o=><option key={o}>{o}</option>)}
        </select>
        <select value={sistema} onChange={e=>setSistema(e.target.value)} style={{width:160}}>
          {['Trifásico 3F+N','Monofásico','Bifásico'].map(o=><option key={o}>{o}</option>)}
        </select>
        <select value={metodo} onChange={e=>setMetodo(e.target.value)} style={{width:130}}>
          {['FFT (Hann)','DFT','Goertzel'].map(o=><option key={o}>{o}</option>)}
        </select>
        <select value={freq} onChange={e=>setFreq(e.target.value)} style={{width:110}}>
          {['60,00 Hz','50,00 Hz','Auto'].map(o=><option key={o}>{o}</option>)}
        </select>
        <div className="spacer"/>
        <button className={`btn btn-sm ${frozen?'btn-warning':'btn-ghost'}`} onClick={()=>setFrozen(f=>!f)}>
          {frozen ? '⏸ Congelado' : '⏸ Congelar'}
        </button>
        <button className="btn btn-primary btn-sm">↻ Atualizar Fasores</button>
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'440px minmax(560px, 1fr) 340px', gap:14, padding:14, overflow:'visible', minHeight:760 }}>

        {/* Left: Phasor diagram */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, minHeight:0 }}>
          <div className="panel" style={{ flex:1 }}>
            <div className="panel__head">Diagrama Fasorial — Tensões e Correntes</div>
            <div style={{ height:'calc(100% - 38px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <FullPhasorDiagram phasors={phasors} />
            </div>
          </div>
          <div className="panel" style={{ flexShrink:0 }}>
            <div className="panel__head">Sequência de Fases e Desequilíbrio</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:10 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:24, fontWeight:800, color:'#1d4ed8' }}>ABC</div>
                <div style={{ fontSize:11, color:'#64748b' }}>Sequência Detectada</div>
                <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:6 }}>
                  <button className="btn btn-primary btn-sm">ABC</button>
                  <button className="btn btn-ghost btn-sm">ACB</button>
                </div>
              </div>
              <div>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:sc.VUF>2?'#dc2626':'#16a34a' }}>{sc.VUF.toFixed(2)}%</div>
                    <div style={{ fontSize:10, color:'#64748b' }}>VUF (%)</div>
                  </div>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:'#ea580c' }}>1,94%</div>
                    <div style={{ fontSize:10, color:'#64748b' }}>IUF (%)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center: symmetric components + power */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, minHeight:0 }}>
          <div className="panel">
            <div className="panel__head">Componentes Simétricas (Fortescue)</div>
            <div className="panel__body">
              <table className="tbl">
                <thead><tr><th>Componente</th><th>Magnitude (V)</th><th>Ângulo (°)</th><th>Descrição</th></tr></thead>
                <tbody>
                  <tr><td>V₀ (Sequência Zero)</td><td style={{fontWeight:700,color:'#64748b'}}>{sc.V0.mag}</td><td>{sc.V0.ang}°</td><td>Correntes de terra</td></tr>
                  <tr><td>V₁ (Seq. Positiva)</td><td style={{fontWeight:700,color:'#16a34a'}}>{sc.V1.mag}</td><td>{sc.V1.ang}°</td><td>Componente útil</td></tr>
                  <tr><td>V₂ (Seq. Negativa)</td><td style={{fontWeight:700,color:'#dc2626'}}>{sc.V2.mag}</td><td>{sc.V2.ang}°</td><td>Desequilíbrio</td></tr>
                  <tr><td>VUF</td><td colSpan={2} style={{fontWeight:800,color:sc.VUF>2?'#dc2626':'#16a34a'}}>{sc.VUF.toFixed(2)}%</td><td>PRODIST ≤ 2%</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">Potências (Método de Akagi)</div>
            <div className="panel__body">
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                {[
                  ['P Ativa','28,56 kW','#16a34a'],
                  ['Q Reativa','13,42 kVAr','#9333ea'],
                  ['S Aparente','31,59 kVA','#1d4ed8'],
                  ['FP','0,904 ind.','#ea580c'],
                  ['D Distorção','4,82 kVA','#d97706'],
                  ['FPD','0,884','#0284c7'],
                ].map(([n,v,c])=>(
                  <div key={n} style={{ background:'#f8fafc', borderRadius:6, padding:'8px 10px', border:'1px solid #e2e8f0' }}>
                    <div style={{ fontSize:10, color:'#64748b', fontWeight:600 }}>{n}</div>
                    <div style={{ fontSize:16, fontWeight:800, color:c, marginTop:2 }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel" style={{ flex:1 }}>
            <div className="panel__head">Ângulos e Ângulos de Fase</div>
            <div className="panel__body">
              <table className="tbl">
                <thead><tr><th>Fasor</th><th>Magnitude</th><th>Ângulo</th><th>Ref.</th><th>Δ Nominal</th></tr></thead>
                <tbody>
                  {phasors.map(p=>(
                    <tr key={p.key}>
                      <td><span style={{color:p.color, fontWeight:700}}>■</span> {p.label}</td>
                      <td style={{fontWeight:700}}>{p.mag.toFixed(1)}</td>
                      <td>{p.ang.toFixed(1)}°</td>
                      <td style={{color:'#64748b'}}>{p.key.startsWith('V') ? 'V' : 'A'}</td>
                      <td style={{color:'#16a34a', fontSize:11}}>+0,{Math.floor(Math.random()*9+1)}°</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: readings tables */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, minHeight:0 }}>
          <div className="panel">
            <div className="panel__head">Tensões RMS por Fase</div>
            <table className="tbl">
              <thead><tr><th>Fase</th><th>RMS (V)</th><th>Pico (V)</th><th>THD (%)</th></tr></thead>
              <tbody>
                {[['A',ph.Va.mag,'#1d4ed8'],['B',ph.Vb.mag,'#16a34a'],['C',ph.Vc.mag,'#dc2626']].map(([f,v,c])=>(
                  <tr key={f}><td><span style={{color:c,fontWeight:700}}>■</span> Fase {f}</td>
                  <td style={{fontWeight:700,color:c}}>{v.toFixed(1)}</td>
                  <td>{(v*Math.SQRT2).toFixed(1)}</td><td>2,{30+Math.floor(Math.random()*20)}</td></tr>
                ))}
                <tr style={{background:'#f8fafc'}}>
                  <td style={{fontWeight:700}}>VLL</td>
                  <td style={{fontWeight:700}}>{(ph.Va.mag*Math.sqrt(3)).toFixed(1)}</td>
                  <td>—</td><td>—</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel__head">Correntes RMS por Fase</div>
            <table className="tbl">
              <thead><tr><th>Fase</th><th>RMS (A)</th><th>Pico (A)</th><th>THD (%)</th></tr></thead>
              <tbody>
                {[['A',ph.Ia.mag,'#7c3aed'],['B',ph.Ib.mag,'#0284c7'],['C',ph.Ic.mag,'#d97706']].map(([f,v,c])=>(
                  <tr key={f}><td><span style={{color:c,fontWeight:700}}>■</span> Fase {f}</td>
                  <td style={{fontWeight:700,color:c}}>{v.toFixed(1)}</td>
                  <td>{(v*Math.SQRT2).toFixed(1)}</td><td>6,{70+Math.floor(Math.random()*30)}</td></tr>
                ))}
                <tr style={{background:'#f8fafc'}}><td style={{fontWeight:700}}>Neutro In</td>
                  <td style={{fontWeight:700}}>8,4</td><td>11,9</td><td>—</td></tr>
              </tbody>
            </table>
          </div>

          <div className="panel" style={{ flex:1 }}>
            <div className="panel__head">Editar Fasores</div>
            <div className="panel__body scroll-y" style={{ overflow:'auto' }}>
              {Object.entries(ph).map(([key, val]) => (
                <div key={key} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, fontSize:11 }}>
                  <span style={{ color:COLORS[key], fontWeight:700, width:18 }}>{key}</span>
                  <input type="number" step="0.1" value={val.mag} style={{ width:68, height:26, border:'1px solid #e2e8f0', borderRadius:4, padding:'0 4px', fontSize:11 }}
                    onChange={e=>setPh(p=>({...p,[key]:{...p[key],mag:parseFloat(e.target.value)||0}}))} />
                  <span style={{color:'#94a3b8'}}>∠</span>
                  <input type="number" step="0.5" value={val.ang} style={{ width:64, height:26, border:'1px solid #e2e8f0', borderRadius:4, padding:'0 4px', fontSize:11 }}
                    onChange={e=>setPh(p=>({...p,[key]:{...p[key],ang:parseFloat(e.target.value)||0}}))} />
                  <span style={{color:'#94a3b8'}}>°</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display:'flex', gap:6, flexShrink:0 }}>
            <button className="btn btn-ghost btn-sm" style={{flex:1}}>Exportar CSV</button>
            <button className="btn btn-primary btn-sm" style={{flex:1}}>Exportar PNG</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FullPhasorDiagram({ phasors }) {
  const size = 360; const cx = size/2; const cy = size/2
  const maxMag = Math.max(...phasors.map(p => p.mag))
  const scale = (size/2 - 30) / (maxMag || 1)
  const arrowId = c => `arr-${c.replace('#','')}`

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        {phasors.map(p=>(
          <marker key={p.key} id={arrowId(p.color)} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 z" fill={p.color}/>
          </marker>
        ))}
      </defs>
      {/* Grid circles */}
      {[0.25,0.5,0.75,1].map(r=>(
        <circle key={r} cx={cx} cy={cy} r={r*(size/2-30)} fill="none" stroke="#f1f5f9" strokeWidth={1}/>
      ))}
      {/* Axes */}
      <line x1={10} y1={cy} x2={size-10} y2={cy} stroke="#e2e8f0" strokeWidth={1}/>
      <line x1={cx} y1={10} x2={cx} y2={size-10} stroke="#e2e8f0" strokeWidth={1}/>
      {/* Phasors */}
      {phasors.map(p=>{
        const rad = p.ang * Math.PI / 180
        const ex = cx + scale * p.mag * Math.cos(rad)
        const ey = cy - scale * p.mag * Math.sin(rad)
        return (
          <g key={p.key}>
            <line x1={cx} y1={cy} x2={ex} y2={ey} stroke={p.color} strokeWidth={2.5}
              markerEnd={`url(#${arrowId(p.color)})`}/>
            <text x={ex+(ex>cx?6:-6)} y={ey+(ey>cy?12:-4)} fontSize={10} fill={p.color}
              textAnchor={ex>cx?'start':'end'} fontWeight={700}>
              {p.label} {p.mag.toFixed(1)}
            </text>
          </g>
        )
      })}
      <text x={4} y={14} fontSize={9} fill="#94a3b8">Im</text>
      <text x={size-28} y={cy-5} fontSize={9} fill="#94a3b8">Re</text>
    </svg>
  )
}
