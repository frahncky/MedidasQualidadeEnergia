import { useState } from 'react'
import Simulacao from './Simulacao'

const COMPONENTS = [
  ['Fonte CC', '+ -'], ['Fonte CA', '~'], ['Resistor', 'R'], ['Indutor', 'L'],
  ['Capacitor', 'C'], ['Carga RL', 'RL'], ['Carga RLC', 'RLC'], ['Motor', 'M'],
  ['Transformador', 'TR'], ['Disjuntor', 'Q'], ['TC', 'TC'], ['TP', 'TP'],
  ['Medidor', 'W'], ['Osciloscopio', 'OSC'], ['Terra', '⏚'], ['Barramento', 'BUS'],
]

const PARTS = [
  ['V1', 'Fonte CA', '3', '13,8 kV / 60 Hz', 'Y', 'OK'],
  ['Q1', 'Disjuntor', '3', '630 A', '--', 'OK'],
  ['TC1', 'TC', '3', '300/5 A', '--', 'OK'],
  ['TP1', 'TP', '3', '13,8kV/√3 / 110 V', 'DY1', 'OK'],
  ['R1', 'Resistor', '3', '0,5 Ω', '--', 'Aviso'],
  ['M1', 'Medidor', '3', 'V,A,kW,kvar,PF', 'Y', 'OK'],
  ['L1', 'Carga RLC', '3', '1000 kW / 400 kvar', 'Y', 'OK'],
]

export default function Circuitos() {
  const [sub, setSub] = useState('editor')

  return (
    <div className="circuitos-page">

      {/* Inner sub-tab nav */}
      <div className="inner-nav">
        <span className="inner-nav__label">Módulo:</span>
        <button className={`inner-nav-btn${sub==='editor'?' active':''}`} onClick={()=>setSub('editor')}>
          ⊡ Editor de Circuitos
        </button>
        <button className={`inner-nav-btn${sub==='simulacao'?' active':''}`} onClick={()=>setSub('simulacao')}>
          ▷ Simulação de Circuitos
        </button>
      </div>

      {sub === 'simulacao' ? <Simulacao /> : (
    <div className="circuit-editor-grid">
      <aside className="panel" style={{ gridRow: '1 / 3', minHeight: 0 }}>
        <div className="panel__head">Componentes</div>
        <div className="panel__body">
          <input className="form-input" placeholder="Pesquisar componente..." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            {COMPONENTS.map(([name, icon]) => (
              <button key={name} className="instr-btn" style={{ textAlign: 'center', padding: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--c-text)' }}>{icon}</div>
                <div style={{ fontSize: 11 }}>{name}</div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="panel" style={{ gridColumn: '2 / 4' }}>
        <div className="panel__body" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {['Novo', 'Abrir', 'Salvar', 'Salvar Como', 'Desfazer', 'Refazer', 'Conectar', 'Girar', 'Apagar', 'Duplicar', 'Alinhar', 'Zoom +', 'Zoom -', 'Grade', 'Verificação'].map((b, i) => (
            <button key={b} className={`btn ${i === 6 ? 'btn-primary' : i === 8 ? 'btn-danger' : 'btn-ghost'} btn-sm`}>{b}</button>
          ))}
        </div>
      </div>

      <main className="panel" style={{ minHeight: 0 }}>
        <div className="panel__body--np" style={{ height: '100%', backgroundImage: 'radial-gradient(#dbe4f0 1px, transparent 1px)', backgroundSize: '14px 14px', position: 'relative' }}>
          <CircuitSvg />
          <div className="surface-box" style={{ position: 'absolute', left: 12, bottom: 12, padding: '4px 8px' }}>X: 220, Y: 140</div>
        </div>
      </main>

      <aside className="panel" style={{ minHeight: 0 }}>
        <div className="panel__head">Propriedades</div>
        <div className="panel__body scroll-y" style={{ height: 'calc(100% - 38px)', overflow: 'auto' }}>
          <b style={{ color: '#1d4ed8' }}>Carga RLC (ID: L1)</b>
          {[
            ['Nome', 'Carga RLC'], ['Tag', 'L1'], ['Tipo', 'Carga RLC'], ['Potência Ativa', '1000 kW'],
            ['Potência Reativa', '400 kvar'], ['Fator de Potência', '0,96 Indutivo'], ['Tensão Nominal', '13,8 kV'], ['Frequência', '60 Hz'],
          ].map(([label, value]) => (
            <div className="form-row" key={label} style={{ marginTop: 8 }}>
              <span className="form-label" style={{ minWidth: 105 }}>{label}</span>
              <input className="form-input" value={value} readOnly />
            </div>
          ))}
          <div className="checklist" style={{ marginTop: 12 }}>
            <label><input type="checkbox" defaultChecked />Neutro aterrado</label>
            <label><input type="checkbox" />Escalonar com tensão</label>
          </div>
        </div>
      </aside>

      <div className="panel">
        <div className="panel__head">Netlist (Extrato)</div>
        <pre style={{ padding: 12, fontSize: 11, lineHeight: 1.65, color: 'var(--c-text)', overflow: 'auto', height: 'calc(100% - 38px)' }}>{`* Circuito Exemplo
FONTE_CA V1 3 13800 60 0
DISJUNTOR Q1 3 630
TC TC1 3 300 5
TP TP1 3 13800 110 10 CONEXAO:DY1
RESISTOR R1 3 0.5
MEDIDOR M1 3 V A KW KVAR PF
CARGA_RLC L1 3 1000 400 0.96 IND
TERRA G1 10
CONEXAO NEUTRO N
FIM`}</pre>
      </div>

      <div className="panel">
        <div className="panel__head">Mensagens / Validação</div>
        <div className="panel__body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
            <span><b style={{ color: '#dc2626' }}>0</b> Erros</span>
            <span><b style={{ color: '#d97706' }}>1</b> Aviso</span>
            <span><b style={{ color: '#1d4ed8' }}>0</b> Informações</span>
          </div>
          <div className="result-panel result-panel--warning" style={{ padding: 10 }}>R1: Valor de resistência muito baixo (0,5 Ω). Verifique aquecimento.</div>
          <div className="checklist" style={{ marginTop: 12 }}>
            {['Topologia do circuito', 'Conexões elétricas', 'Referência de terra', 'Unidades e coerência'].map(x => <label key={x}><input type="checkbox" defaultChecked />{x} <b style={{ marginLeft: 'auto', color: '#16a34a' }}>OK</b></label>)}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">Lista de Componentes</div>
        <table className="tbl">
          <thead><tr><th>ID</th><th>Tipo</th><th>Fases</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>{PARTS.map(p => <tr key={p[0]}><td>{p[0]}</td><td>{p[1]}</td><td>{p[2]}</td><td>{p[3]}</td><td><span className={p[5] === 'OK' ? 'badge badge-green' : 'badge badge-yellow'}>{p[5]}</span></td></tr>)}</tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel__head">Diagrama Unifilar</div>
        <MiniSingleLine />
      </div>

      <div className="panel">
        <div className="panel__head">Status do Editor</div>
        <div className="panel__body">
          <Info k="Versão do Projeto" v="1.0.0" />
          <Info k="Componentes" v="9" />
          <Info k="Conexões" v="27 nós" />
          <Info k="Erros" v="0" />
          <div className="result-panel result-panel--success" style={{ marginTop: 16, padding: 12, fontWeight: 800 }}>Projeto válido</div>
        </div>
      </div>
    </div>
      )}
    </div>
  )
}

function CircuitSvg() {
  const wire = { strokeWidth: 3, fill: 'none' }
  return (
    <svg viewBox="0 0 980 520" style={{ width: '100%', height: '100%' }}>
      <text x="135" y="110" fill="#b45309" fontSize="20">A</text><text x="135" y="160" fill="#16a34a" fontSize="20">B</text><text x="135" y="210" fill="#dc2626" fontSize="20">C</text><text x="135" y="405" fill="#1d4ed8" fontSize="20">N</text>
      <path d="M90 120 H800 V205" stroke="#b45309" {...wire} />
      <path d="M90 170 H840" stroke="#16a34a" {...wire} />
      <path d="M90 220 H800" stroke="#dc2626" {...wire} />
      <path d="M90 410 H800 V260" stroke="#1d4ed8" {...wire} />
      <circle cx="70" cy="245" r="28" fill="#fff" stroke="#111827" strokeWidth="2" /><text x="70" y="251" textAnchor="middle" fontSize="22">~</text>
      <line x1="210" y1="120" x2="250" y2="120" stroke="#111827" strokeWidth="3" /><circle cx="205" cy="120" r="5" fill="#111827" /><circle cx="255" cy="120" r="5" fill="#111827" /><text x="212" y="86">Q1</text><text x="198" y="102" fontSize="11">630 A</text>
      <rect x="350" y="100" width="48" height="70" rx="6" fill="#fff" stroke="#111827" strokeWidth="2" /><text x="364" y="92">TC1</text><path d="M360 120 q15 -20 30 0 q-15 20 -30 0" fill="none" stroke="#111827" />
      <path d="M512 100 l18 35 l18 -35 M512 135 h36" stroke="#111827" strokeWidth="2" fill="none" /><text x="515" y="88">R1</text><text x="515" y="160" fontSize="12">0,5 Ω</text>
      <circle cx="490" cy="230" r="28" fill="#fff" stroke="#1d4ed8" strokeWidth="2" /><text x="490" y="238" textAnchor="middle" fill="#1d4ed8" fontSize="20">M</text>
      <circle cx="410" cy="335" r="26" fill="#fff" stroke="#111827" strokeWidth="2" /><text x="410" y="343" textAnchor="middle" fontSize="22">W</text>
      <rect x="800" y="205" width="70" height="85" fill="#fff" stroke="#111827" strokeWidth="2" /><path d="M820 215 v65 m25 -65 v65 m-25 -42 h25" stroke="#111827" /><text x="884" y="230">Carga RLC</text><text x="884" y="248" fontSize="12">1000 kW</text><text x="884" y="264" fontSize="12">400 kvar</text>
      <line x1="320" y1="120" x2="320" y2="410" stroke="#111827" strokeWidth="2" /><line x1="420" y1="170" x2="420" y2="410" stroke="#111827" strokeWidth="2" /><line x1="550" y1="220" x2="550" y2="410" stroke="#111827" strokeWidth="2" />
      <text x="320" y="440" textAnchor="middle">Terra</text><line x1="300" y1="425" x2="340" y2="425" stroke="#111827" strokeWidth="2" /><line x1="308" y1="433" x2="332" y2="433" stroke="#111827" strokeWidth="2" />
    </svg>
  )
}

function MiniSingleLine() {
  return (
    <svg viewBox="0 0 260 210" style={{ width: '100%', height: 'calc(100% - 38px)' }}>
      <line x1="130" y1="20" x2="130" y2="175" stroke="#111827" strokeWidth="2" />
      <circle cx="130" cy="25" r="13" fill="#fff" stroke="#111827" /><text x="130" y="29" textAnchor="middle" fontSize="10">V1</text>
      <rect x="118" y="60" width="24" height="18" fill="#fff" stroke="#111827" /><text x="152" y="74" fontSize="11">Q1</text>
      <path d="M115 100 q15 -18 30 0 q-15 18 -30 0" fill="none" stroke="#111827" /><text x="152" y="105" fontSize="11">TC1</text>
      <line x1="55" y1="150" x2="205" y2="150" stroke="#111827" strokeWidth="2" />
      <circle cx="90" cy="150" r="18" fill="#fff" stroke="#1d4ed8" /><text x="90" y="156" textAnchor="middle" fill="#1d4ed8">M</text>
      <circle cx="145" cy="150" r="18" fill="#fff" stroke="#111827" /><text x="145" y="156" textAnchor="middle">W</text>
      <circle cx="190" cy="150" r="18" fill="#fff" stroke="#111827" /><text x="190" y="156" textAnchor="middle">L</text>
      <text x="25" y="192" fill="#1d4ed8">N</text><line x1="45" y1="185" x2="210" y2="185" stroke="#1d4ed8" strokeDasharray="5 4" />
    </svg>
  )
}

function Info({ k, v }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}><span style={{ color: '#64748b' }}>{k}</span><b>{v}</b></div>
}
