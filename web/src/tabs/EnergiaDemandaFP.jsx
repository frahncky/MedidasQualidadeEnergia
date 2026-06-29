import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { energySeries } from '../utils/powerQuality'
import { useAppContext } from '../context/AppContext'
import { useToast } from '../components/Toast'

const daily = energySeries(31)
const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((m, i) => ({
  mes: m,
  atual: i < 5 ? 105 + i * 12 + (i % 2) * 10 : 0,
  anterior: 92 + i * 3,
  meta: 95 + i * 5,
}))
const load = Array.from({ length: 25 }, (_, i) => ({
  h: `${String(i).padStart(2, '0')}:00`,
  util: +(820 + Math.sin((i - 8) / 4) * 620 + (i > 7 && i < 20 ? 300 : 0)).toFixed(0),
  sab: +(610 + Math.sin((i - 9) / 4) * 310 + (i > 8 && i < 18 ? 170 : 0)).toFixed(0),
  dom: +(430 + Math.sin((i - 10) / 5) * 180 + (i > 9 && i < 17 ? 90 : 0)).toFixed(0),
}))
const pie = [
  { name: 'Energia', value: 53.8, color: '#1d4ed8' },
  { name: 'Demanda', value: 24.7, color: '#f59e0b' },
  { name: 'Encargos', value: 12.6, color: '#ef4444' },
  { name: 'Ultrapassagem', value: 5.1, color: '#9333ea' },
  { name: 'Impostos', value: 3.8, color: '#64748b' },
]
const sectors = [
  ['Produção', '45,21', '36,1%', 'R$ 28.321,45'],
  ['Utilidades', '23,68', '18,9%', 'R$ 16.372,12'],
  ['HVAC', '18,44', '14,7%', 'R$ 13.024,93'],
  ['Iluminação', '12,31', '9,8%', 'R$ 8.653,32'],
  ['Escritórios / TI', '9,79', '7,8%', 'R$ 6.705,34'],
]

const TARIFAS = ['Grupo A4 Verde', 'Grupo A4 Azul', 'Grupo B1 Residencial', 'Grupo A3 Verde']
const INSTALACOES = ['Subestação Principal', 'Laboratório LQE', 'Fábrica Norte']

/* Calculates capacitor bank size to correct FP from fpAtual to fpAlvo */
function calcCapacitorBank(P_kW, fpAtual, fpAlvo) {
  const tgAtual = Math.tan(Math.acos(fpAtual))
  const tgAlvo = Math.tan(Math.acos(fpAlvo))
  return +(P_kW * (tgAtual - tgAlvo)).toFixed(1)
}

export default function EnergiaDemandaFP({ onNavigate }) {
  const { installation: instalacao, setInstallation: setInstalacao, dateFrom, setDateFrom, dateTo, setDateTo } = useAppContext()
  const toast = useToast()
  const [tarifa, setTarifa] = useState('Grupo A4 Verde')
  const [fpAlvo, setFpAlvo] = useState('0,98')
  const [showEconomy, setShowEconomy] = useState(false)
  const [showSim, setShowSim] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [calculating, setCalculating] = useState(false)

  const P_kW = 1200
  const fpAtual = 0.92
  const fpTarget = parseFloat(fpAlvo.replace(',', '.')) || 0.98
  const Qc = calcCapacitorBank(P_kW, fpAtual, fpTarget)
  const economiaMulta = 7845
  const economiaCapacitor = Math.round(Qc * 4.2)

  function handleCalcular() {
    setShowEconomy(false); setCalculating(true)
    setTimeout(() => { setCalculating(false); setShowEconomy(true); toast('Análise de economia calculada', 'success') }, 600)
  }

  function handleSimular() {
    setShowSim(true); toast('Simulação de FP carregada', 'info')
  }

  function handleComparar() {
    setShowCompare(true); toast('Comparativo de cenários gerado', 'info')
  }

  return (
    <div style={{ minHeight: 1250, display: 'flex', flexDirection: 'column', gap: 14, padding: 14, overflow: 'visible' }}>
      <div className="filter-bar" style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <label>Período de Análise</label>
        <input value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ width: 150 }} />
        <span style={{ color: '#64748b' }}>até</span>
        <input value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ width: 150 }} />
        <label>Instalação</label>
        <select value={instalacao} onChange={e => setInstalacao(e.target.value)}>
          {INSTALACOES.map(o => <option key={o}>{o}</option>)}
        </select>
        <label>Tarifa</label>
        <select value={tarifa} onChange={e => setTarifa(e.target.value)}>
          {TARIFAS.map(o => <option key={o}>{o}</option>)}
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={handleCalcular} disabled={calculating}>
          {calculating ? '⏳…' : 'Calcular Economia'}
        </button>
        <button className="btn btn-ghost" onClick={handleSimular}>Simular Correção de FP</button>
        <button className="btn btn-ghost" onClick={handleComparar}>Comparar Cenários</button>
      </div>

      {/* Economia Result Panel */}
      {showEconomy && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, position: 'relative' }}>
          <button onClick={() => setShowEconomy(false)} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16 }}>✕</button>
          <div>
            <div style={{ fontWeight: 800, color: '#166534', fontSize: 13 }}>Análise de Economia — {instalacao}</div>
            <div style={{ fontSize: 11, color: '#16a34a', marginTop: 4 }}>FP atual: <b>{fpAtual}</b> → FP alvo: <b>{fpAlvo}</b></div>
          </div>
          {[
            ['Economia Multa ANEEL', `R$ ${economiaMulta.toLocaleString('pt-BR')}/mês`, '#16a34a'],
            ['Banco de Capacitores', `${Qc} kVar`, '#1d4ed8'],
            ['Redução de Perdas', `R$ ${(Qc * 1.8).toFixed(0)}/mês`, '#059669'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: '#fff', borderRadius: 6, padding: '10px 14px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color, marginTop: 4 }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* FP Simulation Panel */}
      {showSim && (
        <div style={{ background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, padding: '14px 18px', position: 'relative' }}>
          <button onClick={() => setShowSim(false)} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16 }}>✕</button>
          <div style={{ fontWeight: 800, color: '#1e3a8a', marginBottom: 12 }}>Simulação de Correção de Fator de Potência</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>FP Alvo</div>
              <input className="form-input" value={fpAlvo} onChange={e => setFpAlvo(e.target.value)} placeholder="0,98" style={{ width: '100%' }} />
            </div>
            <div className="panel__body" style={{ background: '#fff', borderRadius: 6, padding: '10px 14px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Banco de Capacitores Necessário</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1d4ed8', marginTop: 4 }}>{Qc} kVar</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Potência ativa: {P_kW} kW</div>
            </div>
            <div className="panel__body" style={{ background: '#fff', borderRadius: 6, padding: '10px 14px', border: '1px solid #bfdbfe' }}>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Custo Estimado do Banco</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#9333ea', marginTop: 4 }}>R$ {economiaCapacitor.toLocaleString('pt-BR')}</div>
              <div style={{ fontSize: 11, color: '#16a34a' }}>Payback: ~{Math.ceil(economiaCapacitor / economiaMulta)} meses</div>
            </div>
          </div>
        </div>
      )}

      {/* Scenarios comparison Panel */}
      {showCompare && (
        <div style={{ background: '#faf5ff', border: '1px solid #d8b4fe', borderRadius: 8, padding: '14px 18px', position: 'relative' }}>
          <button onClick={() => setShowCompare(false)} style={{ position: 'absolute', top: 8, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16 }}>✕</button>
          <div style={{ fontWeight: 800, color: '#581c87', marginBottom: 12 }}>Comparação de Cenários de Eficiência</div>
          <table className="tbl">
            <thead><tr><th>Cenário</th><th>FP</th><th>Custo / mês</th><th>Banco kVar</th><th>Economia / mês</th><th>Payback</th></tr></thead>
            <tbody>
              {[
                ['Atual (sem correção)', '0,92', 'R$ 86.742', '—', '—', '—'],
                ['Correção parcial', '0,95', 'R$ 84.210', `${calcCapacitorBank(P_kW, 0.92, 0.95)} kVar`, 'R$ 2.532', '~14 meses'],
                ['Correção padrão', '0,98', 'R$ 79.875', `${Qc} kVar`, 'R$ 6.867', '~10 meses'],
                ['Correção total', '0,99', 'R$ 78.100', `${calcCapacitorBank(P_kW, 0.92, 0.99)} kVar`, 'R$ 8.642', '~12 meses'],
              ].map((r, i) => (
                <tr key={i} style={{ background: i === 2 ? '#f3e8ff' : undefined }}>
                  {r.map((c, j) => <td key={j} style={j === 0 ? { fontWeight: 700 } : j === 4 ? { color: '#16a34a', fontWeight: 700 } : {}}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(7,1fr)' }}>
        {[
          ['Energia Ativa Consumida', '125,43 MWh', '+8,7%', '#16a34a'],
          ['Custo Total no Período', 'R$ 86.742,31', '+9,2%', '#16a34a'],
          ['Demanda Maxima', '1.786 kW', '+4,3%', '#ea580c'],
          ['Fator de Potência Médio', '0,92 ind.', '+0,03', '#1d4ed8'],
          ['Demanda Contratada', '2.000 kW', 'Utilização: 89%', '#9333ea'],
          ['Custo Médio de Energia', 'R$ 0,693/kWh', '+0,05', '#d97706'],
          ['Economia Estimada', 'R$ 7.845,12', 'com FP p/ 0,98', '#16a34a'],
        ].map(([name, value, delta, color]) => (
          <div key={name} className="kpi-card">
            <div className="kpi-card__icon" style={{ background: color }}>{name[0]}</div>
            <div className="kpi-card__info"><div className="kpi-card__name">{name}</div><div className="kpi-card__value">{value}</div><div className="kpi-card__delta">{delta}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr 0.9fr', gap: 10, height: 320 }}>
        <ChartPanel title="Consumo de Energia (kWh)">
          <BarChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Bar dataKey="energy" fill="#1d4ed8" name="Ativa" /><Bar dataKey="fp" fill="#f97316" name="Reativa (esc.)" /></BarChart>
        </ChartPanel>
        <ChartPanel title="Perfil de Carga Médio (kW)">
          <LineChart data={load}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="h" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Line dataKey="util" stroke="#1d4ed8" dot={false} name="Dias uteis" /><Line dataKey="sab" stroke="#f97316" dot={false} name="Sabado" /><Line dataKey="dom" stroke="#16a34a" dot={false} name="Domingo" /></LineChart>
        </ChartPanel>
        <div className="panel">
          <div className="panel__head">Análise de Tarifas e Custos</div>
          <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={150}><PieChart><Pie data={pie} dataKey="value" innerRadius={45} outerRadius={68}>{pie.map(p => <Cell key={p.name} fill={p.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
            <table className="tbl"><tbody>{pie.map(p => <tr key={p.name}><td><span style={{ color: p.color }}>■</span> {p.name}</td><td>{p.value}%</td><td>R$ {(86742 * p.value / 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td></tr>)}</tbody></table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr 1fr 1fr', gap: 10, height: 320 }}>
        <div className="panel">
          <div className="panel__head">Monitoramento do Fator de Potência</div>
          <div className="panel__body" style={{ textAlign: 'center' }}>
            <div style={{ height: 120, borderRadius: '130px 130px 0 0', background: 'conic-gradient(from 270deg, #ef4444 0 45deg, #f59e0b 45deg 95deg, #16a34a 95deg 180deg, transparent 180deg)' }} />
            <div style={{ fontSize: 30, fontWeight: 800 }}>0,92 <span style={{ fontSize: 13 }}>ind.</span></div>
            <div style={{ color: '#64748b' }}>Médio no período</div>
          </div>
        </div>
        <ChartPanel title="Curva de Demanda (kW) - Ordenada">
          <LineChart data={daily.map((d, i) => ({ x: i * 3.3, demand: Math.max(80, 2100 - i * 58) }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line dataKey="demand" stroke="#1d4ed8" dot={false} /></LineChart>
        </ChartPanel>
        <div className="panel">
          <div className="panel__head">Fluxo de Energia</div>
          <div className="panel__body">
            {[
              ['Cargas Produtivas', 60.7, '#1d4ed8'], ['Cargas Auxiliares', 25.4, '#f97316'], ['Perdas Elétricas', 7.9, '#f59e0b'], ['Outros', 6.0, '#9333ea'],
            ].map(([n, p, c]) => <div key={n} style={{ marginBottom: 13 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{n}</b><span>{p}%</span></div><div style={{ height: 10, background: '#e2e8f0', borderRadius: 8 }}><div style={{ width: `${p}%`, height: '100%', background: c, borderRadius: 8 }} /></div></div>)}
          </div>
        </div>
        <ChartPanel title="Previsão de Consumo e Custo">
          <BarChart data={months.slice(4)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="atual" fill="#1d4ed8" /><Bar dataKey="meta" fill="#86efac" /></BarChart>
        </ChartPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, height: 250 }}>
        <DataTable title="Balanço de Energia (MWh)" rows={[['Energia Ativa Importada', '125,43', '100,0%', '+8,7%'], ['Cargas Produtivas', '76,15', '60,7%', '+8,5%'], ['Cargas Auxiliares', '31,82', '25,4%', '+8,9%'], ['Perdas Elétricas', '9,86', '7,9%', '+14,5%']]} />
        <DataTable title="Contribuição por Setor / Circuito" rows={sectors} />
        <DataTable title="Comparativo Mensal (MWh)" rows={months.slice(0, 6).map(m => [m.mes, m.atual.toFixed(2), m.anterior.toFixed(2), '+8,7%'])} />
      </div>
    </div>
  )
}

function ChartPanel({ title, children }) {
  return <div className="panel"><div className="panel__head">{title}</div><div style={{ height: 'calc(100% - 38px)', padding: 8 }}><ResponsiveContainer>{children}</ResponsiveContainer></div></div>
}

function DataTable({ title, rows }) {
  return (
    <div className="panel">
      <div className="panel__head">{title}</div>
      <table className="tbl"><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={j === 0 ? { fontWeight: 700 } : j === r.length - 1 ? { color: '#16a34a', fontWeight: 700 } : undefined}>{c}</td>)}</tr>)}</tbody></table>
    </div>
  )
}
