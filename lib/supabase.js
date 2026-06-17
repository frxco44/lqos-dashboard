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

export const RANGES = {
  "1h":  60,
  "6h":  360,
  "24h": 1440,
  "7d":  10080,
}
