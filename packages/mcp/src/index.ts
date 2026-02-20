#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseSessionFile, ScoringEngine } from '@sessionstellar/core';
import type { OrchestrationSignals, SessionScore } from '@sessionstellar/core';
function sanitize(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

const server = new Server(
  { name: 'sessionstellar', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'score_session',
      description:
        'Score an AI orchestration session transcript. Returns a 0–100 composite score across 5 metrics: Skill Diversity (20%), Decision Depth (25%), Error Recovery (20%), Compound Learning (20%), and Orchestration Mastery (15%). Works with Claude Code, Cursor, Windsurf, and Gemini session exports.',
      inputSchema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'Full text content of the session transcript',
          },
          filename: {
            type: 'string',
            description:
              'Filename for format detection — .md (markdown), .txt (plain text), .jsonl (JSON Lines). Defaults to session.md.',
            default: 'session.md',
          },
        },
        required: ['content'],
      },
    },
    {
      name: 'score_session_file',
      description:
        'Score a session file by its path on disk. Reads the file, parses orchestration signals, and returns the full breakdown.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the session file (.md, .txt, or .jsonl)',
          },
        },
        required: ['path'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'score_session') {
    const content = args?.content as string;
    const filename = (args?.filename as string) ?? 'session.md';

    if (!content || typeof content !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'content must be a non-empty string');
    }

    const sanitizedContent = sanitize(content);
    const signals = parseSessionFile(sanitizedContent, filename);
    const score = await ScoringEngine.score(signals, randomUUID());
    const quality = ScoringEngine.classifyQuality(score.overallScore);

    return { content: [{ type: 'text', text: formatScore(score, quality, signals) }] };
  }

  if (name === 'score_session_file') {
    const filePath = args?.path as string;

    if (!filePath || typeof filePath !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'path must be a non-empty string');
    }

    let content: string;
    try {
      content = readFileSync(resolve(filePath), 'utf-8');
    } catch {
      throw new McpError(ErrorCode.InvalidParams, `Cannot read file: ${filePath}`);
    }

    const sanitizedContent = sanitize(content);
    const signals = parseSessionFile(sanitizedContent, basename(filePath));
    const score = await ScoringEngine.score(signals, randomUUID());
    const quality = ScoringEngine.classifyQuality(score.overallScore);

    return { content: [{ type: 'text', text: formatScore(score, quality, signals) }] };
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
});

function bar(value: number): string {
  const filled = Math.round(value / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function formatScore(
  score: SessionScore,
  quality: ReturnType<typeof ScoringEngine.classifyQuality>,
  signals: OrchestrationSignals
): string {
  const b = score.breakdown;
  return [
    `## SessionStellar Score`,
    ``,
    `**${score.overallScore} / 100** — ${quality.tier.toUpperCase()}`,
    `_${quality.description}_`,
    ``,
    `### Breakdown`,
    ``,
    `| Metric | Score | Bar |`,
    `|--------|------:|-----|`,
    `| Skill Diversity (20%) | ${b.skillDiversity.toFixed(0)} | \`${bar(b.skillDiversity)}\` |`,
    `| Decision Depth (25%) | ${b.decisionDepth.toFixed(0)} | \`${bar(b.decisionDepth)}\` |`,
    `| Error Recovery (20%) | ${b.errorRecoveryRate.toFixed(0)} | \`${bar(b.errorRecoveryRate)}\` |`,
    `| Compound Learning (20%) | ${b.compoundLearningSignals.toFixed(0)} | \`${bar(b.compoundLearningSignals)}\` |`,
    `| Orchestration (15%) | ${b.orchestrationMastery.toFixed(0)} | \`${bar(b.orchestrationMastery)}\` |`,
    ``,
    `### Signals Detected`,
    ``,
    `- **Skills**: ${signals.skillsInvoked.length}${signals.skillsInvoked.length > 0 ? ` (${signals.skillsInvoked.slice(0, 5).join(', ')}${signals.skillsInvoked.length > 5 ? '…' : ''})` : ''}`,
    `- **Agents spawned**: ${signals.agentsSpawned.length}`,
    `- **Decision points**: ${signals.decisionPoints.length}`,
    `- **Errors recovered**: ${signals.errorsRecovered.length}`,
    `- **Compound learnings**: ${signals.compoundLearnings.length}`,
    `- **Complexity**: ${signals.metadata.complexity ?? 'moderate'}`,
    ``,
    `---`,
    `_Upload to leaderboard: https://sessionstellar.com/upload_`,
  ].join('\n');
}

const transport = new StdioServerTransport();
await server.connect(transport);
