"use client";
import { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import Sidebar from '../../components/Sidebar';
import { getSupabaseClient } from '../../lib/supabaseClient';

type Analysis = {
  id: string;
  title: string;
  url: string;
  domain: string;
  analysis_type: string;
  created_at: string;
  content?: string;
};

export default function DashboardPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisUrl, setAnalysisUrl] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        setLoading(true);
        const supabase: SupabaseClient = getSupabaseClient();
        const { data: sessionRes } = await supabase.auth.getSession();
        if (!sessionRes.session) {
          setRequiresLogin(true);
          setAnalyses([]);
          return;
        }
        const { data, error } = await supabase
          .from('analyses')
          .select('id,title,url,domain,analysis_type,created_at,is_favorite,content')
          .order('created_at', { ascending: false })
          .limit(50);
        if (error) throw error;
        setAnalyses(data || []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load analyses');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return analyses.filter(a => {
      // @ts-ignore allow partial selection of fields
      const matchesFav = !favoritesOnly || !!a.is_favorite;
      const hay = `${a.title} ${a.domain} ${a.url}`.toLowerCase();
      const matchesQ = !q || hay.includes(q);
      const matchesDomain = !selectedDomain || a.domain === selectedDomain;
      return matchesFav && matchesQ && matchesDomain;
    });
  }, [analyses, favoritesOnly, search, selectedDomain]);

  const domainCounts = useMemo(() => {
    const counts = new Map<string, number>();
    analyses.forEach(a => {
      if (!a.domain) return;
      counts.set(a.domain, (counts.get(a.domain) || 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [analyses]);

  async function performAnalysis() {
    if (!analysisUrl.trim()) {
      setError('Please enter a URL to analyze');
      return;
    }

    try {
      setAnalyzing(true);
      setError(null);
      
      const supabase: SupabaseClient = getSupabaseClient();
      const { data: session } = await supabase.auth.getSession();
      
      if (!session.session?.access_token) {
        setError('Please log in to perform analysis');
        return;
      }

      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: analysisUrl,
          accessToken: session.session.access_token
        })
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      
      // Refresh the analyses list
      const { data, error } = await supabase
        .from('analyses')
        .select('id,title,url,domain,analysis_type,created_at,is_favorite,content')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setAnalyses(data || []);
      setAnalysisUrl('');
      
    } catch (e: any) {
      setError(e?.message || 'Failed to perform analysis');
    } finally {
      setAnalyzing(false);
    }
  }

  async function deleteAnalysis(id: string) {
    try {
      const supabase: SupabaseClient = getSupabaseClient();
      const { error } = await supabase.from('analyses').delete().eq('id', id);
      if (error) throw error;
      setAnalyses(prev => prev.filter(a => a.id !== id));
    } catch (e: any) {
      setError(e?.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  function confirmAndDelete(id: string) {
    // Basic confirmation since no Dialog component is available yet
    const ok = window.confirm('Are you sure you want to permanently delete this analysis? This cannot be undone.');
    if (!ok) return;
    // Prevent multiple submits
    if (deletingId) return;
    setDeletingId(id);
    void deleteAnalysis(id);
  }

  async function openAnalysisSidebar(analysisId: string) {
    try {
      const supabase: SupabaseClient = getSupabaseClient();
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('id', analysisId)
        .single();
      
      if (error) throw error;
      setSelectedAnalysis(data);
      setSidebarOpen(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to load analysis details');
    }
  }

  function closeSidebar() {
    setSidebarOpen(false);
    setSelectedAnalysis(null);
  }

  // Handle escape key to close sidebar
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sidebarOpen) {
        closeSidebar();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sidebarOpen]);

  return (
    <main className="flex">
      <Sidebar />
      <div className="flex-1 p-6">
      <h1 className="text-2xl font-semibold">Your Dashboard</h1>
      {requiresLogin && (
        <p>Please <a href="/login">log in</a> to view your dashboard.</p>
      )}
      {error && <p className="text-red-600">{error}</p>}
      
      {/* Analysis Input Section */}
      <div className="mt-6 mb-6">
        <h2 className="text-lg font-medium mb-3">Analyze New Website</h2>
        <div className="flex items-center gap-3">
          <input
            type="url"
            placeholder="Enter website URL to analyze (e.g., https://example.com)"
            value={analysisUrl}
            onChange={(e) => setAnalysisUrl(e.target.value)}
            className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={analyzing}
          />
          <Button 
            onClick={performAnalysis} 
            disabled={analyzing || !analysisUrl.trim()}
          >
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Enter a competitor website URL to extract features, pricing, and key information.
        </p>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <input
          placeholder="Search title, domain, or URL"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 min-w-[260px] rounded-md border border-input bg-background px-3 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-foreground/80">
          <input type="checkbox" checked={favoritesOnly} onChange={(e) => setFavoritesOnly(e.target.checked)} /> Favorites
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {domainCounts.map(([domain, count]) => (
          <Button
            key={domain}
            onClick={() => setSelectedDomain(selectedDomain === domain ? null : domain)}
            variant={selectedDomain === domain ? 'default' : 'outline'}
            size="sm"
          >
            {domain} <span className="opacity-60">({count})</span>
          </Button>
        ))}
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Recent Analyses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-sm text-muted-foreground border-b">
                  <th className="py-2 pr-2">Title</th>
                  <th className="py-2 pr-2">Domain</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Content</th>
                  <th className="py-2 pr-2">Created</th>
                  <th className="py-2 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(loading ? [] : filtered).map((a) => (
                  <tr key={a.id} className="border-b">
                    <td className="py-2 pr-2 align-top">
                      <a 
                        href={a.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        {a.title}
                      </a>
                      <div className="text-xs text-muted-foreground">{a.url}</div>
                    </td>
                    <td className="py-2 pr-2 align-top">{a.domain}</td>
                    <td className="py-2 pr-2 align-top capitalize">{a.analysis_type.replace('_', ' ')}</td>
                    <td className="py-2 pr-2 align-top max-w-[520px]">
                      <div className="text-sm text-muted-foreground break-words">
                        {a.content ? (a.content.length > 220 ? `${a.content.slice(0, 220)}…` : a.content) : '—'}
                      </div>
                    </td>
                    <td className="py-2 pr-2 align-top">
                      {new Date(a.created_at).toLocaleString('en-US', {
                        year: 'numeric', month: '2-digit', day: '2-digit',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                        hour12: false,
                        timeZone: 'UTC'
                      })}
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => openAnalysisSidebar(a.id)}
                          className="text-sm text-primary underline underline-offset-2"
                        >
                          View
                        </button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => confirmAndDelete(a.id)}
                          disabled={deletingId === a.id}
                          aria-busy={deletingId === a.id}
                        >
                          {deletingId === a.id ? 'Deleting…' : 'Delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-muted-foreground">No analyses yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Analysis Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={closeSidebar}
          ></div>
          
          {/* Sidebar */}
          <div className="absolute right-0 top-0 w-1/2 max-w-2xl bg-white shadow-xl overflow-hidden flex flex-col h-full z-10">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-800">Analysis Details</h2>
              <button 
                onClick={closeSidebar}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 hover:bg-gray-200 rounded"
                title="Close"
              >
                ×
              </button>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedAnalysis ? (
                <div>
                  <div className="mb-6">
                    <h3 className="text-xl font-semibold mb-2 text-gray-900">{selectedAnalysis.title}</h3>
                    <div className="text-sm text-blue-600 mb-3 break-all">
                      <a href={selectedAnalysis.url} target="_blank" rel="noreferrer" className="hover:underline">
                        {selectedAnalysis.url}
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full">{selectedAnalysis.domain}</span>
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full capitalize">
                        {selectedAnalysis.analysis_type.replace('_', ' ')}
                      </span>
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full">
                        {new Date(selectedAnalysis.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="bg-white">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Analysis Report</h4>
                    <div className="bg-gray-50 rounded-lg p-4 border">
                      <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed overflow-x-auto">
                        {selectedAnalysis.content}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="text-gray-500">Loading analysis...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


