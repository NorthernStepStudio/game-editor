# Changelog

## 0.1.0

- created the `apps/nstep-workspace-ai` app path
- added the long-term VS Code extension folder structure
- reserved the command, service, state, storage, and docs layout for the planned migration

## 0.2.0

- replaced the dead legacy bridge with a self-contained extension runtime
- restored the full declared command surface with local-first implementations
- added sidebar state for backend status, studio mode/preset/project, tasks, diagnostics, reviews, and latest responses
- restored task runner, diagnostics, memory, workflows, knowledge packs, review center, and studio dashboard flows
- added smoke coverage for request building, review parsing, workflow stepping, and mode/preset inference

## 0.3.0

- removed the leftover legacy compile bridge from the extension package scripts
- added a live extension-host verification path that boots the bundled NSS server and checks a real `/ask` roundtrip
- added repo-level VS Code launch and task configs for running the NSS server and extension together from the studio workspace
