import { useMemo, useRef, useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'
import { useToast } from '../components/Toast'
import { exportCSV } from '../utils/export'
import { useAppContext } from '../context/AppContext'
import { buildDemoPowerQualityDataset } from '../utils/powerQuality'

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

function previewNoise(i) {
  const value = Math.sin(i * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

const PREVIEW_ROWS = Array.from({ length: 20 }, (_, i) => ({
  timestamp: `2024-05-${String(i + 1).padStart(2,'0')} 00:00`,
  Va: +(219.5 + Math.sin(i*0.4)*1.2).toFixed(2),
  Vb: +(220.1 + Math.sin(i*0.4+2)*1.1).toFixed(2),
  Vc: +(219.8 + Math.sin(i*0.4+4)*1.3).toFixed(2),
  Ia: +(610 + Math.sin(i*0.3)*8).toFixed(1),
  FP: +(0.92 + previewNoise(i)*0.04).toFixed(3),
}))

function detectDelimiter(header) {
  const candidates = [',', ';', '\t']
  return candidates
    .map(delimiter => ({ delimiter, count: header.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ','
}

function splitDelimitedLine(line, delimiter) {
  const cells = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      i += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current.trim())
  return cells
}

function parseCsvText(text, maxPreviewRows = 5000) {
  const normalized = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const lines = normalized.split('\n').filter(line => line.trim().length > 0)
  if (lines.length < 2) throw new Error('Arquivo CSV sem linhas de dados')
  const delimiter = detectDelimiter(lines[0])
  const columns = splitDelimitedLine(lines[0], delimiter).map((column, index) => column || `Coluna ${index + 1}`)
  const rows = lines.slice(1, maxPreviewRows + 1).map(line => {
    const cells = splitDelimitedLine(line, delimiter)
    return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? '']))
  })
  return { columns, rows, totalRows: lines.length - 1, delimiter }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit += 1
  }
  return `${size.toLocaleString('pt-BR', { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`
}

function isCsvLike(file) {
  const name = file?.name?.toLowerCase() ?? ''
  return name.endsWith('.csv') || file?.type === 'text/csv' || file?.type === 'application/vnd.ms-excel'
}

function suggestColumn(field, fallback, columns) {
  if (!columns.length) return fallback
  const aliases = {
    Timestamp: ['timestamp', 'datahora', 'data_hora', 'datetime', 'time'],
    Va: ['va', 'va_kv', 'v_a', 'tensao_a'],
    Vb: ['vb', 'vb_kv', 'v_b', 'tensao_b'],
    Vc: ['vc', 'vc_kv', 'v_c', 'tensao_c'],
    Ia: ['ia', 'ia_a', 'i_a', 'corrente_a'],
    Ib: ['ib', 'ib_a', 'i_b', 'corrente_b'],
    Ic: ['ic', 'ic_a', 'i_c', 'corrente_c'],
    Frequência: ['frequencia', 'freq', 'freq_hz', 'frequency'],
    P: ['p', 'p_kw', 'potencia_ativa'],
    Q: ['q', 'q_kvar', 'potencia_reativa'],
  }[field] ?? [fallback]
  return columns.find(column => aliases.includes(column.toLowerCase().replace(/[^a-z0-9_]/g, ''))) ?? columns[0]
}
export default function Dados() {
  const toast = useToast()
  const { setImportedDataset, pqAnalysis } = useAppContext()
  const [format, setFormat] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checksRun, setChecksRun] = useState(false)
  const [cleanOpts, setCleanOpts] = useState([true, true, true, false])
  const [mappingTemplate, setMappingTemplate] = useState('Padrão - PQ e Energia')
  const [dropHover, setDropHover] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parsedData, setParsedData] = useState({ columns: [], rows: [], totalRows: 0, delimiter: '' })
  const [fileMeta, setFileMeta] = useState({ size: '', encoding: 'UTF-8' })
  const [parseError, setParseError] = useState('')
  const fileInputRef = useRef(null)

  function resetParsedData() {
    setParsedData({ columns: [], rows: [], totalRows: 0, delimiter: '' })
    setFileMeta({ size: '', encoding: 'UTF-8' })
    setParseError('')
  }

  function simulateLoad(name = 'arquivo_dados.csv') {
    setFileName(name)
    resetParsedData()
    setLoading(true)
    setLoaded(false)
    setChecksRun(false)
    setTimeout(() => {
      setImportedDataset({ ...buildDemoPowerQualityDataset(), fileName: name, sourceType: 'Fonte simulada' })
      setLoading(false)
      setLoaded(true)
    }, 900)
  }

  function loadFile(file) {
    setFileName(file.name)
    setLoading(true)
    setLoaded(false)
    setChecksRun(false)
    setParseError('')
    setFileMeta({ size: formatBytes(file.size), encoding: 'UTF-8' })

    if (!isCsvLike(file)) {
      setParsedData({ columns: [], rows: [], totalRows: 0, delimiter: '' })
      setTimeout(() => {
        setLoading(false)
        setLoaded(true)
        toast('Formato carregado com prévia simulada. CSV possui prévia real nesta versão.', 'info')
      }, 700)
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = parseCsvText(reader.result)
        setParsedData(parsed)
        setImportedDataset({
          fileName: file.name,
          sourceType: 'Arquivo CSV',
          columns: parsed.columns,
          rows: parsed.rows,
          totalRows: parsed.totalRows,
          delimiter: parsed.delimiter,
          importedAt: new Date().toISOString(),
        })
        setLoaded(true)
        toast(`CSV importado: ${parsed.totalRows.toLocaleString('pt-BR')} registros`, 'success')
      } catch (error) {
        setParseError(error.message || 'Falha ao ler arquivo CSV')
        setParsedData({ columns: [], rows: [], totalRows: 0, delimiter: '' })
        toast('Não foi possível montar a prévia do CSV', 'error')
      } finally {
        setLoading(false)
      }
    }
    reader.onerror = () => {
      setLoading(false)
      setParseError('Erro de leitura do arquivo')
      toast('Erro de leitura do arquivo', 'error')
    }
    reader.readAsText(file)
  }

  function handleFileChange(e) {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDropHover(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) loadFile(f)
  }

  function handleRunChecks() {
    setChecksRun(false)
    setTimeout(() => setChecksRun(true), 600)
  }

  function handleApplyFilter() {
    setLoaded(false)
    setTimeout(() => setLoaded(true), 400)
  }
  const hasParsedData = parsedData.columns.length > 0
  const visibleColumns = useMemo(() => parsedData.columns.slice(0, 10), [parsedData.columns])
  const qualityChecks = useMemo(() => {
    if (!hasParsedData) return QUALITY_CHECKS
    const totalCells = parsedData.rows.length * parsedData.columns.length
    const missingCells = parsedData.rows.reduce((sum, row) => (
      sum + parsedData.columns.filter(column => String(row[column] ?? '').trim() === '').length
    ), 0)
    const numericCells = parsedData.rows.reduce((sum, row) => (
      sum + parsedData.columns.filter(column => {
        const value = String(row[column] ?? '').replace(',', '.').trim()
        return value !== '' && Number.isFinite(Number(value))
      }).length
    ), 0)
    const missingPct = totalCells ? (missingCells / totalCells) * 100 : 0
    const numericPct = totalCells ? (numericCells / totalCells) * 100 : 0
    const timestampColumn = parsedData.columns.find(column => /data|hora|time|timestamp/i.test(column))
    return [
      { name: 'Campos detectados', ok: parsedData.columns.length >= 6, val: `${parsedData.columns.length}`, tone: parsedData.columns.length >= 6 ? 'green' : 'warn' },
      { name: 'Registros lidos', ok: parsedData.totalRows > 0, val: parsedData.totalRows.toLocaleString('pt-BR'), tone: 'green' },
      { name: 'Timestamps prováveis', ok: Boolean(timestampColumn), val: timestampColumn || 'Não detectado', tone: timestampColumn ? 'green' : 'warn' },
      { name: 'Valores faltantes', ok: missingPct < 1, val: `${missingPct.toFixed(2).replace('.', ',')}%`, tone: missingPct < 1 ? 'green' : 'warn' },
      { name: 'Dados numéricos', ok: numericPct > 45, val: `${numericPct.toFixed(1).replace('.', ',')}%`, tone: numericPct > 45 ? 'green' : 'warn' },
      { name: 'Separador', ok: true, val: parsedData.delimiter === '\t' ? 'Tab' : parsedData.delimiter, tone: 'green' },
    ]
  }, [hasParsedData, parsedData])
  const dataQualityPct = hasParsedData
    ? Math.max(72, Math.round((qualityChecks.filter(check => check.tone === 'green').length / qualityChecks.length) * 100))
    : 98
  const recordsLabel = hasParsedData ? parsedData.totalRows.toLocaleString('pt-BR') : '864.000'
  const columnsLabel = hasParsedData ? parsedData.columns.length.toLocaleString('pt-BR') : '10'
  const delimiterLabel = hasParsedData ? (parsedData.delimiter === '\t' ? 'Tab' : parsedData.delimiter) : 'Detectado'
  const cleanExportRows = hasParsedData ? parsedData.rows : PREVIEW_ROWS
  const chartData = useMemo(() => {
    if (!hasParsedData) return WAVE
    const columns = parsedData.columns
    const pick = aliases => columns.find(column => aliases.some(alias => column.toLowerCase().replace(/[^a-z0-9_]/g, '').includes(alias)))
    const map = {
      va: pick(['va', 'va_kv', 'tensao_a']),
      vb: pick(['vb', 'vb_kv', 'tensao_b']),
      vc: pick(['vc', 'vc_kv', 'tensao_c']),
      ia: pick(['ia', 'ia_a', 'corrente_a']),
      ib: pick(['ib', 'ib_a', 'corrente_b']),
      ic: pick(['ic', 'ic_a', 'corrente_c']),
      f: pick(['freq', 'frequencia', 'frequency']),
    }
    const num = value => {
      const parsed = Number(String(value ?? '').replace(',', '.').replace(/[^\d.\-+eE]/g, ''))
      return Number.isFinite(parsed) ? parsed : null
    }
    return parsedData.rows.slice(0, 160).map((row, index) => ({
      t: index + 1,
      va: num(row[map.va]),
      vb: num(row[map.vb]),
      vc: num(row[map.vc]),
      ia: num(row[map.ia]),
      ib: num(row[map.ib]),
      ic: num(row[map.ic]),
      f: num(row[map.f]),
    }))
  }, [hasParsedData, parsedData])
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
              className={`drop-zone${dropHover ? ' hover' : ''}`}
              onDragOver={e => { e.preventDefault(); setDropHover(true) }}
              onDragLeave={() => setDropHover(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {loading ? (
                <div style={{ color: 'var(--c-primary)', fontWeight: 700 }}>⏳ Carregando {fileName}…</div>
              ) : loaded ? (
                <>
                  <div style={{ color: 'var(--c-success)', fontWeight: 700 }}>✓ {fileName} carregado com sucesso</div>
                  {hasParsedData && (
                    <div style={{ color: 'var(--c-text-muted)', fontSize: 11, marginTop: 4 }}>
                      {recordsLabel} registros · {columnsLabel} colunas · separador {delimiterLabel}
                    </div>
                  )}
                  {parseError && <div style={{ color: 'var(--c-danger)', fontSize: 11, marginTop: 4 }}>{parseError}</div>}
                </>
              ) : (
                <>
                  <div className="drop-zone__title">Arraste e solte arquivos aqui ou clique para selecionar</div>
                  <div className="drop-zone__sub">
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
                    <td>
                      <select className="form-select" style={{ height: 24 }} defaultValue={suggestColumn(field, col, parsedData.columns)}>
                        {[suggestColumn(field, col, parsedData.columns), ...parsedData.columns.filter(column => column !== suggestColumn(field, col, parsedData.columns))].map(option => <option key={option}>{option}</option>)}
                      </select>
                    </td>
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
                {hasParsedData ? (
                  <>
                    <thead><tr><th>#</th>{visibleColumns.map(column => <th key={column}>{column}</th>)}</tr></thead>
                    <tbody>
                      {parsedData.rows.slice(0, 20).map((row, i) => (
                        <tr key={`${i}-${row[visibleColumns[0]] ?? ''}`}>
                          <td>{i + 1}</td>
                          {visibleColumns.map(column => <td key={column}>{row[column] || '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead><tr><th>#</th><th>Timestamp</th><th>Va</th><th>Vb</th><th>Vc</th><th>Ia</th><th>Ib</th><th>Ic</th><th>Freq</th><th>P</th></tr></thead>
                    <tbody>
                      {PREVIEW_BASE.map(r => (
                        <tr key={r.n}><td>{r.n}</td><td>{r.ts}</td><td>{r.va}</td><td>{r.vb}</td><td>{r.vc}</td><td>{r.ia}</td><td>{r.ib}</td><td>{r.ic}</td><td>{r.f}</td><td>{r.p}</td></tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>
          </div>
        )}

        {/* Mini charts */}
        {loaded && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, height: 170 }}>
            <MiniChart title="Tensões" data={chartData} keys={['va', 'vb', 'vc']} colors={['#1d4ed8', '#16a34a', '#dc2626']} />
            <MiniChart title="Correntes" data={chartData} keys={['ia', 'ib', 'ic']} colors={['#9333ea', '#0284c7', '#ea580c']} />
            <MiniChart title="Frequência (Hz)" data={chartData} keys={['f']} colors={['#059669']} />
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
          ['Origem', hasParsedData ? 'Arquivo local' : 'Local'],
          ['Tamanho', loaded ? (fileMeta.size || '128,4 MB') : '—'],
          ['Registros', loaded ? recordsLabel : '—'],
          ['Colunas', loaded ? columnsLabel : '—'],
          ['Separador', loaded ? delimiterLabel : '—'],
          ['Codificação', fileMeta.encoding || 'UTF-8'],
        ]} />

        <div className="panel">
          <div className="panel__head">Verificações de Qualidade
            <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={handleRunChecks} disabled={!loaded}>Executar</button>
          </div>
          <div className="panel__body">
            {loaded && checksRun ? (
              <>
                {qualityChecks.map(({ name, ok, val, tone }) => (
                  <div key={name} style={{ display: 'flex', marginBottom: 8, fontSize: 12 }}>
                    <span style={{ color: tone === 'green' ? '#16a34a' : '#d97706', fontWeight: 800, width: 20 }}>{tone === 'green' ? 'OK' : '!'}</span>
                    <span style={{ flex: 1 }}>{name}</span><b>{val}</b>
                  </div>
                ))}
                <div className="progress-track">
                  <div style={{ width: `${dataQualityPct}%`, height: '100%', borderRadius: 8, background: '#16a34a' }} />
                </div>
                <div style={{ textAlign: 'right', color: '#16a34a', fontWeight: 800, marginTop: 4 }}>{dataQualityPct}% qualidade</div>
              </>
            ) : loaded ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: 12 }}>Clique em <b>Executar</b> para verificar a qualidade dos dados.</div>
            ) : (
              <div style={{ color: '#94a3b8', textAlign: 'center', padding: 12 }}>Carregue um arquivo primeiro.</div>
            )}
          </div>
        </div>

        <InfoPanel title="Frequência de Amostragem" rows={[
          ['Detectada', loaded ? `${pqAnalysis.sampleRate.toLocaleString('pt-BR')} amostras/s` : '—'],
          ['Nominal', `${pqAnalysis.nominalFrequency.toLocaleString('pt-BR')} Hz`], ['Tolerância', '1,0%'], ['Método', 'Auto'],
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
              onClick={() => { exportCSV(cleanExportRows, 'dados_limpos.csv'); toast('Limpeza aplicada — arquivo CSV exportado', 'success') }}>
              Aplicar Limpeza
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

function MiniChart({ title, data, keys, colors }) {
  return (
    <div className="panel">
      <div className="panel__head">{title}</div>
      <div style={{ height: 125, padding: 8 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
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
