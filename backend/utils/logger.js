/**
 * Structured Logging Utility
 * Ensures every step in the multi-agent pipeline is logged comprehensively.
 */

export function structuredLog({ step, input, output = null, error = null, latencyMs = null }) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    step,
    input,
    output,
    error: error ? (error.message || error.toString()) : null,
    latencyMs
  };

  console.log(JSON.stringify(logEntry, null, 2));
}
