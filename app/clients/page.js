"use client"
import { useState, useEffect } from "react"
import { supabase } from "../../lib/supabase"

export default function ClientsPage() {
  const [clients, setClients]   = useState([])
  const [nodes, setNodes]       = useState({})
  const [filter, setFilter]     = useState("")
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      // Cargar catálogo de clientes
      const { data: clientData } = await supabase
        .from("clients")
        .select("*")
        .order("circuit_name")

      // Últimas métricas por nodo (para mostrar estado del padre)
      const since = new Date(Date.now() - 5 * 60000).toISOString()
      const { data: nodeData } = await supabase
        .from("node_metrics")
        .select("node_name,rx_bps,tx_bps,rtt_avg,rtt_p95,retx_rate_rx,drops_rx,ts")
        .gte("ts", since)
        .order("ts", { ascending: false })

      // Dedup nodos: el más reciente por nombre
      const nodeMap = {}
      for (const n of nodeData || []) {
        if (!nodeMap[n.node_name]) nodeMap[n.node_name] = n
      }
      setClients(clientData || [])
      setNodes(nodeMap)
      setLoading(false)
    }
    load()
    const t = setInterval(load, 60000)
    return () => clearInterval(t)
  }, [])

  const filtered = clients.filter(c =>
    c.circuit_name.toLowerCase().includes(filter.toLowerCase()) ||
    (c.ipv4 || "").includes(filter) ||
    (c.device_name || "").toLowerCase().includes(filter.toLowerCase()) ||
    (c.parent_node || "").toLowerCase().includes(filter.toLowerCase())
  )

  function planUsagePct(client, nodeMetrics) {
    if (!nodeMetrics || !client.download_max_mbps) return null
    return Math.min(100, (nodeMetrics.rx_bps / (client.download_max_mbps * 1e6)) * 100)
  }

  function planBar(pct) {
    if (pct == null) return null
    const color = pct < 70 ? "bg-green-500" : pct < 90 ? "bg-yellow-500" : "bg-red-500"
    return (
      <div className="w-24 bg-gray-700 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold mb-2">Suscriptores / Clientes</h1>
      <p className="text-gray-500 text-sm mb-6">
        {clients.length} circuitos registrados · El tráfico mostrado es del nodo padre compartido
      </p>

      <div className="flex gap-3 mb-4">
        <input type="text"
          placeholder="Buscar por nombre, IP, nodo padre..."
          value={filter} onChange={e => setFilter(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-80 focus:outline-none focus:border-blue-500" />
        <span className="text-gray-500 text-sm self-center">{filtered.length} clientes</span>
      </div>

      {loading ? (
        <div className="text-gray-500 text-center py-16">Cargando clientes...</div>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Cliente</th>
                <th className="text-left px-4 py-3">Dispositivo</th>
                <th className="text-left px-4 py-3">IP</th>
                <th className="text-left px-4 py-3">Nodo Padre</th>
                <th className="text-right px-4 py-3">Plan ↓/↑ Mbps</th>
                <th className="text-right px-4 py-3">Uso plan</th>
                <th className="text-right px-4 py-3">RTT nodo</th>
                <th className="text-right px-4 py-3">Retransmit%</th>
                <th className="text-left px-4 py-3">Comentario</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const nm = nodes[c.parent_node]
                const pct = planUsagePct(c, nm)
                return (
                  <tr key={c.circuit_id} className="border-b border-gray-800 hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-medium text-white">{c.circuit_name}</div>
                      <div className="text-xs text-gray-500">{c.circuit_id}</div>
                    </td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{c.device_name || "—"}</td>
                    <td className="px-4 py-2.5 text-blue-300 font-mono text-xs">{c.ipv4 || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded ${nm ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500"}`}>
                        {c.parent_node || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-300">
                      <span className="text-green-400">{c.download_max_mbps}</span>
                      <span className="text-gray-600"> / </span>
                      <span className="text-blue-400">{c.upload_max_mbps}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {pct != null ? (
                        <div className="flex items-center gap-2 justify-end">
                          <span className="text-xs text-gray-400">{pct.toFixed(0)}%</span>
                          {planBar(pct)}
                        </div>
                      ) : <span className="text-gray-600 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {nm?.rtt_avg != null
                        ? <span className={nm.rtt_avg < 20 ? "text-green-400" : nm.rtt_avg < 60 ? "text-yellow-400" : "text-red-400"}>
                            {nm.rtt_avg.toFixed(1)} ms
                          </span>
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
                      {nm?.retx_rate_rx != null
                        ? <span className={nm.retx_rate_rx < 0.5 ? "text-green-400" : nm.retx_rate_rx < 1.5 ? "text-yellow-400" : "text-red-400"}>
                            {nm.retx_rate_rx.toFixed(2)}%
                          </span>
                        : <span className="text-gray-600">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs truncate">{c.comment || ""}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
