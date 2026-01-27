/**
 * TagFilter Component
 *
 * A filter dropdown for the bucket filter bar that allows filtering buckets by tags.
 * Supports multi-select and match-all/match-any modes.
 */

import { useState, useRef, useEffect, useCallback, type JSX } from "react";
import type { TagSummary } from "../../types/tags";
import "../../styles/tags.css";

interface TagFilterProps {
  /** Currently selected tags */
  selectedTags: string[];
  /** Available tags with bucket counts */
  availableTags: TagSummary[];
  /** Whether dropdown is open */
  isOpen: boolean;
  /** Toggle dropdown open state */
  onToggle: () => void;
  /** Callback when a tag is toggled */
  onTagToggle: (tag: string) => void;
  /** Whether to match all or any tags */
  matchAll: boolean;
  /** Callback to change match mode */
  onMatchModeChange: (matchAll: boolean) => void;
  /** Clear all selected tags */
  onClear: () => void;
}

export function TagFilter({
  selectedTags,
  availableTags,
  isOpen,
  onToggle,
  onTagToggle,
  matchAll,
  onMatchModeChange,
  onClear,
}: TagFilterProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filterText, setFilterText] = useState("");

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        if (isOpen) {
          onToggle();
        }
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onToggle]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent): void => {
      if (e.key === "Escape" && isOpen) {
        onToggle();
      }
    },
    [isOpen, onToggle],
  );

  // Filter available tags by text
  const filteredTags = filterText.trim()
    ? availableTags.filter((t) =>
        t.tag.toLowerCase().includes(filterText.toLowerCase()),
      )
    : availableTags;

  const hasActiveFilters = selectedTags.length > 0;

  return (
    <div
      className="tag-filter-container"
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className={`tag-filter-button ${hasActiveFilters ? "active" : ""}`}
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Filter by tags"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
        Tags
        {hasActiveFilters && (
          <span className="tag-count">{selectedTags.length}</span>
        )}
      </button>

      {isOpen && (
        <div
          className="tag-filter-dropdown"
          role="dialog"
          aria-label="Tag filter options"
        >
          {/* Match mode toggle */}
          <div
            className="tag-filter-match-mode"
            role="radiogroup"
            aria-label="Match mode"
          >
            <label>
              <input
                type="radio"
                name="tag-match-mode"
                checked={!matchAll}
                onChange={() => onMatchModeChange(false)}
              />
              Match Any
            </label>
            <label>
              <input
                type="radio"
                name="tag-match-mode"
                checked={matchAll}
                onChange={() => onMatchModeChange(true)}
              />
              Match All
            </label>
          </div>

          {/* Filter input */}
          {availableTags.length > 5 && (
            <div
              className="tag-input-container"
              style={{ marginBottom: "0.5rem" }}
            >
              <input
                type="text"
                className="tag-input"
                placeholder="Filter tags..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                aria-label="Filter tags"
                id="tag-filter-search"
                name="tag-filter-search"
              />
            </div>
          )}

          {/* Tag list */}
          <div
            className="tag-filter-list"
            role="listbox"
            aria-multiselectable="true"
          >
            {filteredTags.length > 0 ? (
              filteredTags.map(({ tag, bucket_count }) => (
                <div key={tag} className="tag-filter-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={selectedTags.includes(tag)}
                      onChange={() => onTagToggle(tag)}
                      role="option"
                      aria-selected={selectedTags.includes(tag)}
                      id={`tag-filter-${tag}`}
                      name={`tag-filter-${tag}`}
                    />
                    <span>{tag}</span>
                  </label>
                  <span className="bucket-count">{bucket_count}</span>
                </div>
              ))
            ) : (
              <div
                className="tag-filter-item"
                style={{ color: "var(--text-tertiary)", fontStyle: "italic" }}
              >
                {availableTags.length === 0
                  ? "No tags available"
                  : "No matching tags"}
              </div>
            )}
          </div>

          {/* Clear button */}
          {hasActiveFilters && (
            <div className="tag-filter-actions">
              <button
                type="button"
                className="tag-filter-clear"
                onClick={onClear}
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
