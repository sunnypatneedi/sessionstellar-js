#!/usr/bin/env node
import {
  readFileSync, writeFileSync, appendFileSync,
  existsSync, mkdirSync, readdirSync, chmodSync,
} from 'node:fs';
import { resolve, basename, join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseSessionFile, ScoringEngine } from '@sessionstellar/core';
import type { OrchestrationSignals, SessionScore } from '@sessionstellar/core';

function sanitize(input: string): string {
  return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

// ─── ANSI helpers (no chalk dependency) ──────────────────────────────────────
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  blue: '\x1b[34m', cyan: '\x1b[36m', green: '\x1b[32m',
  yellow: '\x1b[33m', red: '\x1b[31m', white: '\x1b[97m', gray: '\x1b[90m',
};
const isTTY = process.stdout.isTTY;
const paint = (code: string, text: string) => (isTTY ? `${code}${text}${c.reset}` : text);

const VERSION = '0.1.0';

// ─── Git helpers ──────────────────────────────────────────────────────────────
function findGitRoot(dir = process.cwd()): string | null {
  if (existsSync(join(dir, '.git'))) return dir;
  const parent = dirname(dir);
  return parent === dir ? null : findGitRoot(parent);
}

const HOOK_MARKER = '# sessionstellar-hook';

function hookLine(gitRoot: string): string {
  // Prefer local build (developer workflow); fall back to npx (installed globally)
  const localScript = join(gitRoot, 'packages', 'cli', 'dist', 'index.js');
  if (existsSync(localScript)) {
    return `node "${localScript}" score-recent --no-upload 2>/dev/null || true`;
  }
  return `npx --yes sessionstellar score-recent --no-upload 2>/dev/null || true`;
}

// ─── Score storage ────────────────────────────────────────────────────────────
interface StoredScore {
  file: string;
  score: SessionScore;
  signals: { skills: number; agents: number; decisions: number; learnings: number };
  savedAt: string;
}

function saveScore(file: string, score: SessionScore, signals: OrchestrationSignals, gitRoot: string) {
  const dir = join(gitRoot, '.sessionstellar', 'scores');
  mkdirSync(dir, { recursive: true });
  const date = new Date().toISOString().split('T')[0];
  const entry: StoredScore = {
    file,
    score,
    signals: {
      skills: signals.skillsInvoked.length,
      agents: signals.agentsSpawned.length,
      decisions: signals.decisionPoints.length,
      learnings: signals.compoundLearnings.length,
    },
    savedAt: new Date().toISOString(),
  };
  writeFileSync(join(dir, `${date}-${score.sessionId.slice(0, 8)}.json`), JSON.stringify(entry, null, 2));
}

// ─── Commands ─────────────────────────────────────────────────────────────────
async function cmdScore(fileArg: string, flags: { json: boolean; noUpload: boolean }) {
  let content: string;
  let filename: string;

  if (fileArg === '-') {
    content = await readStdin();
    filename = 'session.md';
  } else {
    const filePath = resolve(fileArg);
    try { content = readFileSync(filePath, 'utf-8'); }
    catch { die(`Cannot read file: ${filePath}`); }
    filename = basename(filePath);
  }

  const sanitizedContent = sanitize(content!);
  const signals = parseSessionFile(sanitizedContent, filename);
  const score = await ScoringEngine.score(signals, randomUUID());
  const quality = ScoringEngine.classifyQuality(score.overallScore);

  if (flags.json) {
    process.stdout.write(JSON.stringify({
      overallScore: score.overallScore, tier: quality.tier,
      description: quality.description, breakdown: score.breakdown,
      signals: {
        skills: signals.skillsInvoked, agents: signals.agentsSpawned.length,
        decisions: signals.decisionPoints.length, errorsRecovered: signals.errorsRecovered.length,
        learnings: signals.compoundLearnings.length, complexity: signals.metadata.complexity,
      },
      sessionId: score.sessionId, scoredAt: score.scoredAt,
    }, null, 2) + '\n');
  } else {
    printFormatted(score, quality, signals);
    if (!flags.noUpload) printUploadPrompt();
  }
}

async function cmdEnable() {
  const gitRoot = findGitRoot();
  if (!gitRoot) die('Not inside a git repository.');

  const hookPath = join(gitRoot, '.git', 'hooks', 'post-commit');
  const line = hookLine(gitRoot);
  const block = `\n${HOOK_MARKER}\n${line}\n`;

  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf-8');
    if (existing.includes(HOOK_MARKER)) {
      process.stdout.write(paint(c.yellow, 'already installed') + '  SessionStellar hook is already in .git/hooks/post-commit\n');
      return;
    }
    appendFileSync(hookPath, block);
  } else {
    writeFileSync(hookPath, `#!/bin/sh${block}`);
    chmodSync(hookPath, 0o755);
  }

  // Add .sessionstellar/ to .gitignore if present
  const gitignorePath = join(gitRoot, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gi = readFileSync(gitignorePath, 'utf-8');
    if (!gi.includes('.sessionstellar')) {
      appendFileSync(gitignorePath, '\n# sessionstellar local scores\n.sessionstellar/\n');
    }
  }

  process.stdout.write([
    '',
    `  ${paint(c.green + c.bold, '✓')} SessionStellar hook installed`,
    `  ${paint(c.gray, 'Hook path   ')}  .git/hooks/post-commit`,
    `  ${paint(c.gray, 'Scores saved')}  .sessionstellar/scores/ (gitignored)`,
    '',
    `  ${paint(c.gray, 'Session files (.md, .txt, .jsonl) committed to this repo')}`,
    `  ${paint(c.gray, 'will be scored automatically on every commit.')}`,
    '',
    `  ${paint(c.gray, 'Disable anytime:')}  sessionstellar disable`,
    '',
  ].join('\n'));
}

function cmdDisable() {
  const gitRoot = findGitRoot();
  if (!gitRoot) die('Not inside a git repository.');

  const hookPath = join(gitRoot, '.git', 'hooks', 'post-commit');
  if (!existsSync(hookPath)) {
    process.stdout.write('No post-commit hook found — nothing to remove.\n');
    return;
  }

  const content = readFileSync(hookPath, 'utf-8');
  if (!content.includes(HOOK_MARKER)) {
    process.stdout.write('SessionStellar hook not found in .git/hooks/post-commit.\n');
    return;
  }

  // Remove the block between marker and end of line after hook command
  const cleaned = content
    .split('\n')
    .reduce<{ out: string[]; skip: boolean }>((acc, line) => {
      if (line === HOOK_MARKER) return { out: acc.out, skip: true };
      if (acc.skip && line.trim() === '') return { out: acc.out, skip: false };
      if (!acc.skip) acc.out.push(line);
      return acc;
    }, { out: [], skip: false })
    .out.join('\n');

  writeFileSync(hookPath, cleaned);
  process.stdout.write(`${paint(c.green + c.bold, '✓')} SessionStellar hook removed.\n`);
}

function cmdStatus() {
  const gitRoot = findGitRoot();
  if (!gitRoot) die('Not inside a git repository.');

  const hookPath = join(gitRoot, '.git', 'hooks', 'post-commit');
  const installed =
    existsSync(hookPath) && readFileSync(hookPath, 'utf-8').includes(HOOK_MARKER);

  process.stdout.write('\n');
  process.stdout.write(
    `  ${paint(c.bold, 'Hook')}  ${installed ? paint(c.green, '✓ installed') : paint(c.gray, '✗ not installed')}\n`
  );

  if (!installed) {
    process.stdout.write(`\n  Run ${paint(c.cyan, 'sessionstellar enable')} to install.\n\n`);
    return;
  }

  const scoresDir = join(gitRoot, '.sessionstellar', 'scores');
  if (!existsSync(scoresDir)) {
    process.stdout.write(`\n  ${paint(c.gray, 'No scores yet. Commit a session file to score it.')}\n\n`);
    return;
  }

  const files = readdirSync(scoresDir).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 5);
  if (files.length === 0) {
    process.stdout.write(`\n  ${paint(c.gray, 'No scores yet.')}\n\n`);
    return;
  }

  process.stdout.write(`\n  ${paint(c.bold, 'Recent scores')}\n\n`);
  for (const f of files) {
    try {
      const entry = JSON.parse(readFileSync(join(scoresDir, f), 'utf-8')) as StoredScore;
      const quality = ScoringEngine.classifyQuality(entry.score.overallScore);
      const date = entry.savedAt.split('T')[0];
      const fileShort = basename(entry.file);
      process.stdout.write(
        `  ${paint(c.gray, date)}  ${paint(c.cyan + c.bold, String(entry.score.overallScore).padStart(5))}` +
        `  ${paint(tierColor(quality.tier), quality.tier.padEnd(12))}  ${paint(c.gray, fileShort)}\n`
      );
    } catch { continue; }
  }
  process.stdout.write('\n');
}

async function cmdScoreRecent(flags: { noUpload: boolean }) {
  const { execSync } = await import('node:child_process');
  const gitRoot = findGitRoot();
  if (!gitRoot) return;

  let committed: string[];
  try {
    const out = execSync('git diff-tree --no-commit-id -r --name-only HEAD', { encoding: 'utf-8', cwd: gitRoot });
    committed = out.trim().split('\n').filter(Boolean);
  } catch { return; }

  const sessionFiles = committed.filter(f =>
    f.endsWith('.md') || f.endsWith('.txt') || f.endsWith('.jsonl')
  );
  if (sessionFiles.length === 0) return;

  let scored = 0;
  for (const relPath of sessionFiles) {
    const absPath = join(gitRoot, relPath);
    if (!existsSync(absPath)) continue;
    try {
      const content = readFileSync(absPath, 'utf-8');
      const sanitizedContent = sanitize(content);
      const signals = parseSessionFile(sanitizedContent, basename(relPath));

      // Only score files that look like sessions (have at least some signals)
      const hasSignals =
        signals.skillsInvoked.length > 0 ||
        signals.decisionPoints.length > 0 ||
        signals.agentsSpawned.length > 0;
      if (!hasSignals) continue;

      const score = await ScoringEngine.score(signals, randomUUID());
      const quality = ScoringEngine.classifyQuality(score.overallScore);
      saveScore(relPath, score, signals, gitRoot);
      printCompact(relPath, score, quality);
      if (!flags.noUpload) printUploadPrompt();
      scored++;
    } catch { continue; }
  }

  if (scored === 0 && sessionFiles.length > 0) {
    // Files found but none looked like sessions — silent, don't spam the commit output
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────
function bar(value: number, width = 20): string {
  const filled = Math.round((value / 100) * width);
  return paint(c.cyan, '█'.repeat(filled)) + paint(c.gray, '░'.repeat(width - filled));
}

function tierColor(tier: string): string {
  const map: Record<string, string> = {
    exceptional: c.cyan + c.bold,
    excellent: c.green + c.bold,
    good: c.green,
    fair: c.yellow,
    poor: c.red,
  };
  return map[tier] ?? c.white;
}

function printFormatted(
  score: SessionScore,
  quality: ReturnType<typeof ScoringEngine.classifyQuality>,
  signals: OrchestrationSignals
) {
  const b = score.breakdown;
  const nl = '\n';
  const rows = [
    ['Skill Diversity  ', b.skillDiversity, '(20%)'],
    ['Decision Depth   ', b.decisionDepth, '(25%)'],
    ['Error Recovery   ', b.errorRecoveryRate, '(20%)'],
    ['Compound Learning', b.compoundLearningSignals, '(20%)'],
    ['Orchestration    ', b.orchestrationMastery, '(15%)'],
  ] as const;

  const skillList = signals.skillsInvoked.length > 0
    ? signals.skillsInvoked.slice(0, 6).join(', ') + (signals.skillsInvoked.length > 6 ? ' …' : '')
    : paint(c.gray, 'none detected');

  const out = [
    '',
    `  ${paint(c.bold + c.white, 'SessionStellar')}  ${paint(c.gray, `v${VERSION}`)}`,
    '',
    `  ${paint(c.bold + tierColor(quality.tier), String(score.overallScore))} ${paint(c.gray, '/ 100')}  ${paint(tierColor(quality.tier), quality.tier.toUpperCase())}`,
    `  ${paint(c.gray, quality.description)}`,
    '',
    ...rows.map(([label, value, weight]) =>
      `  ${paint(c.white, label as string)}  ${paint(c.gray, weight as string)}  ${bar(value as number)}  ${paint(c.cyan + c.bold, String(Math.round(value as number)).padStart(3))}`
    ),
    '',
    `  ${paint(c.gray, '─'.repeat(54))}`,
    '',
    `  ${paint(c.bold, 'Signals detected')}`,
    '',
    `  ${paint(c.gray, 'Skills    ')}  ${paint(c.white, String(signals.skillsInvoked.length).padStart(3))}  ${paint(c.gray, skillList)}`,
    `  ${paint(c.gray, 'Agents    ')}  ${paint(c.white, String(signals.agentsSpawned.length).padStart(3))}`,
    `  ${paint(c.gray, 'Decisions ')}  ${paint(c.white, String(signals.decisionPoints.length).padStart(3))}`,
    `  ${paint(c.gray, 'Errors    ')}  ${paint(c.white, String(signals.errorsRecovered.length).padStart(3))}`,
    `  ${paint(c.gray, 'Learnings ')}  ${paint(c.white, String(signals.compoundLearnings.length).padStart(3))}`,
    `  ${paint(c.gray, 'Complexity')}  ${paint(c.white, '   ' + (signals.metadata.complexity ?? 'moderate'))}`,
    '',
  ].join(nl);

  process.stdout.write(out);
}

function printCompact(
  file: string,
  score: SessionScore,
  quality: ReturnType<typeof ScoringEngine.classifyQuality>
) {
  process.stdout.write(
    `\n  ${paint(c.bold + c.white, 'SessionStellar')}  ${paint(c.gray, basename(file))}\n` +
    `  ${paint(c.bold + tierColor(quality.tier), String(score.overallScore))} ${paint(c.gray, '/ 100')}  ${paint(tierColor(quality.tier), quality.tier.toUpperCase())}  ${paint(c.gray, quality.description)}\n\n`
  );
}

function printUploadPrompt() {
  process.stdout.write(
    `  ${paint(c.gray, 'Upload to leaderboard →')}  ${paint(c.blue, 'https://sessionstellar.com/upload')}\n\n`
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function die(msg: string): never {
  process.stderr.write(`${paint(c.red, 'error')}  ${msg}\n`);
  process.exit(1);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', chunk => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const HELP = `
${paint(c.bold + c.white, 'sessionstellar')} ${paint(c.gray, `v${VERSION}`)}

Score AI orchestration sessions from the terminal.

${paint(c.bold, 'Usage:')}
  sessionstellar score <file>    Score a session file
  sessionstellar score -         Read from stdin
  sessionstellar enable          Install git post-commit hook (auto-score on commit)
  sessionstellar disable         Remove the git hook
  sessionstellar status          Show hook status + recent scores

${paint(c.bold, 'Flags:')}
  --json        Output raw JSON
  --no-upload   Suppress upload prompt
  -h, --help    Show this help

${paint(c.bold, 'Examples:')}
  sessionstellar score ./session.md
  cat session.md | sessionstellar score -
  sessionstellar score ./session.md --json | jq .overallScore
  sessionstellar enable   ${paint(c.gray, '# auto-score every commit that touches a session file')}

${paint(c.gray, 'Upload to leaderboard: https://sessionstellar.com/upload')}
`;

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    process.stdout.write(HELP + '\n');
    process.exit(0);
  }

  const flags = { json: args.includes('--json'), noUpload: args.includes('--no-upload') };
  const positional = args.filter(a => !a.startsWith('-'));
  const cmd = positional[0];

  if (cmd === 'score') {
    const fileArg = positional[1];
    if (!fileArg) die("Missing file argument.\nUsage: sessionstellar score <file> | -");
    await cmdScore(fileArg, flags);

  } else if (cmd === 'enable') {
    await cmdEnable();

  } else if (cmd === 'disable') {
    cmdDisable();

  } else if (cmd === 'status') {
    cmdStatus();

  } else if (cmd === 'score-recent') {
    await cmdScoreRecent(flags);

  } else {
    die(`Unknown command: ${cmd}\nRun 'sessionstellar --help' for usage.`);
  }
}

main().catch(err => die(err instanceof Error ? err.message : String(err)));
