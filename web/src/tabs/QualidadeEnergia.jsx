import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, PieChart, Pie, Cell
} from 'recharts'
import { calcTHD, generateHarmonics, demoEvents, SEV_CLASS, energySeries } from '../utils/powerQuality'

const MINI_KPIS = [
  { name: 'Tensão RMS',     value: '13,81 kV',  ref: 'Nom: 13,8 kV',   color: '#1d4ed8', ok: true  },
  { name: 'Corrente RMS',   value: '612 A',      ref: 'Nom: 600 A',     color: '#16a34a', ok: true  },
  { name: 'THD-V Médio',    value: '2,34 %',     ref: 'IEEE 519: ≤5%',  color: '#0284c7', ok: true  },
  { name: 'THD-I Médio',    value: '6,87 %',     ref: 'IEEE 519: ≤8%',  color: '#7c3aed', ok: true  },
  { name: 'Desequilíbrio V',value: '0,92 %',     ref: 'PRODIST: ≤2%',   color: '#d97706', ok: true  },
  { name: 'Flicker Pst 95%',value: '0,58',       ref: 'IEC: ≤1,0',      color: '#9333ea', ok: true  },
  { name: 'Frequência',     value: '60,02 Hz',   ref: 'PRODIST: ±0,2%', color: '#059669', ok: true  },
  { name: 'Eventos Totais', value: '128',         ref: 'Mês corrente',   color: '#dc2626', ok: false },
  { name: 'Conformidade',   value: '98,2 %',     ref: 'Meta: ≥95%',     color: '#16a34a', ok: true  },
]

const EVENTS = demoEvents()
const SERIES = energySeries()
const HARMONICS = generateHarmonics(6.87)
const CONF_PIE = [
  { name: 'Conforme', value: 982, color: '#16a34a' },
  { name: 'Não conf.', value: 18, color: '#dc2626' },
]

export default function QualidadeEnergia() {
  const [fase, setFase] = useState('Fase A')
  const thd = useMemo(() => calcTHD(HARMONICS).toFixed(2), [])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Filter bar */}
      <div className="filter-bar">
        <label>Período:</label>
        <input type="text" defaultValue="01/05/2024" style={{width:110}}/>
        <span style={{color:'#64748b',fontSize:11}}>até</span>
        <input type="text" defaultValue="31/05/2024" style={{width:110}}/>
        <label>Instalação:</label>
        <select style={{width:180}}><option>Subestação Principal</option></select>
        <label>Sistema:</label>
        <select value={fase} onChange={e=>setFase(e.target.value)} style={{width:110}}>
          {['Fase A','Fase B','Fase C','Geral'].map(o=><option key={o}>{o}</option>)}
        </select>
        <div className="spacer"/>
        <button className="btn btn-primary btn-sm">Atualizar</button>
        <button className="btn btn-ghost btn-sm">Relatório</button>
      </div>

      {/* Mini KPIs */}
      <div style={{ padding:'8px 12px', flexShrink:0 }}>
        <div className="mini-kpi-row" style={{ gridTemplateColumns:'repeat(9,1fr)' }}>
          {MINI_KPIS.map(k=>(
            <div key={k.name} className="mini-kpi">
              <div className="mini-kpi__name">{k.name}</div>
              <div className="mini-kpi__value" style={{color:k.color}}>{k.value}</div>
              <div className="mini-kpi__ref" style={{color:k.ok?'#16a34a':'#dc2626'}}>
                {k.ok?'✓':''} {k.ref}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts 2×3 */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gridTemplateRows:'1fr 1fr', gap:8, padding:'0 12px', minHeight:0 }}>

        <div className="panel">
          <div className="panel__head">Espectro Harmônico de Tensão — THD = {thd}%</div>
          <div style={{height:'calc(100% - 38px)', padding:6}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={HARMONICS.filter(h=>h.order>1).map(h=>({name:`${h.order}ª`,mag:h.magnitude,limit:h.limitPct}))}
                margin={{top:4,right:4,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" tick={{fontSize:9}}/>
                <YAxis tick={{fontSize:9}}/>
                <Tooltip/>
                <Bar dataKey="mag" fill="#1d4ed8" name="THD-V (%)" radius={[3,3,0,0]}/>
                <Line type="monotone" dataKey="limit" stroke="#dc2626" dot={false} name="Limite"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">Tensão RMS ao Longo do Período</div>
          <div style={{height:'calc(100% - 38px)', padding:6}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SERIES.map((s,i)=>({...s, V:220+Math.sin(i*0.3)*2+Math.random()-0.5}))}
                margin={{top:4,right:4,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="label" tick={{fontSize:9}} interval={4}/>
                <YAxis domain={[215,225]} tick={{fontSize:9}}/>
                <Tooltip formatter={v=>[v.toFixed(2)+'V','Vrms']}/>
                <ReferenceLine y={220} stroke="#16a34a" strokeDasharray="3 2" label={{value:'Vnom',fontSize:9,fill:'#16a34a'}}/>
                <ReferenceLine y={231} stroke="#dc2626" strokeDasharray="3 2" label={{value:'+5%',fontSize:9,fill:'#dc2626'}}/>
                <ReferenceLine y={209} stroke="#dc2626" strokeDasharray="3 2" label={{value:'-5%',fontSize:9,fill:'#dc2626'}}/>
                <Line type="monotone" dataKey="V" stroke="#1d4ed8" dot={false} name="Vrms" strokeWidth={1.5}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">Conformidade IEEE 519 / PRODIST</div>
          <div style={{height:'calc(100% - 38px)', display:'flex', alignItems:'center', justifyContent:'center', gap:20, padding:8}}>
            <PieChart width={130} height={130}>
              <Pie data={CONF_PIE} cx={60} cy={60} innerRadius={38} outerRadius={60} dataKey="value" paddingAngle={2}>
                {CONF_PIE.map((e,i)=><Cell key={i} fill={e.color}/>)}
              </Pie>
              <Tooltip formatter={v=>[`${(v/10).toFixed(1)}%`]}/>
            </PieChart>
            <div>
              {CONF_PIE.map(d=>(
                <div key={d.name} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,marginBottom:6}}>
                  <span style={{width:10,height:10,borderRadius:2,background:d.color,flexShrink:0}}/>
                  <span>{d.name}</span>
                  <span style={{fontWeight:700,color:d.color,marginLeft:'auto'}}>{(d.value/10).toFixed(1)}%</span>
                </div>
              ))}
              <div style={{fontSize:10,color:'#64748b',marginTop:8}}>Base: 1000 ciclos<br/>Período: Mai/2024</div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">Fator de Potência ao Longo do Período</div>
          <div style={{height:'calc(100% - 38px)', padding:6}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SERIES} margin={{top:4,right:4,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="label" tick={{fontSize:9}} interval={4}/>
                <YAxis domain={[0.82,1.0]} tick={{fontSize:9}}/>
                <Tooltip formatter={v=>[v.toFixed(3),'FP']}/>
                <ReferenceLine y={0.92} stroke="#16a34a" strokeDasharray="3 2" label={{value:'Meta',fontSize:9}}/>
                <Line type="monotone" dataKey="fp" stroke="#7c3aed" dot={false} strokeWidth={2}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">Flicker Pst — Série Temporal</div>
          <div style={{height:'calc(100% - 38px)', padding:6}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SERIES.map((s,i)=>({...s,pst:+(0.4+Math.random()*0.6).toFixed(3)}))}
                margin={{top:4,right:4,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="label" tick={{fontSize:9}} interval={4}/>
                <YAxis domain={[0,2]} tick={{fontSize:9}}/>
                <Tooltip formatter={v=>[v.toFixed(3),'Pst']}/>
                <ReferenceLine y={1.0} stroke="#dc2626" strokeDasharray="3 2" label={{value:'Limite',fontSize:9,fill:'#dc2626'}}/>
                <Line type="monotone" dataKey="pst" stroke="#d97706" dot={false} strokeWidth={1.5}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">Frequência do Sistema</div>
          <div style={{height:'calc(100% - 38px)', padding:6}}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={SERIES.map((s,i)=>({...s,freq:+(60+Math.sin(i*0.5)*0.08+Math.random()*0.04-0.02).toFixed(4)}))}
                margin={{top:4,right:4,left:0,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="label" tick={{fontSize:9}} interval={4}/>
                <YAxis domain={[59.8,60.2]} tick={{fontSize:9}}/>
                <Tooltip formatter={v=>[v.toFixed(4)+'Hz','f']}/>
                <ReferenceLine y={60} stroke="#16a34a" strokeDasharray="3 2"/>
                <Line type="monotone" dataKey="freq" stroke="#059669" dot={false} strokeWidth={1.5}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom: events + stats */}
      <div style={{ height:190, display:'grid', gridTemplateColumns:'1fr 280px', gap:8, padding:'8px 12px 10px', flexShrink:0 }}>
        <div className="panel">
          <div className="panel__head">Alarmes e Eventos Recentes
            <span className="panel__head-actions"><button className="btn btn-ghost btn-sm">Exportar CSV</button></span>
          </div>
          <div style={{overflow:'auto', height:'calc(100% - 38px)'}}>
            <table className="tbl">
              <thead><tr><th>Data/Hora</th><th>Tipo</th><th>Descrição</th><th>Sev.</th><th>Fase</th><th>Duração</th></tr></thead>
              <tbody>
                {EVENTS.map((e,i)=>(
                  <tr key={i}>
                    <td>{e.ts}</td><td>{e.tipo}</td><td>{e.desc}</td>
                    <td><span className={SEV_CLASS[e.sev]??'badge'}>{e.sev}</span></td>
                    <td>{e.fase}</td><td>{e.dur}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <div className="panel__head">Resumo Estatístico</div>
          <div className="panel__body">
            {[
              ['Afundamentos','18','14%'],['Surtos','5','4%'],['Interrupções','3','2%'],
              ['Desequilíbrio','47','37%'],['Flicker','32','25%'],['Harmônicas','23','18%'],
            ].map(([t,n,p])=>(
              <div key={t} style={{display:'flex',justifyContent:'space-between',fontSize:11,marginBottom:6}}>
                <span style={{color:'#64748b'}}>{t}</span>
                <span><strong>{n}</strong> <span style={{color:'#94a3b8'}}>({p})</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
