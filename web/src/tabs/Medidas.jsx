import { useState, useMemo } from 'react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { useToast } from '../components/Toast'
import { exportCSV } from '../utils/export'

const INSTRUMENTS = [
  { name: 'Voltímetro',           mode: 'CA/CC',    range: '0 – 1000 V',    icon: 'V',   model: 'VM-1000',  class: '0,2',  cert: 'CAL-2024-0875', nextCal: '15/11/2025', status: 'Calibrado',    statusColor: '#16a34a' },
  { name: 'Amperímetro',          mode: 'CA/CC',    range: '0 – 1000 A',    icon: 'A',   model: 'AM-800',   class: '0,5',  cert: 'CAL-2024-0812', nextCal: '20/09/2025', status: 'Calibrado',    statusColor: '#16a34a' },
  { name: 'Wattímetro',           mode: 'CA',       range: '0 – 1 MW',      icon: 'W',   model: 'WM-300',   class: '0,5',  cert: 'CAL-2023-1120', nextCal: '10/12/2024', status: 'Vencido',      statusColor: '#dc2626' },
  { name: 'Osciloscópio',         mode: '4 Canais', range: '100 MHz',       icon: '~',   model: 'OSC-440',  class: '1,0',  cert: 'CAL-2024-0740', nextCal: '05/07/2025', status: 'Calibrado',    statusColor: '#16a34a' },
  { name: 'Analisador de Energia',mode: 'Classe A', range: 'IEC 61000-4-30',icon: 'PQ',  model: 'PQA-5000', class: 'A',    cert: 'CAL-2024-0910', nextCal: '31/12/2025', status: 'Calibrado',    statusColor: '#16a34a' },
  { name: 'Multímetro',           mode: 'True RMS', range: 'CAT III 600 V', icon: 'D',   model: 'DMM-344',  class: '0,25', cert: 'CAL-2024-0650', nextCal: '01/10/2025', status: 'Calibrado',    statusColor: '#16a34a' },
  { name: 'Alicate Amperimétrico',mode: 'CA',       range: '0 – 2000 A',    icon: 'A⊕',  model: 'AC-2000',  class: '1,0',  cert: 'CAL-2024-0488', nextCal: '22/08/2025', status: 'Calibrado',    statusColor: '#16a34a' },
  { name: 'Megaôhmetro',          mode: '250–5 kV', range: 'MΩ',            icon: 'Ω',   model: 'MEG-500',  class: '2,5',  cert: 'CAL-2024-0331', nextCal: '30/06/2025', status: 'Próx. Venc.', statusColor: '#d97706' },
]

const MEASURE_TYPES = ['Tensão', 'Corrente', 'Potência', 'Energia', 'Frequência', 'Outros']

const CONFIG_OPTIONS = {
  Tensão:    { grandeza: ['Tensão CA', 'Tensão CC', 'Tensão Pico'],          sistema: ['Trifásico 3F+N', 'Trifásico 3F', 'Monofásico'], conexao: ['Estrela (Y)', 'Delta (Δ)', 'Zigue-zague'], canais: ['L1, L2, L3, N', 'L1, L2, L3', 'L1 apenas'] },
  Corrente:  { grandeza: ['Corrente CA', 'Corrente CC', 'Corrente de Pico'], sistema: ['Trifásico 3F+N', 'Trifásico 3F', 'Monofásico'], conexao: ['TC - Relação 300/5', 'Direto', 'Alicate'],   canais: ['L1, L2, L3, N', 'L1, L2, L3', 'L1 apenas'] },
  Potência:  { grandeza: ['Potência Ativa', 'Potência Reativa', 'Aparente'], sistema: ['Trifásico 3F+N', 'Trifásico 3F', 'Monofásico'], conexao: ['Aron (2 Watt.)', 'Estrela (Y)', 'Delta'],     canais: ['L1, L2, L3, N', 'L1, L2, L3', 'L1 apenas'] },
  Energia:   { grandeza: ['Energia Ativa kWh', 'Reativa kVArh', 'Aparente'], sistema: ['Trifásico 3F+N', 'Trifásico 3F', 'Monofásico'], conexao: ['Estrela (Y)', 'Delta (Δ)', 'Direta'],         canais: ['L1, L2, L3, N', 'L1, L2, L3', 'L1 apenas'] },
  Frequência:{ grandeza: ['Frequência (Hz)', 'Período (ms)', 'RPM'],          sistema: ['Trifásico 3F+N', 'Monofásico', 'Referência'],   conexao: ['Estrela (Y)', 'Direto'],                      canais: ['L1 (referência)', 'L2', 'L3'] },
  Outros:    { grandeza: ['Distorção Harmônica', 'Flicker', 'Desequilíbrio'], sistema: ['Trifásico 3F+N', 'Trifásico 3F', 'Monofásico'], conexao: ['Estrela (Y)', 'Delta (Δ)'],                   canais: ['L1, L2, L3, N', 'L1, L2, L3'] },
}

function buildWave(type) {
  return Array.from({ length: 120 }, (_, i) => {
    const t = +(i * 0.35).toFixed(1)
    if (type === 'Corrente') return { t, vl1: +(300 * Math.sin(i / 8 - 0.35)).toFixed(1), vl2: +(300 * Math.sin(i / 8 - 2.44)).toFixed(1), vl3: +(300 * Math.sin(i / 8 + 1.74)).toFixed(1), vn: +(40 * Math.sin(i / 8 + 0.5)).toFixed(1) }
    if (type === 'Potência') return { t, vl1: +(450 + 450 * Math.sin(i / 4) * Math.sin(i / 8 - 0.35)).toFixed(1) }
    if (type === 'Frequência') return { t, vl1: +(300 * Math.sin(i / 8)).toFixed(1) }
    return { t, vl1: +(300 * Math.sin(i / 8)).toFixed(1), vl2: +(300 * Math.sin(i / 8 - 2.094)).toFixed(1), vl3: +(300 * Math.sin(i / 8 + 2.094)).toFixed(1), vn: +(60 * Math.sin(i / 8 + 0.5)).toFixed(1) }
  })
}

const comparison = [
  ['VM-1000 (Ref.)', 'V_L1', '231,4 V', '--', '±0,12%', 'OK'],
  ['VM-550',         'V_L1', '231,6 V', '+0,2 V', '±0,20%', 'OK'],
  ['DMM-3440',       'V_L1', '231,1 V', '-0,3 V', '±0,25%', 'Aviso'],
  ['Osciloscópio',   'V_L1 pico', '327,1 V', '--', '±1,00%', 'Aviso'],
]

export default function Medidas({ onNavigate }) {
  const toast = useToast()
  const [activeInstr, setActiveInstr] = useState(0)
  const [measureType, setMeasureType] = useState('Tensão')
  const [method, setMethod] = useState('direta')
  const [config, setConfig] = useState({ grandeza: 0, sistema: 0, conexao: 0, canais: 0 })
  const [checklist, setChecklist] = useState([true, true, true, true, true])

  const instr = INSTRUMENTS[activeInstr]
  const opts = CONFIG_OPTIONS[measureType] ?? CONFIG_OPTIONS.Tensão
  const wave = useMemo(() => buildWave(measureType), [measureType])

  const waveLines = measureType === 'Potência'
    ? [{ key: 'vl1', color: '#1d4ed8', name: 'p(t) W' }]
    : measureType === 'Frequência'
      ? [{ key: 'vl1', color: '#059669', name: 'V_L1 (ref)' }]
      : [
          { key: 'vl1', color: '#1d4ed8', name: measureType === 'Corrente' ? 'I_L1' : 'V_L1' },
          { key: 'vl2', color: '#16a34a', name: measureType === 'Corrente' ? 'I_L2' : 'V_L2' },
          { key: 'vl3', color: '#dc2626', name: measureType === 'Corrente' ? 'I_L3' : 'V_L3' },
          { key: 'vn',  color: '#64748b', name: 'N' },
        ]

  const setConfigField = (field, val) => setConfig(c => ({ ...c, [field]: parseInt(val) }))

  return (
    <div style={{ minHeight: 1120, display: 'grid', gridTemplateColumns: '240px minmax(760px, 1fr) 320px', gap: 14, padding: 14, overflow: 'visible' }}>

      {/* Left: instruments list */}
      <aside className="panel" style={{ minHeight: 0 }}>
        <div className="panel__head">Instrumentos Disponíveis</div>
        <div className="panel__body scroll-y" style={{ height: 'calc(100% - 82px)', overflow: 'auto' }}>
          {INSTRUMENTS.map((inst, i) => (
            <button key={inst.name}
              className={`instr-btn${i === activeInstr ? ' active' : ''}`}
              style={{ marginBottom: 8 }}
              onClick={() => setActiveInstr(i)}
            >
              <span style={{ display: 'inline-flex', width: 36, height: 28, marginRight: 8, alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: 5, background: i === activeInstr ? 'rgba(255,255,255,.2)' : '#fff', fontWeight: 800 }}>{inst.icon}</span>
              <b>{inst.name}</b>
              <div style={{ color: i === activeInstr ? '#dbeafe' : '#64748b', fontSize: 10, marginLeft: 46 }}>{inst.mode} · {inst.range}</div>
            </button>
          ))}
        </div>
        <div className="panel__body" style={{ borderTop: '1px solid #e2e8f0' }}>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>+ Adicionar Instrumento</button>
        </div>
      </aside>

      {/* Center: measurement workflow */}
      <main style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr 210px', gap: 10, minHeight: 0 }}>

        {/* Step 1: Measurement type */}
        <div className="panel">
          <div className="panel__head">1. Tipo de Medição</div>
          <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
            {MEASURE_TYPES.map(item => (
              <button key={item}
                className={`btn ${item === measureType ? 'btn-primary' : 'btn-ghost'}`}
                style={{ justifyContent: 'center' }}
                onClick={() => setMeasureType(item)}
              >{item}</button>
            ))}
          </div>
        </div>

        {/* Steps 2 + 3 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 10 }}>
          <div className="panel">
            <div className="panel__head">2. Método de Medição</div>
            <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MethodCard title="Direta" checked={method === 'direta'} onClick={() => setMethod('direta')} />
              <MethodCard title="Indireta (TC/TP)" checked={method === 'indireta'} onClick={() => setMethod('indireta')} />
            </div>
          </div>
          <div className="panel">
            <div className="panel__head">3. Configuração da Medição</div>
            <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Grandeza', field: 'grandeza', items: opts.grandeza },
                { label: 'Sistema',  field: 'sistema',  items: opts.sistema  },
                { label: 'Conexão',  field: 'conexao',  items: opts.conexao  },
                { label: 'Canais / Fases', field: 'canais', items: opts.canais },
              ].map(({ label, field, items }) => (
                <div className="form-row" key={label} style={{ marginBottom: 0 }}>
                  <span className="form-label" style={{ minWidth: 90 }}>{label}</span>
                  <select className="form-select" value={config[field]} onChange={e => setConfigField(field, e.target.value)}>
                    {items.map((o, i) => <option key={i} value={i}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Steps 4, 5, 6 */}
        <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr 270px', gap: 10, minHeight: 0 }}>
          {/* Step 4: Selected instrument */}
          <div className="panel">
            <div className="panel__head">4. Instrumento Selecionado</div>
            <div className="panel__body">
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 95, height: 110, borderRadius: 8, background: '#111827', color: '#67e8f9', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 20 }}>{instr.icon}</div>
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  <b style={{ color: '#1d4ed8' }}>{instr.name}</b><br />
                  Modelo: {instr.model}<br />Classe: {instr.class}<br />Faixa: {instr.range}<br />
                  {method === 'indireta' ? 'Via TC/TP' : 'Conexão direta'}
                </div>
              </div>
              <div style={{ marginTop: 12, padding: 10, border: `1px solid ${instr.statusColor === '#dc2626' ? '#fecaca' : instr.statusColor === '#d97706' ? '#fde68a' : '#dcfce7'}`, background: instr.statusColor === '#dc2626' ? '#fef2f2' : instr.statusColor === '#d97706' ? '#fffbeb' : '#f0fdf4', borderRadius: 8 }}>
                <b style={{ color: instr.statusColor }}>{instr.status}</b><br />
                Certificado: {instr.cert}<br />Próx. Calibração: {instr.nextCal}
              </div>
            </div>
          </div>

          {/* Step 5: Waveform */}
          <div className="panel">
            <div className="panel__head">5. Visualização em Tempo Real — {measureType}</div>
            <div style={{ height: 275, padding: 10 }}>
              <ResponsiveContainer>
                <LineChart data={wave}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  {waveLines.map(l => <Line key={l.key} dataKey={l.key} stroke={l.color} dot={false} name={l.name} strokeWidth={2} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Step 6: Phasors */}
          <div className="panel">
            <div className="panel__head">6. Fasores (RMS)</div>
            <div className="panel__body">
              <PhasorMini type={measureType} />
              <table className="tbl">
                <tbody>
                  {measureType === 'Corrente'
                    ? ['I_L1', 'I_L2', 'I_L3'].map((p, i) => (
                        <tr key={p}><td>{p}</td><td>{(125.3 - i * 2.5).toFixed(1)} A</td><td>{[0, -120.4, 119.6][i]}°</td></tr>
                      ))
                    : ['V_L1', 'V_L2', 'V_L3'].map((p, i) => (
                        <tr key={p}><td>{p}</td><td>{(231.4 - i * 0.8).toFixed(1)} V</td><td>{[0, -120.2, 119.8][i]}°</td></tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Steps 10–13 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 1fr 1fr', gap: 10, minHeight: 0 }}>
          <InfoTable title="10. TC / TP Utilizados" rows={method === 'indireta'
            ? [['L1', '300/5 A', '0,5', '15 VA', 'OK'], ['L2', '300/5 A', '0,5', '15 VA', 'OK'], ['L3', '300/5 A', '0,5', '15 VA', 'OK']]
            : [['L1', 'Direto', '—', '—', 'OK'], ['L2', 'Direto', '—', '—', 'OK'], ['L3', 'Direto', '—', '—', 'OK']]
          } />
          <div className="panel">
            <div className="panel__head">11. Burden e Faixa</div>
            <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Gauge label="Burden do Circuito" value={method === 'indireta' ? '16,6 VA' : '—'} pct={method === 'indireta' ? 16.6 : 0} />
              <Gauge label="Faixa de Medição" value="231,4 V" pct={38.6} />
            </div>
          </div>
          <div className="panel">
            <div className="panel__head">12. Segurança e Conformidade</div>
            <div className="panel__body checklist">
              {['Conexões verificadas', 'Isolação adequada', 'Aterramento verificado', 'CAT III 600 V', 'IEC 61010-1'].map((x, i) => (
                <label key={x}>
                  <input type="checkbox" checked={checklist[i]} onChange={e => setChecklist(c => c.map((v, j) => j === i ? e.target.checked : v))} />
                  {x}
                </label>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel__head">13. Exportação e Relatórios</div>
            <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { exportCSV(wave.slice(0,50).map((d,i)=>({amostra:i+1,...d})), 'leituras_medidas.csv'); toast('Leituras exportadas em CSV', 'success') }}>Exportar Leituras</button>
              <button className="btn btn-primary btn-sm" onClick={() => { toast('Abrindo gerador de relatórios', 'info'); onNavigate?.('relatorios') }}>Gerar Relatório</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast('Captura de tela salva na pasta de downloads', 'success')}>Capturar Tela</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast('Abrindo configurações do instrumento…', 'info')}>Configurar</button>
            </div>
          </div>
        </div>
      </main>

      {/* Right: specs */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <InfoTable title="7. Especificações e Incerteza" rows={[
          ['Classe', instr.class], ['Faixa', instr.range], ['Resolução', '0,1 V'],
          ['Incerteza', `±${instr.class}%`], ['Método', 'IEC 61000-4-30'],
        ]} />
        <InfoTable title="8. Comparação de Instrumentos" rows={comparison} />
        <InfoTable title="9. Resumo da Medição" rows={[
          ['Sistema', opts.sistema[config.sistema]], ['Grandeza', opts.grandeza[config.grandeza]],
          ['Conexão', opts.conexao[config.conexao]], ['Frequência', '60,00 Hz'],
          ['THD Médio', measureType === 'Corrente' ? '6,87%' : '2,35%'],
          ['Data/Hora', new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })],
        ]} />
      </aside>
    </div>
  )
}

function MethodCard({ title, checked, onClick }) {
  return (
    <button onClick={onClick} style={{ border: `1px solid ${checked ? '#93c5fd' : '#e2e8f0'}`, borderRadius: 8, padding: 10, background: checked ? '#eff6ff' : '#fff', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
      <b>{checked ? '●' : '○'} {title}</b>
      <svg viewBox="0 0 180 90" style={{ width: '100%', height: 85, marginTop: 6 }}>
        <line x1="20" y1="25" x2="155" y2="25" stroke="#111827" strokeWidth="2" />
        <line x1="20" y1="65" x2="155" y2="65" stroke="#111827" strokeWidth="2" />
        <circle cx="95" cy="45" r="18" fill="#fff" stroke="#1d4ed8" strokeWidth="2" />
        <text x="95" y="50" textAnchor="middle" fontSize="14" fill="#1d4ed8">V</text>
        <circle cx="45" cy="25" r="4" fill="#111827" /><circle cx="135" cy="65" r="4" fill="#111827" />
        {!checked && <text x="90" y="88" fontSize="11" fill="#94a3b8" textAnchor="middle">TC 300/5</text>}
      </svg>
    </button>
  )
}

function PhasorMini({ type }) {
  const isI = type === 'Corrente'
  const points = [[170, 80, isI ? '#9333ea' : '#1d4ed8', isI ? 'I_L1' : 'V_L1'], [85, 180, isI ? '#d97706' : '#dc2626', isI ? 'I_L3' : 'V_L3'], [95, 30, isI ? '#0284c7' : '#16a34a', isI ? 'I_L2' : 'V_L2']]
  return (
    <svg viewBox="0 0 220 220" style={{ width: '100%', height: 180 }}>
      <circle cx="110" cy="110" r="88" fill="none" stroke="#e2e8f0" />
      <line x1="20" y1="110" x2="200" y2="110" stroke="#e2e8f0" />
      <line x1="110" y1="20" x2="110" y2="200" stroke="#e2e8f0" />
      {points.map(([x, y, c, label]) => (
        <g key={label}>
          <line x1="110" y1="110" x2={x} y2={y} stroke={c} strokeWidth="4" />
          <circle cx={x} cy={y} r="5" fill={c} />
          <text x={x + 5} y={y - 5} fontSize="10" fill={c}>{label}</text>
        </g>
      ))}
    </svg>
  )
}

function InfoTable({ title, rows }) {
  return (
    <div className="panel">
      <div className="panel__head">{title}</div>
      <div className="panel__body--np">
        <table className="tbl">
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={j === 0 ? { fontWeight: 700 } : undefined}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </div>
  )
}

function Gauge({ label, value, pct }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ height: 70, borderRadius: '90px 90px 0 0', background: `conic-gradient(from 270deg, #16a34a 0 ${pct * 1.8}deg, #facc15 ${pct * 1.8}deg 120deg, #ef4444 120deg 180deg, transparent 180deg)`, marginBottom: 6 }} />
      <b>{value}</b>
      <div style={{ color: '#64748b', fontSize: 11 }}>{label}</div>
    </div>
  )
}
