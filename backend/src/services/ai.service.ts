import { env } from '../config/env';

/**
 * Thin proxy to the Python AI service. The AI service never touches the
 * database directly — it calls back into controlled REST endpoints exposed
 * under /api/ai-data/*, authenticated with an internal token.
 */
async function callAi<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${env.aiServiceUrl}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Token': env.aiInternalToken,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI service error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export const aiService = {
  ask(question: string, userContext: { name: string; role: string }) {
    return callAi<{ answer: string; toolUsed: string | null; data?: unknown }>('/ask', {
      question,
      user: userContext,
    });
  },

  maintenanceRisk(vehicleId: string) {
    return callAi<{
      vehicleId: string;
      risk: 'LOW' | 'MEDIUM' | 'HIGH';
      score: number;
      reasons: string[];
      disclaimer: string;
    }>(`/predictive-maintenance/${vehicleId}`);
  },

  fuelAnomalies() {
    return callAi<{ anomalies: unknown[] }>('/fuel-anomalies');
  },

  health() {
    return callAi<{ status: string; llmConfigured: boolean }>('/health');
  },
};
