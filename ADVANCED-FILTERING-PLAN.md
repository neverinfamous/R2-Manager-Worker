# Advanced Filtering Enhancement Plan

## Executive Summary

This plan outlines the enhancement of the existing filename/folder filter (v1.1.1) to include advanced filtering capabilities by file extension, size, and upload date. The implementation will maintain the current user experience while adding powerful new filtering options that integrate seamlessly with the existing UI.

---

## Current State Analysis

### Existing Filtering

**Location:** `src/filegrid.tsx` (lines 450-451, 482-507, 1293-1338)

**Current Features:**
- ✅ Real-time text filtering by filename/folder name
- ✅ Type filtering: All / Files Only / Folders Only
- ✅ Case-insensitive search
- ✅ Match counter showing "X of Y" filtered results
- ✅ Clear button (✕) to reset filter
- ✅ Works in both grid and list views
- ✅ Preserves selections during filtering

**Current Implementation:**
```typescript
// State management
const [filterText, setFilterText] = useState<string>('')
const [filterType, setFilterType] = useState<'all' | 'files' | 'folders'>('all')

// Filtering logic (useMemo for performance)
const filteredFiles = useMemo(() => {
  if (!filterText && filterType === 'all') return paginatedFiles.objects
  return paginatedFiles.objects.filter(file => {
    const fileName = file.key.split('/').pop() || file.key
    const matchesText = fileName.toLowerCase().includes(filterText.toLowerCase())
    const matchesType = filterType === 'all' || filterType === 'files'
    return matchesText && matchesType
  })
}, [paginatedFiles.objects, filterText, filterType])
```

**UI Location:** Filter bar above file actions bar (lines 1293-1338)

---

## Proposed Enhancements

### 1. File Extension Filtering

**Priority:** HIGH  
**Complexity:** LOW  
**User Value:** HIGH

#### Features:
- Multi-select dropdown for file extensions
- Automatically detect available extensions from current bucket
- Common extension shortcuts (Images, Documents, Videos, Code, Archives)
- Custom extension input field
- Extension badges showing active filters

#### UI Design:
```
[Search Input] [Type: All ▼] [Extensions ▼] [Size ▼] [Date ▼] [Clear All]
                                  └─> Opens dropdown with:
                                      ☐ .pdf (23)
                                      ☐ .jpg (156)
                                      ☐ .png (89)
                                      ☐ .xlsx (12)
                                      ─────────────
                                      Quick Filters:
                                      [Images] [Docs] [Code]
                                      ─────────────
                                      Custom: [____]
```

#### Implementation Details:

**New State Variables:**
```typescript
const [selectedExtensions, setSelectedExtensions] = useState<string[]>([])
const [availableExtensions, setAvailableExtensions] = useState<Map<string, number>>(new Map())
const [extensionDropdownOpen, setExtensionDropdownOpen] = useState(false)
```

**Extension Detection Function:**
```typescript
const detectExtensions = useCallback((files: FileObject[]) => {
  const extensionMap = new Map<string, number>()
  files.forEach(file => {
    const ext = getFileExtension(file.key)
    if (ext) {
      extensionMap.set(ext, (extensionMap.get(ext) || 0) + 1)
    }
  })
  return extensionMap
}, [])
```

**Enhanced Filtering Logic:**
```typescript
const filteredFiles = useMemo(() => {
  if (!filterText && filterType === 'all' && selectedExtensions.length === 0) {
    return paginatedFiles.objects
  }
  
  return paginatedFiles.objects.filter(file => {
    // Existing text filter
    const fileName = file.key.split('/').pop() || file.key
    const matchesText = !filterText || 
      fileName.toLowerCase().includes(filterText.toLowerCase())
    
    // Existing type filter
    const matchesType = filterType === 'all' || filterType === 'files'
    
    // NEW: Extension filter
    const fileExt = getFileExtension(file.key).toLowerCase()
    const matchesExtension = selectedExtensions.length === 0 || 
      selectedExtensions.includes(fileExt)
    
    return matchesText && matchesType && matchesExtension
  })
}, [paginatedFiles.objects, filterText, filterType, selectedExtensions])
```

**Extension Group Presets:**
```typescript
const EXTENSION_GROUPS = {
  images: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.heic', '.svg', '.bmp'],
  documents: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'],
  videos: ['.mp4', '.mov', '.webm'],
  code: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.cs', '.go', '.rs', '.html', '.css'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz']
}
```

---

### 2. File Size Filtering

**Priority:** HIGH  
**Complexity:** MEDIUM  
**User Value:** HIGH

#### Features:
- Preset size ranges (< 1MB, 1-10MB, 10-50MB, 50-100MB, > 100MB)
- Custom size range with min/max inputs
- Visual size distribution graph (optional enhancement)
- Size slider for interactive filtering

#### UI Design:
```
[Size ▼] → Size Range
           ○ All Sizes
           ○ < 1 MB
           ○ 1 - 10 MB
           ○ 10 - 50 MB
           ○ 50 - 100 MB
           ○ > 100 MB
           ─────────────
           Custom Range:
           Min: [___] MB  Max: [___] MB
           [Apply]
```

#### Implementation Details:

**New State Variables:**
```typescript
interface SizeFilter {
  min: number | null  // bytes
  max: number | null  // bytes
  preset: 'all' | 'tiny' | 'small' | 'medium' | 'large' | 'xlarge' | 'custom'
}

const [sizeFilter, setSizeFilter] = useState<SizeFilter>({
  min: null,
  max: null,
  preset: 'all'
})
const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false)
```

**Size Range Presets:**
```typescript
const SIZE_PRESETS = {
  all: { min: null, max: null },
  tiny: { min: 0, max: 1024 * 1024 },              // < 1MB
  small: { min: 1024 * 1024, max: 10 * 1024 * 1024 },      // 1-10MB
  medium: { min: 10 * 1024 * 1024, max: 50 * 1024 * 1024 }, // 10-50MB
  large: { min: 50 * 1024 * 1024, max: 100 * 1024 * 1024 }, // 50-100MB
  xlarge: { min: 100 * 1024 * 1024, max: null }     // > 100MB
}
```

**Enhanced Filtering Logic:**
```typescript
const filteredFiles = useMemo(() => {
  return paginatedFiles.objects.filter(file => {
    // ... existing filters ...
    
    // NEW: Size filter
    const matchesSize = 
      (sizeFilter.min === null || file.size >= sizeFilter.min) &&
      (sizeFilter.max === null || file.size <= sizeFilter.max)
    
    return matchesText && matchesType && matchesExtension && matchesSize
  })
}, [paginatedFiles.objects, filterText, filterType, selectedExtensions, sizeFilter])
```

**Size Filter Component:**
```typescript
const handleSizePresetChange = (preset: string) => {
  setSizeFilter({
    min: SIZE_PRESETS[preset].min,
    max: SIZE_PRESETS[preset].max,
    preset
  })
  setSizeDropdownOpen(false)
}

const handleCustomSizeRange = (minMB: number, maxMB: number) => {
  setSizeFilter({
    min: minMB * 1024 * 1024,
    max: maxMB === 0 ? null : maxMB * 1024 * 1024,
    preset: 'custom'
  })
}
```

---

### 3. Upload Date Filtering

**Priority:** MEDIUM  
**Complexity:** MEDIUM  
**User Value:** HIGH

#### Features:
- Preset date ranges (Today, Last 7 days, Last 30 days, Last 90 days, Custom)
- Date picker for custom date ranges
- Relative date filtering (e.g., "older than X days")
- Sort by newest/oldest within filtered results

#### UI Design:
```
[Date ▼] → Upload Date
           ○ All Dates
           ○ Today
           ○ Last 7 Days
           ○ Last 30 Days
           ○ Last 90 Days
           ○ This Year
           ─────────────
           Custom Range:
           From: [📅 Date Picker]
           To:   [📅 Date Picker]
           [Apply]
```

#### Implementation Details:

**New State Variables:**
```typescript
interface DateFilter {
  start: Date | null
  end: Date | null
  preset: 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'
}

const [dateFilter, setDateFilter] = useState<DateFilter>({
  start: null,
  end: null,
  preset: 'all'
})
const [dateDropdownOpen, setDateDropdownOpen] = useState(false)
```

**Date Range Presets:**
```typescript
const DATE_PRESETS = {
  all: { start: null, end: null },
  today: { 
    start: new Date(new Date().setHours(0, 0, 0, 0)),
    end: new Date(new Date().setHours(23, 59, 59, 999))
  },
  week: {
    start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    end: new Date()
  },
  month: {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  },
  quarter: {
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    end: new Date()
  },
  year: {
    start: new Date(new Date().getFullYear(), 0, 1),
    end: new Date()
  }
}
```

**Enhanced Filtering Logic:**
```typescript
const filteredFiles = useMemo(() => {
  return paginatedFiles.objects.filter(file => {
    // ... existing filters ...
    
    // NEW: Date filter
    const fileDate = new Date(file.uploaded)
    const matchesDate = 
      (dateFilter.start === null || fileDate >= dateFilter.start) &&
      (dateFilter.end === null || fileDate <= dateFilter.end)
    
    return matchesText && matchesType && matchesExtension && matchesSize && matchesDate
  })
}, [paginatedFiles.objects, filterText, filterType, selectedExtensions, sizeFilter, dateFilter])
```

---

## UI/UX Enhancements

### 1. Filter Pills/Badges

Display active filters as removable pills below the filter bar:

```
🔍 Search: "report"  ✕  |  📄 Extensions: .pdf, .xlsx  ✕  |  📏 Size: 1-10 MB  ✕  |  📅 Date: Last 7 Days  ✕
```

**Implementation:**
```typescript
const ActiveFilterBadges = () => {
  const hasFilters = filterText || selectedExtensions.length > 0 || 
                     sizeFilter.preset !== 'all' || dateFilter.preset !== 'all'
  
  if (!hasFilters) return null
  
  return (
    <div className="active-filters">
      {filterText && (
        <span className="filter-badge">
          🔍 Search: "{filterText}" 
          <button onClick={() => setFilterText('')}>✕</button>
        </span>
      )}
      {selectedExtensions.length > 0 && (
        <span className="filter-badge">
          📄 Extensions: {selectedExtensions.join(', ')}
          <button onClick={() => setSelectedExtensions([])}>✕</button>
        </span>
      )}
      {/* ... more badges ... */}
    </div>
  )
}
```

### 2. Filter Statistics

Show helpful statistics about filtered results:

```
📊 Showing 23 of 156 items
   Total Size: 45.2 MB
   Date Range: Jan 15 - Oct 23, 2025
```

---

## Technical Architecture

### Component Structure

```
src/filegrid.tsx
├─ FilterBar (existing)
│  ├─ SearchInput (existing)
│  ├─ TypeSelector (existing)
│  └─ ClearButton (existing)
├─ AdvancedFilterBar (NEW)
│  ├─ ExtensionFilter (NEW)
│  │  ├─ ExtensionDropdown
│  │  ├─ ExtensionPresets
│  │  └─ CustomExtensionInput
│  ├─ SizeFilter (NEW)
│  │  ├─ SizePresetSelector
│  │  └─ CustomSizeRange
│  └─ DateFilter (NEW)
│     ├─ DatePresetSelector
│     └─ CustomDateRange
├─ ActiveFilterBadges (NEW)
└─ FilterStats (NEW)
```

### State Management

**Recommended Approach:** Keep state local to `FileGrid` component using React hooks

**Alternative:** If filters become complex, consider:
1. Creating a custom `useFileFilter` hook
2. Using React Context for filter state if needed across multiple components
3. URL query parameters for shareable filter states

### Performance Considerations

1. **Memoization:** Use `useMemo` for all filter computations
2. **Debouncing:** Debounce text input (already implemented: 250ms)
3. **Virtual Scrolling:** Maintain existing intersection observer pagination
4. **Index Building:** Build extension/size maps once when files load

```typescript
// Build search indexes on data load
const fileIndexes = useMemo(() => ({
  extensions: buildExtensionIndex(paginatedFiles.objects),
  sizeRanges: buildSizeRangeIndex(paginatedFiles.objects),
  dateRanges: buildDateRangeIndex(paginatedFiles.objects)
}), [paginatedFiles.objects])
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Establish advanced filter infrastructure

**Tasks:**
1. Create new filter state types and interfaces
2. Implement `AdvancedFilterBar` component structure
3. Add filter state management hooks
4. Create utility functions for filter logic
5. Add unit tests for filter functions

**Deliverables:**
- Type definitions for all filter types
- Base component structure
- Utility functions with tests

---

### Phase 2: Extension Filter (Week 2)
**Goal:** Implement file extension filtering

**Tasks:**
1. Build extension detection system
2. Create `ExtensionFilter` component
3. Implement extension dropdown with multi-select
4. Add extension group presets
5. Integrate with existing filter logic
6. Add CSS styling for extension filter
7. Test with various file types

**Deliverables:**
- Working extension filter
- Extension group presets (Images, Docs, Videos, Code)
- Updated filter logic
- Documentation

**Testing Checklist:**
- [ ] Extension detection works for all supported file types
- [ ] Multi-select checkbox behavior
- [ ] Extension count updates correctly
- [ ] Quick filter buttons work
- [ ] Custom extension input validation
- [ ] Filter clears properly
- [ ] Works in both grid and list views

---

### Phase 3: Size Filter (Week 3)
**Goal:** Implement file size filtering

**Tasks:**
1. Create `SizeFilter` component
2. Implement preset size ranges
3. Add custom size range inputs
4. Integrate size validation
5. Add size formatting utilities
6. Update filter logic to include size
7. Add CSS styling for size filter

**Deliverables:**
- Working size filter with presets
- Custom range input with validation
- Updated documentation

**Testing Checklist:**
- [ ] Size presets filter correctly
- [ ] Custom range validation works
- [ ] Edge cases (0 bytes, very large files)
- [ ] Size format display is human-readable
- [ ] Filter combination with extensions
- [ ] Clear functionality works

---

### Phase 4: Date Filter (Week 4)
**Goal:** Implement upload date filtering

**Tasks:**
1. Create `DateFilter` component
2. Implement preset date ranges
3. Add date picker integration or use native HTML5 date input. Use your judgment.
4. Implement custom date range logic
5. Add timezone handling
6. Update filter logic to include dates
7. Add CSS styling for date filter

**Deliverables:**
- Working date filter with presets
- Custom date range picker
- Timezone-aware filtering

**Testing Checklist:**
- [ ] Date presets calculate correctly
- [ ] Custom date range works
- [ ] Timezone handling is correct
- [ ] Date format display is localized
- [ ] Future date validation
- [ ] Filter combination with other filters

---

### Phase 5: UI Polish (Week 5)
**Goal:** Enhance user experience and visual design

**Tasks:**
1. Implement active filter badges
2. Add filter statistics display
4. Implement "Clear All Filters" button
5. Add filter animations and transitions
6. Mobile responsiveness testing
7. Accessibility audit (ARIA labels, keyboard navigation)
8. Dark/Light theme compatibility

**Deliverables:**
- Polished filter UI
- Active filter badges
- Filter statistics
- Mobile-responsive design
- Accessibility compliant

**Testing Checklist:**
- [ ] Filter badges display correctly
- [ ] Clear individual filters from badges
- [ ] "Clear All" removes all filters
- [ ] Statistics update in real-time
- [ ] Mobile layout works well
- [ ] Keyboard navigation works
- [ ] Screen reader compatible
- [ ] Both themes look good

---

### Phase 6: Documentation (Week 7)
**Goal:** Comprehensive documentation

**Tasks:**
1. Update README.md with filter documentation
2. Create Wiki page: "Advanced-Filtering-Guide.md"
3. Add inline help tooltips

**Deliverables:**
- Comprehensive documentation
- Help resources

---

## File Changes Required

### New Files

1. **`src/components/filters/ExtensionFilter.tsx`**
   - Extension selection dropdown
   - Extension group presets
   - Custom extension input

2. **`src/components/filters/SizeFilter.tsx`**
   - Size preset selector
   - Custom size range inputs

3. **`src/components/filters/DateFilter.tsx`**
   - Date preset selector
   - Custom date range picker

4. **`src/components/filters/ActiveFilterBadges.tsx`**
   - Display active filters as removable badges

5. **`src/components/filters/FilterStats.tsx`**
   - Show statistics about filtered results

6. **`src/hooks/useFileFilters.ts`** (Optional)
   - Custom hook to manage filter state
   - Centralized filter logic

7. **`src/utils/filterUtils.ts`**
   - Utility functions for filtering
   - Index building functions
   - Date/size parsing helpers

8. **`src/styles/filters.css`**
   - Styles for all filter components

9. **`src/types/filters.ts`**
   - TypeScript interfaces for filters

### Modified Files

1. **`src/filegrid.tsx`**
   - Import new filter components
   - Add new state variables
   - Update filtering logic
   - Integrate new UI components

2. **`src/app.css`** or **`src/styles/filters.css`**
   - Add CSS for filter components
   - Responsive styles
   - Dark/light theme variables

3. **`README.md`**
   - Update features list

4. **Wiki: `File-Operations.md`**
   - Add section on advanced filtering

5. **Wiki: New page `Advanced-Filtering-Guide.md`**
   - Comprehensive guide to using filters
   - Examples and use cases
   - Tips and tricks

---

## CSS Styling Guide

### Design Principles
- Consistent with existing UI design
- Support both light and dark themes
- Mobile-responsive (breakpoints at 768px, 1024px)
- Accessible (WCAG 2.1 AA compliant)
- Smooth transitions and animations

### Color Variables (use existing theme variables)
```css
/* Use existing CSS custom properties */
--bg-secondary: /* for filter panels */
--bg-tertiary: /* for dropdown backgrounds */
--text-primary: /* for labels */
--text-secondary: /* for hints */
--border-color: /* for borders */
--accent-blue: /* for active filters */
```

### Component Classes
```css
.advanced-filter-bar {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--bg-secondary);
  border-radius: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.filter-dropdown {
  position: relative;
  min-width: 150px;
}

.filter-dropdown-button {
  /* Similar to existing action-button style */
  padding: 0.5rem 1rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
}

.filter-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 0.25rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  min-width: 250px;
  max-height: 400px;
  overflow-y: auto;
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: var(--accent-blue-bg);
  color: var(--accent-blue-light);
  border-radius: 1rem;
  font-size: 0.875rem;
}

.filter-badge button {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
  font-size: 1rem;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .advanced-filter-bar {
    flex-direction: column;
  }
  
  .filter-dropdown {
    width: 100%;
  }
}
```

---

## Accessibility Requirements

### WCAG 2.1 AA Compliance

1. **Keyboard Navigation**
   - All dropdowns accessible via Tab/Shift+Tab
   - Arrow keys to navigate dropdown options
   - Enter/Space to select
   - Escape to close dropdowns

2. **Screen Reader Support**
   - ARIA labels on all interactive elements
   - ARIA live regions for filter count updates
   - Clear button descriptions

3. **Visual Accessibility**
   - Minimum 4.5:1 contrast ratio for text
   - Focus indicators clearly visible
   - Color not the only means of conveying information

4. **Implementation Examples**

```typescript
// Extension Filter Dropdown
<button
  aria-label="Filter by file extension"
  aria-expanded={extensionDropdownOpen}
  aria-controls="extension-dropdown-menu"
  onClick={toggleExtensionDropdown}
>
  Extensions ▼
</button>

<div
  id="extension-dropdown-menu"
  role="menu"
  aria-label="Select file extensions to filter"
  hidden={!extensionDropdownOpen}
>
  {availableExtensions.map(ext => (
    <label role="menuitemcheckbox" aria-checked={selectedExtensions.includes(ext)}>
      <input
        type="checkbox"
        checked={selectedExtensions.includes(ext)}
        onChange={() => toggleExtension(ext)}
      />
      .{ext}
    </label>
  ))}
</div>

// Filter count announcement
<div
  className="visually-hidden"
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  Showing {filteredCount} of {totalCount} items
</div>
```

---

## Performance Benchmarks

### Optimization Strategies

1. **Use React.memo for filter components**
```typescript
export const ExtensionFilter = React.memo(({ ... }) => {
  // Component code
})
```

2. **Debounce text input** (already implemented)
```typescript
const debouncedFilterText = useMemo(
  () => debounce((text: string) => setFilterText(text), 250),
  []
)
```

3. **Index pre-computation**
```typescript
// Compute once when files load
const extensionIndex = useMemo(() => {
  const map = new Map<string, number[]>()
  files.forEach((file, index) => {
    const ext = getExtension(file.key)
    if (!map.has(ext)) map.set(ext, [])
    map.get(ext)!.push(index)
  })
  return map
}, [files])

// Fast filtering using index
const filteredFiles = selectedExtensions.length === 0
  ? files
  : files.filter((_, index) => 
      selectedExtensions.some(ext => 
        extensionIndex.get(ext)?.includes(index)
      )
    )
```

4. **Virtual scrolling** (already implemented)
   - Maintain existing intersection observer
   - Only render visible items