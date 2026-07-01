export function detectDelimiter(header) {
  const candidates = [',', ';', '\t']
  return candidates
    .map(delimiter => ({ delimiter, count: header.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ','
}

export function splitDelimitedLine(line, delimiter) {
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

export function parseCsvText(text, maxPreviewRows = 5000) {
  const normalized = String(text ?? '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  const lines = normalized.split('\n').filter(line => line.trim().length > 0)
  if (lines.length < 2) throw new Error('Arquivo CSV sem linhas de dados')
  const delimiter = detectDelimiter(lines[0])
  const columns = splitDelimitedLine(lines[0], delimiter).map((column, index) => column || `Coluna ${index + 1}`)
  const rows = lines.slice(1).map(line => {
    const cells = splitDelimitedLine(line, delimiter)
    return Object.fromEntries(columns.map((column, index) => [column, cells[index] ?? '']))
  })
  return {
    columns,
    rows,
    previewRows: rows.slice(0, maxPreviewRows),
    totalRows: rows.length,
    delimiter,
  }
}

export function formatBytes(bytes) {
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

export function isCsvLike(file) {
  const name = file?.name?.toLowerCase() ?? ''
  return name.endsWith('.csv') || file?.type === 'text/csv' || file?.type === 'application/vnd.ms-excel'
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Erro de leitura do arquivo'))
    reader.readAsText(file)
  })
}

export function findByExtension(files, extensions) {
  return files.find(file => extensions.some(ext => file.name.toLowerCase().endsWith(ext)))
}

export function suggestColumn(field, fallback, columns) {
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