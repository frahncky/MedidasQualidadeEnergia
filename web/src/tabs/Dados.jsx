import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts'

const SOURCES = [
  ['PQA-5000 #12345', 'Online', '#16a34a'],
  ['PQA-5000 #12346', 'Offline', '#94a3b8'],
  ['PMU-120 #01', 'Online', '#16a34a'],
  ['SQL Server - PQDB', 'Online', '#16a34a'],
  ['Azure Blob Storage', 'Standby', '#d97706'],
]

const FIELDS = [
  ['Timestamp', 'DataHora', 'datetime', 'Obrigatorio'],
  ['Va', 'Va_kV', 'double', 'Obrigatorio'],
  ['Vb', 'Vb_kV', 'double', 'Obrigatorio'],
  ['Vc', 'Vc_kV', 'double', 'Obrigatorio'],
  ['Ia', 'Ia_A', 'double', 'Obrigatorio'],
  ['Ib', 'Ib_A', 'double', 'Obrigatorio'],
  ['Ic', 'Ic_A', 'double', 'Obrigatorio'],
  ['Frequencia', 'Freq_Hz', 'double', 'Opcional'],
  ['P', 'P_kW', 'double', 'Opcional'],
  ['Q', 'Q_kVAr', 'double', 'Opcional'],
]

const PREVIEW = Array.from({ length: 12 }, (_, i) => ({
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
  f: +(60 + Math.sin(i / 7) * 0.05).toFixed(2),
}))

export default function Dados() {
  return (
    <div style={{ minHeight: 1080, display: 'grid', gridTemplateColumns: '320px minmax(720px, 1fr) 360px', gap: 14, padding: 14, overflow: 'visible' }}>
      <aside style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <div className="panel" style={{ flex: 1 }}>
          <div className="panel__head">Fontes de Dados <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }}>+ Adicionar</button></div>
          <div className="panel__body scroll-y" style={{ height: 'calc(100% - 38px)', overflow: 'auto' }}>
            {['Aquisicoes Locais', 'Arquivos Locais', 'Servidores / Banco de Dados', 'Nuvem', 'Dispositivos Remotos'].map((group, idx) => (
              <div key={group} style={{ marginBottom: 12 }}>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>{group}</div>
                {SOURCES.slice(0, idx === 1 ? 3 : 2).map(([name, status, color]) => (
                  <div key={`${group}-${name}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 4px', fontSize: 12 }}>
                    <span style={{ width: 18, color: '#1d4ed8' }}>▣</span>
                    <span style={{ flex: 1 }}>{name}</span>
                    <span style={{ width: 8, height: 8, borderRadius: 8, background: color }} />
                    <span style={{ color: '#64748b', fontSize: 10 }}>{status}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="panel" style={{ height: 250 }}>
          <div className="panel__head">Historico de Arquivos Importados</div>
          <table className="tbl">
            <thead><tr><th>Arquivo</th><th>Origem</th><th>Data/Hora</th></tr></thead>
            <tbody>
              {['Medicoes_SP_01.csv', 'PQ_Abril_2024.mat', 'Eventos_TJ.tr0', 'Subestacao_Abr_24.tdms'].map((name, i) => (
                <tr key={name}><td>{name}</td><td>{i === 3 ? 'Servidor' : 'Local'}</td><td>31/05/2024 {14 - i}:20</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>

      <main style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <div className="panel">
          <div className="panel__head">Importar Dados</div>
          <div className="panel__body">
            <div style={{ border: '1px dashed #93c5fd', borderRadius: 8, padding: 18, textAlign: 'center', background: '#f8fbff' }}>
              <div style={{ fontWeight: 700, color: '#1e3a8a' }}>Arraste e solte arquivos aqui</div>
              <div style={{ color: '#64748b', fontSize: 11, margin: '4px 0 10px' }}>CSV, XLSX, MAT, TDMS, COMTRADE ou banco SQL</div>
              <button className="btn btn-primary">Selecionar Arquivos</button>
            </div>
            <div className="grid-6 import-types" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8, marginTop: 10 }}>
              {['CSV', 'XLSX', 'MAT', 'TDMS', 'COMTRADE', 'Banco SQL'].map(type => (
                <button key={type} className="btn btn-ghost" style={{ justifyContent: 'center' }}>{type}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="panel" style={{ flex: 1, minHeight: 0 }}>
          <div className="panel__head">Mapeamento de Campos
            <div className="panel__head-actions">
              <select className="form-select" style={{ width: 220 }}><option>Padrao - PQ e Energia</option></select>
              <button className="btn btn-ghost btn-sm">Carregar</button>
              <button className="btn btn-ghost btn-sm">Salvar</button>
            </div>
          </div>
          <div className="panel__body--np scroll-y" style={{ maxHeight: 305, overflow: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>Campo Padrao</th><th>Coluna Arquivo</th><th>Unidade</th><th>Tipo</th><th>Status</th></tr></thead>
              <tbody>
                {FIELDS.map(([field, col, type, status]) => (
                  <tr key={field}>
                    <td style={{ fontWeight: 700 }}>{field}</td>
                    <td><select className="form-select" style={{ height: 24 }}><option>{col}</option></select></td>
                    <td>{field[0] === 'V' ? 'kV' : field[0] === 'I' ? 'A' : field === 'Frequencia' ? 'Hz' : '-'}</td>
                    <td>{type}</td>
                    <td><span className={status === 'Obrigatorio' ? 'badge badge-blue' : 'badge badge-green'}>{status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel" style={{ flex: 1.1, minHeight: 0 }}>
          <div className="panel__head">Pre-visualizacao dos Dados</div>
          <div className="scroll-y" style={{ height: 'calc(100% - 38px)', overflow: 'auto' }}>
            <table className="tbl">
              <thead><tr><th>#</th><th>Timestamp</th><th>Va</th><th>Vb</th><th>Vc</th><th>Ia</th><th>Ib</th><th>Ic</th><th>Freq</th><th>P</th></tr></thead>
              <tbody>
                {PREVIEW.map(r => (
                  <tr key={r.n}><td>{r.n}</td><td>{r.ts}</td><td>{r.va}</td><td>{r.vb}</td><td>{r.vc}</td><td>{r.ia}</td><td>{r.ib}</td><td>{r.ic}</td><td>{r.f}</td><td>{r.p}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, height: 170 }}>
          <MiniChart title="Tensoes (kV)" keys={['va', 'vb', 'vc']} colors={['#1d4ed8', '#16a34a', '#dc2626']} />
          <MiniChart title="Correntes (A)" keys={['ia', 'ib', 'ic']} colors={['#9333ea', '#0284c7', '#ea580c']} />
          <MiniChart title="Frequencia (Hz)" keys={['f']} colors={['#1d4ed8']} />
        </div>
      </main>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <InfoPanel title="Metadados do Arquivo" rows={[
          ['Arquivo', 'Medicoes_SP_01.csv'], ['Origem', 'Local'], ['Tamanho', '128,4 MB'],
          ['Registros', '864.000'], ['Periodo', '31/05/2024 00:00 ate 23:59'], ['Codificacao', 'UTF-8'],
        ]} />
        <div className="panel">
          <div className="panel__head">Verificacoes de Qualidade</div>
          <div className="panel__body">
            {[
              ['Campos mapeados', '9 / 9', 'green'], ['Dados numericos', 'OK', 'green'], ['Timestamps validos', 'OK', 'green'],
              ['Valores faltantes', '0,18%', 'warn'], ['Valores fora de faixa', '0,06%', 'warn'], ['Consistencia trifasica', 'OK', 'green'],
            ].map(([name, val, tone]) => (
              <div key={name} style={{ display: 'flex', marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: tone === 'green' ? '#16a34a' : '#d97706', fontWeight: 800, width: 20 }}>{tone === 'green' ? 'OK' : '!'}</span>
                <span style={{ flex: 1 }}>{name}</span><b>{val}</b>
              </div>
            ))}
            <div style={{ height: 8, borderRadius: 8, background: '#e2e8f0', marginTop: 8 }}>
              <div style={{ width: '98%', height: '100%', borderRadius: 8, background: '#16a34a' }} />
            </div>
            <div style={{ textAlign: 'right', color: '#16a34a', fontWeight: 800, marginTop: 4 }}>98,2%</div>
          </div>
        </div>
        <InfoPanel title="Frequencia de Amostragem" rows={[['Detectada', '49,98 Hz'], ['Nominal', '50 Hz'], ['Tolerancia', '1,0%'], ['Metodo', 'Auto']]} />
        <InfoPanel title="Filtros" rows={[['Passa-baixa', 'Ativo - 2.500 Hz'], ['Passa-alta', '0,50 Hz'], ['Notch 60 Hz', 'Ativo'], ['Tipo', 'IIR Butterworth']]} />
        <div className="panel" style={{ flex: 1 }}>
          <div className="panel__head">Limpeza de Dados</div>
          <div className="panel__body checklist">
            {['Remover duplicatas', 'Preencher dados faltantes', 'Remover outliers Hampel', 'Limitar faixa permitida'].map((item, i) => (
              <label key={item}><input type="checkbox" defaultChecked={i < 3} />{item}</label>
            ))}
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
