import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'

const INSTRUMENTS = [
  ['Voltimetro', 'CA/CC', '0 - 1000 V', 'V'],
  ['Amperimetro', 'CA/CC', '0 - 1000 A', 'A'],
  ['Wattimetro', 'CA', '0 - 1 MW', 'W'],
  ['Osciloscopio', '4 Canais', '100 MHz', '~'],
  ['Analisador de Energia', 'Classe A', 'IEC 61000-4-30', 'PQ'],
  ['Multimetro', 'True RMS', 'CAT III 600 V', 'D'],
  ['Alicate Amperimetrico', 'CA', '0 - 2000 A', 'A'],
  ['Megaometro', '250 V - 5 kV', 'Ω'],
]

const WAVE = Array.from({ length: 120 }, (_, i) => ({
  t: +(i * 0.35).toFixed(1),
  vl1: +(300 * Math.sin(i / 8)).toFixed(1),
  vl2: +(300 * Math.sin(i / 8 - 2.094)).toFixed(1),
  vl3: +(300 * Math.sin(i / 8 + 2.094)).toFixed(1),
  vn: +(60 * Math.sin(i / 8 + 0.5)).toFixed(1),
}))

const comparison = [
  ['VM-1000 (Ref.)', 'V_L1', '231,4 V', '--', '±0,12%', 'OK'],
  ['VM-550', 'V_L1', '231,6 V', '+0,2 V', '±0,20%', 'OK'],
  ['DMM-3440', 'V_L1', '231,1 V', '-0,3 V', '±0,25%', 'Aviso'],
  ['Osciloscopio', 'V_L1 pico', '327,1 V', '--', '±1,00%', 'Aviso'],
]

export default function Medidas() {
  return (
    <div style={{ height: '100%', display: 'grid', gridTemplateColumns: '220px 1fr 290px', gap: 10, padding: 10, overflow: 'hidden' }}>
      <aside className="panel" style={{ minHeight: 0 }}>
        <div className="panel__head">Instrumentos Disponiveis</div>
        <div className="panel__body scroll-y" style={{ height: 'calc(100% - 82px)', overflow: 'auto' }}>
          {INSTRUMENTS.map(([name, mode, range, icon], i) => (
            <button key={name} className={`instr-btn${i === 0 ? ' active' : ''}`} style={{ marginBottom: 8 }}>
              <span style={{ display: 'inline-flex', width: 36, height: 28, marginRight: 8, alignItems: 'center', justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: 5, background: '#fff', fontWeight: 800 }}>{icon}</span>
              <b>{name}</b>
              <div style={{ color: i === 0 ? '#dbeafe' : '#64748b', fontSize: 10, marginLeft: 46 }}>{mode} · {range}</div>
            </button>
          ))}
        </div>
        <div className="panel__body" style={{ borderTop: '1px solid #e2e8f0' }}>
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>+ Adicionar Instrumento</button>
        </div>
      </aside>

      <main style={{ display: 'grid', gridTemplateRows: 'auto auto 1fr 210px', gap: 10, minHeight: 0 }}>
        <div className="panel">
          <div className="panel__head">1. Tipo de Medicao</div>
          <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
            {['Tensao', 'Corrente', 'Potencia', 'Energia', 'Frequencia', 'Outros'].map((item, i) => (
              <button key={item} className={`btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}`} style={{ justifyContent: 'center' }}>{item}</button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 10 }}>
          <div className="panel">
            <div className="panel__head">2. Metodo de Medicao</div>
            <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <MethodCard title="Direta" checked />
              <MethodCard title="Indireta (TC/TP)" />
            </div>
          </div>
          <div className="panel">
            <div className="panel__head">3. Configuracao da Medicao</div>
            <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['Grandeza', 'Sistema', 'Conexao', 'Canais / Fases'].map((label, i) => (
                <div className="form-row" key={label} style={{ marginBottom: 0 }}>
                  <span className="form-label" style={{ minWidth: 90 }}>{label}</span>
                  <select className="form-select"><option>{['Tensao', 'Trifasico - 4 fios', 'Estrela (Y)', 'L1, L2, L3, N'][i]}</option></select>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '310px 1fr 270px', gap: 10, minHeight: 0 }}>
          <div className="panel">
            <div className="panel__head">4. Instrumento Selecionado</div>
            <div className="panel__body">
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 95, height: 110, borderRadius: 8, background: '#111827', color: '#67e8f9', display: 'grid', placeItems: 'center', fontWeight: 800 }}>VM<br />1000</div>
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  <b style={{ color: '#1d4ed8' }}>Voltimetro Digital</b><br />
                  Modelo: VM-1000<br />Classe: 0,2<br />Faixa: 0 - 1000 V CA<br />Entrada: 4 canais
                </div>
              </div>
              <div style={{ marginTop: 12, padding: 10, border: '1px solid #dcfce7', background: '#f0fdf4', borderRadius: 8 }}>
                <b style={{ color: '#16a34a' }}>Calibrado</b><br />
                Certificado: CAL-2024-0875<br />Prox. Calibracao: 15/11/2025
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">5. Visualizacao e Leituras em Tempo Real</div>
            <div style={{ height: 275, padding: 10 }}>
              <ResponsiveContainer>
                <LineChart data={WAVE}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="t" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line dataKey="vl1" stroke="#1d4ed8" dot={false} name="V_L1" strokeWidth={2} />
                  <Line dataKey="vl2" stroke="#16a34a" dot={false} name="V_L2" strokeWidth={2} />
                  <Line dataKey="vl3" stroke="#dc2626" dot={false} name="V_L3" strokeWidth={2} />
                  <Line dataKey="vn" stroke="#64748b" dot={false} name="V_N" strokeWidth={1.6} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel__head">6. Fasores (RMS)</div>
            <div className="panel__body">
              <PhasorMini />
              <table className="tbl">
                <tbody>
                  {['V_L1', 'V_L2', 'V_L3'].map((p, i) => (
                    <tr key={p}><td>{p}</td><td>{(231.4 - i * 0.8).toFixed(1)} V</td><td>{[0, -120.2, 119.8][i]}°</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 1fr 1fr', gap: 10, minHeight: 0 }}>
          <InfoTable title="10. TC / TP Utilizados" rows={[['L1', '1000:100 V', '0,2', '10 VA', 'OK'], ['L2', '1000:100 V', '0,2', '10 VA', 'OK'], ['L3', '1000:100 V', '0,2', '10 VA', 'OK']]} />
          <div className="panel">
            <div className="panel__head">11. Burden e Faixa</div>
            <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Gauge label="Burden do Circuito" value="16,6 VA" pct={16.6} />
              <Gauge label="Faixa de Medicao" value="231,4 V" pct={38.6} />
            </div>
          </div>
          <div className="panel">
            <div className="panel__head">12. Seguranca e Conformidade</div>
            <div className="panel__body checklist">
              {['Conexoes verificadas', 'Isolacao adequada', 'Aterramento verificado', 'CAT III 600 V', 'IEC 61010-1'].map(x => <label key={x}><input type="checkbox" defaultChecked />{x}</label>)}
            </div>
          </div>
          <div className="panel">
            <div className="panel__head">13. Exportacao e Relatorios</div>
            <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {['Exportar Leituras', 'Gerar Relatorio', 'Capturar Tela', 'Configurar'].map((b, i) => <button key={b} className={`btn ${i === 1 ? 'btn-primary' : 'btn-ghost'} btn-sm`}>{b}</button>)}
            </div>
          </div>
        </div>
      </main>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <InfoTable title="7. Especificacoes e Incerteza" rows={[['Classe', '0,2'], ['Faixa', '0 - 600 V'], ['Resolucao', '0,1 V'], ['Incerteza', '±0,12%'], ['Metodo', 'IEC 61000-4-30']]} />
        <InfoTable title="8. Comparacao de Instrumentos" rows={comparison} />
        <InfoTable title="9. Resumo da Medicao" rows={[['Sistema', 'Trifasico - 4 fios'], ['Grandeza', 'Tensao CA'], ['Conexao', 'Estrela'], ['Frequencia', '60,00 Hz'], ['THD Medio', '2,35%'], ['Data/Hora', '01/05/2024 14:25']]} />
      </aside>
    </div>
  )
}

function MethodCard({ title, checked }) {
  return (
    <div style={{ border: `1px solid ${checked ? '#93c5fd' : '#e2e8f0'}`, borderRadius: 8, padding: 10, background: checked ? '#eff6ff' : '#fff' }}>
      <b>{checked ? '●' : '○'} {title}</b>
      <svg viewBox="0 0 180 90" style={{ width: '100%', height: 85, marginTop: 6 }}>
        <line x1="20" y1="25" x2="155" y2="25" stroke="#111827" strokeWidth="2" />
        <line x1="20" y1="65" x2="155" y2="65" stroke="#111827" strokeWidth="2" />
        <circle cx="95" cy="45" r="18" fill="#fff" stroke="#1d4ed8" strokeWidth="2" />
        <text x="95" y="50" textAnchor="middle" fontSize="14" fill="#1d4ed8">V</text>
        <circle cx="45" cy="25" r="4" fill="#111827" /><circle cx="135" cy="65" r="4" fill="#111827" />
      </svg>
    </div>
  )
}

function PhasorMini() {
  const points = [[170, 80, '#1d4ed8', 'V_L1'], [85, 180, '#dc2626', 'V_L3'], [95, 30, '#16a34a', 'V_L2']]
  return (
    <svg viewBox="0 0 220 220" style={{ width: '100%', height: 180 }}>
      <circle cx="110" cy="110" r="88" fill="none" stroke="#e2e8f0" />
      <line x1="20" y1="110" x2="200" y2="110" stroke="#e2e8f0" />
      <line x1="110" y1="20" x2="110" y2="200" stroke="#e2e8f0" />
      {points.map(([x, y, c, label]) => <g key={label}><line x1="110" y1="110" x2={x} y2={y} stroke={c} strokeWidth="4" /><circle cx={x} cy={y} r="5" fill={c} /><text x={x + 5} y={y - 5} fontSize="10" fill={c}>{label}</text></g>)}
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
