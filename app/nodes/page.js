"use client"
import { useState, useEffect, useCallback } from "react"
import { supabase, fmtBps, fmtMs, retxColor, rttColor, RANGES } from "../../lib/supabase"
import TrafficChart from "../../components/TrafficChart"
import RttHistogram from "../../components/RttHistogram"
import ProtocolChart from "../../components/ProtocolChart"

const PAGE_SIZE = 10

export default function NodesPage() {
  const [range, setRange]       = useState("1h")
  const [nodes, setNodes]       = useState([])
  const [selected, setSelected] = useState(null)
  const [detail, setDetail]     = useState(null)
  const [history, setHistory]   = useState([])
  const [filter, setFilter]     = useState("")
  const [page, setPage]         = useState(0)
  const [loading, setLoading]   = useState(true)

  const loadLatest = useCallback(async () => {
    const since = new Date(Date.now() - 5 * 60000).toISOString()
    const { data } = await supabase
      .from("node_metrics")
      .select("*")
      .gte("ts", since)
      .order("ts", { ascending: false })

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

  const loadDetail = useCallback(async (nodeName) => {
    const since = new Date(Date.now() - RANGES[range] * 60000).toISOString()
    // Historial de tráfico
    const { data: hist } = await supabase
      .from("node_metrics")
      .select("ts,rx_bps,tx_bps,retx_rate_rx,retx_rate_tx,rtt_avg,rtt_p50,rtt_p95,drops_rx,drops_tx")
      .eq("node_name", nodeName)
      .gte("ts", since)
      .order("ts", { ascending: true })
    // Último registro para histograma/protocolos
    const { data: last } = await supabase
      .from("node_metrics")
      .select("*")
      .eq("node_name", nodeName)
      .order("ts", { ascending: false })
      .limit(1)
    setHistory(hist || [])
    setDetail(last?.[0] || null)
  }, [range])

  useEffect(() => {
    loadLatest()
    const t = setInterval(loadLatest, 30000)
    return () => clearInterval(t)
  }, [loadLatest])

  useEffect(() => {
    if (selected) loadDetail(selected)
  }, [selected, loadDetail])

  const filtered = nodes.filter(n =>
    n.node_name.toLowerCase().includes(filter.toLowerCase())
  )

  // Paginación de 10 en 10
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const curPage    = Math.min(page, totalPages - 1)
  const pageRows   = filtered.slice(curPage * PAGE_SIZE, curPage * PAGE_SIZE + PAGE_SIZE)

  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-xl font-semibold mb-6">Nodos de Red</h1>

      {/* Panel de detalle */}
      {selected && detail && (
        <div className="bg-gray-900 border border-blue-800 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-blue-300 text-lg">{selected}</h2>
              <span className="text-xs text-gray-500">
                {detail.node_type} · Padre: {detail.parent_name || "Root"} · Plan: {detail.plan_down_mbps}/{detail.plan_up_mbps} Mbps
              </span>
            </div>
            <div className="flex items-center gap-3">
              {Object.keys(RANGES).map(r => (
                <button key={r} onClick={() => setRange(r)}
                  className={`px-2 py-0.5 rounded text-xs ${range === r ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}>
                  {r}
                </button>
              ))}
              <button onClick={() => { setSelected(null); setDetail(null) }} className="text-gray-500 hover:text-white ml-2">✕</button>
            </div>
          </div>

          {/* Stats actuales */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            <StatCard label="Bajada" value={fmtBps(detail.rx_bps)} color="text-blue-400" />
            <StatCard label="Subida" value={fmtBps(detail.tx_bps)} color="text-green-400" />
            <StatCard label="RTT avg" value={fmtMs(detail.rtt_avg)} color={rttColor(detail.rtt_avg)} />
            <StatCard label="RTT p95" value={fmtMs(detail.rtt_p95)} color={rttColor(detail.rtt_p95)} />
            <StatCard label="Retransmisiones" value={`${detail.retx_rate_rx?.toFixed(2) ?? "0"}%`} color={retxColor(detail.retx_rate_rx)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Tráfico histórico */}
            <div className="md:col-span-2 bg-gray-800 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-2">Tráfico (bps)</div>
              <TrafficChart data={history} />
            </div>
            {/* Histograma RTT */}
            <div className="bg-gray-800 rounded-lg p-4">
              <RttHistogram hist={detail.rtt_hist} title="Distribución de Latencia (RTT)" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
            {/* Protocolos */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Desglose de Protocolos (bajada)</div>
              <ProtocolChart
                tcp={detail.tcp_rx} udp={detail.udp_rx}
                icmp={detail.icmp_rx} total={detail.pkts_rx}
              />
            </div>
            {/* Métricas CAKE */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-3">CAKE Shaper & RTT</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <MetricRow label="Drops ↓" value={detail.drops_rx} warn={detail.drops_rx > 0} />
                <MetricRow label="Drops ↑" value={detail.drops_tx} warn={detail.drops_tx > 0} />
                <MetricRow label="Marks ↓" value={detail.marks_rx} />
                <MetricRow label="Marks ↑" value={detail.marks_tx} />
                <MetricRow label="Retransmit ↓" value={`${detail.retx_rate_rx?.toFixed(2) ?? 0}%`} warn={detail.retx_rate_rx > 1} />
                <MetricRow label="Retransmit ↑" value={`${detail.retx_rate_tx?.toFixed(2) ?? 0}%`} warn={detail.retx_rate_tx > 1} />
                <MetricRow label="RTT min" value={fmtMs(detail.rtt_min)} />
                <MetricRow label="RTT max" value={fmtMs(detail.rtt_max)} />
                <MetricRow label="RTT p50" value={fmtMs(detail.rtt_p50)} />
                <MetricRow label="RTT p95" value={fmtMs(detail.rtt_p95)} />
              </div>

              {/* Historial retransmisiones */}
              {history.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-gray-400 mb-1">Retransmisiones % (bajada, historial)</div>
                  <div className="flex items-end gap-0.5 h-12">
                    {history.slice(-30).map((h, i) => {
                      const v = h.retx_rate_rx || 0
                      const pct = Math.min(100, v * 20)
                      const color = v < 0.5 ? "bg-green-500" : v < 1.5 ? "bg-yellow-500" : "bg-red-500"
                      return <div key={i} className={`flex-1 ${color} rounded-t`} style={{ height: `${pct}%` }} title={`${v.toFixed(2)}%`} />
                    })}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">← últimas {Math.min(30, history.length)} muestras</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filtro */}
      <div className="flex gap-3 mb-4">
        <input type="text" placeholder="Buscar nodo..." value={filter}
          onChange={e => { setFilter(e.target.value); setPage(0) }}
          className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm w-64 focus:outline-none focus:border-blue-500" />
        <span className="text-gray-500 text-sm self-center">{filtered.length} nodos</span>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="text-gray-500 text-center py-16">Cargando nodos...</div>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Nodo</th>
                <th className="text-left px-4 py-3">Tipo</th>
                <th className="text-right px-4 py-3">Plan ↓/↑</th>
                <th className="text-right px-4 py-3">Bajada</th>
                <th className="text-right px-4 py-3">Subida</th>
                <th className="text-right px-4 py-3">RTT avg</th>
                <th className="text-right px-4 py-3">RTT p95</th>
                <th className="text-right px-4 py-3">Retransmit%</th>
                <th className="text-right px-4 py-3">Drops ↓/↑</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(node => (
                <tr key={node.node_name}
                  onClick={() => setSelected(node.node_name)}
                  className={`border-b border-gray-800 cursor-pointer hover:bg-gray-800 transition-colors ${selected === node.node_name ? "bg-gray-800" : ""}`}>
                  <td className="px-4 py-2.5 font-medium text-blue-300">{node.node_name}</td>
                  <td className="px-4 py-2.5 text-gray-400">{node.node_type || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">{node.plan_down_mbps}/{node.plan_up_mbps} Mbps</td>
                  <td className="px-4 py-2.5 text-right text-blue-400">{fmtBps(node.rx_bps)}</td>
                  <td className="px-4 py-2.5 text-right text-green-400">{fmtBps(node.tx_bps)}</td>
                  <td className={`px-4 py-2.5 text-right ${rttColor(node.rtt_avg)}`}>{fmtMs(node.rtt_avg)}</td>
                  <td className={`px-4 py-2.5 text-right ${rttColor(node.rtt_p95)}`}>{fmtMs(node.rtt_p95)}</td>
                  <td className={`px-4 py-2.5 text-right ${retxColor(node.retx_rate_rx)}`}>
                    {node.retx_rate_rx?.toFixed(2) ?? "0"}%
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                    {node.drops_rx}/{node.drops_tx}
                  </td>
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
        Click en un nodo para ver análisis completo · Actualización cada 30s
      </p>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="text-gray-400 text-xs mb-1">{label}</div>
      <div className={`font-bold text-lg ${color}`}>{value}</div>
    </div>
  )
}

function MetricRow({ label, value, warn }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className={`font-mono text-xs ${warn ? "text-red-400" : "text-gray-300"}`}>{value}</span>
    </div>
  )
}
