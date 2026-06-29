import { useState, useMemo } from 'react'
import { useAppContext } from '../context/AppContext'

const INSTRUMENT_TYPES = ['Amperímetro', 'Voltímetro', 'Wattímetro', 'TC', 'TP', 'Analisador de Energia', 'Multímetro', 'Outro']
const ACCURACY_CLASSES = ['0,1', '0,25', '0,2', '0,5S', '0,5', '1', '3']
const DIST_OPTIONS = ['Normal', 'Retangular', 'U (arco-seno)', 'Triangular']

const EMPTY_FORM = {
  id: '', name: '', type: 'Amperímetro', serial: '',
  accuracyClass: '0,5', range: '', unit: 'A', resolution: '',
  certNumber: '', certDate: '', certExpiry: '',
}

const alarms = [
  ['TC-005: Carga excede 90% da VA nominal.', 'Alto', '31/05/2024 14:10:22'],
  ['TP-006: aproxima-se da data de calibração.', 'Médio', '31/05/2024 13:55:10'],
  ['Temperatura ambiente acima da faixa recomendada.', 'Médio', '31/05/2024 13:40:05'],
  ['Ensaios de dieletricidade agendados.', 'Info', '31/05/2024 13:30:00'],
]

/* ── Uncertainty helpers ── */

function parseNum(str) {
  if (str === undefined || str === null || str === '') return NaN
  return parseFloat(String(str).replace(',', '.'))
}

function fmtNum(n, d = 6) {
  if (isNaN(n) || n === null) return '0'
  return n.toFixed(d).replace('.', ',')
}

function generateSources(inst) {
  const cls = parseNum(inst.accuracyClass)
  const range = parseNum(inst.range)
  const res = parseNum(inst.resolution)
  if (isNaN(cls) || isNaN(range) || range === 0) return []

  const mpe = (cls / 100) * range
  const u_cal  = mpe / 2
  const u_res  = isNaN(res) ? 0 : res / (2 * Math.sqrt(3))
  const u_lin  = (mpe * 0.25) / Math.sqrt(3)
  const u_temp = (mpe * 0.10) / Math.sqrt(3)

  return [
    { id: 's1', grandeza: inst.name,        fonte: 'Calibração',     tipo: 'B', dist: 'Normal',      ux: fmtNum(u_cal,  6), ci: '1' },
    { id: 's2', grandeza: 'Resolução',       fonte: 'Resolução',      tipo: 'B', dist: 'Retangular',  ux: fmtNum(u_res,  6), ci: '1' },
    { id: 's3', grandeza: 'Repetitividade',  fonte: 'Repetibilidade', tipo: 'A', dist: 'Normal',      ux: '0',               ci: '1' },
    { id: 's4', grandeza: 'Linearidade',     fonte: 'Linearidade',    tipo: 'B', dist: 'Retangular',  ux: fmtNum(u_lin,  6), ci: '1' },
    { id: 's5', grandeza: 'Temperatura',     fonte: 'Temperatura',    tipo: 'B', dist: 'Retangular',  ux: fmtNum(u_temp, 6), ci: '1' },
  ]
}

/* ── Calibration helpers ── */

function parseDate(str) {
  if (!str || !str.includes('/')) return null
  const parts = str.split('/')
  if (parts.length !== 3) return null
  const date = new Date(+parts[2], +parts[1] - 1, +parts[0])
  return isNaN(date.getTime()) ? null : date
}

function certStatus(certExpiry) {
  const exp = parseDate(certExpiry)
  if (!exp) return 'Sem data'
  const daysLeft = (exp - new Date()) / (1000 * 60 * 60 * 24)
  if (daysLeft < 0) return 'Vencido'
  if (daysLeft < 30) return 'A vencer'
  return 'Válido'
}

function StatusBadge({ status }) {
  const cls = status === 'Válido' ? 'badge-green' : status === 'A vencer' ? 'badge-yellow' : status === 'Sem data' ? 'badge-blue' : 'badge-red'
  return <span className={`badge ${cls}`}>{status}</span>
}

/* ── Main component ── */

export default function Metrologia() {
  const { instruments, addInstrument, updateInstrument, removeInstrument } = useAppContext()

  /* instrument registry */
  const [formOpen, setFormOpen]   = useState(false)
  const [formData, setFormData]   = useState(EMPTY_FORM)
  const [editId,   setEditId]     = useState(null)
  const [regError, setRegError]   = useState('')

  /* uncertainty calculator */
  const [selectedInstrId, setSelectedInstrId] = useState('')
  const [kFactor, setKFactor]                 = useState('2')
  const [sources, setSources]                 = useState([])

  const activeClasses  = new Set(instruments.map(i => i.accuracyClass))
  const selectedInstr  = instruments.find(i => i.id === selectedInstrId)

  /* ── registry handlers ── */

  function openAdd() { setFormData(EMPTY_FORM); setEditId(null); setRegError(''); setFormOpen(true) }
  function openEdit(inst) { setFormData({ ...inst }); setEditId(inst.id); setRegError(''); setFormOpen(true) }
  function handleCancel() { setFormOpen(false); setEditId(null); setRegError('') }

  function handleSave() {
    if (!formData.name.trim()) { setRegError('O nome do instrumento é obrigatório.'); return }
    const id = formData.id.trim() || `INST-${Date.now()}`
    if (!editId && instruments.some(i => i.id === id)) {
      setRegError(`ID "${id}" já está em uso.`)
      return
    }
    editId ? updateInstrument(editId, { ...formData, id: editId }) : addInstrument({ ...formData, id })
    setFormOpen(false); setEditId(null); setRegError('')
  }

  function field(key, value) { setFormData(prev => ({ ...prev, [key]: value })) }

  /* ── calculator handlers ── */

  function selectInstrument(id) {
    setSelectedInstrId(id)
    setSources(id ? generateSources(instruments.find(i => i.id === id) ?? {}) : [])
  }

  function restoreSources() {
    if (selectedInstr) setSources(generateSources(selectedInstr))
  }

  function updateSource(id, key, value) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s))
  }

  function addCustomSource() {
    setSources(prev => [...prev, { id: `src-${Date.now()}`, grandeza: '', fonte: '', tipo: 'B', dist: 'Normal', ux: '0', ci: '1' }])
  }

  function removeSource(id) { setSources(prev => prev.filter(s => s.id !== id)) }

  /* ── live uncertainty calculation ── */

  const calc = useMemo(() => {
    const k = parseNum(kFactor) || 2
    const rows = sources.map(s => {
      const ux = parseNum(s.ux)
      const ci = parseNum(s.ci)
      const contrib = (isNaN(ux) || isNaN(ci)) ? 0 : (ci * ux) ** 2
      return { ...s, _ux: ux, _ci: ci, _contrib: contrib }
    })
    const totalVariance = rows.reduce((a, r) => a + r._contrib, 0)
    const uc   = Math.sqrt(totalVariance)
    const U    = k * uc
    const unit = selectedInstr?.unit ?? ''
    const range = parseNum(selectedInstr?.range)
    const pctRange = (!isNaN(range) && range > 0) ? (U / range * 100) : null
    return { rows, totalVariance, uc, U, k, unit, pctRange }
  }, [sources, kFactor, selectedInstr])

  /* ── render ── */

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.85fr 0.85fr', gap: 14, padding: 14 }}>

      {/* ── Instrument registry ── */}
      <div className="panel" style={{ gridColumn: '1 / -1' }}>
        <div className="panel__head" style={{ justifyContent: 'space-between' }}>
          <span>Instrumentos Cadastrados</span>
          {!formOpen && (
            <button className="header__btn header__btn--primary" style={{ fontSize: 12, minHeight: 28 }} onClick={openAdd}>
              + Adicionar instrumento
            </button>
          )}
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th><th>Instrumento</th><th>Tipo</th><th>Série</th>
              <th>Classe</th><th>Faixa / Unidade</th>
              <th>Certificado</th><th>Calibração</th><th>Válido até</th>
              <th>Status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {instruments.length === 0 && (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: 20, color: 'var(--c-text-muted)' }}>
                  Nenhum instrumento cadastrado. Clique em "+ Adicionar instrumento" para começar.
                </td>
              </tr>
            )}
            {instruments.map(inst => {
              const status = certStatus(inst.certExpiry)
              return (
                <tr key={inst.id}>
                  <td style={{ fontWeight: 700 }}>{inst.id}</td>
                  <td>{inst.name}</td>
                  <td>{inst.type}</td>
                  <td style={{ color: 'var(--c-text-muted)' }}>{inst.serial || '—'}</td>
                  <td><span className="badge badge-blue">{inst.accuracyClass}</span></td>
                  <td>{inst.range} {inst.unit}</td>
                  <td style={{ color: 'var(--c-text-muted)' }}>{inst.certNumber || '—'}</td>
                  <td>{inst.certDate || '—'}</td>
                  <td>{inst.certExpiry || '—'}</td>
                  <td><StatusBadge status={status} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-ghost btn-sm" style={{ marginRight: 4 }} onClick={() => openEdit(inst)}>Editar</button>
                    <button className="btn btn-danger btn-sm" onClick={() => { if (window.confirm(`Remover "${inst.name}"?`)) removeInstrument(inst.id) }}>Remover</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {formOpen && (
          <div style={{ borderTop: '1px solid var(--c-border)', padding: '14px 16px', background: 'var(--c-surface-2)' }}>
            <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--c-heading)', marginBottom: 12 }}>
              {editId ? `Editar: ${formData.name}` : 'Novo instrumento'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px 14px' }}>
              <Field label="ID" value={formData.id} onChange={v => field('id', v)} placeholder="ex: CLP-001 (gerado auto se vazio)" disabled={!!editId} />
              <Field label="Nome *" value={formData.name} onChange={v => field('name', v)} placeholder="ex: Alicate Amperimétrico" />
              <SelectField label="Tipo" value={formData.type} onChange={v => field('type', v)} options={INSTRUMENT_TYPES} />
              <Field label="Nº de série" value={formData.serial} onChange={v => field('serial', v)} placeholder="ex: 12345678" />
              <SelectField label="Classe de exatidão" value={formData.accuracyClass} onChange={v => field('accuracyClass', v)} options={ACCURACY_CLASSES} />
              <Field label="Faixa (fundo de escala)" value={formData.range} onChange={v => field('range', v)} placeholder="ex: 200" />
              <Field label="Unidade" value={formData.unit} onChange={v => field('unit', v)} placeholder="A, V, W, kW…" />
              <Field label="Resolução" value={formData.resolution} onChange={v => field('resolution', v)} placeholder="ex: 0,1" />
              <Field label="Nº Certificado" value={formData.certNumber} onChange={v => field('certNumber', v)} placeholder="ex: CAL-2024-0456" />
              <Field label="Data calibração (dd/mm/aaaa)" value={formData.certDate} onChange={v => field('certDate', v)} placeholder="31/05/2024" />
              <Field label="Válido até (dd/mm/aaaa)" value={formData.certExpiry} onChange={v => field('certExpiry', v)} placeholder="31/05/2025" />
            </div>
            {regError && <div style={{ marginTop: 10, color: 'var(--c-danger)', fontSize: 12, fontWeight: 700 }}>{regError}</div>}
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
              <button className="btn btn-ghost" onClick={handleCancel}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Uncertainty Calculator (interactive) ── */}
      <div className="panel">
        <div className="panel__head" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <span>Calculadora de Incerteza da Medição</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {selectedInstrId && (
              <button className="btn btn-ghost btn-sm" onClick={restoreSources} title="Restaurar valores calculados da classe">
                Restaurar
              </button>
            )}
            <select
              className="form-input"
              style={{ height: 28, fontSize: 11 }}
              value={selectedInstrId}
              onChange={e => selectInstrument(e.target.value)}
            >
              <option value="">— selecionar instrumento —</option>
              {instruments.map(i => (
                <option key={i.id} value={i.id}>{i.id} — {i.name}</option>
              ))}
            </select>
          </div>
        </div>

        {sources.length === 0 ? (
          <div className="panel__body" style={{ color: 'var(--c-text-muted)', textAlign: 'center', padding: '24px 16px' }}>
            {selectedInstrId
              ? 'Instrumento sem classe ou faixa definidas. Complete o cadastro para cálculo automático, ou:'
              : 'Selecione um instrumento para calcular as incertezas automaticamente, ou:'}
            <br />
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={addCustomSource}>
              + Adicionar fonte manualmente
            </button>
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table className="tbl" style={{ minWidth: 680 }}>
                <thead>
                  <tr>
                    <th>Grandeza</th><th>Fonte</th><th>Tipo</th><th>Distribuição</th>
                    <th>u(x)</th><th style={{ whiteSpace: 'nowrap' }}>cᵢ</th>
                    <th style={{ whiteSpace: 'nowrap' }}>Contrib. u²</th>
                    <th style={{ whiteSpace: 'nowrap' }}>% Var.</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {calc.rows.map(s => {
                    const pct = calc.totalVariance > 0 ? (s._contrib / calc.totalVariance * 100) : 0
                    const barColor = pct > 50 ? '#ef4444' : pct > 20 ? '#f97316' : '#22c55e'
                    return (
                      <tr key={s.id}>
                        <td>
                          <input className="form-input" style={{ width: '100%', height: 24, fontSize: 11, minWidth: 90 }}
                            value={s.grandeza} onChange={e => updateSource(s.id, 'grandeza', e.target.value)} placeholder="nome" />
                        </td>
                        <td>
                          <input className="form-input" style={{ width: '100%', height: 24, fontSize: 11, minWidth: 80 }}
                            value={s.fonte} onChange={e => updateSource(s.id, 'fonte', e.target.value)} placeholder="origem" />
                        </td>
                        <td>
                          <select className="form-input" style={{ height: 24, fontSize: 11 }}
                            value={s.tipo} onChange={e => updateSource(s.id, 'tipo', e.target.value)}>
                            <option>A</option><option>B</option>
                          </select>
                        </td>
                        <td>
                          <select className="form-input" style={{ height: 24, fontSize: 11, minWidth: 100 }}
                            value={s.dist} onChange={e => updateSource(s.id, 'dist', e.target.value)}>
                            {DIST_OPTIONS.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </td>
                        <td>
                          <input className="form-input" style={{ width: 80, height: 24, fontSize: 11, textAlign: 'right' }}
                            value={s.ux} onChange={e => updateSource(s.id, 'ux', e.target.value)} placeholder="0" />
                        </td>
                        <td>
                          <input className="form-input" style={{ width: 40, height: 24, fontSize: 11, textAlign: 'center' }}
                            value={s.ci} onChange={e => updateSource(s.id, 'ci', e.target.value)} placeholder="1" />
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {fmtNum(s._contrib, 6)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 40, height: 6, background: 'var(--c-border)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                              <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: barColor, transition: 'width .2s' }} />
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--c-text-muted)', minWidth: 34 }}>{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td>
                          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 16, lineHeight: 1, padding: '0 4px' }}
                            onClick={() => removeSource(s.id)} title="Remover">×</button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '6px 10px', borderTop: '1px solid var(--c-border)', background: 'var(--c-surface-2)' }}>
              <button className="btn btn-ghost btn-sm" onClick={addCustomSource}>+ Fonte de incerteza</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.6fr', borderTop: '2px solid var(--c-border)' }}>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontSize: 10, color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>Incerteza Combinada</div>
                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 3 }}>
                  u<sub>c</sub> = {fmtNum(calc.uc, 4)} {calc.unit}
                </div>
                <div style={{ fontSize: 10, color: 'var(--c-text-muted)', marginTop: 2 }}>√Σ(cᵢ · u(xᵢ))²</div>
              </div>
              <div style={{ padding: '10px 12px', borderLeft: '1px solid var(--c-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>Fator de abrangência</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                  <span style={{ fontWeight: 800 }}>k =</span>
                  <input className="form-input" style={{ width: 48, height: 26, fontWeight: 800, textAlign: 'center', fontSize: 13 }}
                    value={kFactor} onChange={e => setKFactor(e.target.value)} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--c-text-muted)', marginTop: 2 }}>k=2 → p ≈ 95%</div>
              </div>
              <div style={{ padding: '10px 12px', borderLeft: '1px solid var(--c-border)', background: 'color-mix(in srgb, var(--c-primary) 6%, var(--c-surface))' }}>
                <div style={{ fontSize: 10, color: 'var(--c-text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.3px' }}>Incerteza Expandida</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--c-primary)', marginTop: 3 }}>
                  U = {fmtNum(calc.U, 4)} {calc.unit}
                </div>
                {calc.pctRange !== null && (
                  <div style={{ fontSize: 10, color: 'var(--c-text-muted)', marginTop: 2 }}>
                    {fmtNum(calc.pctRange, 3)}% da faixa nominal
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Calibration certificates — dynamic ── */}
      <div className="panel">
        <div className="panel__head">Registro de Certificados de Calibração</div>
        <table className="tbl">
          <thead>
            <tr><th>ID</th><th>Instrumento</th><th>Certificado</th><th>Calibração</th><th>Validade</th><th>Status</th></tr>
          </thead>
          <tbody>
            {instruments.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--c-text-muted)', padding: 12 }}>Nenhum instrumento cadastrado.</td></tr>
            )}
            {instruments.map(inst => (
              <tr key={inst.id}>
                <td>{inst.id}</td>
                <td>{inst.name}</td>
                <td>{inst.certNumber || '—'}</td>
                <td>{inst.certDate || '—'}</td>
                <td>{inst.certExpiry || '—'}</td>
                <td><StatusBadge status={certStatus(inst.certExpiry)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Accuracy class — highlights classes in use ── */}
      <div className="panel">
        <div className="panel__head">Classe de Exatidão</div>
        <table className="tbl">
          <tbody>
            {ACCURACY_CLASSES.map(c => {
              const inUse = activeClasses.has(c)
              return (
                <tr key={c} className={inUse ? 'tbl-row-highlight' : undefined} style={inUse ? { fontWeight: 800 } : undefined}>
                  <td>{c}</td>
                  <td>± {c.replace('S', '')}%</td>
                  <td>{inUse && <span className="badge badge-blue">Em uso</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="panel__body" style={{ color: '#1d4ed8', fontWeight: 700 }}>Conforme IEC 61869-1 / IEC 60044</div>
      </div>

      {/* ── Traceability chain ── */}
      <div className="panel">
        <div className="panel__head">Rastreabilidade Metrológica</div>
        <div className="panel__body">
          {['SI', 'LABMETRO / RBC', 'Laboratórios Acreditados', 'Laboratórios Internos', 'Instrumentos de Trabalho'].map((n, i) => (
            <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span className="step-circle">{i + 1}</span>
              <b>{n}</b>
            </div>
          ))}
        </div>
      </div>

      {/* ── Error curves ── */}
      <div className="panel">
        <div className="panel__head">Curvas de Erro — Instrumento</div>
        <svg viewBox="0 0 460 190" style={{ width: '100%', height: 'calc(100% - 38px)' }}>
          <line x1="40" y1="95" x2="430" y2="95" stroke="#cbd5e1" />
          <line x1="40" y1="20" x2="40" y2="170" stroke="#cbd5e1" />
          <polyline points="40,92 90,88 140,94 190,86 240,91 290,83 340,90 390,87 430,92" fill="none" stroke="#1d4ed8" strokeWidth="3" />
          <path d="M40 45 C150 70 280 62 430 62" fill="none" stroke="#ef4444" strokeDasharray="6 5" />
          <path d="M40 145 C150 120 280 128 430 128" fill="none" stroke="#ef4444" strokeDasharray="6 5" />
          <text x="50" y="35" fontSize="11" fill="#64748b">Classe 0,5</text>
          <text x="50" y="185" fontSize="11" fill="#64748b">% do valor de fundo de escala</text>
        </svg>
      </div>

      <DataPanel
        title="Repetibilidade e Reprodutibilidade (Gage R&R)"
        rows={[
          ['Repetibilidade', '27', '0,00362', '18,4%'],
          ['Reprodutibilidade', '2', '0,00674', '34,2%'],
          ['Interação', '54', '0,00221', '11,2%'],
          ['Peça', '9', '0,00781', '39,7%'],
        ]}
      />

      <div className="panel" style={{ gridColumn: '3 / 5' }}>
        <div className="panel__head">Transformadores de Corrente (TC)</div>
        <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gap: 10 }}>
          <FormStack items={['Relação Nominal: 600 / 5 A', 'Classe: 0,5', 'Potência: 15 VA', 'FS: 5', 'Norma: IEC 61869-2']} />
          <CoilDiagram title="Diagrama de Ligação" />
          <PolarityDiagram />
        </div>
      </div>

      <StepPanel
        title="Procedimentos de Medição"
        steps={[
          'Verificar validade do certificado.',
          'Inspecionar instrumento e acessórios.',
          'Confirmar condições ambientais.',
          'Configurar faixa e função.',
          'Realizar medição conforme norma.',
          'Registrar resultados e incertezas.',
        ]}
      />

      <DataPanel
        title="Tabela de Calibração — Referência vs. Medido"
        rows={[
          ['0,00', '0,02', '0,02', '0,27', 'Conforme'],
          ['50,00', '50,05', '0,05', '0,27', 'Conforme'],
          ['100,00', '100,10', '0,10', '0,27', 'Conforme'],
          ['200,00', '200,24', '0,12', '0,27', 'Conforme'],
          ['1000,0', '1002,10', '0,21', '0,27', 'Conforme'],
        ]}
      />

      <div className="panel" style={{ gridColumn: '3 / 5' }}>
        <div className="panel__head">Transformadores de Potencial (TP)</div>
        <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: '220px 1fr 260px', gap: 10 }}>
          <FormStack items={['Relação Nominal: 13,8 kV / 115 V', 'Classe: 0,5', 'Potência: 30 VA', 'Frequência: 60 Hz', 'Grupo Vetorial: Dyn5']} />
          <CoilDiagram title="Diagrama de Ligação" />
          <FormStack items={['Tensão Primária: 13,800 kV', 'Tensão Secundária: 115,0 V', 'N relação: 120,000', 'Erro estimado: 0,18%', 'Saturação: OK']} />
        </div>
      </div>

      <StepPanel
        title="Bloqueio e Etiquetagem (LOTO)"
        steps={['Desligar', 'Isolar', 'Bloquear', 'Etiquetar', 'Verificar ausência de tensão']}
      />

      <DataPanel
        title="Verificação de Aterramento"
        rows={[
          ['Método', 'Queda de Potencial'],
          ['Resistência Medida', '0,32 Ω'],
          ['Limite Recomendado', '≤ 10 Ω'],
          ['Status', 'Conforme'],
        ]}
      />

      <DataPanel
        title="Classes de Segurança (CAT)"
        rows={[
          ['CAT IV', '1000 V', 'Entrada de serviço'],
          ['CAT III', '600 V', 'Distribuição'],
          ['CAT II', '300 V', 'Cargas'],
          ['CAT I', '150 V', 'Eletrônica'],
        ]}
      />

      <RiskMatrix />

      <div className="panel">
        <div className="panel__head">Alarmes e Avisos</div>
        <div className="panel__body">
          {alarms.map(([msg, sev, ts]) => (
            <div key={msg} className={`alarm-item ${sev === 'Alto' ? 'alarm-high' : sev === 'Médio' ? 'alarm-medium' : 'alarm-low'}`}>
              <b>{sev}</b>
              <span style={{ flex: 1 }}>{msg}</span>
              <span style={{ whiteSpace: 'nowrap', opacity: 0.7 }}>{ts}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Sub-components ── */

function Field({ label, value, onChange, placeholder, disabled }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 3 }}>{label}</label>
      <input className="form-input" style={{ width: '100%' }} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} />
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', marginBottom: 3 }}>{label}</label>
      <select className="form-input" style={{ width: '100%' }} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function DataPanel({ title, rows }) {
  return (
    <div className="panel">
      <div className="panel__head">{title}</div>
      <table className="tbl">
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} style={j === 0 ? { fontWeight: 700 } : undefined}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StepPanel({ title, steps }) {
  return (
    <div className="panel">
      <div className="panel__head">{title}</div>
      <div className="panel__body">
        {steps.map((s, i) => (
          <div key={s} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span className="section-num">{i + 1}</span><span>{s}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function FormStack({ items }) {
  return (
    <div>
      {items.map(item => {
        const [k, v] = item.split(': ')
        return (
          <div className="form-row" key={item}>
            <span className="form-label" style={{ minWidth: 115 }}>{k}</span>
            <input className="form-input" value={v} readOnly />
          </div>
        )
      })}
    </div>
  )
}

function CoilDiagram({ title }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <b>{title}</b>
      <svg viewBox="0 0 260 140" style={{ width: '100%', height: 120 }}>
        <line x1="25" y1="40" x2="235" y2="40" stroke="#111827" />
        <path d="M90 40 q20 -40 40 0 q20 40 40 0" fill="none" stroke="#111827" strokeWidth="2" />
        <line x1="25" y1="100" x2="235" y2="100" stroke="#111827" />
        <path d="M90 100 q20 -40 40 0 q20 40 40 0" fill="none" stroke="#111827" strokeWidth="2" />
        <rect x="118" y="72" width="34" height="22" fill="#fff" stroke="#111827" />
        <text x="135" y="88" textAnchor="middle" fontSize="12">Zb</text>
      </svg>
    </div>
  )
}

function PolarityDiagram() {
  return (
    <div style={{ textAlign: 'center' }}>
      <b>Marcação e Polaridade</b>
      <svg viewBox="0 0 220 130" style={{ width: '100%', height: 115 }}>
        <line x1="35" y1="35" x2="190" y2="35" stroke="#111827" />
        <line x1="35" y1="92" x2="190" y2="92" stroke="#111827" />
        <circle cx="35" cy="35" r="6" fill="#ef4444" />
        <circle cx="35" cy="92" r="6" fill="#ef4444" />
        <text x="28" y="24">P1</text><text x="180" y="24">P2</text>
        <text x="28" y="82">S1</text><text x="180" y="82">S2</text>
      </svg>
    </div>
  )
}

function RiskMatrix() {
  const cells = [['Média', 'Alta', 'Crítica'], ['Baixa', 'Média', 'Alta'], ['Baixa', 'Baixa', 'Média']]
  const color = v => v === 'Crítica' ? '#ef4444' : v === 'Alta' ? '#f97316' : v === 'Média' ? '#facc15' : '#22c55e'
  return (
    <div className="panel">
      <div className="panel__head">Matriz de Risco</div>
      <div className="panel__body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4 }}>
        {cells.flat().map((c, i) => (
          <div key={i} style={{ background: color(c), padding: 10, textAlign: 'center', fontWeight: 800 }}>{c}</div>
        ))}
      </div>
    </div>
  )
}
