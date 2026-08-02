// analyticsRoutes.js
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const traceDir = path.join(__dirname, '../logs/traces');

// Helper to ensure trace directory exists and read JSON files matching a pattern
const readJsonLogs = (pattern) => {
  if (!fs.existsSync(traceDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(traceDir);
    const logs = [];

    for (const file of files) {
      if (file.startsWith(pattern) && file.endsWith('.json')) {
        const filePath = path.join(traceDir, file);
        const data = fs.readFileSync(filePath, 'utf-8');
        logs.push(JSON.parse(data));
      }
    }
    return logs;
  } catch (error) {
    console.error(`Error reading analytics files for pattern ${pattern}:`, error);
    return [];
  }
};

// ── GET /traces ──
router.get('/traces', (req, res) => {
  const traces = readJsonLogs('trace_');
  // Sort descending by start time
  traces.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  res.json(traces);
});

// ── GET /costs ──
router.get('/costs', (req, res) => {
  const costs = readJsonLogs('costs_');
  res.json(costs);
});

// ── GET /evals ──
router.get('/evals', (req, res) => {
  const evals = readJsonLogs('eval_');
  res.json(evals);
});

// ── GET /summary ──
router.get('/summary', (req, res) => {
  const traces = readJsonLogs('trace_');
  const costs = readJsonLogs('costs_');
  const evals = readJsonLogs('eval_');

  // Overall aggregates
  let totalTrips = traces.length;
  let successfulTrips = 0;
  let failedTrips = 0;
  let totalTokens = 0;
  let totalCostUsd = 0.0;
  let totalDurationMs = 0;

  // Agent aggregates
  const agentLatencies = {};
  const agentCounts = {};

  // Model aggregates
  const modelCounts = {};

  // RAG aggregates
  let totalFaithfulnessScore = 0;
  let totalRelevancyScore = 0;
  let faithfulCount = 0;
  let relevancyCount = 0;

  // Process traces
  for (const trace of traces) {
    if (trace.status === 'completed') {
      successfulTrips++;
    } else {
      failedTrips++;
    }

    if (trace.duration_ms) {
      totalDurationMs += trace.duration_ms;
    }

    if (trace.token_usage) {
      totalTokens += (trace.token_usage.prompt_tokens || 0) + (trace.token_usage.completion_tokens || 0);
    }

    if (trace.agent_timings) {
      for (const [agent, ms] of Object.entries(trace.agent_timings)) {
        if (!agentLatencies[agent]) {
          agentLatencies[agent] = 0;
          agentCounts[agent] = 0;
        }
        agentLatencies[agent] += ms;
        agentCounts[agent]++;
      }
    }
  }

  // Process costs
  for (const cost of costs) {
    if (cost.estimated_total_cost_usd) {
      totalCostUsd += cost.estimated_total_cost_usd;
    }

    if (cost.by_agent) {
      for (const record of Object.values(cost.by_agent)) {
        // Accrue model usage if present
        // (For simplicity we aggregate by logs)
      }
    }
    
    if (cost.records) {
      for (const record of cost.records) {
        const model = record.model || 'unknown';
        modelCounts[model] = (modelCounts[model] || 0) + (record.total_tokens || 0);
      }
    }
  }

  // Process evals
  for (const evaluation of evals) {
    if (evaluation.faithfulness && evaluation.faithfulness.score) {
      totalFaithfulnessScore += evaluation.faithfulness.score;
      faithfulCount++;
    }
    if (evaluation.relevancy && evaluation.relevancy.score) {
      totalRelevancyScore += evaluation.relevancy.score;
      relevancyCount++;
    }
  }

  // Calculate averages
  const avgDurationMs = totalTrips > 0 ? Math.round(totalDurationMs / totalTrips) : 0;
  const avgAgentLatencies = {};
  for (const [agent, ms] of Object.entries(agentLatencies)) {
    avgAgentLatencies[agent] = Math.round(ms / agentCounts[agent]);
  }

  const avgFaithfulness = faithfulCount > 0 ? parseFloat((totalFaithfulnessScore / faithfulCount).toFixed(2)) : 0.0;
  const avgRelevancy = relevancyCount > 0 ? parseFloat((totalRelevancyScore / relevancyCount).toFixed(2)) : 0.0;

  // Sorting traces for recent logs (top 5)
  const sortedRecent = [...traces]
    .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
    .slice(0, 5)
    .map(t => ({
      trip_id: t.trip_id,
      route: t.route || `${t.start_city} → ${t.end_city}`,
      status: t.status,
      duration_ms: t.duration_ms,
      total_tokens: t.total_tokens || 0,
      timestamp: t.started_at,
    }));

  res.json({
    metrics: {
      totalTrips,
      successfulTrips,
      failedTrips,
      totalTokens,
      totalCostUsd: parseFloat(totalCostUsd.toFixed(4)),
      avgDurationMs,
      avgFaithfulness,
      avgRelevancy,
    },
    avgAgentLatencies,
    modelCounts,
    recentTrips: sortedRecent,
  });
});

export default router;
