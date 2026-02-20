# SessionStellar JS

Open source packages for scoring AI orchestration quality. Parse session transcripts, compute scores across 5 metrics, and integrate into CI/CD pipelines.

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`@sessionstellar/core`](packages/core) | [![npm](https://img.shields.io/npm/v/@sessionstellar/core)](https://www.npmjs.com/package/@sessionstellar/core) | Scoring engine & parser — zero network deps |
| [`sessionstellar`](packages/cli) | [![npm](https://img.shields.io/npm/v/sessionstellar)](https://www.npmjs.com/package/sessionstellar) | CLI — terminal, CI/CD, git hooks |
| [`@sessionstellar/mcp`](packages/mcp) | [![npm](https://img.shields.io/npm/v/@sessionstellar/mcp)](https://www.npmjs.com/package/@sessionstellar/mcp) | MCP server — Claude Code, Cursor, Windsurf |

## Quick Start

### CLI

```bash
npx sessionstellar score session.md
```

### MCP Server

```bash
# Claude Code
claude mcp add sessionstellar -- npx -y @sessionstellar/mcp

# Cursor — add to .cursor/mcp.json
{
  "mcpServers": {
    "sessionstellar": {
      "command": "npx",
      "args": ["-y", "@sessionstellar/mcp"]
    }
  }
}
```

### Programmatic

```typescript
import { parseSessionFile, ScoringEngine } from '@sessionstellar/core';

const signals = parseSessionFile(content, 'session.md');
const score = await ScoringEngine.score(signals, crypto.randomUUID());
console.log(score.overallScore); // 0–100
```

### Git Hook (auto-score on commit)

```bash
npx sessionstellar enable
```

## Metrics

| Metric | Weight | What it measures |
|--------|--------|-----------------|
| Skill Diversity | 20% | Range of tools/skills used relative to task complexity |
| Decision Depth | 25% | Quality and quantity of architectural decisions |
| Error Recovery | 20% | How errors are caught and resolved |
| Compound Learning | 20% | Patterns recognized and applied across the session |
| Orchestration Mastery | 15% | Effective use of agents and sub-processes |

## Development

```bash
pnpm install
pnpm run build
pnpm run typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Related

- [sessionstellar.com](https://sessionstellar.com) — Web app with leaderboard and analytics
- [sessionstellar-cursor](https://github.com/sunnypatneedi/sessionstellar-cursor) — Cursor IDE plugin

## License

MIT
