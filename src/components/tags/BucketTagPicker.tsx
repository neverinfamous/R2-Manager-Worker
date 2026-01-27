/**
 * BucketTagPicker Component
 *
 * A self-contained dropdown component for managing tags on a bucket.
 * Fetches and manages its own tag state internally.
 * Displays current tags as badges and provides UI for adding/removing tags.
 */

import { useState, useRef, useEffect, useCallback, type JSX } from "react";
import { api } from "../../services/api";
import { logger } from "../../services/logger";
import "../../styles/tags.css";

interface BucketTagPickerProps {
  /** Name of the bucket */
  bucketName: string;
  /** Whether to show compact view (for list/table mode) */
  compact?: boolean;
  /** Whether the picker is disabled */
  disabled?: boolean;
}

// Tag validation: alphanumeric, hyphens, underscores, max 32 chars
function validateTag(tag: string): { valid: boolean; error?: string } {
  if (!tag || tag.trim().length === 0) {
    return { valid: false, error: "Tag cannot be empty" };
  }

  const normalized = tag.trim().toLowerCase();

  if (normalized.length > 32) {
    return { valid: false, error: "Tag must be 32 characters or less" };
  }

  if (!/^[a-z0-9][a-z0-9-_]*[a-z0-9]$|^[a-z0-9]$/.test(normalized)) {
    return {
      valid: false,
      error: "Letters, numbers, hyphens, underscores only",
    };
  }

  return { valid: true };
}

export function BucketTagPicker({
  bucketName,
  compact = false,
  disabled = false,
}: BucketTagPickerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTags, setCurrentTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch bucket tags and available tags on mount
  useEffect(() => {
    async function fetchTags(): Promise<void> {
      try {
        const [bucketTags, allTags] = await Promise.all([
          api.getBucketTags(bucketName),
          api.getAllTags(),
        ]);
        // getBucketTags returns string[] directly
        setCurrentTags(bucketTags);
        // getAllTags returns TagSummary[] with tag property
        setAvailableTags(allTags.map((t) => t.tag));
      } catch (err) {
        logger.error("BucketTagPicker", "Failed to fetch tags", err);
      } finally {
        setIsInitializing(false);
      }
    }
    void fetchTags();
  }, [bucketName]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setNewTagInput("");
        setInputError(null);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleToggle = useCallback(
    (e: React.MouseEvent): void => {
      e.stopPropagation();
      if (!disabled && !isInitializing) {
        if (!isOpen && containerRef.current) {
          // Calculate position for fixed dropdown
          const rect = containerRef.current.getBoundingClientRect();
          setDropdownStyle({
            top: rect.bottom + 4,
            left: rect.left,
          });
        }
        setIsOpen((prev) => !prev);
      }
    },
    [disabled, isInitializing, isOpen],
  );

  const handleAddTag = useCallback(
    async (tag: string): Promise<void> => {
      const normalizedTag = tag.trim().toLowerCase();
      if (!normalizedTag) return;

      // Validate tag
      const validation = validateTag(normalizedTag);
      if (!validation.valid) {
        setInputError(validation.error ?? "Invalid tag");
        return;
      }

      // Check if already has this tag
      if (currentTags.includes(normalizedTag)) {
        setInputError("Tag already exists");
        return;
      }

      setLoading(true);
      setInputError(null);

      try {
        await api.addBucketTag(bucketName, normalizedTag);
        setCurrentTags((prev) => [...prev, normalizedTag]);
        // Add to available tags if new
        if (!availableTags.includes(normalizedTag)) {
          setAvailableTags((prev) => [...prev, normalizedTag]);
        }
        setNewTagInput("");
      } catch (err) {
        logger.error("BucketTagPicker", "Failed to add tag", err);
        setInputError(err instanceof Error ? err.message : "Failed to add tag");
      } finally {
        setLoading(false);
      }
    },
    [bucketName, currentTags, availableTags],
  );

  const handleRemoveTag = useCallback(
    async (tag: string, e: React.MouseEvent): Promise<void> => {
      e.stopPropagation();
      setLoading(true);
      setInputError(null);

      try {
        await api.removeBucketTag(bucketName, tag);
        setCurrentTags((prev) => prev.filter((t) => t !== tag));
      } catch (err) {
        logger.error("BucketTagPicker", "Failed to remove tag", err);
        setInputError(
          err instanceof Error ? err.message : "Failed to remove tag",
        );
      } finally {
        setLoading(false);
      }
    },
    [bucketName],
  );

  const handleToggleExistingTag = useCallback(
    async (tag: string): Promise<void> => {
      setLoading(true);
      setInputError(null);

      try {
        if (currentTags.includes(tag)) {
          await api.removeBucketTag(bucketName, tag);
          setCurrentTags((prev) => prev.filter((t) => t !== tag));
        } else {
          await api.addBucketTag(bucketName, tag);
          setCurrentTags((prev) => [...prev, tag]);
        }
      } catch (err) {
        logger.error("BucketTagPicker", "Failed to toggle tag", err);
        setInputError(
          err instanceof Error ? err.message : "Failed to update tag",
        );
      } finally {
        setLoading(false);
      }
    },
    [bucketName, currentTags],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === "Enter" && newTagInput.trim()) {
        e.preventDefault();
        void handleAddTag(newTagInput);
      } else if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    [newTagInput, handleAddTag],
  );

  // Filter available tags by input
  const filteredAvailableTags = availableTags.filter(
    (tag) =>
      !currentTags.includes(tag) &&
      (newTagInput.trim() === "" ||
        tag.toLowerCase().includes(newTagInput.toLowerCase())),
  );

  // Show loading spinner during initialization
  if (isInitializing) {
    return (
      <div className={`bucket-tag-picker ${compact ? "compact" : ""}`}>
        <span className="tag-loading">...</span>
      </div>
    );
  }

  return (
    <div
      className={`bucket-tag-picker ${compact ? "compact" : ""}`}
      ref={containerRef}
    >
      {/* Tag badges display */}
      <div className="tag-badges-container" onClick={handleToggle}>
        {/* Add icon at top - consistent position */}
        <span className="tag-add-icon" aria-label="Add tags">
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
            <line x1="12" y1="12" x2="12" y2="18" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </span>
        {/* Tags follow the icon */}
        {currentTags.length > 0 && (
          <>
            {currentTags.slice(0, compact ? 2 : undefined).map((tag) => (
              <span key={tag} className="tag-badge">
                {tag}
                {!compact && (
                  <button
                    type="button"
                    className="tag-badge-remove"
                    onClick={(e) => void handleRemoveTag(tag, e)}
                    disabled={loading || disabled}
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {compact && currentTags.length > 2 && (
              <span className="tag-badge more">+{currentTags.length - 2}</span>
            )}
          </>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="tag-picker-dropdown"
          style={dropdownStyle}
          role="dialog"
          aria-label="Tag picker"
        >
          {/* New tag input */}
          <div className="tag-input-container">
            <input
              ref={inputRef}
              type="text"
              className={`tag-input ${inputError ? "error" : ""}`}
              placeholder="Add new tag..."
              value={newTagInput}
              onChange={(e) => {
                setNewTagInput(e.target.value);
                setInputError(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={loading || disabled}
              aria-label="New tag name"
              id={`tag-input-${bucketName}`}
              name={`tag-input-${bucketName}`}
            />
            <button
              type="button"
              className="tag-add-button"
              onClick={() => void handleAddTag(newTagInput)}
              disabled={loading || disabled || !newTagInput.trim()}
              aria-label="Add tag"
            >
              {loading ? "..." : "+"}
            </button>
          </div>

          {inputError && (
            <div className="tag-input-error" role="alert">
              {inputError}
            </div>
          )}

          {/* Existing tags list */}
          {filteredAvailableTags.length > 0 && (
            <div className="tag-list">
              <div className="tag-list-header">Available tags</div>
              {filteredAvailableTags.slice(0, 10).map((tag) => (
                <label key={tag} className="tag-list-item">
                  <input
                    type="checkbox"
                    checked={currentTags.includes(tag)}
                    onChange={() => void handleToggleExistingTag(tag)}
                    disabled={loading || disabled}
                    id={`tag-${bucketName}-${tag}`}
                    name={`tag-${bucketName}-${tag}`}
                  />
                  <span>{tag}</span>
                </label>
              ))}
              {filteredAvailableTags.length > 10 && (
                <div className="tag-list-more">
                  +{filteredAvailableTags.length - 10} more
                </div>
              )}
            </div>
          )}

          {/* Current tags section */}
          {currentTags.length > 0 && (
            <div className="tag-current-list">
              <div className="tag-list-header">Current tags</div>
              <div className="tag-current-badges">
                {currentTags.map((tag) => (
                  <span key={tag} className="tag-badge small">
                    {tag}
                    <button
                      type="button"
                      className="tag-badge-remove"
                      onClick={(e) => void handleRemoveTag(tag, e)}
                      disabled={loading || disabled}
                      aria-label={`Remove tag ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
