## [Unreleased]

### Changed

**Dependency Updates**
- Bumped various npm dependencies including `react`, `lucide-react`, `vite`, `typescript`, `eslint`, and `wrangler`.
- Pinned `tar` to `7.5.13` in `package.json` overrides and `Dockerfile` to align with the latest version.

### Fixed
- **Linting:** Remediated multiple `react-hooks/set-state-in-effect` violations across dashboard components and hooks by wrapping `setState` calls in `queueMicrotask` to avoid synchronous re-renders and React Compiler memoization errors.
- **Type Safety:** Removed unnecessary type assertions in `webhookApi.ts` to satisfy `@typescript-eslint/no-unnecessary-type-assertion`.
