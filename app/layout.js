import "./globals.css"

export const metadata = { title: "LibreQoS Monitor", description: "Tráfico en tiempo real" }

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center gap-6">
          <span className="font-bold text-blue-400 text-lg">LibreQoS Monitor</span>
          <a href="/"       className="text-sm text-gray-300 hover:text-white">Red Global</a>
          <a href="/nodes"  className="text-sm text-gray-300 hover:text-white">Suscriptores</a>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  )
}
