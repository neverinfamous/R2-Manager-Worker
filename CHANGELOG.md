# Changelog

All notable changes to this project are documented in this file.
This changelog is auto-generated from Git history using [lib-git-history](https://github.com/neverinfamous/adamic).

## [Unreleased]

### Bug Fixes

- harden origin validation and prevent local dev auth bypass by **Chris** ([fa48ef9](https://github.com/neverinfamous/R2-Manager-Worker/commit/fa48ef9665e36b3cfe102a093d4751a24c378e59))

## [v3.5.8]

### Code Quality

- --- product: "R2-Manager-Worker" version: "3.5.8" date: "2026-10-30" slug: "v3.5.8-release-notes" docker_image: "writenotenow/r2-bucket-manager" github_repo: "neverinfamous/R2-Manager-Worker" description: "Dependency refresh and a hardened Docker image with near-zero known vulnerabilities." --- # R2-Manager-Worker v3.5.8 ## Highlights; **Hardened Container**: The Docker image drops from 24 known vulnerabilities, including 2 critical, to a single unrated `musl` finding that awaits an upstream Alpine fix.; **Fresh Stack**: React 19.3, Vite 8.3, Wrangler 4.156, and updated tooling keep the app current.; **Safer View Preference**: A corrupted saved view setting now falls back to the list view instead of breaking the file grid. ## Changed; **deps**: Updated all runtime and development dependencies and refreshed security overrides for `undici`, `ip-address`, `brace-expansion`, `picomatch`, and `flatted`.; **ci**: Refreshed pinned GitHub Actions to their latest releases and pinned all runners to `ubuntu-24.04`.; **docs**: Added GitHub and Docker Pulls badges to the README files. ## Fixed; **filegrid**: Validate the saved view mode instead of casting it, so an invalid stored value no longer leaks into the UI state. ## Security; **docker**: Patched `undici` and `postcss-selector-parser` bundled inside npm, and upgraded OpenSSL, zlib, and musl in the runtime image.; **deps**: Raised `undici` to 7.30.1, clearing the open Dependabot alerts. ## Install ```bash docker pull writenotenow/r2-bucket-manager:v3.5.8 ``` [Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/compare/v3.5.7...v3.5.8) by **Chris LeRoux** ([2beb8f1](https://github.com/neverinfamous/R2-Manager-Worker/commit/2beb8f118eb20b4e14472bfabb187a37596d4028))

## [v3.5.7]

### Code Quality

- --- product: "R2-Manager-Worker" version: "3.5.7" date: "2026-08-19" slug: "v3.5.7-release-notes" github_repo: "neverinfamous/R2-Manager-Worker" description: "Security updates, pnpm migration, and deterministic CI pipelines." --- # R2-Manager-Worker v3.5.7 ## Highlights; **Fast & Deterministic Builds**: Migrated the package manager from `npm` to `pnpm` for faster dependency resolution and stricter module boundaries.; **Supply Chain Security**: Hardened GitHub Actions workflows by pinning all external actions to explicit commit SHAs, preventing upstream supply chain attacks.; **Dependency Hardening**: Updated all runtime dependencies and applied targeted overrides to transitive CLI dependencies to resolve known vulnerabilities. ## Changed; **deps**: Migrated project from npm to pnpm to improve speed and consistency.; **ci**: Pinned GitHub Actions by SHA for tamper-proof CI workflows.; **docs**: Standardized release notes naming convention and formatting. ## Security; **deps**: Updated dependencies and applied security patches to eliminate transitive vulnerabilities in Docker builds. ## Install ```bash git clone https://github.com/neverinfamous/R2-Manager-Worker.git git checkout v3.5.7 ``` [Full Changelog](https://github.com/neverinfamous/R2-Manager-Worker/compare/v3.5.6...v3.5.7) by **Chris LeRoux** ([cac9664](https://github.com/neverinfamous/R2-Manager-Worker/commit/cac966477ebc4bb511fbf1b5ef3bbe63767958f1))

## [v3.5.6]

### Bug Fixes

- Resolve vulnerabilities in tar, brace-expansion, and ip-address by **Chris** ([fccf550](https://github.com/neverinfamous/R2-Manager-Worker/commit/fccf5508c5054f503890af457eb42b6c444a7d1d))

### Code Quality

- --- product: "R2 Manager Worker" version: "3.5.6" date: "2026-08-17" slug: "v3.5.6" npm_package: "" github_repo: "neverinfamous/R2-Manager-Worker" docker_image: "writenotenow/r2-bucket-manager:3.5.6" description: "Resolves CI/CD Node.js 20 deprecation warnings." --- # R2 Manager Worker v3.5.6 ## Changed * **CI/CD:** Upgraded `pnpm/action-setup` to v6 to permanently resolve Node.js 20 runner deprecation warnings across all workflows. by **Chris** ([9a92550](https://github.com/neverinfamous/R2-Manager-Worker/commit/9a9255044ebff73d78d5a8d0012856a788936ed2))

## [v3.5.5]

### Bug Fixes

- migrate github actions to use pnpm and fix cache lookup by **Chris** ([1f3e79a](https://github.com/neverinfamous/R2-Manager-Worker/commit/1f3e79ad1b28965da7e43c97448c5008cda2be45))
- resolve accessibility issues in webhook dialogs by **Chris** ([1b70b03](https://github.com/neverinfamous/R2-Manager-Worker/commit/1b70b03978c197440023ba74cea10b50ab0546fc))

### Code Quality

- --- product: "R2 Manager Worker" version: "3.5.5" date: "2026-08-17" slug: "r2-manager-worker-v3-5-5" npm_package: "r2" docker_image: "ghcr.io/neverinfamous/r2-manager-worker" github_repo: "neverinfamous/R2-Manager-Worker" description: "Resolve Webhook accessibility issues, migrate to pnpm, and pin GitHub Actions by SHA." --- # R2 Manager Worker v3.5.5 ## Highlights; **Enhanced Accessibility**: Improved Webhook configuration dialogs to fully comply with W3C standards, ensuring a seamless experience for screen readers and keyboard navigation.; **Robust Supply Chain Security**: Migrated the package manager from `npm` to `pnpm` for faster, deterministic builds, and pinned all GitHub Actions to their exact SHA digests to prevent unauthorized pipeline tampering. ## Changed; **deps**: Converted project from `npm` to `pnpm` for stricter dependency resolution.; **deps**: Pinned GitHub Actions in `.github/workflows/` to exact SHA digests to secure CI/CD pipelines. ## Fixed; **ui**: Resolved `<label>` accessibility issues in Webhook Add and Edit dialogs by implementing semantic `<fieldset>` and `<legend>` grouping. by **Chris** ([65c42aa](https://github.com/neverinfamous/R2-Manager-Worker/commit/65c42aab0e6f59487d7a147ce6da84be6cfc0100))

## [v3.4.1]

### Bug Fixes

- patch Docker minimatch CVE-2026-27904, CVE-2026-27903 by **Chris LeRoux** (with Temp) ([a8900fb](https://github.com/neverinfamous/R2-Manager-Worker/commit/a8900fba468c89b9dc34f2592caef08d894adbcb))
- update Dockerfile tar patch from 7.5.7 to 7.5.8 (CVE-2026-26960) (#236) by **Chris LeRoux** (with Temp) ([9d68f96](https://github.com/neverinfamous/R2-Manager-Worker/commit/9d68f966d64814b2f7d5c5c60031dc2205a16c6b))

## [v3.3.0]

### Features

- finalize Object Lifecycle Management feature by **Temp** ([92b5f0b](https://github.com/neverinfamous/R2-Manager-Worker/commit/92b5f0bde0c006d99e5b70775be9c080e4a3b1e1))
- integrate lifecycle panel into bucket list/grid views by **Temp** ([3ab0fcb](https://github.com/neverinfamous/R2-Manager-Worker/commit/3ab0fcb58e570bf24c941829e6e92a61ef441bc3))
- add lifecycle management frontend components by **Temp** ([fc6b158](https://github.com/neverinfamous/R2-Manager-Worker/commit/fc6b15858b5ef18fd1aaa2522e7db1ee17a4909c))
- add Object Lifecycle Management API by **Temp** ([4dd3b66](https://github.com/neverinfamous/R2-Manager-Worker/commit/4dd3b66d7075b453ce835124d2fdbc96cb4abb59))
- Enhanced Metrics Dashboard with Storage Tab and bucket filtering by **Temp** ([a1c9f30](https://github.com/neverinfamous/R2-Manager-Worker/commit/a1c9f302e1a6b988594f6e6b428ee80359cc63a5))
- Add support email to all API error responses by **Temp** ([e97ba2c](https://github.com/neverinfamous/R2-Manager-Worker/commit/e97ba2cbef8e8e67ff38ea93d7ea100b107f5521))
- add 6 new webhook events for R2 operations (file_move, file_copy, file_rename, folder_create, folder_delete, bucket_rename) by **Temp** ([3a27aa1](https://github.com/neverinfamous/R2-Manager-Worker/commit/3a27aa1a2e1ac7f071451a66fc196e9d20a39e19))

### Bug Fixes

- normalize existing lifecycle rules - convert maxAge from seconds to days by **Temp** ([096f37b](https://github.com/neverinfamous/R2-Manager-Worker/commit/096f37b750648b82a59dacd6d1f34ca88fcb5b74))
- update worker lifecycle types to match Cloudflare API format by **Temp** ([5c3840f](https://github.com/neverinfamous/R2-Manager-Worker/commit/5c3840fd9e7b5aef2d7bb9a7363c4f5eeea2865b))
- use correct Cloudflare REST API format for lifecycle rules by **Temp** ([74645f4](https://github.com/neverinfamous/R2-Manager-Worker/commit/74645f4d871750312eb40b1b7a2fd8e7cae1e0b8))
- resolve 4 CodeQL code scanning alerts by **Temp** ([772b430](https://github.com/neverinfamous/R2-Manager-Worker/commit/772b4305c4fe49268605749cb2f0b8c217f25ccf))
- Add CVE-2026-22184 to allowlist for Docker security scan by **Temp** ([556b886](https://github.com/neverinfamous/R2-Manager-Worker/commit/556b88673561b5c4ff8639ce314c68ec094d8873))
- AI Search integration and rate limit increase by **Temp** ([568813d](https://github.com/neverinfamous/R2-Manager-Worker/commit/568813deee5b34468b6e408e84a27518f4192672))
- AI Search integration - sync, queries, instance status, and response parsing by **Temp** ([2c059c5](https://github.com/neverinfamous/R2-Manager-Worker/commit/2c059c5deeb792064b73d78d1af22a8c2a5ace37))
- Docker Scout vulnerability check parsing by **Temp** ([59fbbaf](https://github.com/neverinfamous/R2-Manager-Worker/commit/59fbbafa5e384179168a73e26a11296be44aa5d2))
- local development issues for Metrics, Webhooks, and URL signing by **Temp** ([08a8c38](https://github.com/neverinfamous/R2-Manager-Worker/commit/08a8c382e4bf9c283e1bf37f923e4152333d46ae))

## [v1.2.0]

### Features

- add production environment tracking to deployment workflows by **Temp** ([435b498](https://github.com/neverinfamous/R2-Manager-Worker/commit/435b498a3328f287033f2d8db1c1e86579195f49))

### Bug Fixes

- suppress ESLint fast-refresh warning for ThemeContext by **Temp** ([88a02e0](https://github.com/neverinfamous/R2-Manager-Worker/commit/88a02e04c889c61ad6d10e5496f11c0df54ace7f))
- resolve TypeScript linting errors for CORS headers by **Temp** ([1470f08](https://github.com/neverinfamous/R2-Manager-Worker/commit/1470f08590d6f3251ee60940dae69a6fee369223))

## [v1.0]

### Features

- Comprehensive Folder Management for R2 Buckets (#43) by **Chris LeRoux** ([edc26b5](https://github.com/neverinfamous/R2-Manager-Worker/commit/edc26b5c5f6150d3494f8607e09bf40883966a75))
- Combine Preview/List buttons into single toggle (#37) by **Chris LeRoux** ([8d1944d](https://github.com/neverinfamous/R2-Manager-Worker/commit/8d1944d87a00e709da61086fdf5ab733374b5e4d))
- make application configurable for any Cloudflare account by **Temp** ([93576e3](https://github.com/neverinfamous/R2-Manager-Worker/commit/93576e35cabf06bd241dd9cd72a18a0df2d92192))
- Add MIT License by **Chris LeRoux** ([180c6ec](https://github.com/neverinfamous/R2-Manager-Worker/commit/180c6ec52946bed6472aea46b351a9beef6f9439))
- Add FileGrid component back to show files when bucket is selected by **Temp** ([913b51d](https://github.com/neverinfamous/R2-Manager-Worker/commit/913b51d6248f714b3b020b43cf0306bf0d67b849))
- **[BREAKING]** implement Cloudflare Zero Trust GitHub SSO authentication by **Temp** ([159d6bb](https://github.com/neverinfamous/R2-Manager-Worker/commit/159d6bbd08e5147bd8e40be434736ebea364b8ee))
- upgrade Vite from 5.4.20 to 7.1.10 with @vitejs/plugin-react 5.0.4 by **Temp** ([299848d](https://github.com/neverinfamous/R2-Manager-Worker/commit/299848def1ee8e121d127554d63da66a5c006786))
- upgrade React from 18.3.1 to 19.2.0 with React 19 compatibility fixes by **Temp** ([91bc1a0](https://github.com/neverinfamous/R2-Manager-Worker/commit/91bc1a02e47fa64746c663bfd067d56bad7bd96f))
- change 'Successfully moved' notification background from red to green by **Temp** ([2eb6fe4](https://github.com/neverinfamous/R2-Manager-Worker/commit/2eb6fe4c18dd37c6e99548c8e93e1ec285bc0743))
- implement Electron desktop app with native file opening by **Temp** ([276bbc3](https://github.com/neverinfamous/R2-Manager-Worker/commit/276bbc31c3b8afe6fa24ed0829b51556d341c158))
- implement open files natively feature (issue #13) - Option A by **Temp** ([0752adf](https://github.com/neverinfamous/R2-Manager-Worker/commit/0752adf8c238f0625bd0d2bc63cd04a876379a8c))
- Add native file opening with context menu and Electron/Tauri support by **Temp** ([e2af96e](https://github.com/neverinfamous/R2-Manager-Worker/commit/e2af96e1bb7e53c3d869a44d1e42dfb1f0d92099))
- add total bucket size metric to bucket list display by **Temp** ([7acbb15](https://github.com/neverinfamous/R2-Manager-Worker/commit/7acbb157c011e1eaf4fdc2bedfc2f954e4e2faf2))
- implement move files between R2 buckets feature (#12) by **Temp** ([c1e5a9c](https://github.com/neverinfamous/R2-Manager-Worker/commit/c1e5a9c7674d2205a30482166917b099cd6f5083))
- Implement full bucket rename workflow with copy and delete by **Temp** ([395f726](https://github.com/neverinfamous/R2-Manager-Worker/commit/395f726b3b485fb240a28c09d099c0fd29d9efcf))
- Issue #10 - Add bucket rename UI with validation and error handling by **Temp** ([7e38858](https://github.com/neverinfamous/R2-Manager-Worker/commit/7e38858709745c02ff7459b47a055fbb952f7cbc))

### Bug Fixes

- remove unnecessary escape characters in regex patterns by **Temp** ([22c9f9e](https://github.com/neverinfamous/R2-Manager-Worker/commit/22c9f9e9689831a9ddac7a82954a64739ed997d7))
- add explicit permissions block to secrets-scanning workflow (CodeQL actions/missing-workflow-permissions) by **Temp** ([8655f03](https://github.com/neverinfamous/R2-Manager-Worker/commit/8655f038482009360c3c585311d471d6dccfcaa4))
- add explicit permissions block to workflow (CodeQL actions/missing-workflow-permissions) by **Temp** ([0e91306](https://github.com/neverinfamous/R2-Manager-Worker/commit/0e9130648534e16e0e726210bd6b1bcff20b9988))
- remove error details from API responses to prevent information exposure (CodeQL js/stack-trace-exposure) by **Temp** ([7634717](https://github.com/neverinfamous/R2-Manager-Worker/commit/763471748a7ba884e193fa0bc4c1ef4b8c1bc427))
- Update TruffleHog to use proper base commit on push events by **Chris LeRoux** ([25c0153](https://github.com/neverinfamous/R2-Manager-Worker/commit/25c0153f2ae36b381f3e81c0195606b0be61a4cd))
- Configure CodeQL to work with GitHub's default setup properly by **Chris LeRoux** ([b12e3dc](https://github.com/neverinfamous/R2-Manager-Worker/commit/b12e3dc8e9df7e795a076ea3029140fe9998914c))
- Update wrangler command from publish to deploy for dry-run validation by **Chris LeRoux** ([8acb6db](https://github.com/neverinfamous/R2-Manager-Worker/commit/8acb6db5ede70287c72e32f07bda937f085cede6))
- Remove category parameter from CodeQL to fix SARIF processing error by **Chris LeRoux** ([7148b6a](https://github.com/neverinfamous/R2-Manager-Worker/commit/7148b6a8886ab7ef69e5ba5be8c6f3ff45eef0fe))
- Update Vite to 7.1.11 to address CVE-2025-30208 server.fs.deny bypass vulnerability by **Temp** ([4865be0](https://github.com/neverinfamous/R2-Manager-Worker/commit/4865be09b085429cae64bb6c2fc5ef4581a41c70))
- Serve site.webmanifest directly to avoid Cloudflare Access CORS blocks by **Temp** ([323137a](https://github.com/neverinfamous/R2-Manager-Worker/commit/323137a96ed524275c22ca56b7e7c1e86ad497ec))
- Remove bucket_owners insert from create bucket endpoint by **Temp** ([d79c317](https://github.com/neverinfamous/R2-Manager-Worker/commit/d79c31711e5e0521768162ae67155fe4614e3d8e))
- Remove bucket ownership check from delete endpoint by **Temp** ([39c2a6a](https://github.com/neverinfamous/R2-Manager-Worker/commit/39c2a6aec18b9b5a22e40e519eb887bcc2d43c82))
- Remove destination bucket ownership check from move file endpoint by **Temp** ([79d80b6](https://github.com/neverinfamous/R2-Manager-Worker/commit/79d80b60e6b15e22cb4d656e7c90526793462120))
- Clean up header layout and remove duplicate logout button by **Temp** ([e41f94c](https://github.com/neverinfamous/R2-Manager-Worker/commit/e41f94ce436083d12bd0b5b37608b66329a89902))
- Hide bucket list and form when bucket is selected by **Temp** ([9445d22](https://github.com/neverinfamous/R2-Manager-Worker/commit/9445d22e464e092e9d56cde893ee82ffce2a1c43))
- Remove Auth import and fix handleLogout for Zero Trust by **Temp** ([c1d0bca](https://github.com/neverinfamous/R2-Manager-Worker/commit/c1d0bca92234f708d134837b4c687fadbce0f89c))
- Properly hide bucket list and form when viewing bucket files by **Temp** ([d97ad7b](https://github.com/neverinfamous/R2-Manager-Worker/commit/d97ad7bc8e52966eb393756b30d72572b581c3c7))
- Hide create bucket form when viewing bucket contents by **Temp** ([b2694d7](https://github.com/neverinfamous/R2-Manager-Worker/commit/b2694d76fab018d9e15929bbac482a1bb368c33d))
- Show FileGrid conditionally and add back button by **Temp** ([36e0d16](https://github.com/neverinfamous/R2-Manager-Worker/commit/36e0d16caad33f2d06034c6709e4678cc07940ec))
- Remove file listing ownership checks and improve UI layout by **Temp** ([d7efb9e](https://github.com/neverinfamous/R2-Manager-Worker/commit/d7efb9e3e1342d135f8d0a875748a3b853ee7d97))
- Disable all ownership checks for Zero Trust authenticated users by **Temp** ([087bf07](https://github.com/neverinfamous/R2-Manager-Worker/commit/087bf0757df8aab9faf73440e991f0c970c735fa))
- Remove ownership checks and hide system buckets for Zero Trust users by **Temp** ([bc0bb00](https://github.com/neverinfamous/R2-Manager-Worker/commit/bc0bb00f561c52c5cd41f87c70aa1a1365e0bb86))
- Show all R2 buckets to Zero Trust authenticated users by **Temp** ([4454367](https://github.com/neverinfamous/R2-Manager-Worker/commit/4454367e0aa0105478a765385f0aed477ba3b5ab))
- Extract JWT from cookies for Cloudflare Access integration by **Temp** ([babb246](https://github.com/neverinfamous/R2-Manager-Worker/commit/babb246e124811bd72d8485722ba3ffa830b90fe))
- add debugging and improve Electron detection in preload/API by **Temp** ([0d1e67c](https://github.com/neverinfamous/R2-Manager-Worker/commit/0d1e67c149e49cf560ff36ac80fcee7ac196c60b))
- move download handler setup before window creation by **Temp** ([34b8298](https://github.com/neverinfamous/R2-Manager-Worker/commit/34b829811df028e6144ee3b334d0bf651c3baa36))
- resolve linting errors in electron/main.ts by **Temp** ([4dd0c18](https://github.com/neverinfamous/R2-Manager-Worker/commit/4dd0c188d0ced82d9cd5de8953c4b29f27c7974b))
- add dual approach for opening files in Electron with debugging by **Temp** ([da40f0b](https://github.com/neverinfamous/R2-Manager-Worker/commit/da40f0b6d471d4ba28cc1ae4a9b1088fad072b51))
- implement proper Electron download handler for native file opening by **Temp** ([f1351cc](https://github.com/neverinfamous/R2-Manager-Worker/commit/f1351ccc8c9303650eb962ae77de7dc5236a552a))
- resolve TypeScript error in app.tsx file rejection type by **Temp** ([4f51f32](https://github.com/neverinfamous/R2-Manager-Worker/commit/4f51f32e77b6af14cb77d344af94890f94f0e7c8))
- Handle token in new login response format by **Temp** ([3b2606b](https://github.com/neverinfamous/R2-Manager-Worker/commit/3b2606be3f8ef79076fde0a4e899d1fd6ea49389))
- Include auth token in login response for CORS compatibility by **Temp** ([297abee](https://github.com/neverinfamous/R2-Manager-Worker/commit/297abeecdf118dae9655456a3fc4b54ba7be7f91))
- Add better error logging to listBuckets by **Temp** ([7d2ce9f](https://github.com/neverinfamous/R2-Manager-Worker/commit/7d2ce9f216731be6b82e4de9910917741440d876))
- Handle cookie-based auth when no token in response by **Temp** ([a2c15f8](https://github.com/neverinfamous/R2-Manager-Worker/commit/a2c15f80701dc9cfc71f960bed9b77e516d8acd5))
- Resolve all linting errors in feature branch by **Temp** ([f030ca7](https://github.com/neverinfamous/R2-Manager-Worker/commit/f030ca739b650a91bd56df553a9c55a966b0d711))
- handle file keys with slashes in move endpoint by **Temp** ([7817228](https://github.com/neverinfamous/R2-Manager-Worker/commit/781722837e076a18b657d51f3a717b4c80c7eca6))
- open move dialog when Move Selected button is clicked by **Temp** ([87c800e](https://github.com/neverinfamous/R2-Manager-Worker/commit/87c800e5bc7e7cd6534435097be72247f045eb34))
- Clean up linting errors in bucket rename handler by **Temp** ([ffd4076](https://github.com/neverinfamous/R2-Manager-Worker/commit/ffd4076dde68adfaa429e2eb4e53d68066e2d52f))
- Move PATCH handler to correct scope to fix TypeScript error by **Temp** ([450c48f](https://github.com/neverinfamous/R2-Manager-Worker/commit/450c48f00f7fe7defe84274a1b38c89e44be0d00))
- Improve non-empty bucket error detection by **Temp** ([ac0882c](https://github.com/neverinfamous/R2-Manager-Worker/commit/ac0882ce340f47e4cf58281451df1784b82f70f7))
- Correct force delete API endpoints and response parsing by **Temp** ([f1a1e80](https://github.com/neverinfamous/R2-Manager-Worker/commit/f1a1e80cc2975a966e9df916a35530752b7320fc))
- Improve API error response handling for bucket deletion by **Temp** ([ef28db9](https://github.com/neverinfamous/R2-Manager-Worker/commit/ef28db9e01bccfad46eb96ed94d50319cf443179))
- Improve bucket deletion response handling for 204 status by **Temp** ([646b7c0](https://github.com/neverinfamous/R2-Manager-Worker/commit/646b7c06d3561e654cd05c0c1790565f3447f20d))
- Force delete bucket response handling by **Temp** ([f33364f](https://github.com/neverinfamous/R2-Manager-Worker/commit/f33364fc3f0db1e0a2d46ee22fe5152abb07d7e5))
- add wrangler build configuration and simplify workflow by **Temp** ([e1bbdf7](https://github.com/neverinfamous/R2-Manager-Worker/commit/e1bbdf78504f0060f2ec856cf3f555a62ed86977))
- use official cloudflare/wrangler-action for proper authentication by **Temp** ([07fcf37](https://github.com/neverinfamous/R2-Manager-Worker/commit/07fcf373d927daaa71925c16d0c51ae55d4292ab))
- update CI/CD workflow to use existing GitHub secrets by **Temp** ([b8f4df0](https://github.com/neverinfamous/R2-Manager-Worker/commit/b8f4df07eac670092101962f240b9e412dc3580f))
- remove unsupported single_page_app field from wrangler.toml by **Temp** ([9648a02](https://github.com/neverinfamous/R2-Manager-Worker/commit/9648a02f8db12ad2d1d34303c2f381e9c3ef41bb))
- update wrangler config and add CI/CD deployment workflow by **Temp** ([93640a2](https://github.com/neverinfamous/R2-Manager-Worker/commit/93640a2dc273226a881ea10ca1f1bac52146ed93))
