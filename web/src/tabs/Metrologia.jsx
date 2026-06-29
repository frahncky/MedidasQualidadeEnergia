const uncertainty = [
  ['Alicate Amperimetrico', 'Calibracao', 'B', 'Normal', '0,120', '1,000', '0,014400'],
  ['Resolucao', 'Resolucao', 'B', 'Retangular', '0,029', '1,000', '0,000841'],
  ['Repetitividade', 'Repetibilidade', 'A', 'Normal', '0,018', '1,000', '0,000324'],
  ['Linearidade', 'Linearidade', 'B', 'Retangular', '0,060', '1,000', '0,003600'],
  ['Temperatura', 'Temperatura', 'B', 'Retangular', '0,015', '1,000', '0,000225'],
]
const certs = [
  ['CLP-001', 'Alicate Amperimetrico', '12345678', 'CAL-2024-0456', '31/05/2024', '31/05/2025', 'Valido'],
  ['VAT-002', 'Voltimetro AC', '87654321', 'CAL-2024-0312', '15/05/2024', '15/05/2025', 'Valido'],
  ['WAT-003', 'Wattimetro', 'A1B2C3D4', 'CAL-2024-0288', '10/05/2024', '10/05/2025', 'Valido'],
  ['TC-005', 'TC 600/5 A', 'TC6005-01', 'CAL-2024-0180', '28/04/2024', '28/04/2025', 'Valido'],
  ['TP-006', 'TP 13,8 kV/115 V', 'TP138-01', 'CAL-2024-0155', '25/04/2024', '25/04/2025', 'A vencer'],
]
const alarms = [
  ['TC-005: Carga excede 90% da VA nominal.', 'Alto', '31/05/2024 14:10:22'],
  ['TP-006: Aproxima-se da data de calibracao.', 'Medio', '31/05/2024 13:55:10'],
  ['Temperatura ambiente acima da faixa recomendada.', 'Medio', '31/05/2024 13:40:05'],
  ['Ensaios de dielectricidade agendados.', 'Info', '31/05/2024 13:30:00'],
]

export default function Metrologia() {
  return (
    <div style={{ minHeight: 1180, display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.85fr 0.85fr', gridTemplateRows: '260px 300px 300px 240px', gap: 14, padding: 14, overflow: 'visible' }}>
      <div className="panel">
        <div className="panel__head">Orcamento de Incerteza da Medicao</div>
        <table className="tbl">
          <thead><tr><th>Grandeza</th><th>Fonte</th><th>Tipo</th><th>Distribuicao</th><th>u(x)</th><th>Sens.</th><th>Contrib.</th></tr></thead>
          <tbody>{uncertainty.map(r => <tr key={r[0]}>{r.map(c => <td key={c}>{c}</td>)}</tr>)}</tbody>
        </table>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.7fr', borderTop: '1px solid #e2e8f0' }}>
          {['Incerteza Combinada: 0,135 A', 'k = 2,00', 'Incerteza Expandida: 0,270 A (0,135%)'].map(x => <div key={x} style={{ padding: 12, fontWeight: 800 }}>{x}</div>)}
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">Registro de Certificados de Calibracao</div>
        <table className="tbl">
          <thead><tr><th>ID</th><th>Instrumento</th><th>Certificado</th><th>Data</th><th>Prox.</th><th>Status</th></tr></thead>
          <tbody>{certs.map(r => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[3]}</td><td>{r[4]}</td><td>{r[5]}</td><td><span className={r[6] === 'Valido' ? 'badge badge-green' : 'badge badge-yellow'}>{r[6]}</span></td></tr>)}</tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel__head">Classe de Exatidao</div>
        <table className="tbl"><tbody>{['0,1', '0,25', '0,2', '0,5S', '0,5', '1', '3'].map(c => <tr key={c} style={c === '0,5' ? { background: '#dbeafe', fontWeight: 800 } : undefined}><td>{c}</td><td>± {c.replace('S', '')}%</td></tr>)}</tbody></table>
        <div className="panel__body" style={{ color: '#1d4ed8', fontWeight: 700 }}>Conforme IEC 61869-1 / IEC 60044</div>
      </div>

      <div className="panel">
        <div className="panel__head">Rastreabilidade Metrologica</div>
        <div className="panel__body">
          {['SI', 'LABMETRO / RBC', 'Laboratorios Acreditados', 'Laboratorios Internos', 'Instrumentos de Trabalho'].map((n, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ width: 30, height: 30, borderRadius: 30, background: '#dbeafe', display: 'grid', placeItems: 'center', color: '#1d4ed8', fontWeight: 800 }}>{i + 1}</span>
              <b>{n}</b>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">Curvas de Erro - Instrumento</div>
        <svg viewBox="0 0 460 190" style={{ width: '100%', height: 'calc(100% - 38px)' }}>
          <line x1="40" y1="95" x2="430" y2="95" stroke="#cbd5e1" /><line x1="40" y1="20" x2="40" y2="170" stroke="#cbd5e1" />
          <polyline points="40,92 90,88 140,94 190,86 240,91 290,83 340,90 390,87 430,92" fill="none" stroke="#1d4ed8" strokeWidth="3" />
          <path d="M40 45 C150 70 280 62 430 62" fill="none" stroke="#ef4444" strokeDasharray="6 5" />
          <path d="M40 145 C150 120 280 128 430 128" fill="none" stroke="#ef4444" strokeDasharray="6 5" />
          <text x="50" y="35" fontSize="11" fill="#64748b">Classe 0,5</text><text x="50" y="185" fontSize="11" fill="#64748b">% do valor de fundo de escala</text>
        </svg>
      </div>

      <DataPanel title="Repetibilidade e Reprodutibilidade (Gage R&R)" rows={[['Repetibilidade', '27', '0,00362', '18,4%'], ['Reprodutibilidade', '2', '0,00674', '34,2%'], ['Interacao', '54', '0,00221', '11,2%'], ['Peca', '9', '0,00781', '39,7%']]} />

      <div className="panel" style={{ gridColumn: '3 / 5' }}>
        <div className="panel__head">Transformadores de Corrente (TC)</div>
        <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 10 }}>
          <FormStack items={['Relacao Nominal: 600 / 5 A', 'Classe: 0,5', 'Potencia: 15 VA', 'FS: 5', 'Norma: IEC 61869-2']} />
          <CoilDiagram title="Diagrama de Ligacao" />
          <PolarityDiagram />
        </div>
      </div>

      <StepPanel title="Procedimentos de Medicao" steps={['Verificar validade do certificado.', 'Inspecionar instrumento e acessorios.', 'Confirmar condicoes ambientais.', 'Configurar faixa e funcao.', 'Realizar medicao conforme norma.', 'Registrar resultados e incertezas.']} />
      <DataPanel title="Tabela de Calibracao - Referencia vs Medido" rows={[['0,00', '0,02', '0,02', '0,27', 'Conforme'], ['50,00', '50,05', '0,05', '0,27', 'Conforme'], ['100,00', '100,10', '0,10', '0,27', 'Conforme'], ['200,00', '200,24', '0,12', '0,27', 'Conforme'], ['1000,0', '1002,10', '0,21', '0,27', 'Conforme']]} />

      <div className="panel" style={{ gridColumn: '3 / 5' }}>
        <div className="panel__head">Transformadores de Potencial (TP)</div>
        <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: 10 }}>
          <FormStack items={['Relacao Nominal: 13,8 kV / 115 V', 'Classe: 0,5', 'Potencia: 30 VA', 'Frequencia: 60 Hz', 'Grupo Vetorial: Dyn5']} />
          <CoilDiagram title="Diagrama de Ligacao" />
          <FormStack items={['Tensao Primaria: 13,800 kV', 'Tensao Secundaria: 115,0 V', 'N relacao: 120,000', 'Erro estimado: 0,18%', 'Saturacao: OK']} />
        </div>
      </div>

      <StepPanel title="Bloqueio e Etiquetagem (LOTO)" steps={['Desligar', 'Isolar', 'Bloquear', 'Etiquetar', 'Verificar ausencia de tensao']} />
      <DataPanel title="Verificacao de Aterramento" rows={[['Metodo', 'Queda de Potencial'], ['Resistencia Medida', '0,32 Ω'], ['Limite Recomendado', '≤ 10 Ω'], ['Status', 'Conforme']]} />
      <DataPanel title="Classes de Seguranca (CAT)" rows={[['CAT IV', '1000 V', 'Entrada de servico'], ['CAT III', '600 V', 'Distribuicao'], ['CAT II', '300 V', 'Cargas'], ['CAT I', '150 V', 'Eletronica']]} />
      <RiskMatrix />
      <div className="panel">
        <div className="panel__head">Alarmes e Avisos</div>
        <div className="panel__body">{alarms.map(([msg, sev, ts]) => <div key={msg} style={{ display: 'flex', gap: 8, padding: 8, marginBottom: 6, borderRadius: 6, background: sev === 'Alto' ? '#fee2e2' : sev === 'Medio' ? '#fef9c3' : '#dbeafe' }}><b>{sev}</b><span style={{ flex: 1 }}>{msg}</span><span>{ts}</span></div>)}</div>
      </div>
    </div>
  )
}

function DataPanel({ title, rows }) {
  return <div className="panel"><div className="panel__head">{title}</div><table className="tbl"><tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={j === 0 ? { fontWeight: 700 } : undefined}>{c}</td>)}</tr>)}</tbody></table></div>
}

function StepPanel({ title, steps }) {
  return <div className="panel"><div className="panel__head">{title}</div><div className="panel__body">{steps.map((s, i) => <div key={s} style={{ display: 'flex', gap: 8, marginBottom: 8 }}><span className="section-num">{i + 1}</span><span>{s}</span></div>)}</div></div>
}

function FormStack({ items }) {
  return <div>{items.map(item => { const [k, v] = item.split(': '); return <div className="form-row" key={item}><span className="form-label" style={{ minWidth: 115 }}>{k}</span><input className="form-input" value={v} readOnly /></div> })}</div>
}

function CoilDiagram({ title }) {
  return <div style={{ textAlign: 'center' }}><b>{title}</b><svg viewBox="0 0 260 140" style={{ width: '100%', height: 120 }}><line x1="25" y1="40" x2="235" y2="40" stroke="#111827" /><path d="M90 40 q20 -40 40 0 q20 40 40 0" fill="none" stroke="#111827" strokeWidth="2" /><line x1="25" y1="100" x2="235" y2="100" stroke="#111827" /><path d="M90 100 q20 -40 40 0 q20 40 40 0" fill="none" stroke="#111827" strokeWidth="2" /><rect x="118" y="72" width="34" height="22" fill="#fff" stroke="#111827" /><text x="135" y="88" textAnchor="middle" fontSize="12">Zb</text></svg></div>
}

function PolarityDiagram() {
  return <div style={{ textAlign: 'center' }}><b>Marcacao e Polaridade</b><svg viewBox="0 0 220 130" style={{ width: '100%', height: 115 }}><line x1="35" y1="35" x2="190" y2="35" stroke="#111827" /><line x1="35" y1="92" x2="190" y2="92" stroke="#111827" /><circle cx="35" cy="35" r="6" fill="#ef4444" /><circle cx="35" cy="92" r="6" fill="#ef4444" /><text x="28" y="24">P1</text><text x="180" y="24">P2</text><text x="28" y="82">S1</text><text x="180" y="82">S2</text></svg></div>
}

function RiskMatrix() {
  const cells = [['Media', 'Alta', 'Critica'], ['Baixa', 'Media', 'Alta'], ['Baixa', 'Baixa', 'Media']]
  const color = v => v === 'Critica' ? '#ef4444' : v === 'Alta' ? '#f97316' : v === 'Media' ? '#facc15' : '#22c55e'
  return <div className="panel"><div className="panel__head">Matriz de Risco</div><div className="panel__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>{cells.flat().map((c, i) => <div key={i} style={{ background: color(c), padding: 10, textAlign: 'center', fontWeight: 800 }}>{c}</div>)}</div></div>
}
