# Contributing to SessionStellar JS

Thanks for your interest in contributing to SessionStellar's open source packages!

## Packages

| Package | npm | Description |
|---------|-----|-------------|
| `@sessionstellar/core` | [npm](https://www.npmjs.com/package/@sessionstellar/core) | Scoring engine & parser — zero network dependencies |
| `sessionstellar` | [npm](https://www.npmjs.com/package/sessionstellar) | CLI — score sessions in terminal, CI/CD, git hooks |
| `@sessionstellar/mcp` | [npm](https://www.npmjs.com/package/@sessionstellar/mcp) | MCP server — score from Claude Code, Cursor, Windsurf |

## Getting Started

```bash
# Clone
git clone https://github.com/sunnypatneedi/sessionstellar-js.git
cd sessionstellar-js

# Install (requires pnpm >= 9)
pnpm install

# Build all packages
pnpm run build

# Typecheck all packages
pnpm run typecheck
```

## Development Workflow

1. **Fork** the repo and create a feature branch
2. Make your changes in the relevant `packages/` directory
3. Run `pnpm run build && pnpm run typecheck` to verify
4. Submit a pull request

## Architecture

```
packages/
  core/     # Scoring engine + parser (depended on by CLI and MCP)
  cli/      # Terminal CLI (depends on core)
  mcp/      # MCP server (depends on core)
```

- `core` is the foundation — parser and scorer live here
- `cli` and `mcp` are thin wrappers that consume `core`
- Inter-package dependencies use `workspace:*` (resolved to npm versions on publish)

## Guidelines

- Keep `core` zero-dependency (besides `zod` for schema validation)
- CLI should work offline — no network calls
- MCP server follows the [Model Context Protocol](https://modelcontextprotocol.io) specification
- TypeScript strict mode is required

## Reporting Issues

- **Bugs**: Open an issue with reproduction steps
- **Features**: Open a discussion first to align on approach
- **Security**: See [SECURITY.md](SECURITY.md)
