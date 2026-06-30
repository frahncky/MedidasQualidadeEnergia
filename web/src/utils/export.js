export function exportCSV(rows, filename = 'export.csv') {
  if (!rows?.length) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const v = String(r[h] ?? '')
      return v.includes(',') ? `"${v}"` : v
    }).join(',')),
  ]
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, filename)
}

export function exportJSON(data, filename = 'export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, filename)
}

export function exportText(text, filename = 'export.txt') {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' })
  downloadBlob(blob, filename)
}

export function exportHTML(html, filename = 'export.html') {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
  downloadBlob(blob, filename)
}

export function printHTML(html, title = 'Relatório SMQE') {
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  win.document.title = title
  setTimeout(() => {
    win.focus()
    win.print()
  }, 250)
  return true
}

export function exportDOCX(document, filename = 'relatorio_smqe.docx') {
  const xml = buildDocumentXml(document)
  const entries = [
    ['[Content_Types].xml', contentTypesXml()],
    ['_rels/.rels', packageRelsXml()],
    ['word/document.xml', xml],
  ]
  const blob = new Blob([buildZip(entries)], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
  downloadBlob(blob, filename)
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paragraph(text, style = '') {
  const pStyle = style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''
  return `<w:p>${pStyle}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`
}

function table(rows) {
  const trs = rows.map(row => `<w:tr>${row.map(cell => `<w:tc><w:p><w:r><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`).join('')
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>${trs}</w:tbl>`
}

function buildDocumentXml(document) {
  const body = [
    paragraph(document.title ?? 'Relatório SMQE', 'Title'),
    ...(document.paragraphs ?? []).map(text => paragraph(text)),
    ...(document.tables ?? []).map(rows => table(rows)),
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>',
  ].join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${body}</w:document>`
}

function contentTypesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'
}

function packageRelsXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'
}

function crc32(bytes) {
  let crc = -1
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i]
    for (let j = 0; j < 8; j += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ -1) >>> 0
}

function u16(value) {
  return [value & 0xff, (value >>> 8) & 0xff]
}

function u32(value) {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
}

function concat(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  parts.forEach(part => {
    out.set(part, offset)
    offset += part.length
  })
  return out
}

function buildZip(entries) {
  const encoder = new TextEncoder()
  const files = entries.map(([name, text]) => {
    const nameBytes = encoder.encode(name)
    const data = encoder.encode(text)
    return { nameBytes, data, crc: crc32(data) }
  })

  let offset = 0
  const locals = []
  const centrals = []
  files.forEach(file => {
    const local = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(file.crc), ...u32(file.data.length), ...u32(file.data.length),
      ...u16(file.nameBytes.length), ...u16(0),
    ])
    locals.push(local, file.nameBytes, file.data)

    const central = new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(file.crc), ...u32(file.data.length), ...u32(file.data.length),
      ...u16(file.nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ])
    centrals.push(central, file.nameBytes)
    offset += local.length + file.nameBytes.length + file.data.length
  })

  const localData = concat(locals)
  const centralData = concat(centrals)
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length),
    ...u32(centralData.length), ...u32(localData.length), ...u16(0),
  ])
  return concat([localData, centralData, end])
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
