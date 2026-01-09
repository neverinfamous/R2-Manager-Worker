# Security Policy

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them by opening a security advisory in the repository. To do this:

1. Navigate to the [Security](https://github.com/neverinfamous/R2-Manager-Worker/security) tab
2. Click on "Report a vulnerability"
3. Fill out the form with details about the vulnerability

Or, if you prefer private communication, please email the maintainers directly.

## What to Include

When reporting a vulnerability, please include:

* Type of vulnerability (e.g., XSS, SQL injection, authentication bypass, etc.)
* Location of the vulnerable code (file path, line number if possible)
* A detailed description of the vulnerability
* Steps to reproduce (if applicable)
* Potential impact
* Suggested fix (if you have one)

## Security Practices

This project follows security best practices:

### Authentication & Authorization
- All API endpoints require valid Cloudflare Access JWT authentication
- JWT validation occurs on every authenticated request
- User context extracted from Cloudflare Access tokens (email-based)
- Authorization delegated to Cloudflare Access policies

### Data Protection
- No user data stored - all operations use Cloudflare R2 API directly
- File operations authenticated via Cloudflare Access
- Signed URLs for downloads use HMAC-SHA256
- Environment secrets managed via Wrangler and Cloudflare Workers secrets

### API Security
- CORS headers properly configured
- R2 API calls use properly formatted requests
- Object keys handled correctly (no encoding issues on Management API)
- Rate limiting handled by Cloudflare infrastructure

### Dependencies
- All dependencies regularly updated via Dependabot
- Automated security scanning via CodeQL
- Secrets scanning enabled to prevent credential leaks
- Supply chain security monitored

### Code Quality
- TypeScript for type safety
- ESLint configuration enforced
- Automated linting on pull requests
- Code review process for all changes

## Security Response Timeline

We aim to:
- Acknowledge receipt of vulnerability reports within 48 hours
- Provide an initial assessment within 1 week
- Release a fix as soon as possible (timeline depends on severity)
- Notify reporters when the fix is released

## Known Vulnerabilities

### CVE-2026-22184 (zlib - CRITICAL)

**Status:** Documented & Acknowledged | **Risk:** Not Exploitable in This Context

| Field | Value |
|-------|-------|
| Package | zlib 1.3.1-r2 (Alpine) |
| Severity | CRITICAL |
| Fix Available | No |
| Affected Component | Docker container base image |

**Why This Is Not Exploitable:**

R2 Bucket Manager's container does not:
- Process untrusted compressed data through zlib
- Accept arbitrary compressed input from users
- Use zlib for network protocol decompression

The zlib library is present in the Alpine base image but is not used in a way that exposes the vulnerability. This CVE requires an attacker to supply malicious compressed data, which is not possible in R2 Manager's architecture.

**Mitigation:**
- Monitoring for upstream fix from Alpine
- CVE is allowlisted in Docker security scan workflow
- Will be removed from allowlist when fix is available

---

## Security Updates

- Subscribe to release notifications to stay informed about security updates
- Follow the project for security advisories
- Check this file regularly for updates to security practices

## Known Security Considerations

### Cloudflare Access Dependency
- This application requires Cloudflare Access (Zero Trust) for authentication
- If Access policies are misconfigured, unauthorized access may occur
- Ensure your Access policies are properly configured as documented in README.md

### Static Assets
- The `/site.webmanifest` path bypasses Cloudflare Access to avoid CORS issues
- This is a design trade-off; this file is intended to be public
- Do not store sensitive information in static assets

### Development Environment
- Use strong API tokens and secrets (never commit them)
- Use `.env` files for local development (included in .gitignore)
- Use `wrangler secret put` for production secrets
- Review environment variables before deployment

## Security Headers

The application includes appropriate security headers:
- CORS headers for API endpoints
- Content-Type headers for proper content handling
- JWT validation on sensitive endpoints

## Dependency Security

This project uses:
- **Dependabot** for automatic dependency updates and security alerts
- **CodeQL** for static code analysis and vulnerability detection
- **Secrets Scanning** to prevent credential leaks
- **Automated testing** on pull requests

## Contributing Security Improvements

If you'd like to contribute security improvements:

1. Follow the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines
2. Document security improvements clearly in your PR
3. Ensure all tests pass
4. Get approval from maintainers before merging

## Acknowledgments

We appreciate security researchers who responsibly disclose vulnerabilities. Depending on the severity and impact, contributors may be recognized in:
- Security advisories
- Release notes
- Project documentation

Thank you for helping keep this project secure!
