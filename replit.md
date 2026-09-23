# Matterhorn development environment

Matterhorn is a standalone local Studio and AI assistant. The optional legacy VS Code integration is excluded from the default workspaces.

Use Node.js 22+, `npm ci`, and `npm run dev:server`. See README.md for project and provider configuration.

The execution API is local-only and binds to loopback. The old unauthenticated public Replit preview/deployment configuration has been removed. A remote multi-user deployment requires an authenticated service boundary before exposing project execution.
