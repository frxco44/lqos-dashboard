"use client"
import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from "recharts"
import { supabase, fmtBps, fmtMs, rttColor, retxColor, RANGES } from "../../../lib/supabase"

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
}

export default function ClientDetail() {
  const { id } = useParams()
  const [range, setRange]     = useState("1h")
  const [client, setClient]   = useState(null)
  const [history, setHistory] = useState([])
  const [latest, setLatest]   = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data: c } = await supabase.from("clients").select("*").eq("circuit_id", id).limit(1)
    setClient(c?.[0] || null)

    const since = new Date(Date.now() - RANGES[range] * 60000).toISOString()
    const { data: hist } = await supabase
      .from("circuit_metrics")
      .select("ts,rx_bps,tx_bps,rtt_ms,retx_down,retx_up,tcp_down")
      .eq("circuit_id", id)
      .gte("ts", since)
      .order("ts", { ascending: true })

    const enriched = (hist || []).map(h => ({
      ...h,
      retx_pct: h.tcp_down > 0 ? (h.retx_down / h.tcp_down) * 100 : 0,
    }))
    setHistory(enriched)
    setLatest(enriched.length ? enriched[enriched.length - 1] : null)
    setLoading(false)
  }, [id, range])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  // Estadísticas del periodo
  const stats = (() => {
    if (!history.length) return null
    const rx = history.map(h => h.rx_bps)
    const rtts = history.map(h => h.rtt_ms).filter(v => v != null && v > 0)
    return {
      maxRx: Math.max(...rx),
      avgRx: rx.reduce((a, b) => a + b, 0) / rx.length,
      avgRtt: rtts.length ? rtts.reduce((a, b) => a + b, 0) / rtts.length : null,
      maxRtt: rtts.length ? Math.max(...rtts) : null,
      maxRetx: Math.max(...history.map(h => h.retx_pct)),
    }
  })()

  const planDownBps = (client?.download_max_mbps || 0) * 1e6

  return (
    <div className="max-w-6xl mx-auto">
      <Link href="/clients" className="text-sm text-gray-400 hover:text-white">← Volver a suscriptores</Link>

      {loading ? (
        <div className="text-gray-500 text-center py-16">Cargando...</div>
      ) : !client ? (
        <div className="text-gray-500 text-center py-16">Cliente no encontrado</div>
      ) : (
        <>
          <div className="flex items-center justify-between mt-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">{client.circuit_name}</h1>
              <div className="text-sm text-gray-500 mt-1">
                {client.device_name} · {client.ipv4
                  ? <a href={`http://${client.ipv4}`} target="_blank" rel="noopener noreferrer"
                      title="Abrir configuración de la antena"
                      className="font-mono text-gray-400 hover:text-blue-300 hover:underline">{client.ipv4} ↗</a>
                  : <span className="font-mono text-gray-600">—</span>} · Nodo: {client.parent_node}
                · Plan: <span className="text-green-400">{client.download_max_mbps}</span>/<span className="text-blue-400">{client.upload_max_mbps}</span> Mbps
              </div>
            </div>
            <div className="flex gap-2">
              {Object.keys(RANGES).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-3 py-1 rounded text-sm ${range === r ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}>{r}</button>
              ))}
            </div>
          </div>

          {/* KPIs actuales */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Kpi label="Bajada ahora" value={fmtBps(latest?.rx_bps)} color="text-blue-400" />
            <Kpi label="Subida ahora" value={fmtBps(latest?.tx_bps)} color="text-green-400" />
            <Kpi label="RTT ahora" value={fmtMs(latest?.rtt_ms)} color={rttColor(latest?.rtt_ms)} />
            <Kpi label="Retransmit ahora" value={latest ? `${latest.retx_pct.toFixed(2)}%` : "—"} color={retxColor(latest?.retx_pct)} />
            <Kpi label="Pico bajada" value={fmtBps(stats?.maxRx)} color="text-blue-300" />
          </div>

          {!history.length ? (
            <div className="bg-gray-900 border border-gray-800 rounded-lg text-gray-500 text-center py-16">
              Sin datos en este rango. El cliente puede estar inactivo o aún sin historial acumulado.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Throughput con línea del plan */}
              <Panel title="Consumo de Ancho de Banda (bajada/subida)">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={history} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="rx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tickFormatter={v => fmtBps(v)} tick={{ fontSize: 11, fill: "#9ca3af" }} width={80} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }}
                      labelFormatter={v => new Date(v).toLocaleString("es")}
                      formatter={(v, n) => [fmtBps(v), n === "rx_bps" ? "Bajada" : "Subida"]} />
                    <Legend formatter={v => v === "rx_bps" ? "Bajada" : "Subida"} />
                    <Area type="monotone" dataKey="rx_bps" stroke="#3b82f6" fill="url(#rx)" strokeWidth={2} />
                    <Line type="monotone" dataKey="tx_bps" stroke="#10b981" dot={false} strokeWidth={1.5} />
                  </AreaChart>
                </ResponsiveContainer>
                {planDownBps > 0 && (
                  <div className="text-xs text-gray-500 mt-1">
                    Plan contratado: {client.download_max_mbps} Mbps · Pico alcanzado: {fmtBps(stats?.maxRx)}
                    {stats?.maxRx >= planDownBps * 0.9 && <span className="text-yellow-400"> · ⚠ saturando el plan</span>}
                  </div>
                )}
              </Panel>

              {/* Latencia (ping) */}
              <Panel title="Historial de Latencia (RTT / Ping)">
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={history} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tickFormatter={v => v + "ms"} tick={{ fontSize: 11, fill: "#9ca3af" }} width={50} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }}
                      labelFormatter={v => new Date(v).toLocaleString("es")}
                      formatter={v => [fmtMs(v), "RTT"]} />
                    <Line type="monotone" dataKey="rtt_ms" stroke="#f59e0b" dot={false} strokeWidth={2} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
                {stats?.avgRtt != null && (
                  <div className="text-xs text-gray-500 mt-1">
                    Promedio: <span className={rttColor(stats.avgRtt)}>{stats.avgRtt.toFixed(1)} ms</span> ·
                    Máximo: <span className={rttColor(stats.maxRtt)}>{stats.maxRtt.toFixed(1)} ms</span>
                    {stats.maxRtt > 80 && <span className="text-red-400"> · ⚠ picos de latencia (posible saturación de sector)</span>}
                  </div>
                )}
              </Panel>

              {/* Retransmisiones */}
              <Panel title="Retransmisiones TCP (% — calidad del enlace inalámbrico)">
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={history} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="retx" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="ts" tickFormatter={fmtTime} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                    <YAxis tickFormatter={v => v.toFixed(1) + "%"} tick={{ fontSize: 11, fill: "#9ca3af" }} width={45} />
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151" }}
                      labelFormatter={v => new Date(v).toLocaleString("es")}
                      formatter={v => [v.toFixed(2) + "%", "Retransmit"]} />
                    <Area type="monotone" dataKey="retx_pct" stroke="#ef4444" fill="url(#retx)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="text-xs text-gray-500 mt-1">
                  Máximo en el periodo: <span className={retxColor(stats?.maxRetx)}>{stats?.maxRetx.toFixed(2)}%</span>
                  {stats?.maxRetx > 1 && <span className="text-red-400"> · ⚠ &gt;1% indica problemas de RF (interferencia / alineación)</span>}
                </div>
              </Panel>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Kpi({ label, value, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className={`font-bold text-lg ${color}`}>{value ?? "—"}</div>
    </div>
  )
}

function Panel({ title, children }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>
      {children}
    </div>
  )
}
