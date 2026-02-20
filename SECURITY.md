# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x (latest) | Yes |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately via one of these channels:

- **GitHub private vulnerability reporting**: [github.com/sunnypatneedi/sessionstellar-js/security/advisories/new](https://github.com/sunnypatneedi/sessionstellar-js/security/advisories/new)

### What to include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (optional but appreciated)

### What to expect

- **Acknowledgement within 48 hours**
- **Triage within 5 business days**
- **Fix + coordinated disclosure** for confirmed vulnerabilities
- Credit in the changelog and advisory (unless you prefer to remain anonymous)

## Scope

In scope:

- Score manipulation via crafted session input (parser exploits)
- CLI command injection via malicious filenames or session content
- MCP server vulnerabilities (arbitrary code execution, data exfiltration)
- Dependency vulnerabilities with direct exploitability

Out of scope:

- Issues in the web app (report to the [private repo](https://sessionstellar.com))
- Social engineering attacks
- Attacks requiring physical access
- Issues in transitive dependencies with no exploitable path

## Architecture Notes

- `@sessionstellar/core` has zero network dependencies — it parses and scores locally
- The CLI (`sessionstellar`) operates entirely offline
- The MCP server (`@sessionstellar/mcp`) communicates only via stdio with the MCP client — it makes no outbound network requests
