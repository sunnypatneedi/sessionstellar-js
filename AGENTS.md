# AGENTS.md — AI Agent Instructions for SessionStellar JS

This file guides AI coding agents contributing to SessionStellar (`github.com/sunnypatneedi/sessionstellar-js`).

## Quick Rules

1. **Keep `core` zero-dependency** (besides `zod` for schema validation)
2. **All source code lives in `packages/`** — the root is a pure workspace coordinator
3. **Run `pnpm build && pnpm typecheck`** before committing
4. **Keep TypeScript strict mode** — no `any` types
5. **Use `.js` extensions** in all imports (NodeNext module resolution)

## Monorepo Structure

```
sessionstellar-js/
├── .github/workflows/
│   ├── ci.yml                  # Build + typecheck on push/PR
│   └── publish.yml             # npm publish on v* tags
├── packages/
│   ├── core/                   # @sessionstellar/core (published)
│   │   └── src/
│   │       ├── index.ts        # Public exports
│   │       ├── parser.ts       # SessionParser — md/txt/jsonl parsing
│   │       ├── scorer.ts       # ScoringEngine — 5 metric scoring
│   │       └── types.ts        # Zod schemas + TypeScript types
│   ├── cli/                    # sessionstellar (published)
│   │   └── src/index.ts        # CLI: score, enable/disable hook, status
│   └── mcp/                    # @sessionstellar/mcp (published)
│       └── src/index.ts        # MCP server: score_session, score_session_file
├── tsconfig.base.json
├── pnpm-workspace.yaml
├── package.json                # Pure workspace coordinator
└── README.md
```

## Package Dependencies

```
core (standalone — depends only on zod)
  ↑
  ├── cli (depends on core)
  └── mcp (depends on core + @modelcontextprotocol/sdk)
```

Inter-package dependencies use `workspace:*` locally, resolved to npm version ranges on publish.

## Development Workflow

```bash
pnpm install          # install all dependencies
pnpm build            # compile TypeScript (all packages)
pnpm typecheck        # type check without emitting
```

## Key Architecture Decisions

- **WeightProvider callback**: `ScoringEngine.score()` accepts an optional async callback for dynamic weight resolution. Default weights are hardcoded.
- **Zero network deps in core**: The parser and scorer run entirely offline. No fetch, no HTTP, no external services.
- **ESM only**: All packages use `"type": "module"`. CommonJS is not supported.

## ESM Pitfalls

| Don't | Do | Why |
|-------|-----|-----|
| Bare `__dirname` | ESM `fileURLToPath` shim | Undefined in ESM |
| Import without `.js` extension | Always include `.js` | NodeNext requires it |
| `require()` | `import` | ESM only |

## Testing Checklist

- [ ] `pnpm build` succeeds
- [ ] `pnpm typecheck` passes
- [ ] README updated if public API changed
- [ ] No breaking changes to exports (or noted in PR)
