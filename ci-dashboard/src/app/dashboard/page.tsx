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
    <div className="min-h-screen bg-gradient-to-br from-gray-400 via-gray-300 to-gray-200">
      {/* Background pattern */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `
            repeating-linear-gradient(90deg, transparent, transparent 98px, rgba(0,0,0,0.03) 100px),
            repeating-linear-gradient(0deg, transparent, transparent 98px, rgba(0,0,0,0.03) 100px)
          `
        }}></div>
      </div>

      <main className="flex relative">
        <Sidebar />
        <div className="flex-1 p-6">
          {/* Header with 90s styling */}
          <div className="bg-gray-200 border-4 border-gray-400 mb-6 shadow-lg" style={{
            borderStyle: 'outset'
          }}>
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 border-b-2 border-gray-400" style={{
              borderBottomStyle: 'inset'
            }}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-3 h-3 bg-red-500 rounded-full border border-red-700"></div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full border border-yellow-700"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-full border border-green-700"></div>
                </div>
                <span className="text-sm font-mono">CI_HQ_DASHBOARD.exe</span>
              </div>
            </div>
            <div className="p-4">
              <h1 className="text-2xl font-bold text-gray-800 font-mono" style={{
                textShadow: '2px 2px 0px #ffffff'
              }}>
                🎯 YOUR DASHBOARD
              </h1>
              <div className="text-sm text-gray-600 mt-1">━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</div>
            </div>
          </div>

          {requiresLogin && (
            <div className="bg-red-100 border-4 border-red-400 p-4 mb-4 font-mono text-red-800" style={{
              borderStyle: 'inset'
            }}>
              ⚠️ Please <a href="/login" className="underline font-bold">log in</a> to view your dashboard.
            </div>
          )}

          {error && (
            <div className="bg-red-100 border-4 border-red-400 p-4 mb-4 font-mono text-red-800" style={{
              borderStyle: 'inset'
            }}>
              💥 ERROR: {error}
            </div>
          )}
          
          {/* Analysis Input Section */}
          <div className="bg-gray-200 border-4 border-gray-400 mb-6 shadow-lg" style={{
            borderStyle: 'outset'
          }}>
            <div className="bg-gray-300 border-b-2 border-gray-400 px-4 py-2" style={{
              borderBottomStyle: 'inset'
            }}>
              <h2 className="font-bold text-gray-800 font-mono">📡 ANALYZE NEW WEBSITE</h2>
            </div>
            <div className="p-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-2">
                <input
                  type="url"
                  placeholder="Enter website URL to analyze (e.g., https://example.com)"
                  value={analysisUrl}
                  onChange={(e) => setAnalysisUrl(e.target.value)}
                  className="flex-1 p-3 border-2 border-gray-400 font-mono text-sm min-w-0"
                  style={{ borderStyle: 'inset' }}
                  disabled={analyzing}
                />
                <button
                  onClick={performAnalysis} 
                  disabled={analyzing || !analysisUrl.trim()}
                  className="px-6 py-3 bg-blue-500 text-white font-bold border-2 border-gray-400 font-mono text-sm hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{ borderStyle: 'outset' }}
                >
                  {analyzing ? '⏳ ANALYZING...' : '🚀 ANALYZE'}
                </button>
              </div>
              <p className="text-xs text-gray-600 font-mono">
                Enter a competitor website URL to extract features, pricing, and key information.
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="bg-gray-200 border-4 border-gray-400 mb-6 shadow-lg" style={{
            borderStyle: 'outset'
          }}>
            <div className="bg-gray-300 border-b-2 border-gray-400 px-4 py-2" style={{
              borderBottomStyle: 'inset'
            }}>
              <h3 className="font-bold text-gray-800 font-mono">🔍 SEARCH & FILTERS</h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  placeholder="Search title, domain, or URL"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 p-2 border-2 border-gray-400 font-mono text-sm min-w-0"
                  style={{ borderStyle: 'inset' }}
                />
                <label className="flex items-center gap-2 text-sm font-mono text-gray-700 bg-white p-2 border-2 border-gray-400 whitespace-nowrap" style={{
                  borderStyle: 'outset'
                }}>
                  <input 
                    type="checkbox" 
                    checked={favoritesOnly} 
                    onChange={(e) => setFavoritesOnly(e.target.checked)}
                    className="w-4 h-4"
                  /> 
                  ⭐ FAVORITES
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {domainCounts.map(([domain, count]) => (
                  <button
                    key={domain}
                    onClick={() => setSelectedDomain(selectedDomain === domain ? null : domain)}
                    className={`px-2 py-1 font-mono text-xs border-2 border-gray-400 whitespace-nowrap ${
                      selectedDomain === domain 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    style={{ borderStyle: 'outset' }}
                  >
                    {domain} ({count})
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="bg-gray-200 border-4 border-gray-400 shadow-lg" style={{
            borderStyle: 'outset'
          }}>
            <div className="bg-gray-300 border-b-2 border-gray-400 px-4 py-2" style={{
              borderBottomStyle: 'inset'
            }}>
              <h3 className="font-bold text-gray-800 font-mono">📊 RECENT ANALYSES</h3>
            </div>
            <div className="p-4">
              <div className="overflow-x-auto bg-white border-2 border-gray-400" style={{
                borderStyle: 'inset'
              }}>
                <table className="w-full border-collapse font-mono text-sm min-w-[800px]">
                  <thead>
                    <tr className="bg-gray-100 border-b-2 border-gray-300">
                      <th className="py-2 px-2 text-left font-bold text-gray-700 border-r border-gray-300 w-[25%]">TITLE</th>
                      <th className="py-2 px-2 text-left font-bold text-gray-700 border-r border-gray-300 w-[12%]">DOMAIN</th>
                      <th className="py-2 px-2 text-left font-bold text-gray-700 border-r border-gray-300 w-[10%]">TYPE</th>
                      <th className="py-2 px-2 text-left font-bold text-gray-700 border-r border-gray-300 w-[25%]">CONTENT</th>
                      <th className="py-2 px-2 text-left font-bold text-gray-700 border-r border-gray-300 w-[13%]">CREATED</th>
                      <th className="py-2 px-2 text-left font-bold text-gray-700 w-[15%]">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(loading ? [] : filtered).map((a) => (
                      <tr key={a.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-2 px-2 align-top border-r border-gray-200 w-[25%]">
                          <a 
                            href={a.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:underline font-semibold block truncate"
                            title={a.title}
                          >
                            {a.title}
                          </a>
                          <div className="text-xs text-gray-500 mt-1 truncate" title={a.url}>
                            {a.url}
                          </div>
                        </td>
                        <td className="py-2 px-2 align-top border-r border-gray-200 text-gray-700 w-[12%] truncate" title={a.domain}>
                          {a.domain}
                        </td>
                        <td className="py-2 px-2 align-top border-r border-gray-200 w-[10%]">
                          <span className="bg-blue-100 text-blue-800 px-1 py-1 rounded text-xs uppercase block text-center">
                            {a.analysis_type.replace('_', ' ').substring(0, 8)}
                          </span>
                        </td>
                        <td className="py-2 px-2 align-top border-r border-gray-200 w-[25%]">
                          <div className="text-xs text-gray-600 line-clamp-3" title={a.content || ''}>
                            {a.content ? (a.content.length > 100 ? `${a.content.slice(0, 100)}…` : a.content) : '—'}
                          </div>
                        </td>
                        <td className="py-2 px-2 align-top border-r border-gray-200 text-xs text-gray-600 w-[13%]">
                          <div className="whitespace-nowrap">
                            {new Date(a.created_at).toLocaleDateString('en-US', {
                              year: '2-digit', month: '2-digit', day: '2-digit'
                            })}
                          </div>
                          <div className="whitespace-nowrap">
                            {new Date(a.created_at).toLocaleTimeString('en-US', {
                              hour: '2-digit', minute: '2-digit', hour12: false
                            })}
                          </div>
                        </td>
                        <td className="py-2 px-2 align-top w-[15%]">
                          <div className="flex flex-col gap-1">
                            <button 
                              onClick={() => openAnalysisSidebar(a.id)}
                              className="px-2 py-1 bg-green-500 text-white text-xs font-bold border border-gray-400 hover:bg-green-600 w-full"
                              style={{ borderStyle: 'outset' }}
                            >
                              VIEW
                            </button>
                            <button
                              onClick={() => confirmAndDelete(a.id)}
                              disabled={deletingId === a.id}
                              className="px-2 py-1 bg-red-500 text-white text-xs font-bold border border-gray-400 hover:bg-red-600 disabled:bg-gray-400 w-full"
                              style={{ borderStyle: 'outset' }}
                            >
                              {deletingId === a.id ? 'DEL...' : 'DEL'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!loading && filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-gray-500 font-mono">
                          💭 No analyses yet. Start by analyzing a competitor website above!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

      {/* Analysis Sidebar - 90s styled */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60" 
            onClick={closeSidebar}
          ></div>
          
          {/* Sidebar */}
          <div className="absolute right-4 top-4 bottom-4 w-1/2 max-w-2xl bg-gray-200 border-4 border-gray-400 shadow-2xl overflow-hidden flex flex-col z-10" style={{
            borderStyle: 'outset'
          }}>
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-3 border-b-2 border-gray-400" style={{
              borderBottomStyle: 'inset'
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-3 h-3 bg-red-500 rounded-full border border-red-700"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full border border-yellow-700"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full border border-green-700"></div>
                  </div>
                  <span className="text-sm font-mono">ANALYSIS_VIEWER.exe</span>
                </div>
                <button 
                  onClick={closeSidebar}
                  className="bg-red-500 hover:bg-red-600 text-white w-6 h-6 border border-red-700 font-mono text-sm font-bold"
                  style={{ borderStyle: 'outset' }}
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-100">
              {selectedAnalysis ? (
                <div>
                  {/* Header section with 90s styling */}
                  <div className="bg-white border-2 border-gray-400 p-4 mb-4 shadow-sm" style={{
                    borderStyle: 'inset'
                  }}>
                    <h3 className="text-lg font-bold text-gray-800 mb-2 font-mono" style={{
                      textShadow: '1px 1px 0px #ffffff'
                    }}>
                      📄 {selectedAnalysis.title}
                    </h3>
                    <div className="text-sm text-blue-600 mb-3 break-all font-mono">
                      <a href={selectedAnalysis.url} target="_blank" rel="noreferrer" className="hover:underline">
                        🔗 {selectedAnalysis.url}
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-gray-300 text-gray-800 px-2 py-1 border border-gray-400 font-mono font-bold" style={{
                        borderStyle: 'outset'
                      }}>
                        🌐 {selectedAnalysis.domain}
                      </span>
                      <span className="bg-blue-300 text-blue-800 px-2 py-1 border border-blue-400 font-mono font-bold uppercase" style={{
                        borderStyle: 'outset'
                      }}>
                        📊 {selectedAnalysis.analysis_type.replace('_', ' ')}
                      </span>
                      <span className="bg-green-300 text-green-800 px-2 py-1 border border-green-400 font-mono font-bold" style={{
                        borderStyle: 'outset'
                      }}>
                        📅 {new Date(selectedAnalysis.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Report section */}
                  <div className="bg-white border-2 border-gray-400 shadow-sm" style={{
                    borderStyle: 'inset'
                  }}>
                    <div className="bg-gray-300 border-b-2 border-gray-400 px-4 py-2" style={{
                      borderBottomStyle: 'inset'
                    }}>
                      <h4 className="font-bold text-gray-800 font-mono">📋 ANALYSIS REPORT</h4>
                    </div>
                    <div className="p-4">
                      <div className="bg-black text-green-400 p-4 border-2 border-gray-600 font-mono text-sm leading-relaxed overflow-x-auto max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap">
                          {selectedAnalysis.content}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="bg-yellow-100 border-2 border-yellow-400 p-4 font-mono text-yellow-800" style={{
                    borderStyle: 'inset'
                  }}>
                    ⏳ Loading analysis...
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}


