# GitHub Configuration

This directory contains GitHub-specific configuration files and workflows for the R2-Manager-Worker project.

## 📋 Structure

### Community Standards
- **[CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)** - Community guidelines and expected behavior
- **[CONTRIBUTING.md](../CONTRIBUTING.md)** - Guide for contributing to the project
- **[SECURITY.md](../SECURITY.md)** - Security policy and vulnerability reporting
- **[LICENSE](../LICENSE)** - MIT License

### Issue Templates
Located in `ISSUE_TEMPLATE/`:
- **bug_report.md** - Template for reporting bugs
- **feature_request.md** - Template for requesting new features
- **documentation.md** - Template for documentation improvements

### Pull Request Template
- **PULL_REQUEST_TEMPLATE.md** - Template for submitting pull requests

### Workflows
Located in `workflows/`:

#### **codeql.yml**
- Static code analysis using GitHub CodeQL
- Scans for common security vulnerabilities
- Runs on push to `main`, PRs to `main`, and weekly schedule
- Results available in Security → Code scanning alerts

#### **lint-and-test.yml**
- Runs ESLint on TypeScript/JavaScript code
- Tests against Node.js 20.x and 25.x
- Builds frontend and worker bundles
- Runs npm audit for security vulnerabilities

#### **dependabot-auto-merge.yml**
- Automatically merges Dependabot PRs for patch and minor versions
- Requires manual review for major version updates
- Uses squash merging strategy

#### **secrets-scanning.yml**
- TruffleHog for secret detection
- Gitleaks for additional secret scanning
- Runs on all pushes and pull requests

### Dependency Management
- **dependabot.yml** - Configuration for Dependabot
  - Updates npm dependencies weekly
  - Updates GitHub Actions weekly
  - Auto-merging enabled for patch/minor versions
  - Labels PRs for organization

## 🚀 GitHub Actions

### Branch Protection Rules
Recommended branch protection rules for `main`:
- ✅ Require pull request reviews before merging (1 approval)
- ✅ Require status checks to pass before merging
  - `Lint and Test (20.x)`
  - `Lint and Test (25.x)`
  - `CodeQL`
  - `TruffleHog Secret Scanning`
  - `GITLEAKS Secret Scanning`
- ✅ Require branches to be up to date before merging
- ✅ Include administrators in restrictions (recommended)

### Enabling GitHub Advanced Security
For enhanced security features, enable GitHub Advanced Security:
1. Go to Settings → Security & Analysis
2. Enable:
   - ✅ Dependency graph
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Secret scanning
   - ✅ Code scanning (CodeQL)

## 📊 Monitoring & Alerts

### Security Alerts
- **Dependabot Alerts** - Vulnerability notifications for dependencies
- **Secret Scanning** - Alerts when secrets are detected
- **CodeQL Alerts** - Static analysis security findings

### Workflows Status
- View workflow runs: Actions → All workflows
- View deployment status: Deployments
- View security findings: Security tab

## 🔧 Secrets Configuration

### Required Secrets (if using enhanced scanning)
```
GITLEAKS_LICENSE         # Optional: Gitleaks Enterprise license
GITHUB_TOKEN             # Automatically provided by GitHub Actions
```

These are managed in Settings → Secrets and variables → Actions

## 📝 Commit Message Convention

The project uses conventional commits:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style
- `refactor:` - Refactoring
- `perf:` - Performance
- `test:` - Tests
- `chore:` - Build/tooling
- `ci:` - CI/CD

Example:
```
feat: add file transfer progress tracking

- Implement onProgress callback
- Add progress bar to UI

Fixes #123
```

## 🔄 Workflows Execution

### Triggers
| Workflow | Trigger |
|----------|---------|
| CodeQL | Push to `main`, PRs to `main`, weekly schedule |
| Lint and Test | Push to `main`, PRs to `main` |
| Dependabot Auto-Merge | Dependabot PRs |
| Secret Scanning | Push to any branch, PRs to `main` |

### Manual Runs
Some workflows support manual execution via GitHub UI (Actions tab).

## 📚 Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Dependabot Documentation](https://docs.github.com/en/code-security/dependabot)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Branch Protection Rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

## ✅ Community Standards Checklist

This repository has been configured with:
- ✅ License (MIT)
- ✅ Code of Conduct
- ✅ Contributing Guidelines
- ✅ Security Policy
- ✅ Issue Templates
- ✅ Pull Request Template
- ✅ Code Scanning (CodeQL)
- ✅ Secret Scanning
- ✅ Dependabot Configuration
- ✅ Automated Testing
- ✅ Status Checks

## 🤝 Contributing

For contribution guidelines, see [CONTRIBUTING.md](../CONTRIBUTING.md).

For security concerns, see [SECURITY.md](../SECURITY.md).

## 📝 Notes

- GitHub Actions runs are free for public repositories
- All workflows respect branch protection rules
- Secret scanning is enabled by default on public repositories
- Dependabot alerts are sent to repository watchers
