import type { AgentTool } from '@earendil-works/pi-agent-core';
import { Type } from '@earendil-works/pi-ai';
import type { Operation } from 'fast-json-patch';
import type { AppData } from '../types';
import { createProposal, readSnapshot } from './proposal';
import type { AgentProposal } from './proposal';
import { describeAppDataChange } from './diff';
import type { AppDataChangeSummary } from './diff';

export interface AppDataToolDependencies {
  getData: () => AppData;
  onProposal: (proposal: AgentProposal, summary: AppDataChangeSummary) => void;
  now?: () => Date;
}

function localToday(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function createAppDataTools({ getData, onProposal, now = () => new Date() }: AppDataToolDependencies): AgentTool[] {
  let lastRead: ReturnType<typeof readSnapshot> | null = null;
  const readTool: AgentTool = {
    name: 'read_app_data',
    label: '读取任务数据',
    description: '读取当前完整 TodoTree AppData、基版标识与用户本地今天。查询或修改前先调用。',
    parameters: Type.Object({}),
    execute: async () => {
      lastRead = readSnapshot(getData());
      return {
        content: [{ type: 'text', text: JSON.stringify({ ...lastRead, localToday: localToday(now()) }) }],
        details: { baseVersion: lastRead.baseVersion },
      };
    },
  };
  const proposalParameters = Type.Object({
    baseVersion: Type.String(),
    patch: Type.Array(Type.Object({
      op: Type.String(),
      path: Type.String(),
      from: Type.Optional(Type.String()),
      value: Type.Optional(Type.Any()),
    })),
  });
  const proposalTool: AgentTool<typeof proposalParameters> = {
    name: 'propose_app_data_patch',
    label: '提出任务数据修改',
    description: '以刚读取的基版提出 RFC 6902 JSON Patch。只产生待用户审阅的提案，不会保存。只能修改已知任务与标签字段。',
    parameters: proposalParameters,
    executionMode: 'sequential',
    execute: async (_toolCallId, params) => {
      if (!lastRead) throw new Error('请先读取当前任务数据');
      const result = createProposal(lastRead.data, getData(), lastRead.baseVersion, params.baseVersion, params.patch as Operation[]);
      if (!result.ok) throw new Error(result.error);
      const summary = describeAppDataChange(result.proposal.base, result.proposal.next, result.proposal.patch);
      onProposal(result.proposal, summary);
      return {
        content: [{ type: 'text', text: `提案已生成，待审阅；实际影响：新增 ${summary.totals.added}，修改 ${summary.totals.updated}，移动 ${summary.totals.moved}，删除 ${summary.totals.deleted}。用户确认前不会保存。` }],
        details: summary,
      };
    },
  };

  return [readTool, proposalTool];
}
