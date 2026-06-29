const sections = [
  'Capa e Identificacao', 'Sumario Executivo', 'Resumo de Conformidade', 'Descricao da Instalacao',
  'Metodologia e Normas', 'Resultados e Analises', 'Qualidade de Energia', 'Eventos e Ocorrencias',
  'Conclusoes e Recomendacoes', 'Apendices',
]
const figures = [
  ['Tensao RMS - Fase A', 'Grafico', '8'],
  ['Espectro Harmonico de Tensao - Fase A', 'Grafico', '12'],
  ['Diagrama Fasorial de Tensoes', 'Fasorial', '15'],
  ['Diagrama Unifilar da Subestacao', 'Circuito', '20'],
  ['Interrupcoes por Duracao', 'Grafico', '21'],
]

export default function Relatorios() {
  return (
    <div style={{ minHeight: 1250, display: 'grid', gridTemplateRows: 'auto 760px 320px', gap: 14, padding: 14, overflow: 'visible' }}>
      <div className="panel">
        <div className="panel__head" style={{ fontSize: 15 }}>Geracao de Relatorios <span style={{ color: '#64748b', fontWeight: 400 }}>Configure, visualize e exporte relatorios profissionais de medicoes e qualidade de energia.</span></div>
        <div className="panel__body" style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary btn-lg">Gerar Relatorio</button>
          <button className="btn btn-ghost btn-lg">Agendar</button>
          <button className="btn btn-ghost btn-lg">Assinar</button>
          <button className="btn btn-ghost btn-lg">Compartilhar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '330px 300px 1fr 230px', gap: 10, minHeight: 0 }}>
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div className="panel">
            <div className="panel__head">1. Modelo de Relatorio</div>
            <div className="panel__body">
              <select className="form-select" style={{ width: '100%' }}><option>Relatorio Completo de Qualidade de Energia</option></select>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>Gerenciar Modelos</button>
            </div>
          </div>
          <div className="panel" style={{ flex: 1 }}>
            <div className="panel__head">2. Secoes do Relatorio <label style={{ marginLeft: 'auto', fontWeight: 400 }}><input type="checkbox" defaultChecked /> Selecionar tudo</label></div>
            <div className="panel__body checklist scroll-y" style={{ height: 'calc(100% - 38px)', overflow: 'auto' }}>
              {sections.map((s, i) => <label key={s}><input type="checkbox" defaultChecked />{s}<span style={{ marginLeft: 'auto', color: '#94a3b8' }}>{i + 1}</span></label>)}
            </div>
          </div>
        </aside>

        <div className="panel">
          <div className="panel__head">3. Inclusoes no Relatorio</div>
          <div className="panel__body">
            {['Graficos e Curvas', 'Tabelas de Resultados', 'Diagramas Fasoriais', 'Diagramas de Circuitos', 'Resumo de Conformidade', 'Logs de Eventos'].map(item => (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e2e8f0', borderRadius: 8, padding: 9, marginBottom: 8 }}>
                <b style={{ color: '#1d4ed8', flex: 1 }}>{item}</b><input type="checkbox" defaultChecked /><button className="btn btn-ghost btn-sm">Configurar</button>
              </div>
            ))}
            <div style={{ marginTop: 12, padding: 12, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>As inclusoes podem ser configuradas individualmente nas opcoes ao lado de cada item.</div>
          </div>
        </div>

        <main className="panel" style={{ minHeight: 0 }}>
          <div className="panel__head">4. Pre-visualizacao do Relatorio
            <div className="panel__head-actions"><button className="btn btn-ghost btn-sm">‹</button><button className="btn btn-ghost btn-sm">1 / 24</button><button className="btn btn-ghost btn-sm">100%</button><button className="btn btn-ghost btn-sm">Baixar</button></div>
          </div>
          <div style={{ height: 'calc(100% - 38px)', overflow: 'auto', background: '#e5e7eb', padding: 18 }}>
            <ReportPage />
          </div>
        </main>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          <div className="panel">
            <div className="panel__head">5. Opcoes de Exportacao</div>
            <div className="panel__body checklist">
              {['PDF (Recomendado)', 'DOCX (Word)', 'HTML (Pagina Web)', 'TXT (Texto)'].map((f, i) => <label key={f}><input name="format" type="radio" defaultChecked={i === 0} />{f}</label>)}
              <hr style={{ border: 0, borderTop: '1px solid #e2e8f0', margin: '8px 0' }} />
              {['Incluir Sumario Hiperlink', 'Incluir Numeracao de Paginas', 'Incluir Rodape com Metadata', 'Compactar Imagens'].map((o, i) => <label key={o}><input type="checkbox" defaultChecked={i < 3} />{o}</label>)}
            </div>
          </div>
          <div className="panel">
            <div className="panel__head">Exportacao de Figuras</div>
            <div className="panel__body checklist">
              {['PNG (Alta Qualidade)', 'EPS (Vetorial)', 'JPEG (Compacto)', 'PDF (Vetorial)', 'SVG (Vetorial)'].map((o, i) => <label key={o}><input type="checkbox" defaultChecked={i === 0 || i === 3} />{o}</label>)}
              <button className="btn btn-primary btn-sm" style={{ justifyContent: 'center' }}>Exportar Figuras</button>
              <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'center' }}>Exportar Tabelas</button>
            </div>
          </div>
        </aside>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 350px 1fr 1.2fr', gap: 10, minHeight: 0 }}>
        <div className="panel">
          <div className="panel__head">6. Dados do Relatorio</div>
          <div className="panel__body">
            {['Autor do Relatorio', 'Instituicao / Empresa', 'Titulo de Estudo', 'Periodo de Medicao', 'Local da Instalacao'].map((label, i) => <div className="form-row" key={label}><span className="form-label">{label}</span><input className="form-input" value={['Engenheiro Responsavel', 'Sua Empresa / Instituicao', 'Analise da Qualidade de Energia', '01/05/2024 - 31/05/2024', 'Subestacao Principal'][i]} readOnly /></div>)}
          </div>
        </div>
        <div className="panel">
          <div className="panel__head">7. Resumo Automatico</div>
          <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              ['Energia Ativa', '125,43', 'MWh', '#16a34a'], ['Demanda Maxima', '1,786', 'MW', '#ea580c'], ['FP Medio', '0,92', 'Indutivo', '#9333ea'],
              ['Tensao Media', '13,8', 'kV', '#1d4ed8'], ['Frequencia Media', '60,02', 'Hz', '#16a34a'], ['Interrupcoes', '2', 'Eventos', '#ef4444'],
            ].map(([n, v, u, c]) => <div key={n} className="mini-kpi"><div className="mini-kpi__name">{n}</div><div className="mini-kpi__value" style={{ color: c }}>{v}</div><div className="mini-kpi__ref">{u}</div></div>)}
          </div>
        </div>
        <div className="panel">
          <div className="panel__head">8. Gerenciador de Apendices</div>
          <table className="tbl"><tbody>{['A - Configuracao da Instalacao', 'B - Configuracoes do Instrumento', 'C - Tabelas Detalhadas', 'D - Eventos e Ocorrencias', 'E - Evidencias Fotograficas'].map((a, i) => <tr key={a}><td>{a}</td><td><input type="checkbox" defaultChecked={i < 4} /></td></tr>)}</tbody></table>
          <div className="panel__body"><button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }}>+ Adicionar Apendice</button></div>
        </div>
        <div className="panel">
          <div className="panel__head">9. Figuras Geradas</div>
          <table className="tbl">
            <thead><tr><th>#</th><th>Miniatura</th><th>Descricao</th><th>Tipo</th><th>Pag.</th></tr></thead>
            <tbody>{figures.map((f, i) => <tr key={f[0]}><td>{i + 1}</td><td><SparkThumb i={i} /></td><td>{f[0]}</td><td>{f[1]}</td><td>{f[2]}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ReportPage() {
  return (
    <div style={{ width: 690, minHeight: 860, background: '#fff', margin: '0 auto', padding: 32, boxShadow: '0 6px 20px rgba(15,23,42,.18)', color: '#111827' }}>
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '2px solid #cbd5e1', paddingBottom: 18 }}>
        <div style={{ width: 70, height: 70, borderRadius: 14, background: '#dbeafe', display: 'grid', placeItems: 'center', color: '#1d4ed8', fontWeight: 900 }}>LOGO</div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2>RELATORIO DE QUALIDADE DE ENERGIA</h2>
          <div>Conforme IEEE 519:2014 e PRODIST Modulo 8</div>
        </div>
        <div style={{ fontSize: 11 }}>Relatorio N: RQE-2024-05131<br />Data: 31/05/2024</div>
      </div>
      <h3 style={{ marginTop: 20 }}>IDENTIFICACAO</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Box rows={[['Titulo do Estudo', 'Analise da Qualidade de Energia'], ['Instalacao', 'Subestacao Principal'], ['Cidade/UF', 'Sao Paulo / SP']]} />
        <Box rows={[['Periodo de Medicao', '01/05/2024 a 31/05/2024'], ['Instrumento', 'PQA-5000'], ['CREA', '5061234567']]} />
      </div>
      <h3 style={{ marginTop: 22 }}>SUMARIO EXECUTIVO</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
        {['88% Conforme', '23 Eventos', '6,87% THD-I', '0,92 FP', '125,43 MWh'].map((k, i) => <div key={k} style={{ border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, textAlign: 'center', fontWeight: 800, color: ['#16a34a', '#d97706', '#1d4ed8', '#9333ea', '#ea580c'][i] }}>{k}</div>)}
      </div>
      <h3 style={{ marginTop: 22 }}>RESUMO DE CONFORMIDADE</h3>
      <table className="tbl"><tbody>{[['Tensao RMS', '±10%', 'Dentro do limite', 'Conforme'], ['THD-Tensao', '5,0%', '2,34%', 'Conforme'], ['THD-Corrente', '8,0%', '6,87%', 'Conforme']].map(r => <tr key={r[0]}>{r.map(c => <td key={c}>{c}</td>)}</tr>)}</tbody></table>
    </div>
  )
}

function Box({ rows }) {
  return <div style={{ border: '1px solid #cbd5e1', padding: 12 }}>{rows.map(([k, v]) => <div key={k} style={{ display: 'flex', gap: 12, marginBottom: 8 }}><b style={{ width: 120 }}>{k}</b><span>{v}</span></div>)}</div>
}

function SparkThumb({ i }) {
  return <svg viewBox="0 0 80 30" style={{ width: 80, height: 30 }}><polyline points={Array.from({ length: 12 }, (_, n) => `${n * 7},${15 + Math.sin(n + i) * 10}`).join(' ')} fill="none" stroke="#1d4ed8" strokeWidth="2" /></svg>
}
