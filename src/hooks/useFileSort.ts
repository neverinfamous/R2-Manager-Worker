import { useState, useCallback, useRef } from "react";
import { getFileExtension } from "../utils/fileUtils";

interface FileObject {
  key: string;
  size: number;
  uploaded: string;
  url: string;
}

type SortField = "name" | "size" | "type" | "uploaded";
type SortDirection = "asc" | "desc";

interface SortState {
  field: SortField;
  direction: SortDirection;
}

interface UseFileSortReturn {
  sortState: SortState;
  sortDropdownOpen: boolean;
  sortDropdownPosition: { top: number; left: number } | null;
  sortButtonRef: React.RefObject<HTMLButtonElement | null>;
  sortedFilesRef: React.RefObject<FileObject[]>;
  sortFiles: (files: FileObject[]) => FileObject[];
  updateSortState: (field: SortField) => void;
  handleSortButtonClick: () => void;
  getSortLabel: () => string;
  setSortDropdownOpen: (open: boolean) => void;
  setSortDropdownPosition: (pos: { top: number; left: number } | null) => void;
}

export function useFileSort(): UseFileSortReturn {
  const [sortState, setSortState] = useState<SortState>({
    field: "uploaded",
    direction: "desc",
  });
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [sortDropdownPosition, setSortDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const sortButtonRef = useRef<HTMLButtonElement>(null);
  const sortedFilesRef = useRef<FileObject[]>([]);

  const sortFiles = useCallback(
    (files: FileObject[]) => {
      return [...files].sort((a, b) => {
        let result = 0;

        switch (sortState.field) {
          case "name":
            result = a.key.localeCompare(b.key, undefined, {
              numeric: true,
              sensitivity: "base",
            });
            break;
          case "size":
            result = a.size - b.size;
            break;
          case "type": {
            const typeA = getFileExtension(a.key);
            const typeB = getFileExtension(b.key);
            result = typeA.localeCompare(typeB);
            if (result === 0) {
              result = a.key.localeCompare(b.key);
            }
            break;
          }
          case "uploaded": {
            const dateA = new Date(a.uploaded).getTime();
            const dateB = new Date(b.uploaded).getTime();
            result = dateA - dateB;
            break;
          }
        }

        return sortState.direction === "asc" ? result : -result;
      });
    },
    [sortState],
  );

  const updateSortState = useCallback((field: SortField) => {
    setSortState((prev) => ({
      field,
      direction:
        prev.field === field && prev.direction === "asc" ? "desc" : "asc",
    }));
    setSortDropdownOpen(false);
  }, []);

  const handleSortButtonClick = useCallback(() => {
    if (!sortDropdownOpen && sortButtonRef.current) {
      const rect = sortButtonRef.current.getBoundingClientRect();
      setSortDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
    setSortDropdownOpen(!sortDropdownOpen);
  }, [sortDropdownOpen]);

  const getSortLabel = useCallback(() => {
    const fieldLabels: Record<SortField, string> = {
      name: "Name",
      size: "Size",
      type: "Type",
      uploaded: "Uploaded",
    };
    return fieldLabels[sortState.field];
  }, [sortState]);

  return {
    sortState,
    sortDropdownOpen,
    sortDropdownPosition,
    sortButtonRef,
    sortedFilesRef,
    sortFiles,
    updateSortState,
    handleSortButtonClick,
    getSortLabel,
    setSortDropdownOpen,
    setSortDropdownPosition,
  };
}
