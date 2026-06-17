"use client"
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts"

const COLORS = { TCP: "#3b82f6", UDP: "#10b981", ICMP: "#f59e0b", Otro: "#6b7280" }

export default function ProtocolChart({ tcp, udp, icmp, total }) {
  const otros = Math.max(0, total - tcp - udp - icmp)
  const data = [
    { name: "TCP",  value: tcp },
    { name: "UDP",  value: udp },
    { name: "ICMP", value: icmp },
    { name: "Otro", value: otros },
  ].filter(d => d.value > 0)

  if (!data.length || total === 0)
    return <div className="text-gray-600 text-xs text-center py-6">Sin datos de paquetes</div>

  const pct = (v) => total > 0 ? ((v / total) * 100).toFixed(1) + "%" : "0%"

  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={data} dataKey="value" cx="50%" cy="50%" outerRadius={55} label={({ name, value }) => `${name} ${pct(value)}`} labelLine={false}>
          {data.map(d => <Cell key={d.name} fill={COLORS[d.name] || "#6b7280"} />)}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#111827", border: "1px solid #374151" }}
          formatter={(v, name) => [`${v} pkts (${pct(v)})`, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
