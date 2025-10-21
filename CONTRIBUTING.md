# Contributing to R2-Manager-Worker

First off, thank you for considering contributing to R2-Manager-Worker! It's people like you that make R2-Manager-Worker such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps which reproduce the problem** in as many details as possible
* **Provide specific examples to demonstrate the steps.** Include links to files or GitHub projects, or copy/pasteable snippets
* **Describe the behavior you observed after following the steps** and point out what exactly is the problem with that behavior
* **Explain which behavior you expected to see instead and why**
* **Include screenshots and animated GIFs** if possible
* **Include your environment** (OS, Node version, Browser, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a step-by-step description of the suggested enhancement** in as many details as possible
* **Provide specific examples to demonstrate the steps**
* **Describe the current behavior** and **the expected behavior**
* **Explain why this enhancement would be useful**

### Pull Requests

* Follow the [TypeScript](#typescript-styleguide) and [CSS](#css-styleguide) styleguides
* Include appropriate test cases for new features
* Document new code based on the [Documentation Styleguide](#documentation-styleguide)
* End all files with a newline

## Development Setup

### Prerequisites

* Node.js 20+ or 25+
* npm 10+

### Local Development

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR-USERNAME/R2-Manager-Worker.git
   cd R2-Manager-Worker
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/neverinfamous/R2-Manager-Worker.git
   ```
4. Create a branch for your changes:
   ```bash
   git checkout -b fix/issue-name
   ```
5. Install dependencies:
   ```bash
   npm install
   ```

### Running the Development Server

**Frontend:**
```bash
npm run dev
# Open http://localhost:5173
```

**Worker (requires local .env with VITE_WORKER_API):**
```bash
npx wrangler dev
# Open http://localhost:8787
```

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## Styleguides

### TypeScript Styleguide

* Use semicolons
* Use 2-space indentation
* Use `const` by default, `let` only when reassignment is necessary
* Use meaningful variable names (avoid single letters except for loops)
* Use type annotations for function parameters and return types
* Use interfaces over types for object shapes
* Comment complex logic and non-obvious code

Example:
```typescript
interface User {
  email: string;
  id: string;
}

const getUser = async (id: string): Promise<User> => {
  // Fetch user from API
  const response = await fetch(`/api/users/${id}`);
  return response.json();
};
```

### CSS Styleguide

* Use CSS modules or scoped styles when possible
* Use meaningful class names (BEM notation recommended)
* Mobile-first approach for responsive design
* Use CSS custom properties for colors and spacing
* Group related properties together

Example:
```css
.file-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.file-grid__item {
  padding: 1rem;
  border: 1px solid var(--color-border);
}
```

### Documentation Styleguide

* Use Markdown
* Reference functions and files with backticks (`` `functionName` ``)
* Use clear headings and sections
* Include code examples for complex features
* Keep language clear and concise

## Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line
* Consider using conventional commits:
  - `feat:` - A new feature
  - `fix:` - A bug fix
  - `docs:` - Documentation changes
  - `style:` - Code style changes (formatting, semicolons, etc.)
  - `refactor:` - Code refactoring without feature changes
  - `perf:` - Performance improvements
  - `test:` - Adding or updating tests
  - `chore:` - Build process, dependencies, or tooling

Example:
```
feat: add file transfer progress tracking

- Implement onProgress callback in API service
- Add progress bar to UI
- Update transfer state management

Fixes #123
```

## Pull Request Process

1. Update the README.md with details of changes to the interface, if applicable
2. Update the worker/schema.sql if there are database changes
3. Ensure all tests pass and linting shows no errors:
   ```bash
   npm run lint
   ```
4. Request review from maintainers
5. Address any review comments
6. Ensure your branch is up to date with `main`:
   ```bash
   git fetch upstream
   git rebase upstream/main
   git push --force-with-lease
   ```

## Additional Notes

### Issue and Pull Request Labels

* `bug` - Something isn't working
* `enhancement` - New feature or request
* `documentation` - Improvements or additions to documentation
* `good first issue` - Good for newcomers
* `help wanted` - Extra attention is needed
* `question` - Further information is requested
* `wontfix` - This will not be worked on

### Recognition

Contributors will be recognized in:
* Pull Request merge messages
* Release notes
* Project README (for significant contributions)

## Questions?

Feel free to open an issue with the `question` label or reach out to the maintainers.

Thank you for contributing! 🎉
