/**
 * BucketColorPicker Component
 *
 * A self-contained dropdown component for setting bucket colors.
 * Uses fixed positioning to escape overflow containers.
 */

import { useState, useRef, useLayoutEffect, useEffect, type JSX } from "react";
import {
  BUCKET_COLORS,
  getColorHex,
  type BucketColor,
} from "../../utils/bucketColors";
import "./bucket-colors.css";

interface BucketColorPickerProps {
  /** Current color value */
  value: BucketColor;
  /** Callback when color changes */
  onChange: (color: BucketColor) => Promise<void> | void;
  /** Disable the picker */
  disabled?: boolean;
}

interface DropdownPosition {
  top?: number;
  bottom?: number;
  right: number;
}

/**
 * Color picker for bucket visual organization
 */
export function BucketColorPicker({
  value,
  onChange,
  disabled = false,
}: BucketColorPickerProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate fixed position for dropdown based on button position and available space
  useLayoutEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      const spaceBelow = viewportHeight - rect.bottom;
      const dropdownHeight = 180; // Approximate height including "Remove color" button

      // Calculate right position (align right edge of dropdown with right edge of button)
      const rightPos = viewportWidth - rect.right;

      // Open above if not enough space below (with some margin)
      if (spaceBelow < dropdownHeight + 10) {
        setPosition({
          bottom: viewportHeight - rect.top + 4,
          right: rightPos,
        });
      } else {
        setPosition({
          top: rect.bottom + 4,
          right: rightPos,
        });
      }
    } else {
      setPosition(null);
    }
  }, [isOpen]);

  // Close dropdown when clicking outside (more reliable than backdrop)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      // Use mousedown for immediate response
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleColorSelect = async (color: BucketColor): Promise<void> => {
    setLoading(true);
    try {
      await onChange(color);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const colorHex = value ? getColorHex(value) : undefined;
  const colorLabel = value
    ? BUCKET_COLORS.find((c) => c.value === value)?.label
    : undefined;

  return (
    <div
      className="bucket-color-picker"
      ref={containerRef}
      data-open={isOpen ? "true" : undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        disabled={disabled || loading}
        className="bucket-color-button"
        title={colorLabel ? `Color: ${colorLabel}` : "Set color"}
        aria-label={colorLabel ? `Color: ${colorLabel}` : "Set color"}
      >
        {loading ? (
          <span className="bucket-color-spinner">...</span>
        ) : colorHex ? (
          <span
            className="bucket-color-dot"
            style={{ backgroundColor: colorHex }}
          />
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="bucket-color-palette-icon"
            aria-hidden="true"
          >
            <circle cx="13.5" cy="6.5" r="2.5" />
            <circle cx="19" cy="11.5" r="2.5" />
            <circle cx="17.5" cy="18" r="2.5" />
            <circle cx="8.5" cy="18" r="2.5" />
            <circle cx="5" cy="11.5" r="2.5" />
            <path d="M12 2a10 10 0 1 0 10 10c0-1.35-.27-2.63-.75-3.8" />
          </svg>
        )}
      </button>

      {isOpen && position && (
        <div
          className="bucket-color-dropdown"
          style={{
            top:
              position.top !== undefined
                ? `${String(position.top)}px`
                : undefined,
            bottom:
              position.bottom !== undefined
                ? `${String(position.bottom)}px`
                : undefined,
            right: `${String(position.right)}px`,
          }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Color picker"
        >
          <div className="bucket-color-grid">
            {BUCKET_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => void handleColorSelect(color.value)}
                disabled={loading}
                className={`bucket-color-option ${value === color.value ? "selected" : ""}`}
                style={{ backgroundColor: getColorHex(color.value) }}
                title={color.label}
                aria-label={`Set color to ${color.label}`}
              />
            ))}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => void handleColorSelect(null)}
              disabled={loading}
              className="bucket-color-remove"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              Remove color
            </button>
          )}
        </div>
      )}
    </div>
  );
}
