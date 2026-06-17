"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import { supabase, fmtBps, fmtMs, rttColor, healthScore } from "../../lib/supabase"

const PAGE_SIZE = 10

export default function ClientsPage() {
  const [rows, setRows]       = useState([])
  const [filter, setFilter]   = useState("")
  const [sortKey, setSortKey] = useState("rx")
  const [page, setPage]       = useState(0)
  const [loading, setLoading] = useState(true)
  const [stamp, setStamp]     = useState(null)

  useEffect(() => {
    async function load() {
      // Catálogo completo de clientes
      const { data: clients } = await supabase
        .from("clients")
        .select("circuit_id,circuit_name,device_name,ipv4,parent_node,download_max_mbps,upload_max_mbps")

      // Últimas métricas en vivo por circuito (5 min)
      const since = new Date(Date.now() - 5 * 60000).toISOString()
      const { data: metrics } = await supabase
        .from("circuit_metrics")
        .select("circuit_id,rx_bps,tx_bps,rtt_ms,retx_down,retx_up,tcp_down,plan_down_mbps,plan_up_mbps,ts")
        .gte("ts", since)
        .order("ts", { ascending: false })

      // Última métrica por circuito
      const latest = {}
      for (const m of metrics || []) {
        if (!latest[m.circuit_id]) latest[m.circuit_id] = m
      }

      const merged = (clients || []).map(c => {
        const m = latest[c.circuit_id]
        const retxRate = m && m.tcp_down > 0 ? (m.retx_down / m.tcp_down) * 100 : null
        const usage = m && c.download_max_mbps ? (m.rx_bps / (c.download_max_mbps * 1e6)) * 100 : null
        const health = m ? healthScore({ rtt: m.rtt_ms, retxRate, usage }) : null
        return { ...c, m, retxRate, usage, health, active: !!m }
      })
      setRows(merged)
      setStamp(new Date())
      setLoading(false)
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const filtered = rows
    .filter(c =>
      c.circuit_name?.toLowerCase().includes(filter.toLowerCase()) ||
      (c.ipv4 || "").includes(filter) ||
      (c.device_name || "").toLowerCase().includes(filter.toLowerCase()) ||
      (c.parent_node || "").toLowerCase().includes(filter.toLowerCase())
    )
    .sort((a, b) => {
      if (sortKey === "rx")    return (b.m?.rx_bps || 0) - (a.m?.rx_bps || 0)
      if (sortKey === "tx")    return (b.m?.tx_bps || 0) - (a.m?.tx_bps || 0)
      if (sortKey === "rtt")   return (b.m?.rtt_ms || 0) - (a.m?.rtt_ms || 0)
      if (sortKey === "retx")  return (b.retxRate || 0) - (a.retxRate || 0)
      if (sortKey === "usage") return (b.usage || 0) - (a.usage || 0)
      if (sortKey === "salud") return (b.health?.rank || 0) - (a.health?.rank || 0)
      return a.circuit_name?.localeCompare(b.circuit_name)
    })

  const activos = rows.filter(r => r.active).length

  // Paginación de 10 en 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const curPage    = Math.min(page, totalPages - 1)
  const pageRows   = filtered.slice(curPage * PAGE_SIZE, curPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold">Suscriptores</h1>
        <span className="text-sm text-gray-500">
          <span className="text-green-400">{activos}</span> activos / {rows.length} totales
        </span>
      </div>
      <p className="text-gray-500 text-sm mb-6">Consumo individual real en vivo · click en un cliente para su historial</p>

      <div className="flex gap-3 mb-4 flex-wrap">
        <input type="text" placeholder="Buscar nombre, IP, nodo..."
          value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-72 focus:outline-none focus:border-blue-500" />
        <div className="flex gap-1 text-xs items-center flex-wrap">
          <span className="text-gray-500 mr-1">Ordenar (mayor→menor):</span>
          {[["salud","Salud"],["rx","Bajada"],["tx","Subida"],["rtt","RTT"],["retx","Retransmit"],["usage","% Plan"],["name","Nombre"]].map(([k,l]) => (
            <button key={k} onClick={() => { setSortKey(k); setPage(0) }}
              className={`px-2 py-1 rounded ${sortKey===k ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}>{l}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-16">Cargando suscriptores...</div>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Salud</th>
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">IP</th>
                <th className="text-right px-4 py-3">Bajada</th>
                <th className="text-right px-4 py-3">Subida</th>
                <th className="text-right px-4 py-3">% Plan</th>
                <th className="text-right px-4 py-3">RTT</th>
                <th className="text-right px-4 py-3">Retransmit</th>
                <th className="text-left px-4 py-3">Nodo</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(c => (
                <tr key={c.circuit_id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-2.5">
                    {c.health
                      ? <span className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${c.health.dot}`} />
                          <span className={`text-xs ${c.health.color}`}>{c.health.label}</span>
                        </span>
                      : <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-gray-600" />
                          <span className="text-xs text-gray-600">Inactivo</span>
                        </span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/clients/${c.circuit_id}`} className="font-medium text-blue-300 hover:text-blue-200 hover:underline">
                      {c.circuit_name}
                    </Link>
                    <div className="text-xs text-gray-500">{c.device_name} · plan {c.download_max_mbps}/{c.upload_max_mbps}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {c.ipv4
                      ? <a href={`http://${c.ipv4}`} target="_blank" rel="noopener noreferrer"
                          title="Abrir configuración de la antena"
                          className="text-gray-400 hover:text-blue-300 hover:underline">{c.ipv4} ↗</a>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-blue-400">{c.active ? fmtBps(c.m.rx_bps) : <span className="text-gray-600">—</span>}</td>
                  <td className="px-4 py-2.5 text-right text-green-400">{c.active ? fmtBps(c.m.tx_bps) : <span className="text-gray-600">—</span>}</td>
                  <td className="px-4 py-2.5 text-right">
                    {c.usage != null ? <UsageBadge pct={c.usage} /> : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-right ${rttColor(c.m?.rtt_ms)}`}>{c.active ? fmtMs(c.m.rtt_ms) : "—"}</td>
                  <td className="px-4 py-2.5 text-right text-xs">
                    {c.retxRate != null
                      ? <span className={c.retxRate < 0.5 ? "text-green-400" : c.retxRate < 1.5 ? "text-yellow-400" : "text-red-400"}>{c.retxRate.toFixed(2)}%</span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{c.parent_node}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Controles de paginación */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-500">
            Mostrando {curPage * PAGE_SIZE + 1}–{Math.min(filtered.length, curPage * PAGE_SIZE + PAGE_SIZE)} de {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(0)} disabled={curPage === 0}
              className="px-2 py-1 rounded text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">«</button>
            <button onClick={() => setPage(curPage - 1)} disabled={curPage === 0}
              className="px-3 py-1 rounded text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">‹ Anterior</button>
            <span className="px-3 py-1 text-xs text-gray-400">Página {curPage + 1} / {totalPages}</span>
            <button onClick={() => setPage(curPage + 1)} disabled={curPage >= totalPages - 1}
              className="px-3 py-1 rounded text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">Siguiente ›</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={curPage >= totalPages - 1}
              className="px-2 py-1 rounded text-xs bg-gray-800 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed">»</button>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600 mt-3 text-center">
        {stamp && `Actualizado ${stamp.toLocaleTimeString("es")} · `}auto-refresh 30s
      </p>
    </div>
  )
}

function UsageBadge({ pct }) {
  const color = pct < 70 ? "text-green-400" : pct < 90 ? "text-yellow-400" : "text-red-400"
  const bar   = pct < 70 ? "bg-green-500"   : pct < 90 ? "bg-yellow-500"   : "bg-red-500"
  return (
    <div className="flex items-center gap-2 justify-end">
      <span className={`text-xs ${color}`}>{pct.toFixed(0)}%</span>
      <div className="w-16 bg-gray-700 rounded-full h-1.5">
        <div className={`${bar} h-1.5 rounded-full`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  )
}
