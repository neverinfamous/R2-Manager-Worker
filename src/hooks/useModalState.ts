import { useState } from "react";

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  itemType: "file" | "folder";
  itemKey: string;
}

interface RenameState {
  isRenaming: boolean;
  itemType: "file" | "folder";
  itemKey: string;
  newName: string;
  error: string;
}

interface UseModalStateReturn {
  // Create folder modal
  showCreateFolderModal: boolean;
  setShowCreateFolderModal: (show: boolean) => void;

  // Dropdowns
  transferDropdownOpen: boolean;
  setTransferDropdownOpen: (open: boolean) => void;
  bucketDropdownOpen: boolean;
  setBucketDropdownOpen: (open: boolean) => void;
  extensionDropdownOpen: boolean;
  setExtensionDropdownOpen: (open: boolean) => void;
  sizeDropdownOpen: boolean;
  setSizeDropdownOpen: (open: boolean) => void;
  dateDropdownOpen: boolean;
  setDateDropdownOpen: (open: boolean) => void;

  // Dropdown positions
  dropdownPosition: { top: number; left: number } | null;
  setDropdownPosition: (pos: { top: number; left: number } | null) => void;
  bucketDropdownPosition: { top: number; left: number } | null;
  setBucketDropdownPosition: (
    pos: { top: number; left: number } | null,
  ) => void;

  // Context menu
  contextMenu: ContextMenuState | null;
  setContextMenu: (menu: ContextMenuState | null) => void;

  // Rename state
  renameState: RenameState | null;
  setRenameState: (
    state:
      | RenameState
      | null
      | ((prev: RenameState | null) => RenameState | null),
  ) => void;
}

export function useModalState(): UseModalStateReturn {
  // Create folder modal
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);

  // Dropdowns
  const [transferDropdownOpen, setTransferDropdownOpen] = useState(false);
  const [bucketDropdownOpen, setBucketDropdownOpen] = useState(false);
  const [extensionDropdownOpen, setExtensionDropdownOpen] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);

  // Dropdown positions
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const [bucketDropdownPosition, setBucketDropdownPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Rename state
  const [renameState, setRenameState] = useState<RenameState | null>(null);

  return {
    showCreateFolderModal,
    setShowCreateFolderModal,
    transferDropdownOpen,
    setTransferDropdownOpen,
    bucketDropdownOpen,
    setBucketDropdownOpen,
    extensionDropdownOpen,
    setExtensionDropdownOpen,
    sizeDropdownOpen,
    setSizeDropdownOpen,
    dateDropdownOpen,
    setDateDropdownOpen,
    dropdownPosition,
    setDropdownPosition,
    bucketDropdownPosition,
    setBucketDropdownPosition,
    contextMenu,
    setContextMenu,
    renameState,
    setRenameState,
  };
}
