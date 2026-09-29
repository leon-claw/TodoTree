import type { AppData } from '../types';
import type { AgentProposal } from './proposal';
import { revalidateProposal } from './proposal';

export interface AgentCommitReceipt {
  before: AppData;
  after: AppData;
}
export type CommitResult =
  | { ok: true; data: AppData; receipt: AgentCommitReceipt }
  | { ok: false; error: string };

export function commitAgentProposal(
  current: AppData,
  proposal: AgentProposal,
  save: (data: AppData) => string | null,
): CommitResult {
  const checked = revalidateProposal(current, proposal);
  if (!checked.ok) return checked;
  const next = structuredClone(checked.proposal.next);
  const error = save(next);
  if (error) return { ok: false, error };
  return { ok: true, data: next, receipt: { before: structuredClone(current), after: structuredClone(next) } };
}

export function undoAgentCommit(
  current: AppData,
  receipt: AgentCommitReceipt,
  save: (data: AppData) => string | null,
): CommitResult {
  if (JSON.stringify(current) !== JSON.stringify(receipt.after)) {
    return { ok: false, error: '任务数据已发生其他修改，无法撤销本次 Agent 变更' };
  }
  const before = structuredClone(receipt.before);
  const error = save(before);
  if (error) return { ok: false, error };
  return { ok: true, data: before, receipt: { before: structuredClone(current), after: structuredClone(before) } };
}
