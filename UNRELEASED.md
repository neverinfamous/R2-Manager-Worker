### Security
- Added Dockerfile layout-agnostic patching for `picomatch` to fix Method Injection vulnerability
- Pinned `flatted` transitive dependency to fix Prototype Pollution vulnerability
- Updated `brace-expansion` override to address zero-step sequence hang issue

### Changed
**Dependency Updates**
- Bumped `esbuild` to 0.28.0
- Bumped `lucide-react` to 1.7.0
- Bumped `typescript` to 6.0.2
- Bumped `@cloudflare/workers-types` to 4.20260405.1
- Various minor and patch dependency updates via npm update
