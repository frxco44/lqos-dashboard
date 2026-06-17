"use client"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts"
import { fmtBps } from "../lib/supabase"

const COLORS = { rx: "#3b82f6", tx: "#10b981" }

function fmtTime(ts) {
  const d = new Date(ts)
  return d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
}

export default function TrafficChart({ data, title }) {
  if (!data || data.length === 0)
    return <div className="text-gray-500 text-sm py-8 text-center">Sin datos aún</div>

  return (
    <div>
      {title && <h3 className="text-sm font-medium text-gray-400 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 11, fill: "#9ca3af" }} />
          <YAxis tickFormatter={v => fmtBps(v)} tick={{ fontSize: 11, fill: "#9ca3af" }} width={80} />
          <Tooltip
            contentStyle={{ background: "#111827", border: "1px solid #374151" }}
            labelFormatter={v => new Date(v).toLocaleString("es")}
            formatter={(v, name) => [fmtBps(v), name === "rx_bps" ? "Bajada" : "Subida"]}
          />
          <Legend formatter={v => v === "rx_bps" ? "Bajada (RX)" : "Subida (TX)"} />
          <Line type="monotone" dataKey="rx_bps" stroke={COLORS.rx} dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="tx_bps" stroke={COLORS.tx} dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
