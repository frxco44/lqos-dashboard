import { createClient } from "@supabase/supabase-js"

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export function fmtBps(bps) {
  if (!bps || bps <= 0) return "0 bps"
  if (bps >= 1e9) return (bps / 1e9).toFixed(2) + " Gbps"
  if (bps >= 1e6) return (bps / 1e6).toFixed(1) + " Mbps"
  if (bps >= 1e3) return (bps / 1e3).toFixed(1) + " Kbps"
  return bps + " bps"
}

export function fmtMs(ms) {
  if (ms == null) return "—"
  return ms.toFixed(1) + " ms"
}

export function retxColor(rate) {
  if (rate == null || rate === 0) return "text-gray-400"
  if (rate < 0.5) return "text-green-400"
  if (rate < 1.5) return "text-yellow-400"
  return "text-red-400"
}

export function rttColor(ms) {
  if (ms == null) return "text-gray-400"
  if (ms < 20) return "text-green-400"
  if (ms < 60) return "text-yellow-400"
  return "text-red-400"
}

export const RANGES = {
  "5m":  5,
  "1h":  60,
  "6h":  360,
  "24h": 1440,
  "7d":  10080,
}

// Score de salud combinado: mezcla retransmisión TCP (calidad de enlace),
// RTT (latencia/bufferbloat) y saturación del plan en un solo semáforo.
// Devuelve rank (mayor = peor, para ordenar) + etiqueta/colores para la UI.
export function healthScore({ rtt, retxRate, usage }) {
  let rank = 0
  if (retxRate != null) {
    if (retxRate >= 3)      rank += 3
    else if (retxRate >= 1) rank += 1.5
  }
  if (rtt != null) {
    if (rtt >= 60)      rank += 3
    else if (rtt >= 20) rank += 1
  }
  if (usage != null && usage >= 90) rank += 1

  if (rank >= 3)        return { rank, label: "Crítico",  color: "text-red-400",    dot: "bg-red-500" }
  if (rank >= 1.5)      return { rank, label: "Atención", color: "text-yellow-400", dot: "bg-yellow-500" }
  return { rank, label: "Bueno", color: "text-green-400", dot: "bg-green-500" }
}
