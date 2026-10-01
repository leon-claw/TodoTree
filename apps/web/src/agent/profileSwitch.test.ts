import { Agent } from '@earendil-works/pi-agent-core';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from '@earendil-works/pi-ai';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
import type { Api, AssistantMessage, Model } from '@earendil-works/pi-ai';
import { describe, expect, it } from 'vitest';
import { applyPendingAgentModel, selectAgentModel } from './profileSwitch';

function model(id: string): Model<Api> {
  return { provider: 'openai', id } as Model<Api>;
}

const usage: AssistantMessage['usage'] = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
};

function assistantMessage(
  selectedModel: Model<Api>,
  stopReason: AssistantMessage['stopReason'],
  content: AssistantMessage['content'],
): AssistantMessage {
  return {
    role: 'assistant',
    content,
    api: selectedModel.api,
    provider: selectedModel.provider,
    model: selectedModel.id,
    usage,
    stopReason,
    timestamp: 1,
  };
}

describe('profile switching for the shared Agent', () => {
  it('applies a model immediately while idle without clearing its transcript or tools', () => {
    const firstModel = model('first');
    const nextModel = model('next');
    const toolParameters = Type.Object({});
    const tool: AgentTool<typeof toolParameters> = {
      name: 'read_example',
      label: 'Read example',
      description: 'Read example data',
      parameters: toolParameters,
      execute: async () => ({ content: [{ type: 'text', text: 'example' }], details: {} }),
    };
    const agent = new Agent({ initialState: { model: firstModel, tools: [tool] }, streamFn: () => createAssistantMessageEventStream() });
    agent.state.messages = [{
      role: 'user',
      content: 'existing conversation',
      timestamp: 1,
    }];
    const messagesBefore = [...agent.state.messages];
    const toolsBefore = [...agent.state.tools];
    const pending = { current: null as Model<Api> | null };

    selectAgentModel(agent, nextModel, pending);

    expect(agent.state.model).toBe(nextModel);
    expect(pending.current).toBeNull();
    expect(agent.state.messages).toEqual(messagesBefore);
    expect(agent.state.tools).toEqual(toolsBefore);
  });

  it('keeps one model through tool continuation, then applies only the last selection at agent_end', async () => {
    const firstModel = model('first');
    const secondModel = model('second');
    const finalModel = model('final');
    const toolParameters = Type.Object({});
    let signalToolStarted!: () => void;
    let releaseTool!: () => void;
    const toolStarted = new Promise<void>((resolve) => { signalToolStarted = resolve; });
    const toolGate = new Promise<void>((resolve) => { releaseTool = resolve; });
    const tool: AgentTool<typeof toolParameters> = {
      name: 'pause_for_switch',
      label: 'Pause',
      description: 'Pauses so the current model can be changed while running.',
      parameters: toolParameters,
      execute: async () => {
        signalToolStarted();
        await toolGate;
        return { content: [{ type: 'text', text: 'tool finished' }], details: {} };
      },
    };
    const requestedModels: Model<Api>[] = [];
    const agent = new Agent({
      initialState: { model: firstModel, tools: [tool] },
      streamFn: (selectedModel) => {
        requestedModels.push(selectedModel);
        const stream = createAssistantMessageEventStream();
        if (requestedModels.length === 1) {
          stream.push({
            type: 'done',
            reason: 'toolUse',
            message: assistantMessage(selectedModel, 'toolUse', [{
              type: 'toolCall',
              id: 'pause-call',
              name: 'pause_for_switch',
              arguments: {},
            }]),
          });
        } else {
          stream.push({
            type: 'done',
            reason: 'stop',
            message: assistantMessage(selectedModel, 'stop', [{ type: 'text', text: 'finished' }]),
          });
        }
        return stream;
      },
    });
    const pending = { current: null as Model<Api> | null };
    let streamingDuringAgentEnd = false;
    agent.subscribe((event) => {
      if (event.type === 'agent_end') {
        streamingDuringAgentEnd = agent.state.isStreaming;
        applyPendingAgentModel(agent, pending);
      }
    });

    const running = agent.prompt('run the tool');
    await toolStarted;
    const messagesBeforeSwitch = [...agent.state.messages];
    selectAgentModel(agent, secondModel, pending);
    selectAgentModel(agent, finalModel, pending);

    expect(agent.state.isStreaming).toBe(true);
    expect(agent.state.model).toBe(firstModel);
    expect(pending.current).toBe(finalModel);
    expect(agent.state.messages).toEqual(messagesBeforeSwitch);

    releaseTool();
    await running;

    expect(requestedModels).toEqual([firstModel, firstModel]);
    expect(streamingDuringAgentEnd).toBe(true);
    expect(agent.state.model).toBe(finalModel);
    expect(pending.current).toBeNull();
    expect(agent.state.messages.length).toBeGreaterThan(messagesBeforeSwitch.length);
    expect(agent.state.messages.some((message) => message.role === 'toolResult')).toBe(true);
  });
});
