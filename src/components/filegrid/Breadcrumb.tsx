import { type JSX } from "react";

interface BreadcrumbItem {
  name: string;
  path: string;
}

interface BreadcrumbProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Breadcrumb = ({
  currentPath,
  onNavigate,
}: BreadcrumbProps): JSX.Element | null => {
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    if (!currentPath) return [];
    const parts = currentPath.split("/").filter(Boolean);
    const breadcrumbs = parts.map((part, index) => ({
      name: part,
      path: parts.slice(0, index + 1).join("/"),
    }));
    return breadcrumbs;
  };

  if (!currentPath) return null;

  const breadcrumbs = getBreadcrumbs();

  return (
    <div
      style={{
        padding: "10px 0",
        marginBottom: "10px",
        borderBottom: "1px solid #333",
        display: "flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "14px",
      }}
    >
      <button
        onClick={() => onNavigate("")}
        style={{
          background: "transparent",
          border: "none",
          color: "#4a9eff",
          cursor: "pointer",
          padding: "4px 8px",
          fontSize: "14px",
        }}
      >
        🏠 Root
      </button>
      {breadcrumbs.map((crumb, index) => (
        <span
          key={crumb.path}
          style={{ display: "flex", alignItems: "center", gap: "5px" }}
        >
          <span style={{ color: "#666" }}>›</span>
          <button
            onClick={() => onNavigate(crumb.path)}
            style={{
              background: "transparent",
              border: "none",
              color: index === breadcrumbs.length - 1 ? "#fff" : "#4a9eff",
              cursor: index === breadcrumbs.length - 1 ? "default" : "pointer",
              padding: "4px 8px",
              fontSize: "14px",
              fontWeight: index === breadcrumbs.length - 1 ? "bold" : "normal",
            }}
            disabled={index === breadcrumbs.length - 1}
          >
            {crumb.name}
          </button>
        </span>
      ))}
    </div>
  );
};
