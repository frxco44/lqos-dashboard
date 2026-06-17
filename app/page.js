"use client"
import { useState, useEffect, useCallback } from "react"
import { supabase, fmtBps, RANGES } from "../lib/supabase"
import TrafficChart from "../components/TrafficChart"

const IFACES = ["enp1s0f0", "enp1s0f1", "eno1"]

export default function HomePage() {
  const [range, setRange]   = useState("1h")
  const [data,  setData]    = useState({})
  const [latest, setLatest] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const since = new Date(Date.now() - RANGES[range] * 60000).toISOString()
    const { data: rows } = await supabase
      .from("traffic_global")
      .select("ts,interface,rx_bps,tx_bps")
      .gte("ts", since)
      .order("ts", { ascending: true })

    const byIface = {}
    const latestByIface = {}
    for (const row of rows || []) {
      if (!byIface[row.interface]) byIface[row.interface] = []
      byIface[row.interface].push(row)
      latestByIface[row.interface] = row
    }
    setData(byIface)
    setLatest(latestByIface)
    setLoading(false)
  }, [range])

  useEffect(() => {
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [load])

  const totalRx = Object.values(latest).reduce((s, r) => s + (r?.rx_bps || 0), 0)
  const totalTx = Object.values(latest).reduce((s, r) => s + (r?.tx_bps || 0), 0)

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Tráfico Global de Red</h1>
        <div className="flex gap-2">
          {Object.keys(RANGES).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1 rounded text-sm ${range === r ? "bg-blue-600" : "bg-gray-800 hover:bg-gray-700"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen actual */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-gray-400 text-xs mb-1">Bajada total actual</div>
          <div className="text-2xl font-bold text-blue-400">{fmtBps(totalRx)}</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="text-gray-400 text-xs mb-1">Subida total actual</div>
          <div className="text-2xl font-bold text-green-400">{fmtBps(totalTx)}</div>
        </div>
      </div>

      {/* Gráficas por interfaz */}
      {loading ? (
        <div className="text-gray-500 text-center py-16">Cargando datos...</div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {IFACES.map(iface => (
            <div key={iface} className="bg-gray-900 rounded-lg p-5 border border-gray-800">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-medium text-white">{iface}</h2>
                <span className="text-xs text-gray-500">
                  RX {fmtBps(latest[iface]?.rx_bps)} · TX {fmtBps(latest[iface]?.tx_bps)}
                </span>
              </div>
              <TrafficChart data={data[iface] || []} />
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-600 mt-6 text-center">
        Actualización automática cada 30s · Datos guardados en Supabase
      </p>
    </div>
  )
}
