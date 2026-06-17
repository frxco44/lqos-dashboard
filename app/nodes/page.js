"use client"
import { useState, useEffect, useCallback } from "react"
import { supabase, fmtBps, RANGES } from "../../lib/supabase"
import TrafficChart from "../../components/TrafficChart"

export default function NodesPage() {
  const [range, setRange]         = useState("1h")
  const [nodes, setNodes]         = useState([])
  const [selected, setSelected]   = useState(null)
  const [history, setHistory]     = useState([])
  const [filter, setFilter]       = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [loading, setLoading]     = useState(true)

  const loadLatest = useCallback(async () => {
    // Obtener el último registro por nodo usando window function equivalente
    const since = new Date(Date.now() - 5 * 60000).toISOString() // últimos 5 min
    const { data } = await supabase
      .from("traffic_nodes")
      .select("node_name,node_type,parent_name,rx_bps,tx_bps,drops_rx,drops_tx,rtt_avg,ts")
      .gte("ts", since)
      .order("ts", { ascending: false })

    // Dedup: quedarse solo con el más reciente por nodo
    const seen = new Set()
    const latest = []
    for (const row of data || []) {
      if (!seen.has(row.node_name)) {
        seen.add(row.node_name)
        latest.push(row)
      }
    }
    latest.sort((a, b) => (b.rx_bps + b.tx_bps) - (a.rx_bps + a.tx_bps))
    setNodes(latest)
    setLoading(false)
  }, [])

  const loadHistory = useCallback(async (nodeName) => {
    const since = new Date(Date.now() - RANGES[range] * 60000).toISOString()
    const { data } = await supabase
      .from("traffic_nodes")
      .select("ts,rx_bps,tx_bps")
      .eq("node_name", nodeName)
      .gte("ts", since)
      .order("ts", { ascending: true })
    setHistory(data || [])
  }, [range])

  useEffect(() => {
    loadLatest()
    const t = setInterval(loadLatest, 30000)
    return () => clearInterval(t)
  }, [loadLatest])

  useEffect(() => {
    if (selected) loadHistory(selected)
  }, [selected, loadHistory])

  const types = ["all", ...new Set(nodes.map(n => n.node_type).filter(Boolean))]
  const filtered = nodes.filter(n => {
    const matchName = n.node_name.toLowerCase().includes(filter.toLowerCase())
    const matchType = typeFilter === "all" || n.node_type === typeFilter
    return matchName && matchType
  })

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Suscriptores / Nodos</h1>

      {/* Historial del nodo seleccionado */}
      {selected && (
        <div className="bg-gray-900 rounded-lg p-5 border border-blue-800 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-blue-300">{selected}</h2>
            <div className="flex items-center gap-3">
              <div className="flex gap-2">
                {Object.keys(RANGES).map(r => (
                  <button key={r} onClick={() => setRange(r)}
                    className={`px-2 py-0.5 rounded text-xs ${range === r ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}>
                    {r}
                  </button>
                ))}
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-sm">✕</button>
            </div>
          </div>
          <TrafficChart data={history} />
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <input
          type="text" placeholder="Buscar nodo..." value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-blue-500"
        />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500">
          {types.map(t => <option key={t} value={t}>{t === "all" ? "Todos los tipos" : t}</option>)}
        </select>
        <span className="text-gray-500 text-sm self-center">{filtered.length} nodos</span>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-gray-500 text-center py-16">Cargando nodos...</div>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Nodo</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-left px-4 py-3">Padre</th>
                <th className="text-right px-4 py-3">Bajada</th>
                <th className="text-right px-4 py-3">Subida</th>
                <th className="text-right px-4 py-3">RTT avg</th>
                <th className="text-right px-4 py-3">Drops ↓/↑</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(node => (
                <tr key={node.node_name}
                  onClick={() => setSelected(node.node_name)}
                  className={`border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors
                    ${selected === node.node_name ? "bg-gray-800" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-blue-300">{node.node_name}</td>
                  <td className="px-4 py-2.5 text-gray-400">{node.node_type || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{node.parent_name || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-blue-400">{fmtBps(node.rx_bps)}</td>
                  <td className="px-4 py-2.5 text-right text-green-400">{fmtBps(node.tx_bps)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">
                    {node.rtt_avg ? node.rtt_avg.toFixed(1) + " ms" : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                    {node.drops_rx}/{node.drops_tx}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-gray-600 text-center py-10">Sin resultados</div>
          )}
        </div>
      )}

      <p className="text-xs text-gray-600 mt-4 text-center">
        Click en un nodo para ver su historial · Actualización automática cada 30s
      </p>
    </div>
  )
}
