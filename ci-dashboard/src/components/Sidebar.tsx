import Link from 'next/link'

export default function Sidebar() {
  return (
    <aside className="hidden md:block w-64 border-r bg-card h-[calc(100vh-var(--header-height))] sticky top-[var(--header-height)]">
      <div className="p-4 border-b">
        <div className="text-lg font-semibold">Your CI HQ</div>
        <div className="text-sm text-muted-foreground">Competitive Intelligence</div>
      </div>
      <nav className="p-3 space-y-6 overflow-y-auto h-full">
        <div>
          <div className="px-2 text-xs uppercase tracking-wide text-muted-foreground">Overview</div>
          <div className="mt-2 grid">
            <Link className="px-2 py-2 rounded hover:bg-accent" href="/dashboard">Dashboard</Link>
          </div>
        </div>
      </nav>
    </aside>
  )
}


