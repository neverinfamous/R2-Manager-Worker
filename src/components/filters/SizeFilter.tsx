import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { SIZE_PRESETS, formatFileSize } from "../../utils/filterUtils";
import type { SizeFilter as SizeFilterType } from "../../types/filters";

interface SizeFilterProps {
  sizeFilter: SizeFilterType;
  isOpen: boolean;
  onToggle: () => void;
  onPresetChange: (preset: SizeFilterType["preset"]) => void;
  onCustomRange: (minMB: number, maxMB: number | null) => void;
  onClear: () => void;
}

export function SizeFilter({
  sizeFilter,
  isOpen,
  onToggle,
  onPresetChange,
  onCustomRange,
  onClear,
}: SizeFilterProps): JSX.Element {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [customMin, setCustomMin] = useState<string>("");
  const [customMax, setCustomMax] = useState<string>("");

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        isOpen &&
        dropdownRef.current !== null &&
        buttonRef.current !== null &&
        !dropdownRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return (): void => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
    return undefined;
  }, [isOpen, onToggle]);

  const handlePresetClick = useCallback(
    (preset: SizeFilterType["preset"]) => {
      onPresetChange(preset);
    },
    [onPresetChange],
  );

  const handleCustomApply = useCallback(() => {
    const minMB = parseFloat(customMin) || 0;
    const maxMB = customMax ? parseFloat(customMax) : null;
    onCustomRange(minMB, maxMB);
    setCustomMin("");
    setCustomMax("");
  }, [customMin, customMax, onCustomRange]);

  const getActiveLabel = useCallback(() => {
    if (sizeFilter.preset === "all") return "All sizes";
    if (sizeFilter.preset === "custom") {
      const min =
        sizeFilter.min !== null ? formatFileSize(sizeFilter.min) : "0";
      const max =
        sizeFilter.max !== null ? formatFileSize(sizeFilter.max) : "∞";
      return `${min} - ${max}`;
    }
    const preset = SIZE_PRESETS[sizeFilter.preset];
    const min = preset.min !== null ? formatFileSize(preset.min) : "0";
    const max = preset.max !== null ? formatFileSize(preset.max) : "∞";
    return `${min} - ${max}`;
  }, [sizeFilter]);

  return (
    <div className="filter-dropdown">
      <button
        ref={buttonRef}
        className="filter-dropdown-button"
        onClick={onToggle}
        aria-label="Filter by file size"
        aria-expanded={isOpen}
        aria-controls="size-dropdown-menu"
      >
        Size: {getActiveLabel()}
        <span className="dropdown-arrow">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          id="size-dropdown-menu"
          className="filter-dropdown-menu"
          role="menu"
          aria-label="Select size range to filter"
        >
          <div className="filter-dropdown-section">
            <div className="filter-dropdown-header">
              <span>Size Range</span>
              {sizeFilter.preset !== "all" && (
                <button
                  className="filter-clear-link"
                  onClick={onClear}
                  type="button"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="filter-radio-group">
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="size-preset"
                  checked={sizeFilter.preset === "all"}
                  onChange={() => handlePresetClick("all")}
                  className="filter-radio-input"
                />
                <span>All Sizes</span>
              </label>
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="size-preset"
                  checked={sizeFilter.preset === "tiny"}
                  onChange={() => handlePresetClick("tiny")}
                  className="filter-radio-input"
                />
                <span>&lt; 1 MB</span>
              </label>
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="size-preset"
                  checked={sizeFilter.preset === "small"}
                  onChange={() => handlePresetClick("small")}
                  className="filter-radio-input"
                />
                <span>1 - 10 MB</span>
              </label>
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="size-preset"
                  checked={sizeFilter.preset === "medium"}
                  onChange={() => handlePresetClick("medium")}
                  className="filter-radio-input"
                />
                <span>10 - 50 MB</span>
              </label>
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="size-preset"
                  checked={sizeFilter.preset === "large"}
                  onChange={() => handlePresetClick("large")}
                  className="filter-radio-input"
                />
                <span>50 - 100 MB</span>
              </label>
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="size-preset"
                  checked={sizeFilter.preset === "xlarge"}
                  onChange={() => handlePresetClick("xlarge")}
                  className="filter-radio-input"
                />
                <span>&gt; 100 MB</span>
              </label>
            </div>
          </div>

          <div className="filter-dropdown-section">
            <div className="filter-dropdown-header">
              <span>Custom Range</span>
            </div>
            <div className="filter-custom-range">
              <div className="filter-input-group">
                <label htmlFor="size-min">Min (MB):</label>
                <input
                  id="size-min"
                  type="number"
                  min="0"
                  step="0.1"
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  placeholder="0"
                  className="filter-number-input"
                />
              </div>
              <div className="filter-input-group">
                <label htmlFor="size-max">Max (MB):</label>
                <input
                  id="size-max"
                  type="number"
                  min="0"
                  step="0.1"
                  value={customMax}
                  onChange={(e) => setCustomMax(e.target.value)}
                  placeholder="No limit"
                  className="filter-number-input"
                />
              </div>
              <button
                className="filter-apply-button"
                onClick={handleCustomApply}
                disabled={!customMin && !customMax}
                type="button"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
