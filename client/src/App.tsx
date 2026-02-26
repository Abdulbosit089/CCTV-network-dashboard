
import React, { useState, useEffect } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Activity, Video, AlertTriangle, Network, ShieldCheck, Info, Plus, Play, Pause, 
  Lock, LogOut, User, Cpu, Zap, BarChart3, Settings, Bell, RefreshCw,
  Trash2, Terminal, ChevronRight, KeyRound
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const API_BASE = '/api';

const App: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showAddCamera, setShowAddCamera] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('cctv_token'));
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const authFetch = async (url: string, options: any = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401 || res.status === 403) {
      logout();
      throw new Error('Unauthorized');
    }
    return res;
  };

  const logout = () => {
    localStorage.removeItem('cctv_token');
    setToken(null);
    setData(null);
    setShowSettings(false);
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthError('');
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());

    try {
      const endpoint = authMode === 'login' ? '/login' : '/signup';
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (res.ok) {
        if (authMode === 'login') {
          localStorage.setItem('cctv_token', json.token);
          setToken(json.token);
        } else {
          setAuthMode('login');
          setAuthError('Account created. Please login.');
        }
      } else {
        setAuthError(json.error || 'Authentication failed');
      }
    } catch (err) {
      setAuthError('Could not connect to server');
    }
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = Object.fromEntries(formData.entries());

    try {
      const res = await authFetch(`${API_BASE}/change-password`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setShowChangePassword(false);
        alert('Password changed successfully');
      } else {
        const json = await res.json();
        alert(json.error || 'Failed to change password');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  const fetchDashboardData = async () => {
    if (!token) return;
    try {
      const res = await authFetch(`${API_BASE}/dashboard`);
      const json = await res.json();
      setData(json);
      setLoading(false);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  };

  useEffect(() => {
    if (token) fetchDashboardData();
  }, [token]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (token && !isPaused) fetchDashboardData();
    }, 5000);
    return () => clearInterval(interval);
  }, [token, isPaused]);

  const toggleCamera = async (id: number) => {
    await authFetch(`${API_BASE}/cameras/toggle/${id}`, { method: 'POST' });
    fetchDashboardData();
  };

  const addCamera = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const body = {
      name: formData.get('name'),
      location: formData.get('location'),
      resolution: formData.get('resolution'),
      fps: Number(formData.get('fps')),
      bitrate: Number(formData.get('bitrate')),
    };
    await authFetch(`${API_BASE}/cameras`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setShowAddCamera(false);
    fetchDashboardData();
  };

  const resetDatabase = async () => {
    if (window.confirm('Are you sure you want to reset the simulation database?')) {
      await authFetch(`${API_BASE}/database/reset`, { method: 'POST' });
      fetchDashboardData();
    }
  };

  const runAiAnalysis = async () => {
    if (!data) return;
    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const model = "gemini-3-flash-preview";
      
      const prompt = `
        Analyze the following CCTV network metrics and provide a concise, technical assessment.
        
        Metrics:
        - Active Cameras: ${data.cameras.filter((c: any) => c.is_active).length}
        - Total Bandwidth Usage: ${data.cameras.filter((c: any) => c.is_active).reduce((s: number, c: any) => s + parseFloat(c.bitrate), 0).toFixed(2)} Mbps
        - Network Capacity: ${data.capacity} Mbps
        - Current Latency: ${data.metrics[data.metrics.length - 1]?.latency || 'N/A'} ms
        - Packet Loss: ${data.metrics[data.metrics.length - 1]?.packet_loss || 'N/A'} %
        - Recent Alerts: ${data.alerts.length}
        
        Provide:
        1. Current health status (Optimal, Warning, Critical).
        2. Primary bottleneck if any.
        3. One specific recommendation for optimization.
        
        Keep it professional and brief (max 100 words).
      `;

      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      setAiAnalysis(response.text || "Analysis unavailable.");
    } catch (err) {
      console.error("AI Analysis error:", err);
      setAiAnalysis("Failed to generate AI analysis.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-blue-600/20 rounded-xl flex items-center justify-center mb-6 border border-blue-500/30">
              <ShieldCheck className="text-blue-500" size={24} />
            </div>
            <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">
              {authMode === 'login' ? 'Network Access' : 'Create Operator'}
            </h1>
            <p className="text-slate-500 text-xs mb-8 font-mono uppercase tracking-widest">CCTV Impact Simulator v2.0</p>
            
            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Operator ID</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                  <input name="username" placeholder="admin" className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Access Key</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
                  <input name="password" type="password" placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 transition-all placeholder:text-slate-700" required />
                </div>
              </div>
              {authError && <div className={`text-[10px] font-bold p-2 rounded border ${authError.includes('created') ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-red-400 bg-red-500/10 border-red-500/20'}`}>{authError}</div>}
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-3 rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] mt-4">
                {authMode === 'login' ? 'Initialize Session' : 'Register Operator'}
              </button>
            </form>
            
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              className="w-full mt-4 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:text-white transition-colors"
            >
              {authMode === 'login' ? 'Need an account? Sign Up' : 'Already have an account? Login'}
            </button>

            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[9px] text-slate-600 font-mono uppercase">System Ready</span>
              <span className="text-[9px] text-slate-600 font-mono uppercase">Node: AS-772</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 font-mono">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest">Establishing Secure Link...</p>
        </div>
      </div>
    );
  }

  const { cameras, metrics, alerts, capacity, logs } = data;
  const currentMetric = metrics[metrics.length - 1] || {};
  const totalBitrate = cameras.filter((c: any) => c.is_active).reduce((s: number, c: any) => s + parseFloat(c.bitrate), 0);
  const loadPercentage = ((totalBitrate / capacity) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100">
      {/* Sidebar Navigation (Desktop) */}
      <div className="fixed left-0 top-0 bottom-0 w-16 bg-slate-900 flex flex-col items-center py-8 gap-8 border-r border-slate-800 z-50 hidden md:flex">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-900/40">
          <Activity size={20} />
        </div>
        <nav className="flex flex-col gap-6">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-3 rounded-xl transition-all ${showSettings ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
          >
            <Settings size={20} />
          </button>
        </nav>
        
        {/* Settings Dropdown */}
        {showSettings && (
          <div className="absolute left-20 bottom-8 bg-slate-900 border border-slate-800 rounded-xl p-2 shadow-2xl w-48 z-[60] animate-in slide-in-from-left-2 duration-200">
            <button 
              onClick={() => { setShowChangePassword(true); setShowSettings(false); }}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <KeyRound size={14} />
              Change Password
            </button>
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut size={14} />
              Logout Session
            </button>
          </div>
        )}
      </div>

      <main className="md:ml-16 p-4 md:p-8 max-w-7xl mx-auto">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              Network Impact Monitor
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-mono uppercase">Live</span>
            </h1>
            <p className="text-slate-500 text-sm">CCTV Traffic Simulation & Analysis Engine</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={resetDatabase}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border border-red-200 text-red-600 hover:bg-red-50 transition-all"
            >
              <Trash2 size={14} />
              Reset DB
            </button>
            <div className="bg-white border border-slate-200 rounded-lg p-1 flex gap-1">
              <button 
                onClick={() => setIsPaused(false)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${!isPaused ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Stream
              </button>
              <button 
                onClick={() => setIsPaused(true)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${isPaused ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                Pause
              </button>
            </div>
            <button onClick={fetchDashboardData} className="p-2 text-slate-400 hover:text-slate-900 transition-colors">
              <RefreshCw size={18} className={!isPaused ? 'animate-spin-slow' : ''} />
            </button>
          </div>
        </header>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard 
            label="Bandwidth Load" 
            value={`${(Number(loadPercentage) || 0).toFixed(1)}%`} 
            subValue={`${(Number(totalBitrate) || 0).toFixed(1)} / ${capacity || 0} Mbps`}
            trend={Number(loadPercentage) > 80 ? 'up' : 'stable'}
            color={Number(loadPercentage) > 80 ? 'red' : 'blue'}
          />
          <StatCard 
            label="Network Latency" 
            value={`${(Number(currentMetric?.latency) || 0).toFixed(1)}ms`} 
            subValue="Avg Round Trip"
            trend={(currentMetric?.latency || 0) > 100 ? 'up' : 'stable'}
            color={(currentMetric?.latency || 0) > 100 ? 'orange' : 'emerald'}
          />
          <StatCard 
            label="Packet Loss" 
            value={`${(Number(currentMetric?.packet_loss) || 0).toFixed(2)}%`} 
            subValue="Transmission Error"
            trend={(currentMetric?.packet_loss || 0) > 1 ? 'up' : 'stable'}
            color={(currentMetric?.packet_loss || 0) > 1 ? 'red' : 'emerald'}
          />
          <StatCard 
            label="Active Nodes" 
            value={cameras.filter((c: any) => c.is_active).length} 
            subValue={`Out of ${cameras.length} Units`}
            trend="stable"
            color="blue"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Chart Area */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <BarChart3 size={18} className="text-blue-500" />
                  Traffic Throughput
                </h2>
                <div className="flex gap-4 text-[10px] font-bold uppercase text-slate-400">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Bandwidth</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500"></span> Latency</span>
                </div>
              </div>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics}>
                    <defs>
                      <linearGradient id="colorBandwidth" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="timestamp" hide />
                    <YAxis tick={{fontSize: 10, fill: '#94a3b8'}} axisLine={false} tickLine={false} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="bandwidth_usage" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorBandwidth)" 
                      name="Bandwidth (Mbps)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="latency" 
                      stroke="#f97316" 
                      strokeWidth={2}
                      fill="transparent"
                      name="Latency (ms)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* AI Analysis Tool */}
            <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Cpu size={80} />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold flex items-center gap-2 text-blue-400">
                    <Zap size={18} />
                    Gemini AI Insights
                  </h3>
                  <button 
                    onClick={runAiAnalysis}
                    disabled={isAnalyzing}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-[10px] font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-2"
                  >
                    {isAnalyzing ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
                    {isAnalyzing ? 'Analyzing...' : 'Generate Report'}
                  </button>
                </div>
                
                <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800 min-h-[100px]">
                  {aiAnalysis ? (
                    <p className="text-sm text-slate-300 leading-relaxed italic">"{aiAnalysis}"</p>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 py-4">
                      <Info size={24} className="mb-2 opacity-20" />
                      <p className="text-[10px] uppercase tracking-widest">Awaiting Analysis Trigger</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 space-y-6">
            {/* Inventory */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-slate-800 flex items-center gap-2">
                  <Video size={18} className="text-blue-500" />
                  Unit Inventory
                </h2>
                <button 
                  onClick={() => setShowAddCamera(true)}
                  className="w-8 h-8 bg-slate-50 text-slate-600 rounded-lg flex items-center justify-center hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100"
                >
                  <Plus size={18} />
                </button>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {cameras.map((cam: any) => (
                  <div key={cam.id} className={`group p-4 rounded-xl border transition-all ${cam.is_active ? 'border-blue-100 bg-blue-50/20' : 'border-slate-100 bg-slate-50/50 grayscale opacity-60'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{cam.name}</h4>
                        <p className="text-[10px] text-slate-500 font-medium">{cam.location}</p>
                      </div>
                      <button 
                        onClick={() => toggleCamera(cam.id)}
                        className={`text-[9px] font-bold px-2 py-1 rounded-md transition-all ${cam.is_active ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-200 text-slate-500'}`}
                      >
                        {cam.is_active ? 'ACTIVE' : 'OFFLINE'}
                      </button>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <span className="text-[9px] font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">{cam.resolution}</span>
                        <span className="text-[9px] font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">{cam.fps} FPS</span>
                      </div>
                      <span className="text-xs font-bold text-blue-600">{cam.bitrate} Mbps</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts Log */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-6">
                <Bell size={18} className="text-red-500" />
                System Alerts
              </h2>
              <div className="space-y-2">
                {alerts.length === 0 ? (
                  <div className="text-center py-8">
                    <ShieldCheck size={32} className="mx-auto text-emerald-100 mb-2" />
                    <p className="text-[10px] text-slate-400 uppercase font-bold">No Violations Detected</p>
                  </div>
                ) : (
                  alerts.map((a: any, i: number) => (
                    <div key={i} className={`p-3 rounded-lg border flex items-start gap-3 ${a.severity === 'Critical' ? 'bg-red-50 border-red-100 text-red-800' : 'bg-amber-50 border-amber-100 text-amber-800'}`}>
                      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="text-[10px] font-bold uppercase">{a.alert_type}</span>
                          <span className="text-[9px] opacity-50 font-mono">{new Date(a.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p className="text-[11px] leading-tight truncate">Value {parseFloat(a.current_value).toFixed(1)} exceeded threshold</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* DB Transaction Logs */}
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-sm">
              <h2 className="font-bold text-slate-100 flex items-center gap-2 mb-4">
                <Terminal size={18} className="text-blue-400" />
                DB Transactions
              </h2>
              <div className="space-y-1.5 font-mono">
                {logs?.length === 0 ? (
                  <p className="text-[10px] text-slate-600 italic">No transactions recorded...</p>
                ) : (
                  logs.map((log: any) => (
                    <div key={log.id} className="flex items-center gap-2 text-[10px]">
                      <span className="text-slate-600">[{new Date(log.timestamp).toLocaleTimeString([], {hour12: false})}]</span>
                      <span className="text-blue-400 font-bold">{log.action}</span>
                      <span className="text-slate-500 ml-auto">ID:{log.id}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Camera Modal */}
      {showAddCamera && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Provision Unit</h2>
              <button onClick={() => setShowAddCamera(false)} className="text-slate-400 hover:text-slate-900 transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={addCamera} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Identifier</label>
                <input name="name" placeholder="e.g. Lobby North-West" className="w-full border border-slate-200 p-2.5 rounded-lg bg-slate-50 text-sm focus:outline-none focus:border-blue-500" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Location</label>
                <input name="location" placeholder="e.g. Floor 2, Zone B" className="w-full border border-slate-200 p-2.5 rounded-lg bg-slate-50 text-sm focus:outline-none focus:border-blue-500" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Frame Rate (FPS)</label>
                  <input name="fps" type="number" defaultValue="30" className="w-full border border-slate-200 p-2.5 rounded-lg bg-slate-50 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bitrate (Mbps)</label>
                  <input name="bitrate" type="number" step="0.1" defaultValue="4.0" className="w-full border border-slate-200 p-2.5 rounded-lg bg-slate-50 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Resolution Profile</label>
                <select name="resolution" className="w-full border border-slate-200 p-2.5 rounded-lg bg-slate-50 text-sm focus:outline-none focus:border-blue-500 appearance-none">
                  <option value="1080p">High Definition (1080p)</option>
                  <option value="4K">Ultra HD (4K)</option>
                  <option value="720p">Standard HD (720p)</option>
                </select>
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowAddCamera(false)} className="flex-1 border border-slate-200 py-3 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-500 transition-all">Register Unit</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showChangePassword && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6">Update Access Key</h2>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Current Password</label>
                <input name="currentPassword" type="password" className="w-full border border-slate-200 p-2.5 rounded-lg bg-slate-50 text-sm focus:outline-none focus:border-blue-500" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">New Password</label>
                <input name="newPassword" type="password" className="w-full border border-slate-200 p-2.5 rounded-lg bg-slate-50 text-sm focus:outline-none focus:border-blue-500" required />
              </div>
              <div className="flex gap-3 pt-6">
                <button type="button" onClick={() => setShowChangePassword(false)} className="flex-1 border border-slate-200 py-3 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
                <button type="submit" className="flex-1 bg-blue-600 text-white py-3 rounded-lg text-sm font-bold shadow-lg shadow-blue-200 hover:bg-blue-500 transition-all">Update Key</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{label: string, value: string | number, subValue: string, trend: 'up' | 'down' | 'stable', color: 'blue' | 'red' | 'emerald' | 'orange'}> = ({label, value, subValue, trend, color}) => {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    red: 'text-red-600 bg-red-50 border-red-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    orange: 'text-orange-600 bg-orange-50 border-orange-100',
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className={`p-1 rounded-md ${colorMap[color]}`}>
          {trend === 'up' ? <Activity size={12} className="rotate-45" /> : <Activity size={12} />}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-black text-slate-900 tracking-tight">{value}</span>
        <span className="text-[10px] text-slate-500 font-medium">{subValue}</span>
      </div>
    </div>
  );
};

export default App;
