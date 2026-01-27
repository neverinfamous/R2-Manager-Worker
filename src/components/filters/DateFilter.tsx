import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { formatDateRange } from "../../utils/filterUtils";
import type { DateFilter as DateFilterType } from "../../types/filters";

interface DateFilterProps {
  dateFilter: DateFilterType;
  isOpen: boolean;
  onToggle: () => void;
  onPresetChange: (preset: DateFilterType["preset"]) => void;
  onCustomRange: (start: Date | null, end: Date | null) => void;
  onClear: () => void;
}

export function DateFilter({
  dateFilter,
  isOpen,
  onToggle,
  onPresetChange,
  onCustomRange,
  onClear,
}: DateFilterProps): JSX.Element {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

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
    (preset: DateFilterType["preset"]) => {
      onPresetChange(preset);
    },
    [onPresetChange],
  );

  const handleCustomApply = useCallback(() => {
    const start = customStart ? new Date(customStart) : null;
    const end = customEnd ? new Date(customEnd) : null;
    onCustomRange(start, end);
    setCustomStart("");
    setCustomEnd("");
  }, [customStart, customEnd, onCustomRange]);

  const getActiveLabel = useCallback(() => {
    if (dateFilter.preset === "all") return "All dates";
    if (dateFilter.preset === "custom") {
      return formatDateRange(dateFilter.start, dateFilter.end);
    }

    const presetLabels: Record<DateFilterType["preset"], string> = {
      all: "All dates",
      today: "Today",
      week: "Last 7 days",
      month: "Last 30 days",
      quarter: "Last 90 days",
      year: "This year",
      custom: "Custom",
    };
    return presetLabels[dateFilter.preset];
  }, [dateFilter]);

  return (
    <div className="filter-dropdown">
      <button
        ref={buttonRef}
        className="filter-dropdown-button"
        onClick={onToggle}
        aria-label="Filter by upload date"
        aria-expanded={isOpen}
        aria-controls="date-dropdown-menu"
      >
        Date: {getActiveLabel()}
        <span className="dropdown-arrow">{isOpen ? "▲" : "▼"}</span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          id="date-dropdown-menu"
          className="filter-dropdown-menu"
          role="menu"
          aria-label="Select date range to filter"
        >
          <div className="filter-dropdown-section">
            <div className="filter-dropdown-header">
              <span>Upload Date</span>
              {dateFilter.preset !== "all" && (
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
                  name="date-preset"
                  checked={dateFilter.preset === "all"}
                  onChange={() => handlePresetClick("all")}
                  className="filter-radio-input"
                />
                <span>All Dates</span>
              </label>
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="date-preset"
                  checked={dateFilter.preset === "today"}
                  onChange={() => handlePresetClick("today")}
                  className="filter-radio-input"
                />
                <span>Today</span>
              </label>
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="date-preset"
                  checked={dateFilter.preset === "week"}
                  onChange={() => handlePresetClick("week")}
                  className="filter-radio-input"
                />
                <span>Last 7 Days</span>
              </label>
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="date-preset"
                  checked={dateFilter.preset === "month"}
                  onChange={() => handlePresetClick("month")}
                  className="filter-radio-input"
                />
                <span>Last 30 Days</span>
              </label>
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="date-preset"
                  checked={dateFilter.preset === "quarter"}
                  onChange={() => handlePresetClick("quarter")}
                  className="filter-radio-input"
                />
                <span>Last 90 Days</span>
              </label>
              <label className="filter-radio-label">
                <input
                  type="radio"
                  name="date-preset"
                  checked={dateFilter.preset === "year"}
                  onChange={() => handlePresetClick("year")}
                  className="filter-radio-input"
                />
                <span>This Year</span>
              </label>
            </div>
          </div>

          <div className="filter-dropdown-section">
            <div className="filter-dropdown-header">
              <span>Custom Range</span>
            </div>
            <div className="filter-custom-range">
              <div className="filter-input-group">
                <label htmlFor="date-start">From:</label>
                <input
                  id="date-start"
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  max={customEnd || new Date().toISOString().split("T")[0]}
                  className="filter-date-input"
                />
              </div>
              <div className="filter-input-group">
                <label htmlFor="date-end">To:</label>
                <input
                  id="date-end"
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  min={customStart}
                  max={new Date().toISOString().split("T")[0]}
                  className="filter-date-input"
                />
              </div>
              <button
                className="filter-apply-button"
                onClick={handleCustomApply}
                disabled={!customStart && !customEnd}
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
