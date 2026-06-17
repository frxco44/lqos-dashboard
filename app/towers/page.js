"use client"
import { useState, useEffect } from "react"
import { supabase, fmtBps, fmtMs, healthScore } from "../../lib/supabase"

export default function TowersPage() {
  const [towers, setTowers]   = useState([])
  const [filter, setFilter]   = useState("")
  const [loading, setLoading] = useState(true)
  const [stamp, setStamp]     = useState(null)

  useEffect(() => {
    async function load() {
      // Catálogo de clientes (para agrupar y conocer su plan)
      const { data: clients } = await supabase
        .from("clients")
        .select("circuit_id,parent_node,download_max_mbps")

      // Últimas métricas en vivo por circuito (5 min)
      const since = new Date(Date.now() - 5 * 60000).toISOString()
      const { data: metrics } = await supabase
        .from("circuit_metrics")
        .select("circuit_id,rx_bps,tx_bps,rtt_ms,retx_down,tcp_down,ts")
        .gte("ts", since)
        .order("ts", { ascending: false })

      const latest = {}
      for (const m of metrics || []) {
        if (!latest[m.circuit_id]) latest[m.circuit_id] = m
      }

      // Agregación por torre (parent_node)
      const g = {}
      for (const c of clients || []) {
        const key = c.parent_node || "(sin nodo)"
        if (!g[key]) g[key] = {
          name: key, total: 0, active: 0,
          rx: 0, tx: 0, retx: 0, tcp: 0,
          rttSum: 0, rttN: 0, rttMax: 0,
          planCap: 0, alerts: 0,
        }
        const t = g[key]
        t.total++
        const m = latest[c.circuit_id]
        if (!m) continue
        t.active++
        t.rx += m.rx_bps || 0
        t.tx += m.tx_bps || 0
        t.retx += m.retx_down || 0
        t.tcp += m.tcp_down || 0
        if (c.download_max_mbps) t.planCap += c.download_max_mbps * 1e6
        if (m.rtt_ms != null) { t.rttSum += m.rtt_ms; t.rttN++; t.rttMax = Math.max(t.rttMax, m.rtt_ms) }
        const retxRate = m.tcp_down > 0 ? (m.retx_down / m.tcp_down) * 100 : null
        const usage = c.download_max_mbps ? (m.rx_bps / (c.download_max_mbps * 1e6)) * 100 : null
        if (healthScore({ rtt: m.rtt_ms, retxRate, usage }).rank >= 3) t.alerts++
      }

      const rows = Object.values(g).map(t => {
        const retxRate = t.tcp > 0 ? (t.retx / t.tcp) * 100 : null
        const rttAvg = t.rttN > 0 ? t.rttSum / t.rttN : null
        const usage = t.planCap > 0 ? (t.rx / t.planCap) * 100 : null
        const health = healthScore({ rtt: rttAvg, retxRate, usage })
        return { ...t, retxRate, rttAvg, usage, health }
      })
      // Peores torres primero; desempate por nº de alertas
      rows.sort((a, b) => (b.health.rank - a.health.rank) || (b.alerts - a.alerts) || (b.rx - a.rx))
      setTowers(rows)
      setStamp(new Date())
      setLoading(false)
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const filtered = towers.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
  const critico  = towers.filter(t => t.health.rank >= 3).length
  const atencion = towers.filter(t => t.health.rank >= 1.5 && t.health.rank < 3).length

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">Salud por Torre</h1>
        <span className="text-sm text-gray-500">
          {towers.length} torres · <span className="text-red-400">{critico} críticas</span> · <span className="text-yellow-400">{atencion} en atención</span>
        </span>
      </div>
      <p className="text-gray-500 text-sm mb-6">
        Clientes agrupados por nodo padre · ordenado por salud (peor primero) · combina RTT, retransmisión y saturación
      </p>

      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Buscar torre/nodo..." value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-blue-500" />
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-16">Cargando torres...</div>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Salud</th>
                <th className="text-left px-4 py-3">Torre / Nodo</th>
                <th className="text-right px-4 py-3">Clientes</th>
                <th className="text-right px-4 py-3">Bajada</th>
                <th className="text-right px-4 py-3">Subida</th>
                <th className="text-right px-4 py-3">% Sat</th>
                <th className="text-right px-4 py-3">RTT prom</th>
                <th className="text-right px-4 py-3">RTT máx</th>
                <th className="text-right px-4 py-3">Retransmit%</th>
                <th className="text-right px-4 py-3">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.name} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${t.health.dot}`} />
                      <span className={`text-xs ${t.health.color}`}>{t.health.label}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-blue-300">{t.name}</td>
                  <td className="px-4 py-2.5 text-right text-gray-300">
                    <span className="text-green-400">{t.active}</span>
                    <span className="text-gray-600"> / {t.total}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-blue-400">{fmtBps(t.rx)}</td>
                  <td className="px-4 py-2.5 text-right text-green-400">{fmtBps(t.tx)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {t.usage != null
                      ? <span className={t.usage < 70 ? "text-green-400" : t.usage < 90 ? "text-yellow-400" : "text-red-400"}>{t.usage.toFixed(0)}%</span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-right ${t.rttAvg == null ? "text-gray-600" : t.rttAvg < 20 ? "text-green-400" : t.rttAvg < 60 ? "text-yellow-400" : "text-red-400"}`}>
                    {t.rttAvg != null ? fmtMs(t.rttAvg) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{t.rttMax ? fmtMs(t.rttMax) : "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    {t.retxRate != null
                      ? <span className={t.retxRate < 0.5 ? "text-green-400" : t.retxRate < 1.5 ? "text-yellow-400" : "text-red-400"}>{t.retxRate.toFixed(2)}%</span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {t.alerts > 0
                      ? <span className="text-red-400 font-semibold">{t.alerts}</span>
                      : <span className="text-gray-600">0</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-600 mt-3 text-center">
        {stamp && `Actualizado ${stamp.toLocaleTimeString("es")} · `}auto-refresh 30s
      </p>
    </div>
  )
}
