"use client"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

const BINS = ["0-5", "5-10", "10-20", "20-40", "40-80", "80-160", "160+"]

function binColor(label) {
  if (label.startsWith("0-") || label === "5-10") return "#10b981"
  if (label === "10-20" || label === "20-40") return "#f59e0b"
  return "#ef4444"
}

export default function RttHistogram({ hist, title }) {
  if (!hist || Object.keys(hist).length === 0)
    return <div className="text-gray-600 text-xs text-center py-6">Sin muestras RTT</div>

  const data = BINS.map(bin => ({ bin, count: hist[bin] || 0 })).filter(d => d.count > 0 || true)
  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div>
      {title && <div className="text-xs text-gray-400 mb-2">{title}</div>}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="bin" tick={{ fontSize: 10, fill: "#9ca3af" }} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={30} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #374151" }}
            formatter={(v) => [`${v} muestras (${total ? ((v/total)*100).toFixed(0) : 0}%)`, "Frecuencia"]}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]}>
            {data.map((d) => <Cell key={d.bin} fill={binColor(d.bin)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-3 mt-1 text-xs justify-center">
        <span className="text-green-400">■ Bueno (&lt;10ms)</span>
        <span className="text-yellow-400">■ Aceptable (10-80ms)</span>
        <span className="text-red-400">■ Problema (&gt;80ms)</span>
      </div>
    </div>
  )
}
