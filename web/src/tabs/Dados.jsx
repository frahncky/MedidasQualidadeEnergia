import { useState, useRef } from 'react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { useToast } from '../components/Toast'
import { exportCSV } from '../utils/export'

const SOURCES_LIST = [
  { name: 'PQA-5000 #12345', group: 'Aquisições Locais',              status: 'Online',  color: '#16a34a' },
  { name: 'PQA-5000 #12346', group: 'Aquisições Locais',              status: 'Offline', color: '#94a3b8' },
  { name: 'PMU-120 #01',     group: 'Arquivos Locais',                status: 'Online',  color: '#16a34a' },
  { name: 'SQL Server PQDB', group: 'Servidores / Banco de Dados',    status: 'Online',  color: '#16a34a' },
  { name: 'Azure Blob Storage', group: 'Nuvem',                       status: 'Standby', color: '#d97706' },
]

const GROUPS = ['Aquisições Locais', 'Arquivos Locais', 'Servidores / Banco de Dados', 'Nuvem', 'Dispositivos Remotos']

const FORMATS = ['CSV', 'XLSX', 'MAT', 'TDMS', 'COMTRADE', 'Banco SQL']

const FORMAT_EXTENSIONS = { CSV: '.csv', XLSX: '.xlsx,.xls', MAT: '.mat', TDMS: '.tdms', COMTRADE: '.cfg,.dat,.hdr', 'Banco SQL': '' }

const FIELDS = [
  ['Timestamp',   'DataHora',  'datetime', 'Obrigatório'],
  ['Va',          'Va_kV',     'double',   'Obrigatório'],
  ['Vb',          'Vb_kV',     'double',   'Obrigatório'],
  ['Vc',          'Vc_kV',     'double',   'Obrigatório'],
  ['Ia',          'Ia_A',      'double',   'Obrigatório'],
  ['Ib',          'Ib_A',      'double',   'Obrigatório'],
  ['Ic',          'Ic_A',      'double',   'Obrigatório'],
  ['Frequência',  'Freq_Hz',   'double',   'Opcional'],
  ['P',           'P_kW',      'double',   'Opcional'],
  ['Q',           'Q_kVAr',    'double',   'Opcional'],
]

const PREVIEW_BASE = Array.from({ length: 12 }, (_, i) => ({
  n: i + 1,
  ts: `31/05/2024 14:20:${String(i).padStart(2, '0')}.000`,
  va: (13.82 + Math.sin(i / 3) * 0.06).toFixed(2),
  vb: (13.84 + Math.cos(i / 4) * 0.05).toFixed(2),
  vc: (13.79 + Math.sin(i / 5) * 0.04).toFixed(2),
  ia: (255.4 + Math.sin(i / 2) * 6).toFixed(1),
  ib: (-128.6 + Math.cos(i / 2) * 4).toFixed(1),
  ic: (-129.9 + Math.sin(i / 2.5) * 4).toFixed(1),
  f: (60 + Math.sin(i / 4) * 0.08).toFixed(2),
  p: (5.1 + Math.sin(i / 3) * 0.08).toFixed(3),
}))

const WAVE = Array.from({ length: 60 }, (_, i) => ({
  t: +(i * 0.0034).toFixed(3),
  va: +(13.8 * Math.sin(i / 4)).toFixed(2),
  vb: +(13.8 * Math.sin(i / 4 - 2.09)).toFixed(2),
  vc: +(13.8 * Math.sin(i / 4 + 2.09)).toFixed(2),
  ia: +(260 * Math.sin(i / 4 - 0.35)).toFixed(1),
  ib: +(260 * Math.sin(i / 4 - 2.44)).toFixed(1),
  ic: +(260 * Math.sin(i / 4 + 1.74)).toFixed(1),
  f:  +(60 + Math.sin(i / 7) * 0.05).toFixed(2),
}))

const IMPORT_HISTORY = [
  ['Medições_SP_01.csv', 'Local',     '31/05/2024 14:20'],
  ['PQ_Abril_2024.mat',  'Local',     '30/05/2024 13:20'],
  ['Eventos_TJ.tr0',    'Local',     '29/05/2024 12:20'],
  ['Subestação_Abr.tdms','Servidor', '28/05/2024 11:20'],
]

const QUALITY_CHECKS = [
  { name: 'Campos mapeados',      ok: true,  val: '9 / 9',  tone: 'green' },
  { name: 'Dados numéricos',      ok: true,  val: 'OK',     tone: 'green' },
  { name: 'Timestamps válidos',   ok: true,  val: 'OK',     tone: 'green' },
  { name: 'Valores faltantes',    ok: false, val: '0,18%',  tone: 'warn'  },
  { name: 'Valores fora de faixa',ok: false, val: '0,06%',  tone: 'warn'  },
  { name: 'Consistência trifásica',ok: true, val: 'OK',     tone: 'green' },
]

const PREVIEW_ROWS = Array.from({ length: 20 }, (_, i) => ({
  timestamp: `2024-05-${String(i + 1).padStart(2,'0')} 00:00`,
  Va: +(219.5 + Math.sin(i*0.4)*1.2).toFixed(2),
  Vb: +(220.1 + Math.sin(i*0.4+2)*1.1).toFixed(2),
  Vc: +(219.8 + Math.sin(i*0.4+4)*1.3).toFixed(2),
  Ia: +(610 + Math.sin(i*0.3)*8).toFixed(1),
  FP: +(0.92 + Math.random()*0.04).toFixed(3),
}))

export default function Dados() {
  const toast = useToast()
  const [format, setFormat] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checksRun, setChecksRun] = useState(false)
  const [cleanOpts, setCleanOpts] = useState([true, true, true, false])
  const [mappingTemplate, setMappingTemplate] = useState('Padrão - PQ e Energia')
  const [dropHover, setDropHover] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInputRef = useRef(null)

  function simulateLoad(name = 'arquivo_dados.csv') {
    setFileName(name)
    setLoading(true)
    setLoaded(false)
    setChecksRun(false)
    setTimeout(() => { setLoading(false); setLoaded(true) }, 900)
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (f) simulateLoad(f.name)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDropHover(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) simulateLoad(f.name)
  }

  function handleRunChecks() {
    setChecksRun(false)
    setTimeout(() => setChecksRun(true), 600)
  }

  function handleApplyFilter() {
    setLoaded(false)
    setTimeout(() => setLoaded(true), 400)
  }

  return (
    <div style={{ minHeight: 1080, display: 'grid', gridTemplateColumns: '320px minmax(720px, 1fr) 360px', gap: 14, padding: 14, overflow: 'visible' }}>

      {/* Left sidebar */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <div className="panel" style={{ flex: 1 }}>
          <div className="panel__head">Fontes de Dados
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => toast('Funcionalidade de adicionar fonte disponível na versão completa', 'info')}>+ Adicionar</button>
          </div>
          <div className="panel__body scroll-y" style={{ height: 'calc(100% - 38px)', overflow: 'auto' }}>
            {GROUPS.map(group => (
              <div key={group} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{group}</div>
                {SOURCES_LIST.filter(s => s.group === group).map(s => (
                  <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 12, cursor: 'pointer', borderRadius: 5 }}
                    onClick={() => simulateLoad(s.name + '_export.csv')}>
                    <span style={{ width: 18, color: '#1d4ed8' }}>▣</span>
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span style={{ width: 8, height: 8, borderRadius: 8, background: s.color }} />
                    <span style={{ color: '#64748b', fontSize: 10 }}>{s.status}</span>
                  </div>
                ))}
                {SOURCES_LIST.filter(s => s.group === group).length === 0 && (
                  <div style={{ color: '#94a3b8', fontSize: 11, paddingLeft: 26 }}>Nenhuma fonte configurada</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ height: 250 }}>
          <div className="panel__head">Histórico de Arquivos Importados</div>
          <table className="tbl">
            <thead><tr><th>Arquivo</th><th>Origem</th><th>Data/Hora</th></tr></thead>
            <tbody>
              {IMPORT_HISTORY.map(([name, orig, dt]) => (
                <tr key={name} style={{ cursor: 'pointer' }} onClick={() => simulateLoad(name)}>
                  <td>{name}</td><td>{orig}</td><td>{dt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>

      {/* Main area */}
      <main style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

        {/* Import panel */}
        <div className="panel">
          <div className="panel__head">Importar Dados</div>
          <div className="panel__body">
            <input type="file" ref={fileInputRef} style={{ display: 'none' }}
              accept={format ? FORMAT_EXTENSIONS[format] : '*'}
              onChange={handleFileChange} />
            <div
              style={{ border: `1px dashed ${dropHover ? '#1d4ed8' : '#93c5fd'}`, borderRadius: 8, padding: 18, textAlign: 'center', background: dropHover ? '#eff6ff' : '#f8fbff', transition: 'all .15s', cursor: 'pointer' }}
              onDragOver={e => { e.preventDefault(); setDropHover(true) }}
              onDragLeave={() => setDropHover(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {loading ? (
                <div style={{ color: '#1d4ed8', fontWeight: 700 }}>⏳ Carregando {fileName}…</div>
              ) : loaded ? (
                <div style={{ color: '#16a34a', fontWeight: 700 }}>✓ {fileName} carregado com sucesso</div>
              ) : (
                <>
                  <div style={{ fontWeight: 700, color: '#1e3a8a' }}>Arraste e solte arquivos aqui ou clique para selecionar</div>
                  <div style={{ color: '#64748b', fontSize: 11, margin: '4px 0 10px' }}>
                    {format ? `Formato selecionado: ${format}` : 'CSV, XLSX, MAT, TDMS, COMTRADE ou banco SQL'}
                  </div>
                  <button className="btn btn-primary" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>Selecionar Arquivos</button>
                </>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginTop: 10 }}>
              {FORMATS.map(f => (
                <button key={f}
                  className={`btn ${f === format ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ justifyContent: 'center' }}
                  onClick={() => { setFormat(prev => prev === f ? null : f); fileInputRef.current && (fileInputRef.current.accept = FORMAT_EXTENSIONS[f] ?? '*') }}
                >{f}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Field mapping */}
        <div className="panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="panel__head">Mapeamento de Campos
            <div className="panel__head-actions">
              <select className="form-select" value={mappingTemplate} onChange={e => setMappingTemplate(e.target.value)} style={{ width: 220 }}>
                {['Padrão - PQ e Energia', 'IEC 61850', 'COMTRADE', 'Personalizado'].map(o => <option key={o}>{o}</option>)}
              </select>
              <button className="btn btn-ghost btn-sm" onClick={() => toast('Mapeamento carregado', 'success')}>Carregar</button>
              <button className="btn btn-ghost btn-sm" onClick={() => toast('Mapeamento salvo', 'success')}>Salvar</button>
            </div>
          </div>
          <div className="panel__body--np scroll-y" style={{ maxHeight: 305, overflow: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Campo Padrão</th><th>Coluna Arquivo</th><th>Unidade</th><th>Tipo</th><th>Status</th></tr></thead>
              <tbody>
                {FIELDS.map(([field, col, type, status]) => (
                  <tr key={field}>
                    <td style={{ fontWeight: 700 }}>{field}</td>
                    <td><select className="form-select" style={{ height: 24 }}><option>{col}</option></select></td>
                    <td>{field[0] === 'V' ? 'kV' : field[0] === 'I' ? 'A' : field === 'Frequência' ? 'Hz' : '-'}</td>
                    <td>{type}</td>
                    <td><span className={status === 'Obrigatório' ? 'badge badge-blue' : 'badge badge-green'}>{status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Data preview */}
        {loaded && (
          <div className="panel" style={{ flex: 1.1, minHeight: 0 }}>
            <div className="panel__head">Pré-visualização dos Dados
              <span className="panel__head-actions"><button className="btn btn-ghost btn-sm" onClick={handleApplyFilter}>Aplicar Filtros</button></span>
            </div>
            <div className="scroll-y" style={{ height: 'calc(100% - 38px)', overflow: 'auto' }}>
              <table className="tbl">
                <thead><tr><th>#</th><th>Timestamp</th><th>Va</th><th>Vb</th><th>Vc</th><th>Ia</th><th>Ib</th><th>Ic</th><th>Freq</th><th>P</th></tr></thead>
                <tbody>
                  {PREVIEW_BASE.map(r => (
                    <tr key={r.n}><td>{r.n}</td><td>{r.ts}</td><td>{r.va}</td><td>{r.vb}</td><td>{r.vc}</td><td>{r.ia}</td><td>{r.ib}</td><td>{r.ic}</td><td>{r.f}</td><td>{r.p}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mini charts */}
        {loaded && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, height: 170 }}>
            <MiniChart title="Tensões (kV)" keys={['va', 'vb', 'vc']} colors={['#1d4ed8', '#16a34a', '#dc2626']} />
            <MiniChart title="Correntes (A)" keys={['ia', 'ib', 'ic']} colors={['#9333ea', '#0284c7', '#ea580c']} />
            <MiniChart title="Frequência (Hz)" keys={['f']} colors={['#059669']} />
          </div>
        )}

        {!loaded && !loading && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 14 }}>
            Selecione um arquivo ou fonte de dados para visualizar os dados
          </div>
        )}
      </main>

      {/* Right sidebar */}
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <InfoPanel title="Metadados do Arquivo" rows={[
          ['Arquivo', loaded ? fileName : '—'],
          ['Origem', 'Local'],
          ['Tamanho', loaded ? '128,4 MB' : '—'],
          ['Registros', loaded ? '864.000' : '—'],
          ['Período', loaded ? '31/05/2024 00:00 até 23:59' : '—'],
          ['Codificação', 'UTF-8'],
        ]} />

        <div className="panel">
          <div className="panel__head">Verificações de Qualidade
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={handleRunChecks} disabled={!loaded}>Executar</button>
          </div>
          <div className="panel__body">
            {loaded && checksRun ? (
              <>
                {QUALITY_CHECKS.map(({ name, ok, val, tone }) => (
                  <div key={name} style={{ display: 'flex', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: tone === 'green' ? '#16a34a' : '#d97706', fontWeight: 800, width: 20 }}>{tone === 'green' ? 'OK' : '!'}</span>
                    <span style={{ flex: 1 }}>{name}</span><b>{val}</b>
                  </div>
                ))}
                <div style={{ height: 8, borderRadius: 8, background: '#e2e8f0', marginTop: 8 }}>
                  <div style={{ width: '98%', height: '100%', borderRadius: 8, background: '#16a34a' }} />
                </div>
                <div style={{ textAlign: 'right', color: '#16a34a', fontWeight: 800, marginTop: 4 }}>98,2% qualidade</div>
              </>
            ) : loaded ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: 12 }}>Clique em <b>Executar</b> para verificar a qualidade dos dados.</div>
            ) : (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: 12 }}>Carregue um arquivo primeiro.</div>
            )}
          </div>
        </div>

        <InfoPanel title="Frequência de Amostragem" rows={[
          ['Detectada', loaded ? '49,98 Hz' : '—'],
          ['Nominal', '50 Hz'], ['Tolerância', '1,0%'], ['Método', 'Auto'],
        ]} />

        <InfoPanel title="Filtros" rows={[
          ['Passa-baixa', 'Ativo – 2.500 Hz'], ['Passa-alta', '0,50 Hz'],
          ['Notch 60 Hz', 'Ativo'], ['Tipo', 'IIR Butterworth'],
        ]} />

        <div className="panel" style={{ flex: 1 }}>
          <div className="panel__head">Limpeza de Dados</div>
          <div className="panel__body checklist">
            {['Remover duplicatas', 'Preencher dados faltantes', 'Remover outliers Hampel', 'Limitar faixa permitida'].map((item, i) => (
              <label key={item}>
                <input type="checkbox" checked={cleanOpts[i]} onChange={e => setCleanOpts(opts => opts.map((v, j) => j === i ? e.target.checked : v))} />{item}
              </label>
            ))}
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }}
              disabled={!loaded}
              onClick={() => { exportCSV(PREVIEW_ROWS, 'dados_limpos.csv'); toast('Limpeza aplicada — arquivo CSV exportado', 'success') }}>
              Aplicar Limpeza
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

function MiniChart({ title, keys, colors }) {
  return (
    <div className="panel">
      <div className="panel__head">{title}</div>
      <div style={{ height: 125, padding: 8 }}>
        <ResponsiveContainer>
          <LineChart data={WAVE}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="t" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} width={38} />
            <Tooltip />
            {keys.map((key, i) => <Line key={key} dataKey={key} stroke={colors[i]} dot={false} strokeWidth={1.8} />)}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function InfoPanel({ title, rows }) {
  return (
    <div className="panel">
      <div className="panel__head">{title}</div>
      <div className="panel__body">
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', gap: 10, marginBottom: 7, fontSize: 12 }}>
            <span style={{ color: '#64748b', width: 92 }}>{k}</span>
            <b style={{ flex: 1 }}>{v}</b>
          </div>
        ))}
      </div>
    </div>
  )
}
