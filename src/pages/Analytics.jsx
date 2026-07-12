// Analytics.jsx
import React, { useState, useEffect } from "react";
import { 
  FaChartBar, 
  FaCoins, 
  FaClock, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaRoute, 
  FaBrain,
  FaFileAlt
} from "react-icons/fa";
import toast from "react-hot-toast";

const Analytics = () => {
  const [data, setData] = useState(null);
  const [traces, setTraces] = useState([]);
  const [selectedTrace, setSelectedTrace] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [summaryRes, tracesRes] = await Promise.all([
        fetch("http://localhost:3000/api/analytics/summary"),
        fetch("http://localhost:3000/api/analytics/traces")
      ]);

      if (!summaryRes.ok || !tracesRes.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      const summaryData = await summaryRes.json();
      const tracesData = await tracesRes.json();

      setData(summaryData);
      setTraces(tracesData);
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast.error("Failed to load analytics dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-t-cyan-400 border-slate-800"></div>
          <p className="text-slate-400 text-sm animate-pulse tracking-widest uppercase">Loading Analytics...</p>
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    totalTrips: 0,
    successfulTrips: 0,
    failedTrips: 0,
    totalTokens: 0,
    totalCostUsd: 0.0,
    avgDurationMs: 0,
    avgFaithfulness: 0,
    avgRelevancy: 0
  };

  // Find max latency for visual scaling in native CSS charts
  const maxLatency = Math.max(...Object.values(data?.avgAgentLatencies || { dummy: 1 }), 1);
  const maxTokens = Math.max(...Object.values(data?.modelCounts || { dummy: 1 }), 1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-12 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="pointer-events-none absolute -left-1/4 -top-1/4 h-[800px] w-[800px] rounded-full bg-cyan-900/10 blur-[150px]" />
      <div className="pointer-events-none absolute -right-1/4 -bottom-1/4 h-[800px] w-[800px] rounded-full bg-blue-900/10 blur-[150px]" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-10">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
              Platform Analytics
            </h1>
            <p className="mt-2 text-slate-400 text-base md:text-lg">
              Monitor LLM costs, agent timings, and RAG evaluation metrics in real-time.
            </p>
          </div>
          <button 
            onClick={fetchAnalytics}
            className="self-start md:self-center inline-flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 px-5 py-2.5 text-sm font-semibold transition hover:bg-slate-800/80 active:scale-95"
          >
            Refresh Dashboard
          </button>
        </div>

        {/* ── METRIC CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card: Costs */}
          <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-xl shadow-xl flex items-center justify-between group hover:border-cyan-500/20 transition-all duration-300">
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-widest uppercase text-slate-400">Total API Cost</span>
              <h3 className="text-3xl font-bold text-cyan-400 group-hover:scale-105 transition-transform duration-300">
                ${metrics.totalCostUsd.toFixed(4)}
              </h3>
              <p className="text-xs text-slate-500">Groq / Cohere calls</p>
            </div>
            <div className="rounded-2xl bg-cyan-500/10 p-4 text-cyan-400">
              <FaCoins className="text-2xl" />
            </div>
          </div>

          {/* Card: Tokens */}
          <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-xl shadow-xl flex items-center justify-between group hover:border-blue-500/20 transition-all duration-300">
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-widest uppercase text-slate-400">Total Tokens</span>
              <h3 className="text-3xl font-bold text-blue-400 group-hover:scale-105 transition-transform duration-300">
                {metrics.totalTokens.toLocaleString()}
              </h3>
              <p className="text-xs text-slate-500">Prompt & Completion</p>
            </div>
            <div className="rounded-2xl bg-blue-500/10 p-4 text-blue-400">
              <FaBrain className="text-2xl" />
            </div>
          </div>

          {/* Card: Successful Trips */}
          <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-xl shadow-xl flex items-center justify-between group hover:border-emerald-500/20 transition-all duration-300">
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-widest uppercase text-slate-400">Trips Audited</span>
              <h3 className="text-3xl font-bold text-emerald-400 group-hover:scale-105 transition-transform duration-300">
                {metrics.successfulTrips} <span className="text-sm font-normal text-slate-400">/ {metrics.totalTrips}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {metrics.totalTrips > 0 ? Math.round((metrics.successfulTrips / metrics.totalTrips) * 100) : 0}% Success rate
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-4 text-emerald-400">
              <FaCheckCircle className="text-2xl" />
            </div>
          </div>

          {/* Card: Avg Duration */}
          <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-6 backdrop-blur-xl shadow-xl flex items-center justify-between group hover:border-indigo-500/20 transition-all duration-300">
            <div className="space-y-1">
              <span className="text-xs font-semibold tracking-widest uppercase text-slate-400">Avg Duration</span>
              <h3 className="text-3xl font-bold text-indigo-400 group-hover:scale-105 transition-transform duration-300">
                {(metrics.avgDurationMs / 1000).toFixed(2)}s
              </h3>
              <p className="text-xs text-slate-500">Per trip planning</p>
            </div>
            <div className="rounded-2xl bg-indigo-500/10 p-4 text-indigo-400">
              <FaClock className="text-2xl" />
            </div>
          </div>

        </div>

        {/* RAG EVALUATION CARD */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="rounded-3xl border border-white/5 bg-slate-900/30 p-8 backdrop-blur-xl shadow-xl space-y-6">
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FaBrain className="text-cyan-400" /> RAG Evaluation Metrics
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Audits conducted via LLM-as-a-judge scoring criteria mapping context alignment (1-5 range).
            </p>
            <div className="space-y-5">
              
              {/* Faithfulness */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-slate-300">Context Faithfulness</span>
                  <span className="text-cyan-400 font-bold">{metrics.avgFaithfulness} / 5.0</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500" 
                    style={{ width: `${(metrics.avgFaithfulness / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">Degree to which recommendations strictly match retrieved data</p>
              </div>

              {/* Relevancy */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-slate-300">Answer Relevancy</span>
                  <span className="text-indigo-400 font-bold">{metrics.avgRelevancy} / 5.0</span>
                </div>
                <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" 
                    style={{ width: `${(metrics.avgRelevancy / 5) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">Alignment of daily itineraries with requested user preferences</p>
              </div>

            </div>
          </div>

          {/* TOKEN MODEL COUNTS */}
          <div className="rounded-3xl border border-white/5 bg-slate-900/30 p-8 backdrop-blur-xl shadow-xl space-y-6">
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <FaChartBar className="text-blue-400" /> Token Volume By Model
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Distribution of token consumption across the integrated LLMs.
            </p>
            <div className="space-y-4">
              {Object.keys(data?.modelCounts || {}).length === 0 ? (
                <p className="text-slate-500 text-sm py-4 text-center">No token logs found yet.</p>
              ) : (
                Object.entries(data.modelCounts).map(([model, count]) => (
                  <div key={model} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-mono text-slate-400">{model}</span>
                      <span className="font-bold text-slate-200">{count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" 
                        style={{ width: `${(count / maxTokens) * 100}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* AGENT LATENCIES CHART */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/30 p-8 backdrop-blur-xl shadow-xl space-y-8">
          <div className="space-y-1">
            <h3 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <FaClock className="text-indigo-400" /> Average Execution Latency by Agent
            </h3>
            <p className="text-sm text-slate-400">
              Timings recorded node-by-node during LangGraph workflow execution.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
            {Object.keys(data?.avgAgentLatencies || {}).length === 0 ? (
              <p className="text-slate-500 text-sm py-4 col-span-3 text-center">No execution timings logged yet.</p>
            ) : (
              Object.entries(data.avgAgentLatencies).map(([agent, ms]) => (
                <div key={agent} className="rounded-2xl border border-white/5 bg-slate-950/60 p-5 space-y-3 relative overflow-hidden group hover:border-indigo-500/20 transition-all duration-300">
                  <div className="flex justify-between items-center relative z-10">
                    <span className="font-semibold text-slate-300 capitalize">{agent} Node</span>
                    <span className="text-indigo-400 font-bold font-mono">{(ms / 1000).toFixed(2)}s</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden relative z-10">
                    <div 
                      className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full group-hover:scale-x-105 origin-left transition-all duration-300" 
                      style={{ width: `${(ms / maxLatency) * 100}%` }}
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* TRACE AUDIT TABLE */}
        <div className="rounded-3xl border border-white/5 bg-slate-900/30 p-8 backdrop-blur-xl shadow-xl space-y-6">
          <h3 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <FaRoute className="text-slate-200" /> Audit Log Traces
          </h3>
          <p className="text-sm text-slate-400">
            Select a trace run to inspect the detailed supervisor routing and decision events log.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-white/5">
            <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
              <thead className="bg-slate-950/60 font-semibold text-slate-400">
                <tr>
                  <th className="px-6 py-4">Trace ID</th>
                  <th className="px-6 py-4">Trip Route</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Cost</th>
                  <th className="px-6 py-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/10">
                {traces.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      No traces recorded yet. Execute a trip planning request to log traces.
                    </td>
                  </tr>
                ) : (
                  traces.map((trace) => (
                    <tr 
                      key={trace.trace_id} 
                      onClick={() => setSelectedTrace(selectedTrace?.trace_id === trace.trace_id ? null : trace)}
                      className={`hover:bg-white/5 cursor-pointer transition ${selectedTrace?.trace_id === trace.trace_id ? "bg-indigo-500/10 hover:bg-indigo-500/15" : ""}`}
                    >
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">{trace.trace_id.slice(0, 8)}...</td>
                      <td className="px-6 py-4 font-semibold text-slate-200">{trace.route}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                          trace.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        }`}>
                          {trace.status === "completed" ? <FaCheckCircle /> : <FaTimesCircle />}
                          {trace.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono">{(trace.duration_ms / 1000).toFixed(2)}s</td>
                      <td className="px-6 py-4 text-cyan-400 font-semibold">${trace.estimated_cost_usd?.toFixed(4) || "0.0000"}</td>
                      <td className="px-6 py-4 text-slate-400 text-xs">{new Date(trace.started_at).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Detailed Audit Event Logs */}
          {selectedTrace && (
            <div className="rounded-2xl border border-indigo-500/20 bg-slate-950/60 p-6 space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h4 className="font-bold text-indigo-400">Supervisor & Node Event Audit Logs (Trace {selectedTrace.trace_id.slice(0, 8)})</h4>
                <button 
                  onClick={() => setSelectedTrace(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Close Detailed View
                </button>
              </div>
              <div className="space-y-3 font-mono text-xs max-h-80 overflow-y-auto pr-2">
                {selectedTrace.events?.map((evt, idx) => (
                  <div key={idx} className="flex gap-4 border-l border-slate-800 pl-4 py-1.5 relative">
                    <div className="absolute -left-1 top-2.5 h-2 w-2 rounded-full bg-indigo-500" />
                    <span className="text-slate-500 w-16 shrink-0">{evt.elapsed_ms}ms</span>
                    <div className="space-y-1">
                      <span className="text-slate-200 font-semibold">{evt.type}</span>
                      <pre className="text-slate-400 mt-1 whitespace-pre-wrap font-sans text-xs bg-slate-900/60 p-2 rounded-lg border border-white/5">
                        {JSON.stringify(evt.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

export default Analytics;
