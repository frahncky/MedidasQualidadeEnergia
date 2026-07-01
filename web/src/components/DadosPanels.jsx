import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export function DadosMiniChart({ title, data, keys, colors }) {
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

export function DadosInfoPanel({ title, rows }) {
  return (
    <div className="panel">
      <div className="panel__head">{title}</div>
      <div className="panel__body">
        {rows.map(([key, value]) => (
          <div key={key} style={{ display: 'flex', gap: 10, marginBottom: 7, fontSize: 12 }}>
            <span style={{ color: '#64748b', width: 92 }}>{key}</span>
            <b style={{ flex: 1 }}>{value}</b>
          </div>
        ))}
      </div>
    </div>
  )
}