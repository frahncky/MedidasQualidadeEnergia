import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { energySeries } from '../utils/powerQuality'

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
  ['Producao', '45,21', '36,1%', 'R$ 28.321,45'],
  ['Utilidades', '23,68', '18,9%', 'R$ 16.372,12'],
  ['HVAC', '18,44', '14,7%', 'R$ 13.024,93'],
  ['Iluminacao', '12,31', '9,8%', 'R$ 8.653,32'],
  ['Escritorios / TI', '9,79', '7,8%', 'R$ 6.705,34'],
]

export default function EnergiaDemandaFP() {
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto auto 1fr 1fr 200px', gap: 10, padding: 10, overflow: 'hidden' }}>
      <div className="filter-bar" style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <label>Periodo de Analise</label><input value="01/05/2024 00:00" readOnly /><span>ate</span><input value="31/05/2024 23:59" readOnly />
        <label>Instalacao</label><select><option>Subestacao Principal</option></select>
        <label>Tarifa</label><select><option>Grupo A4 Verde</option></select>
        <div className="spacer" />
        <button className="btn btn-primary">Calcular Economia</button>
        <button className="btn btn-ghost">Simular Correcao de FP</button>
        <button className="btn btn-ghost">Comparar Cenarios</button>
      </div>

      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(7,1fr)' }}>
        {[
          ['Energia Ativa Consumida', '125,43 MWh', '+8,7%', '#16a34a'],
          ['Custo Total no Periodo', 'R$ 86.742,31', '+9,2%', '#16a34a'],
          ['Demanda Maxima', '1.786 kW', '+4,3%', '#ea580c'],
          ['Fator de Potencia Medio', '0,92 ind.', '+0,03', '#1d4ed8'],
          ['Demanda Contratada', '2.000 kW', 'Utilizacao: 89%', '#9333ea'],
          ['Custo Medio de Energia', 'R$ 0,693/kWh', '+0,05', '#d97706'],
          ['Economia Estimada', 'R$ 7.845,12', 'com FP p/ 0,98', '#16a34a'],
        ].map(([name, value, delta, color]) => (
          <div key={name} className="kpi-card">
            <div className="kpi-card__icon" style={{ background: color }}>{name[0]}</div>
            <div className="kpi-card__info"><div className="kpi-card__name">{name}</div><div className="kpi-card__value">{value}</div><div className="kpi-card__delta">{delta}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1fr 0.9fr', gap: 10, minHeight: 0 }}>
        <ChartPanel title="Consumo de Energia (kWh)">
          <BarChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Bar dataKey="energy" fill="#1d4ed8" name="Ativa" /><Bar dataKey="fp" fill="#f97316" name="Reativa (esc.)" /></BarChart>
        </ChartPanel>
        <ChartPanel title="Perfil de Carga Medio (kW)">
          <LineChart data={load}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="h" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Line dataKey="util" stroke="#1d4ed8" dot={false} name="Dias uteis" /><Line dataKey="sab" stroke="#f97316" dot={false} name="Sabado" /><Line dataKey="dom" stroke="#16a34a" dot={false} name="Domingo" /></LineChart>
        </ChartPanel>
        <div className="panel">
          <div className="panel__head">Analise de Tarifas e Custos</div>
          <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10, alignItems: 'center' }}>
            <ResponsiveContainer width="100%" height={150}><PieChart><Pie data={pie} dataKey="value" innerRadius={45} outerRadius={68}>{pie.map(p => <Cell key={p.name} fill={p.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
            <table className="tbl"><tbody>{pie.map(p => <tr key={p.name}><td><span style={{ color: p.color }}>■</span> {p.name}</td><td>{p.value}%</td><td>R$ {(86742 * p.value / 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</td></tr>)}</tbody></table>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr 1fr 1fr', gap: 10, minHeight: 0 }}>
        <div className="panel">
          <div className="panel__head">Monitoramento do Fator de Potencia</div>
          <div className="panel__body" style={{ textAlign: 'center' }}>
            <div style={{ height: 120, borderRadius: '130px 130px 0 0', background: 'conic-gradient(from 270deg, #ef4444 0 45deg, #f59e0b 45deg 95deg, #16a34a 95deg 180deg, transparent 180deg)' }} />
            <div style={{ fontSize: 30, fontWeight: 800 }}>0,92 <span style={{ fontSize: 13 }}>ind.</span></div>
            <div style={{ color: '#64748b' }}>Medio no periodo</div>
          </div>
        </div>
        <ChartPanel title="Curva de Demanda (kW) - Ordenada">
          <LineChart data={daily.map((d, i) => ({ x: i * 3.3, demand: Math.max(80, 2100 - i * 58) }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="x" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Line dataKey="demand" stroke="#1d4ed8" dot={false} /></LineChart>
        </ChartPanel>
        <div className="panel">
          <div className="panel__head">Fluxo de Energia</div>
          <div className="panel__body">
            {[
              ['Cargas Produtivas', 60.7, '#1d4ed8'], ['Cargas Auxiliares', 25.4, '#f97316'], ['Perdas Eletricas', 7.9, '#f59e0b'], ['Outros', 6.0, '#9333ea'],
            ].map(([n, p, c]) => <div key={n} style={{ marginBottom: 13 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{n}</b><span>{p}%</span></div><div style={{ height: 10, background: '#e2e8f0', borderRadius: 8 }}><div style={{ width: `${p}%`, height: '100%', background: c, borderRadius: 8 }} /></div></div>)}
          </div>
        </div>
        <ChartPanel title="Previsao de Consumo e Custo">
          <BarChart data={months.slice(4)}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="atual" fill="#1d4ed8" /><Bar dataKey="meta" fill="#86efac" /></BarChart>
        </ChartPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, minHeight: 0 }}>
        <DataTable title="Balanco de Energia (MWh)" rows={[['Energia Ativa Importada', '125,43', '100,0%', '+8,7%'], ['Cargas Produtivas', '76,15', '60,7%', '+8,5%'], ['Cargas Auxiliares', '31,82', '25,4%', '+8,9%'], ['Perdas Eletricas', '9,86', '7,9%', '+14,5%']]} />
        <DataTable title="Contribuicao por Setor / Circuito" rows={sectors} />
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
