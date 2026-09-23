import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import { terminalRun } from '../../../core/out/index.js';
import type { NssWorkspaceAiServerConfig } from '../config/env.js';
import type { StudioService } from '../services/studioService.js';
import { handleAskRequest } from '../services/askService.js';
import { listWorkspaceFiles, readWorkspaceFile, searchWorkspace } from './files.js';
import { projectRoot } from './paths.js';
import { WorkspaceReviews, publicReview } from './reviews.js';
import { WorkspaceTransactions, publicTransaction } from './transactions.js';
import { WorkspaceValidations, configuredValidationTasks } from './validations.js';

const send = (response: ServerResponse, data: unknown) => {
  response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
};

function field(body: Record<string, unknown>, key: string, max = 8000): string {
  const value = body[key];
  if (typeof value !== 'string' || value.length > max) throw new Error(`Invalid ${key}.`);
  return value;
}

export function createWorkspaceRoutes(studio: StudioService, config: NssWorkspaceAiServerConfig) {
  const dataDirectory = process.env.MATTERHORN_DATA_DIR ?? resolve(__dirname, '../../../.matterhorn');
  const assertIdle = () => {
    if (studio.controller.store.list().some(run => !terminalRun(run.status))) {
      throw new Error('Wait for Studio execution to settle before changing files or running workspace validation.');
    }
  };
  const reviews = new WorkspaceReviews(studio.projects, dataDirectory, assertIdle);
  const transactions = new WorkspaceTransactions(studio.projects, dataDirectory, assertIdle);
  const validations = new WorkspaceValidations(studio.projects, configuredValidationTasks(studio.projects), assertIdle);

  return async (request: IncomingMessage, response: ServerResponse, readBody: () => Promise<unknown>): Promise<boolean> => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/workspace/')) return false;
    const action = url.pathname.slice('/api/workspace/'.length);

    if (request.method === 'GET') {
      if (action === 'review') {
        send(response, publicReview(reviews.get(url.searchParams.get('id') ?? '')));
        return true;
      }
      if (action === 'transaction') {
        send(response, publicTransaction(transactions.get(url.searchParams.get('id') ?? '')));
        return true;
      }
      const projectId = url.searchParams.get('projectId') ?? '';
      const root = projectRoot(studio.projects, projectId);
      if (action === 'files') { send(response, listWorkspaceFiles(root)); return true; }
      if (action === 'file') { send(response, readWorkspaceFile(root, url.searchParams.get('path') ?? '')); return true; }
      if (action === 'search') { send(response, searchWorkspace(root, url.searchParams.get('q') ?? '')); return true; }
      if (action === 'reviews') {
        const result = reviews.list(projectId);
        send(response, { unavailable: result.unavailable, reviews: result.reviews.map(review => ({ id: review.id, path: review.path, status: review.status, createdAt: review.createdAt })) });
        return true;
      }
      if (action === 'transactions') {
        const result = transactions.list(projectId);
        send(response, {
          unavailable: result.unavailable,
          transactions: result.transactions.map(transaction => ({
            id: transaction.id,
            status: transaction.status,
            createdAt: transaction.createdAt,
            files: transaction.files.map(file => file.path),
            detail: transaction.detail,
          })),
        });
        return true;
      }
      if (action === 'validations') {
        send(response, validations.list(projectId));
        return true;
      }
    }

    if (request.method === 'POST') {
      const raw = await readBody();
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Expected a request object.');
      const body = raw as Record<string, unknown>;

      if (['apply', 'reject', 'restore'].includes(action)) {
        send(response, publicReview(reviews.act(field(body, 'id', 50), action as 'apply' | 'reject' | 'restore')));
        return true;
      }
      if (action === 'transaction-stage') {
        const files = body.files;
        if (!Array.isArray(files)) throw new Error('files must be an array.');
        const changes = files.map(item => {
          if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid change-set file.');
          const change = item as Record<string, unknown>;
          return {
            path: field(change, 'path', 500),
            version: field(change, 'version', 64),
            content: field(change, 'content', 32768),
          };
        });
        send(response, publicTransaction(transactions.stage(field(body, 'projectId', 80), changes)));
        return true;
      }
      if (['transaction-apply', 'transaction-reject', 'transaction-rollback'].includes(action)) {
        const transactionAction = action.slice('transaction-'.length) as 'apply' | 'reject' | 'rollback';
        send(response, publicTransaction(transactions.act(field(body, 'id', 50), transactionAction)));
        return true;
      }
      if (action === 'validate') {
        send(response, await validations.run(field(body, 'projectId', 80), field(body, 'id', 80)));
        return true;
      }

      const projectId = field(body, 'projectId', 80);
      const root = projectRoot(studio.projects, projectId);
      const path = field(body, 'path', 500);
      const version = field(body, 'version', 64);
      if (action === 'stage') {
        send(response, publicReview(reviews.stage(projectId, path, version, field(body, 'content', 32768))));
        return true;
      }
      if (action === 'assist') {
        const intent = field(body, 'intent', 30);
        const prompt = field(body, 'prompt');
        const provider = typeof body.provider === 'string' ? body.provider : undefined;
        if (!['explain', 'plan', 'propose', 'diagnose'].includes(intent)) throw new Error('Unsupported workspace assistance action.');
        const file = readWorkspaceFile(root, path);
        if (file.version !== version) throw new Error('File changed. Reopen it before requesting assistance.');
        const answer = await handleAskRequest(config, {
          prompt: prompt || 'Explain this file.',
          intent: intent === 'explain' ? 'explain-file' : intent === 'propose' ? 'propose-edit' : intent === 'diagnose' ? 'propose-error-file-fix' : 'change-plan',
          workspace: { name: studio.projects.find(project => project.id === projectId)!.name },
          activeFile: { path, languageId: path.split('.').at(-1) ?? 'text', content: file.content },
          project: { structureSummary: listWorkspaceFiles(root).files.slice(0, 200).join('\n') },
        }, provider);
        const review = typeof answer.proposedText === 'string' && ['propose', 'diagnose'].includes(intent)
          ? reviews.stage(projectId, path, version, answer.proposedText)
          : undefined;
        send(response, { response: answer.response, review: review ? publicReview(review) : null });
        return true;
      }
    }

    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ error: 'Workspace route not found.' }));
    return true;
  };
}
