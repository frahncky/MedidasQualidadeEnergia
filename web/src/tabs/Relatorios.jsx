import { useState, useMemo } from 'react'
import { useToast } from '../components/Toast'
import { exportJSON, exportCSV, exportText } from '../utils/export'
import { useAppContext } from '../context/AppContext'

const ALL_SECTIONS = [
  { id: 'capa',        label: 'Capa e Identificação' },
  { id: 'sumario',     label: 'Sumário Executivo' },
  { id: 'conformidade',label: 'Resumo de Conformidade' },
  { id: 'instalacao',  label: 'Descrição da Instalação' },
  { id: 'metodologia', label: 'Metodologia e Normas' },
  { id: 'resultados',  label: 'Resultados e Análises' },
  { id: 'qualidade',   label: 'Qualidade de Energia' },
  { id: 'eventos',     label: 'Eventos e Ocorrências' },
  { id: 'conclusoes',  label: 'Conclusões e Recomendações' },
  { id: 'apendices',   label: 'Apêndices' },
]

const INCLUSIONS = ['Gráficos e Curvas', 'Tabelas de Resultados', 'Diagramas Fasoriais', 'Diagramas de Circuitos', 'Resumo de Conformidade', 'Logs de Eventos']

const TEMPLATES = [
  'Relatório Completo de Qualidade de Energia',
  'Relatório Resumido (Executivo)',
  'Relatório de Conformidade PRODIST',
  'Relatório de Análise Harmônica',
  'Relatório de Medição de Demanda',
]

const FIGURES = [
  ['Tensão RMS – Fase A',              'Gráfico',  '8'],
  ['Espectro Harmônico de Tensão – A', 'Gráfico',  '12'],
  ['Diagrama Fasorial de Tensões',     'Fasorial', '15'],
  ['Diagrama Unifilar da Subestação',  'Circuito', '20'],
  ['Interrupções por Duração',         'Gráfico',  '21'],
]

const APPENDICES = [
  'A – Configuração da Instalação',
  'B – Configurações do Instrumento',
  'C – Tabelas Detalhadas',
  'D – Eventos e Ocorrências',
  'E – Evidências Fotográficas',
]

const REPORT_DATA_FIELDS = [
  ['Autor do Relatório',    'Engenheiro Responsável'],
  ['Instituição / Empresa', 'Sua Empresa / Instituição'],
  ['Título de Estudo',      'Análise da Qualidade de Energia'],
  ['Período de Medição',    '01/05/2024 – 31/05/2024'],
  ['Local da Instalação',   'Subestação Principal'],
]

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits).replace('.', ',') : '-'
}

function buildSummaryCards(analysis) {
  return [
    ['Conformidade', `${fmt(analysis.conformity.score, 1)}%`, 'Global', '#16a34a'],
    ['Eventos', String(analysis.events.length), 'Detectados', '#ef4444'],
    ['THD-V', `${fmt(analysis.summary.thdVAvg, 2)}%`, 'Médio', '#1d4ed8'],
    ['FP Médio', fmt(analysis.summary.fpAvg, 3), 'Indutivo', '#9333ea'],
    ['Tensão Média', analysis.summary.vrmsAvg >= 1000 ? fmt(analysis.summary.vrmsAvg / 1000, 2) : fmt(analysis.summary.vrmsAvg, 1), analysis.summary.vrmsAvg >= 1000 ? 'kV' : 'V', '#ea580c'],
    ['Frequência', fmt(analysis.summary.freqAvg, 3), 'Hz', '#16a34a'],
  ]
}

export default function Relatorios({ onNavigate }) {
  const toast = useToast()
  const { pqAnalysis, installation, dateFrom, dateTo } = useAppContext()
  const [template, setTemplate] = useState(TEMPLATES[0])
  const [selectedSections, setSelectedSections] = useState(() => new Set(ALL_SECTIONS.map(s => s.id)))
  const [inclusions, setInclusions] = useState(() => new Set(INCLUSIONS))
  const [format, setFormat] = useState('PDF (Recomendado)')
  const [formatOpts, setFormatOpts] = useState([true, true, true, false])
  const [figureFormats, setFigureFormats] = useState([true, false, false, true, false])
  const [appendices, setAppendices] = useState([true, true, true, true, false])
  const [reportData, setReportData] = useState(() => ({
    ...Object.fromEntries(REPORT_DATA_FIELDS),
    'Período de Medição': `${dateFrom} – ${dateTo}`,
    'Local da Instalação': installation,
  }))
  const [page, setPage] = useState(1)
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  const totalPages = useMemo(() => {
    const hasGraphs = inclusions.has('Gráficos e Curvas')
    return Math.max(4, selectedSections.size * 2 + (hasGraphs ? 5 : 0))
  }, [selectedSections, inclusions])

  function toggleSection(id) {
    setSelectedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
    setGenerated(false)
  }

  function toggleAll(checked) {
    setSelectedSections(checked ? new Set(ALL_SECTIONS.map(s => s.id)) : new Set())
    setGenerated(false)
  }

  function toggleInclusion(item, checked) {
    setInclusions(prev => { const n = new Set(prev); checked ? n.add(item) : n.delete(item); return n })
    setGenerated(false)
  }

  function handleGenerate() {
    if (selectedSections.size === 0) { toast('Selecione pelo menos uma seção antes de gerar', 'warning'); return }
    setGenerated(false); setGenerating(true)
    setTimeout(() => { setGenerating(false); setGenerated(true); setPage(1); toast('Relatório gerado com sucesso', 'success') }, 1400)
  }

  function handleDownload() {
    if (!generated) { toast('Gere o relatório primeiro', 'warning'); return }
    const exportFormat = format.split(' ')[0]
    if (exportFormat === 'JSON') {
      exportJSON({
        template,
        format,
        sections: [...selectedSections],
        data: reportData,
        resumo: pqAnalysis.summary,
        conformidade: pqAnalysis.conformity,
        eventos: pqAnalysis.events,
        geradoEm: new Date().toISOString(),
      }, 'relatorio_smqe.json')
    } else {
      const txt = Object.entries(reportData).map(([k,v]) => `${k}: ${v}`).join('\n')
      const indicators = [
        `Conformidade: ${pqAnalysis.conformity.score}%`,
        `THD-V médio: ${fmt(pqAnalysis.summary.thdVAvg, 2)}%`,
        `THD-I médio: ${fmt(pqAnalysis.summary.thdIAvg, 2)}%`,
        `Desequilíbrio: ${fmt(pqAnalysis.summary.unbalance, 2)}%`,
        `Eventos: ${pqAnalysis.events.length}`,
      ].join('\n')
      exportText(`RELATÓRIO SMQE\n${'-'.repeat(40)}\n${txt}\n\nINDICADORES\n${indicators}\n\nSeções: ${[...selectedSections].join(', ')}`, 'relatorio_smqe.txt')
    }
    toast(`Relatório exportado em ${exportFormat}`, 'success')
  }

  const allChecked = selectedSections.size === ALL_SECTIONS.length

  return (
    <div style={{ minHeight: 1250, display: 'grid', gridTemplateRows: 'auto 760px 320px', gap: 14, padding: 14, overflow: 'visible' }}>

      {/* Header */}
      <div className="panel">
        <div className="panel__head" style={{ fontSize: 15 }}>
          Geração de Relatórios
          <span style={{ color: '#64748b', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>Configure, visualize e exporte relatórios profissionais.</span>
        </div>
        <div className="panel__body" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={handleGenerate} disabled={generating}>
            {generating ? '⏳ Gerando…' : generated ? '✓ Gerar Novamente' : 'Gerar Relatório'}
          </button>
          <button className="btn btn-ghost btn-lg" onClick={() => toast('Agendamento configurado', 'success')}>Agendar</button>
          <button className="btn btn-ghost btn-lg" onClick={() => toast('Assinatura digital disponível na versão Enterprise', 'info')}>Assinar</button>
          <button className="btn btn-ghost btn-lg" onClick={() => toast('Compartilhamento por e-mail disponível na versão Enterprise', 'info')}>Compartilhar</button>
          {generated && <span style={{ color: '#16a34a', fontWeight: 700, marginLeft: 8 }}>✓ {totalPages} páginas geradas</span>}
        </div>
      </div>

      {/* Config 4 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '330px 300px 1fr 230px', gap: 10, minHeight: 0 }}>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div className="panel">
            <div className="panel__head">1. Modelo de Relatório</div>
            <div className="panel__body">
              <select className="form-select" style={{ width: '100%' }} value={template} onChange={e => { setTemplate(e.target.value); setGenerated(false) }}>
                {TEMPLATES.map(t => <option key={t}>{t}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                onClick={() => toast('Gerenciador de modelos disponível na versão Pro', 'info')}>Gerenciar Modelos</button>
            </div>
          </div>
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel__head">
              2. Seções do Relatório
              <label style={{ marginLeft: 'auto', fontWeight: 400, cursor: 'pointer' }}>
                <input type="checkbox" checked={allChecked} onChange={e => toggleAll(e.target.checked)} /> Selecionar tudo
              </label>
            </div>
            <div className="panel__body checklist scroll-y" style={{ height: 'calc(100% - 38px)', overflow: 'auto' }}>
              {ALL_SECTIONS.map((s, i) => (
                <label key={s.id} style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={selectedSections.has(s.id)} onChange={() => toggleSection(s.id)} />
                  {s.label}
                  <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>{i + 1}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        <div className="panel">
          <div className="panel__head">3. Inclusões no Relatório</div>
          <div className="panel__body">
            {INCLUSIONS.map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e2e8f0', borderRadius: 8, padding: 9, marginBottom: 8 }}>
                <b style={{ color: '#1d4ed8', flex: 1, fontSize: 12 }}>{item}</b>
                <input type="checkbox" checked={inclusions.has(item)} onChange={e => toggleInclusion(item, e.target.checked)} />
                <button className="btn btn-ghost btn-sm" onClick={() => toast(`Configurando: ${item}`, 'info')}>Configurar</button>
              </div>
            ))}
            <div className="info-note" style={{ marginTop: 8, fontSize: 11 }}>
              {inclusions.size} de {INCLUSIONS.length} inclusões ativas
            </div>
          </div>
        </div>

        <main className="panel" style={{ minHeight: 0 }}>
          <div className="panel__head">
            4. Pré-visualização do Relatório
            <div className="panel__head-actions">
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
              <span style={{ padding: '0 8px', fontSize: 12, fontWeight: 600 }}>{page} / {generated ? totalPages : '—'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={!generated || page >= totalPages}>›</button>
              <button className="btn btn-ghost btn-sm" onClick={handleDownload}>Baixar</button>
            </div>
          </div>
          <div className="report-preview-wrap" style={{ height: 'calc(100% - 38px)' }}>
            {generated
              ? <ReportPage page={page} sections={[...selectedSections]} data={reportData} totalPages={totalPages} analysis={pqAnalysis} />
              : generating
                ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--c-primary)', fontWeight: 700 }}>⏳ Gerando {selectedSections.size} seções…</div>
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--c-text-muted)', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 40 }}>≡</div>
                    <div>Clique em <b style={{ color: 'var(--c-primary)' }}>Gerar Relatório</b> para visualizar</div>
                  </div>
            }
          </div>
        </main>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div className="panel">
            <div className="panel__head">5. Opções de Exportação</div>
            <div className="panel__body checklist">
              {['PDF (Recomendado)', 'DOCX (Word)', 'HTML (Página Web)', 'TXT (Texto)'].map(f => (
                <label key={f}><input name="format" type="radio" checked={format === f} onChange={() => setFormat(f)} />{f}</label>
              ))}
              <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />
              {['Incluir Sumário Hiperlink', 'Incluir Numeração de Páginas', 'Incluir Rodapé com Metadata', 'Compactar Imagens'].map((o, i) => (
                <label key={o}><input type="checkbox" checked={formatOpts[i]} onChange={e => setFormatOpts(v => v.map((x, j) => j === i ? e.target.checked : x))} />{o}</label>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="panel__head">Exportação de Figuras</div>
            <div className="panel__body checklist">
              {['PNG (Alta Qualidade)', 'EPS (Vetorial)', 'JPEG (Compacto)', 'PDF (Vetorial)', 'SVG (Vetorial)'].map((o, i) => (
                <label key={o}><input type="checkbox" checked={figureFormats[i]} onChange={e => setFigureFormats(v => v.map((x, j) => j === i ? e.target.checked : x))} />{o}</label>
              ))}
              <button className="btn btn-primary btn-sm" style={{ justifyContent: 'center', width: '100%', marginTop: 8 }}
                onClick={() => toast('Exportação de figuras disponível após gerar relatório', generated ? 'success' : 'warning')}>Exportar Figuras</button>
              <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'center', width: '100%' }}
                onClick={() => { exportCSV(Object.entries(reportData).map(([campo,valor])=>({campo,valor})), 'dados_relatorio.csv'); toast('Tabelas exportadas em CSV', 'success') }}>Exportar Tabelas</button>
            </div>
          </div>
        </aside>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 350px 1fr 1.2fr', gap: 10, minHeight: 0 }}>
        <div className="panel">
          <div className="panel__head">6. Dados do Relatório</div>
          <div className="panel__body">
            {REPORT_DATA_FIELDS.map(([label, placeholder]) => (
              <div className="form-row" key={label}>
                <span className="form-label">{label}</span>
                <input className="form-input"
                  value={reportData[label] ?? placeholder}
                  onChange={e => setReportData(d => ({ ...d, [label]: e.target.value }))}
                  placeholder={placeholder} />
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">7. Resumo Automático</div>
          <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {buildSummaryCards(pqAnalysis).map(([n,v,u,c])=>(
              <div key={n} className="mini-kpi"><div className="mini-kpi__name">{n}</div><div className="mini-kpi__value" style={{color:c}}>{v}</div><div className="mini-kpi__ref">{u}</div></div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">8. Gerenciador de Apêndices</div>
          <table className="tbl"><tbody>
            {APPENDICES.map((a,i)=><tr key={a}><td>{a}</td><td><input type="checkbox" checked={appendices[i]} onChange={e=>setAppendices(v=>v.map((x,j)=>j===i?e.target.checked:x))}/></td></tr>)}
          </tbody></table>
          <div className="panel__body">
            <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={()=>toast('Novo apêndice adicionado', 'success')}>+ Adicionar Apêndice</button>
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">9. Figuras Geradas</div>
          <table className="tbl">
            <thead><tr><th>#</th><th>Miniatura</th><th>Descrição</th><th>Tipo</th><th>Pág.</th></tr></thead>
            <tbody>{FIGURES.map((f,i)=><tr key={f[0]}><td>{i+1}</td><td><SparkThumb i={i}/></td><td>{f[0]}</td><td>{f[1]}</td><td>{f[2]}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ReportPage({ page, sections, data, totalPages, analysis }) {
  const merged = { ...Object.fromEntries(REPORT_DATA_FIELDS), ...data }
  const summaryCards = buildSummaryCards(analysis).slice(0, 5).map(([name, value, unit]) => `${value} ${unit}`.trim())
  const complianceRows = analysis.conformity.checks.map(check => [
    check.name,
    check.limit,
    typeof check.value === 'number' ? fmt(check.value, check.value < 10 ? 2 : 1) : check.value,
    check.ok ? 'Conforme' : 'Não conforme',
  ])
  return (
    <div className="report-preview-page">
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #cbd5e1', paddingBottom: 18 }}>
        <div style={{ width: 70, height: 70, borderRadius: 14, background: '#dbeafe', display: 'grid', placeItems: 'center', color: '#1d4ed8', fontWeight: 900 }}>LOGO</div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 style={{ fontSize: 15 }}>RELATÓRIO DE QUALIDADE DE ENERGIA</h2>
          <div style={{ fontSize: 12 }}>Conforme IEEE 519:2014 e PRODIST Módulo 8</div>
        </div>
        <div style={{ fontSize: 11 }}>N: RQE-2024-05131<br />Data: {new Date().toLocaleDateString('pt-BR')}</div>
      </div>
      {page === 1 ? (
        <>
          <h3 style={{ marginTop: 20, fontSize: 13 }}>IDENTIFICAÇÃO</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Box rows={[['Título', merged['Título de Estudo']], ['Instalação', merged['Local da Instalação']], ['Autor', merged['Autor do Relatório']]]} />
            <Box rows={[['Período', merged['Período de Medição']], ['Empresa', merged['Instituição / Empresa']], ['Instrumento', 'PQA-5000']]} />
          </div>
          <h3 style={{ marginTop: 22, fontSize: 13 }}>SUMÁRIO EXECUTIVO</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
            {summaryCards.map((k,i)=>(
              <div key={k} style={{ border:'1px solid #bfdbfe', borderRadius:8, padding:12, textAlign:'center', fontWeight:800, fontSize:11, color:['#16a34a','#d97706','#1d4ed8','#9333ea','#ea580c'][i] }}>{k}</div>
            ))}
          </div>
          <h3 style={{ marginTop: 22, fontSize: 13 }}>RESUMO DE CONFORMIDADE</h3>
          <table className="tbl"><tbody>
            {complianceRows.map(r=>(
              <tr key={r[0]}>{r.map((c,i)=><td key={i} style={i===3?{color:c === 'Conforme' ? '#16a34a' : '#dc2626',fontWeight:700}:{}}>{c}</td>)}</tr>
            ))}
          </tbody></table>
          <div style={{ marginTop: 16, fontSize: 11, color: '#94a3b8' }}>
            Seções incluídas: {sections.length} · Total: {totalPages} páginas
          </div>
        </>
      ) : (
        <div style={{ marginTop: 40, color: '#64748b', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>≡</div>
          <div style={{ fontWeight: 700 }}>Página {page} de {totalPages}</div>
          <div style={{ fontSize: 11, marginTop: 8, maxWidth: 400, margin: '12px auto 0' }}>
            Seções: {sections.map(id => ALL_SECTIONS.find(s => s.id === id)?.label).filter(Boolean).join(' · ')}
          </div>
        </div>
      )}
    </div>
  )
}

function Box({ rows }) {
  return (
    <div style={{ border: '1px solid #cbd5e1', padding: 12 }}>
      {rows.map(([k,v])=><div key={k} style={{ display:'flex', gap:12, marginBottom:8, fontSize:12 }}><b style={{width:80}}>{k}</b><span>{v}</span></div>)}
    </div>
  )
}

function SparkThumb({ i }) {
  return <svg viewBox="0 0 80 30" style={{ width:80, height:30 }}><polyline points={Array.from({length:12},(_,n)=>`${n*7},${15+Math.sin(n+i)*10}`).join(' ')} fill="none" stroke="#1d4ed8" strokeWidth="2"/></svg>
}
