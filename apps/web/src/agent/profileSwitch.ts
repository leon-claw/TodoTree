import type { Agent } from '@earendil-works/pi-agent-core';
import type { Api, Model } from '@earendil-works/pi-ai';

export interface PendingAgentModel {
  current: Model<Api> | null;
}

export function selectAgentModel(agent: Agent, model: Model<Api>, pending: PendingAgentModel): void {
  if (agent.state.isStreaming) {
    pending.current = model;
    return;
  }

  pending.current = null;
  agent.state.model = model;
}

export function applyPendingAgentModel(agent: Agent, pending: PendingAgentModel): void {
  if (!pending.current) return;

  // agent_end listeners run before Pi clears isStreaming; no further stream
  // continuation will be emitted once this event is reached.
  agent.state.model = pending.current;
  pending.current = null;
}
