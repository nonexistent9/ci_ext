import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside className="hidden md:block w-64 bg-gray-200 border-r-4 border-gray-400 h-screen sticky top-0 shadow-lg" style={{
      borderRightStyle: 'outset'
    }}>
      {/* Header */}
      <div className="bg-gray-300 border-b-4 border-gray-400 p-4" style={{
        borderBottomStyle: 'inset'
      }}>
        <div className="text-lg font-bold text-gray-800 font-mono" style={{
          textShadow: '1px 1px 0px #ffffff'
        }}>
          🎯 CI HQ
        </div>
        <div className="text-sm text-gray-600 font-mono">
          Competitive Intel
        </div>
        <div className="text-xs text-gray-500 mt-1">━━━━━━━━━━━━━━━━━━</div>
      </div>

      {/* Navigation */}
      <nav className="p-3 space-y-4 overflow-y-auto h-full">
        <div>
          <div className="px-2 text-xs uppercase tracking-wide text-gray-600 font-mono font-bold mb-2">
            📊 OVERVIEW
          </div>
          <div className="space-y-1">
            <Link 
              className="block px-3 py-2 text-sm font-mono text-gray-700 bg-white border-2 border-gray-400 hover:bg-gray-100 shadow-sm"
              href="/dashboard"
              style={{ borderStyle: 'outset' }}
            >
              📈 Dashboard
            </Link>
          </div>
        </div>

        {/* System Info Panel */}
        <div className="mt-6">
          <div className="bg-black text-green-400 p-3 font-mono text-xs border-2 border-gray-600">
            <div className="mb-1">SYSTEM STATUS:</div>
            <div>ONLINE ●</div>
            <div>CPU: 47%</div>
            <div>MEM: 12.3MB</div>
            <div className="mt-2 text-yellow-400">CI_HQ v1.0</div>
          </div>
        </div>

        {/* Retro Computer Graphics */}
        <div className="mt-6 text-center">
          <div className="text-xs font-mono text-gray-600">
            ╔══════════════════╗<br/>
            ║  💾 DISK SPACE   ║<br/>
            ║  ████████░░ 85%  ║<br/>
            ╚══════════════════╝
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-4 left-3 right-3">
          <div className="bg-blue-100 border-2 border-blue-400 p-2 text-center" style={{
            borderStyle: 'inset'
          }}>
            <div className="text-xs font-mono text-blue-800">
              🚀 NO BULLSH*T<br/>
              CI TOOL
            </div>
          </div>
        </div>
      </nav>
    </aside>
  )
}


