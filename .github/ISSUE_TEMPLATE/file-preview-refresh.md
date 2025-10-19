---
name: "Bug: Preview pane does not refresh"
about: Track the fix for the preview pane not updating after file changes
labels: bug
assignees: ''
title: "Bug: Preview pane does not refresh after file add/delete"
---

## Summary
The bucket object preview pane shows stale content after uploading or deleting files. Switching buckets or reloading the page forces it to refresh, but the view should stay in sync automatically like list mode.

## Steps to reproduce
1. Log in to the R2 Manager UI.
2. Open any bucket in preview mode.
3. Upload a new image (or delete an existing one) using drag and drop or the upload button.

## Expected result
The preview pane updates immediately to show the new set of images without requiring a manual page refresh.

## Actual result
The preview pane continues to show the previous set of images until the entire page is reloaded. List mode reflects the correct state instantly.

## Environment
- Browser(s): _e.g., Chrome 124, Firefox 125_
- Build: Current `main`

## Notes
- List mode appears to consume a fresh bucket listing, so the bug is limited to preview-mode state management.
- Investigate whether the preview grid uses stale cached data or misses the object list refresh event.

## Acceptance criteria
- Preview mode updates to reflect object additions and deletions without a page reload.
- Automated or manual regression check ensures the fix does not break list mode updates.
