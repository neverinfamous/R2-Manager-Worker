### Security
- Fixed multiple high severity vulnerabilities in `undici` by pinning exact patched version `7.24.4` via package.json overrides.

### Performance
- Migrated CSS transformer and minifier to `lightningcss` in Vite 8, accelerating application compile time from 29 seconds to 1.9 seconds.

### Changed
**Dependency Updates**
- Bumped `@cloudflare/workers-types` to `4.20260316.1`
- Bumped `@types/node` to `25.5.0`
- Bumped `@vitejs/plugin-react` to `6.0.1`
- Bumped `esbuild` to `0.27.4`
- Bumped `vite` to `8.0.0`
- Bumped `wrangler` to `4.74.0`
- Added `lightningcss` to devDependencies for optimized build speeds
