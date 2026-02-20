# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer or use GitHub's private vulnerability reporting
3. Include steps to reproduce and potential impact

## Architecture Notes

- `@sessionstellar/core` has zero network dependencies — it parses and scores locally
- The CLI (`sessionstellar`) operates entirely offline
- The MCP server (`@sessionstellar/mcp`) communicates only via stdio with the MCP client — it makes no outbound network requests
