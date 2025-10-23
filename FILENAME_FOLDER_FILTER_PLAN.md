# Filename/Folder Filter Implementation Plan

**Project:** R2 Bucket Manager for Cloudflare  
**Feature:** Add client-side filtering for filenames and folder names via text input  
**Date:** October 23, 2025  
**Status:** Planning Phase

---

## 1. Problem Statement

Users need the ability to quickly filter and search through files and folders in large buckets without relying on server-side queries. The current UI lacks a search/filter mechanism, making it difficult to locate specific items when dealing with hundreds or thousands of files.

### Hard Constraint
- The toolbar (`.file-actions-bar`) is already full when files/folders are selected
- Screenshot shows buttons like "Download Selected", "Transfer", "Delete Selected", "Deselect All", "Jump to Bucket", sort controls, and view mode toggle all in one horizontal row
- Adding a filter input to this row would cause overflow and poor UX on smaller screens

---

## 2. Proposed Solution

### **Dedicated Filter Bar**

Add a **separate, persistent filter bar** positioned directly above the current action toolbar. This provides:

1. **Clear visual separation** between filtering (search/discovery) and actions (operations)
2. **Always visible** - users can filter even when no items are selected
3. **No layout conflicts** - doesn't compete with action buttons for space
4. **Mobile-friendly** - can stack naturally on smaller screens
5. **Room for enhancement** - can add filter type toggles, clear button, match counter, etc.

#### Layout Structure:
```
┌─────────────────────────────────────────────────────────┐
│ [🔍 Search]  [Filter by: All ▼]  [Clear]   [23 matches] │ ← NEW FILTER BAR
├─────────────────────────────────────────────────────────┤
│ Selected: 3 files | [Download] [Transfer▼] [Delete]... │ ← EXISTING ACTION BAR
└─────────────────────────────────────────────────────────┘
```

#### Visual Design:
- **Height:** ~44-48px (similar to action bar)
- **Background:** Slightly different shade than action bar (e.g., `var(--bg-tertiary)`) to distinguish purpose
- **Border:** Bottom border to separate from action bar
- **Icon:** Search/filter icon (🔍) prepended to input
- **Responsive:** On mobile, takes full width and stacks above everything

---

## 3. Recommended Implementation

### 3.1 UI Components

#### Filter Bar Container
```tsx
<div className="filter-bar">
  <div className="filter-input-container">
    <svg className="filter-icon">{/* Search icon */}</svg>
    <input
      type="text"
      placeholder="Filter files and folders..."
      value={filterText}
      onChange={(e) => setFilterText(e.target.value)}
      className="filter-input"
    />
    {filterText && (
      <button 
        className="filter-clear-button"
        onClick={() => setFilterText('')}
        title="Clear filter"
      >
        ✕
      </button>
    )}
  </div>
  
  <div className="filter-controls">
    <select 
      className="filter-type-select"
      value={filterType}
      onChange={(e) => setFilterType(e.target.value)}
    >
      <option value="all">All</option>
      <option value="files">Files Only</option>
      <option value="folders">Folders Only</option>
    </select>
    
    {filteredCount !== totalCount && (
      <span className="filter-match-count">
        {filteredCount} of {totalCount}
      </span>
    )}
  </div>
</div>
```

#### State Management
```tsx
const [filterText, setFilterText] = useState<string>('')
const [filterType, setFilterType] = useState<'all' | 'files' | 'folders'>('all')

// Computed filtered results
const filteredFiles = useMemo(() => {
  if (!filterText && filterType === 'all') return paginatedFiles.objects
  
  return paginatedFiles.objects.filter(file => {
    // Case-insensitive substring match
    const matchesText = file.key.toLowerCase().includes(filterText.toLowerCase())
    const matchesType = filterType === 'all' || filterType === 'files'
    return matchesText && matchesType
  })
}, [paginatedFiles.objects, filterText, filterType])

const filteredFolders = useMemo(() => {
  if (!filterText && filterType === 'all') return paginatedFiles.folders
  
  return paginatedFiles.folders.filter(folder => {
    const matchesText = folder.name.toLowerCase().includes(filterText.toLowerCase())
    const matchesType = filterType === 'all' || filterType === 'folders'
    return matchesText && matchesType
  })
}, [paginatedFiles.folders, filterText, filterType])
```

### 3.2 CSS Styling

```css
/* Filter Bar Styles */
.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color);
}

.filter-input-container {
  position: relative;
  flex: 1;
  max-width: 400px;
  display: flex;
  align-items: center;
}

.filter-icon {
  position: absolute;
  left: 12px;
  width: 18px;
  height: 18px;
  color: var(--text-tertiary);
  pointer-events: none;
}

.filter-input {
  width: 100%;
  padding: 0.625rem 2.5rem 0.625rem 2.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-primary);
  font-size: 0.875rem;
  transition: border-color 0.2s;
}

.filter-input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.filter-input::placeholder {
  color: var(--text-tertiary);
}

.filter-clear-button {
  position: absolute;
  right: 8px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 0.25rem;
  font-size: 16px;
  line-height: 1;
  transition: all 0.2s;
}

.filter-clear-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.filter-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.filter-type-select {
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  color: var(--text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: border-color 0.2s;
  color-scheme: inherit;
}

.filter-type-select:focus {
  outline: none;
  border-color: var(--border-focus);
}

.filter-match-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
  white-space: nowrap;
  padding: 0.5rem 0.75rem;
  background: var(--accent-blue-bg);
  border-radius: 0.375rem;
  font-weight: 500;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
  }
  
  .filter-input-container {
    max-width: none;
  }
  
  .filter-controls {
    justify-content: space-between;
  }
}
```

### 3.3 Integration Points

#### FileGrid Component (filegrid.tsx)
1. Add state variables for filter (lines ~406-450)
2. Add filter computation with `useMemo` hooks
3. Insert filter bar JSX before `.file-actions-bar` (around line 1264)
4. Replace `paginatedFiles.objects` with `filteredFiles` in render logic
5. Replace `paginatedFiles.folders` with `filteredFolders` in render logic
6. Update "Select All" to select only filtered items
7. Update empty state to show "No matches found" when filtering

#### App Component (app.tsx)
- No changes needed (filtering is local to FileGrid)

---

## 4. Implementation Steps

### Step 1: Add Filter State & Logic
- [ ] Add `filterText` and `filterType` state to FileGrid component
- [ ] Create `filteredFiles` and `filteredFolders` computed values with `useMemo`
- [ ] Add keyboard shortcut handling (Ctrl+F, Escape)

### Step 2: Build Filter Bar UI
- [ ] Create filter bar JSX structure
- [ ] Add search icon SVG
- [ ] Add clear button (X icon)
- [ ] Add filter type dropdown
- [ ] Add match counter

### Step 3: Style Filter Bar
- [ ] Add CSS for `.filter-bar` and child elements
- [ ] Ensure responsive behavior on mobile
- [ ] Match existing design system (colors, spacing, typography)
- [ ] Add focus states and transitions

### Step 4: Integrate with FileGrid
- [ ] Insert filter bar above action bar in JSX
- [ ] Update file/folder render loops to use filtered arrays
- [ ] Update "Select All" logic to work with filtered items
- [ ] Update empty state message for "No matches" vs "No files"
- [ ] Update item count displays (selected X of Y filtered items)

### Step 5: Testing
- [ ] Test with empty bucket
- [ ] Test with 1-10 files
- [ ] Test with 100+ files
- [ ] Test with nested folders
- [ ] Test filter type dropdown (All/Files/Folders)
- [ ] Test clear button
- [ ] Test mobile layout
- [ ] Test keyboard shortcuts
- [ ] Test case sensitivity (should be case-insensitive)
- [ ] Test special characters in filenames

### Step 6: Documentation
- [ ] Update README.md with filter feature description
- [ ] Add screenshots showing filter in action
- [ ] Update keyboard shortcuts section (if exists)
- [ ] Update FAQ with "How do I search for files?"

---

## 5. Edge Cases & Considerations

### Performance
- **Large buckets (1000+ items)**: Current approach filters on every keystroke. Consider debouncing if performance issues arise.
- **Deep folder hierarchies**: Filtering shows all matching items across folders, which may break expected folder navigation patterns. Consider adding breadcrumb context to search results.

### UX Considerations
- **No matches**: Show helpful message like "No files or folders match 'xyz'. Try a different search term."
- **Filter persistence**: Should filter clear when navigating between folders? **Recommendation:** Yes, clear filter on folder navigation to avoid confusion.
- **Selected items**: If user has items selected, then filters, and selected items are hidden, show notice: "3 selected items hidden by filter"

### Accessibility
- [ ] Ensure filter input has proper ARIA labels
- [ ] Announce filter results to screen readers ("Showing 23 of 156 items")
- [ ] Keyboard navigation: Tab should move through filter controls logically
- [ ] Clear button should have accessible label/title

### Browser Compatibility
- Filter input placeholder styling works in all modern browsers
- CSS custom properties (var) are widely supported (IE11+ would need fallbacks, but Cloudflare Workers requires modern browsers anyway)

---

## 6. Success Metrics

Post-implementation, success can be measured by:
1. **Feature adoption**: % of users who use the filter in a session (track via analytics)
2. **Time to find file**: Reduction in time between bucket open and file download
3. **User feedback**: Qualitative feedback via GitHub issues/discussions
4. **Performance**: Filter response time <50ms for 1000 items

---

## Feature Enhancements (Future Iterations)

### Phase 2: Advanced Filtering
- **Regex support**: Toggle for treating input as regular expression
- **Extension filter**: Dropdown for common file types (.pdf, .jpg, .zip, etc.)
- **Size filter**: Range slider or input for file size filtering
- **Date filter**: Date range picker for upload date filtering

### Phase 3: Search Improvements
- **Fuzzy matching**: Allow typos (e.g., "docment" matches "document")
- **Search history**: Dropdown showing recent searches
- **Highlighted matches**: Show matching text in bold/color in file names

### Phase 4: Performance Optimizations
- **Debounced filtering**: Wait 200-300ms after typing stops before filtering
- **Virtual scrolling**: For buckets with 10,000+ items
- **Web Worker filtering**: Offload filtering to background thread for large datasets