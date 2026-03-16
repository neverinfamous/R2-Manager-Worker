# Contributing to R2-Manager-Worker

Thank you for your interest in contributing to R2-Manager-Worker! This guide covers everything you need to get started — from setting up your environment to understanding our code conventions and submitting a pull request.

## Prerequisites

- **Node.js 24+** (LTS) — required by `engines` in `package.json`
- **Git** with SSH access configured
- **Cloudflare Account** (Free tier works!) with `npx wrangler login` authenticated
- **Docker** (optional, for container-based testing)

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:

   ```bash
   git clone https://github.com/YOUR_USERNAME/R2-Manager-Worker.git
   cd R2-Manager-Worker
   ```

3. **Install** dependencies:

   ```bash
   npm install
   ```

4. **Configure environment:**

   ```bash
   cp .env.example .env
   cp wrangler.toml.example wrangler.toml
   ```

   Edit both files with your settings. The `.env.development` file is automatically loaded by Vite when running `npm run dev` and automatically points to the local worker on port 8787. No manual switching between dev and production URLs required.

5. **Build** the project:

   ```bash
   npm run build
   ```

6. **Run the quality gate** to confirm everything works:

   ```bash
   npm run check   # Runs ESLint + TypeScript strict-mode type checking
   ```

7. **Create a branch** for your changes:

   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Available Scripts

| Script              | Purpose                                              |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Start frontend Vite dev server on port 5173          |
| `npm run build`     | Build React app and typescript worker                |
| `npm run check`     | **Quality gate** — lint + typecheck (run before PRs) |
| `npm run lint`      | ESLint only                                          |
| `npm run lint:fix`  | ESLint with auto-fix                                 |
| `npm run typecheck` | TypeScript strict-mode type checking                 |

### Running the App Locally (Two Terminal Windows Required)

We use Vite for the frontend and Wrangler for the backend API.

**Terminal 1: Frontend dev server (Vite)**

```bash
npm run dev
# Opens http://localhost:5173
```

**Terminal 2: Worker dev server (Wrangler)**

```bash
npx wrangler dev --config wrangler.dev.toml --local
# Opens http://localhost:8787
```

> **Note:** The local database mock operations return simulated success responses for UI testing. Files and folders are not actually stored. Local development is for UI/UX testing only. Authentication, rate-limiting, and CORS are automatically bypassed. For full functionality, deploy to Cloudflare Workers.

## Project Architecture

```
src/                      # Frontend source code (React 19)
├── app.tsx              # Main UI component
├── filegrid.tsx         # File browser with grid/list views
└── services/            # API client and auth utilities
worker/                   # Backend API (Cloudflare Workers)
├── index.ts             # Worker runtime & API endpoints
├── routes/              # API route handlers
└── utils/               # Helper utilities
wrangler.toml.example    # Wrangler configuration template
.env.example             # Environment variables template
```

## Code Conventions

### File Naming

All files and directories use **kebab-case** (lowercase with dashes):

- ✅ `file-grid.tsx`, `api-service.ts`, `job-history/`
- ❌ `FileGrid.tsx`, `apiService.ts`

### TypeScript

- **Strict mode** with no `any` types — the entire codebase is fully type-safe.
- **No `eslint-disable`** — do not suppress linting rules. Exceptions are allowed only for external SDK deprecations where the linter genuinely misunderstands intent.
- **Formatting** is handled automatically by Prettier during the release workflow via `/bump-deploy` — no need to run it manually.

### Modularity

- **Source files stay under ~500 lines.** If a file is approaching that limit, split it proactively.
- **Split pattern:** `foo.ts` → `foo/` directory with sub-modules + `foo/index.ts` barrel re-export.
- **Group by functional cohesion** (e.g., CRUD vs. analysis, basic vs. advanced), not arbitrary line counts.

### CSS Styleguide

- Use CSS modules or scoped styles when possible
- Use meaningful class names (BEM notation recommended)
- Mobile-first approach for responsive design
- Use CSS custom properties for colors and spacing

## Error Handling & Logging

Use the centralized logger with structured payloads. Include: `module`, `operation`, `entityId`, `context`, and `stack` (for errors). Severity levels: `error`, `warning`, `info`.

Example structured error pattern for APIs:

```json
{
  "success": false,
  "error": "Descriptive message with context",
  "code": "R2_UPLOAD_FAILED"
}
```

## Changelog

Log all changes in **[`UNRELEASED.md`](UNRELEASED.md)** at the project root using [Keep a Changelog](https://keepachangelog.com/) format. Use the appropriate header:

- `### Added` — new features or tools
- `### Changed` — changes to existing functionality
- `### Fixed` — bug fixes
- `### Removed` — removed features
- `### Security` — vulnerability fixes

> **Do not edit `CHANGELOG.md` directly** — it is assembled automatically during the release process.

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line
- Consider using conventional commits:
  - `feat:` - A new feature
  - `fix:` - A bug fix
  - `docs:` - Documentation changes
  - `style:` - Code style changes (formatting, semicolons, etc.)
  - `refactor:` - Code refactoring without feature changes
  - `perf:` - Performance improvements
  - `test:` - Adding or updating tests
  - `chore:` - Build process, dependencies, or tooling

## Submitting a Pull Request

1. **Ensure all checks pass:**

   ```bash
   npm run check   # Lint + typecheck
   ```

2. **Update documentation** — if your change affects user-facing behavior, update the README, help resources, or Wiki as appropriate
3. **Update `UNRELEASED.md`** with your change
4. **Commit** with a clear, descriptive message in conventional commit format. Reference issues when applicable (`Fixes #123`). Keep commits atomic — one logical change per commit.
5. **Push** to your fork and **open a Pull Request**

### What CI Will Check

When you open a PR, the following checks run automatically:

| Workflow           | What It Does                                 |
| ------------------ | -------------------------------------------- |
| **Lint & Compile** | ESLint, TypeScript strict-mode, Vite Build   |
| **CodeQL**         | Static analysis for security vulnerabilities |
| **Docker Scout**   | Container image vulnerability checks         |

All checks must pass before merge. Security steps **hard-fail on fixable issues** — this is intentional.

## Security

If you discover a security vulnerability, **do not** open a public issue. Please follow our [Security Policy](SECURITY.md) and report it to **admin@adamic.tech**.

When contributing code, follow these security practices:

- **No secrets in code** — use environment variables (`.env` files are gitignored) or Cloudflare Secrets mapping.
- **Typed error classes** with descriptive messages — don't expose internal details like server stack traces to end users over the frontend.

## Questions?

If you have questions or want to discuss a potential contribution, feel free to:

- Open an [issue](https://github.com/neverinfamous/R2-Manager-Worker/issues) for discussion
- Email **admin@adamic.tech**
