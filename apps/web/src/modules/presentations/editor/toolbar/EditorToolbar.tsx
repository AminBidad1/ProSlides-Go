import {
  FileText,
  LayoutList,
  Paintbrush,
  Volume2,
  type LucideIcon,
} from "lucide-react";

import type { EditorPanelTab } from "../model/useEditorPanelController.ts";

type ToolbarItem = {
  id: EditorPanelTab;
  label: string;
  icon: LucideIcon;
  mobileOnly?: boolean;
};

type EditorToolbarProps = {
  activeTab: EditorPanelTab | null;
  setActiveTab: (tab: EditorPanelTab) => void;
  isCompact?: boolean;
};

const items: ToolbarItem[] = [
  {
    id: "slides",
    label: "اسلایدها",
    icon: LayoutList,
    mobileOnly: true,
  },
  { id: "content", label: "محتوا", icon: FileText },
  { id: "design", label: "طراحی", icon: Paintbrush },
  { id: "audio", label: "صدا", icon: Volume2 },
];

export default function RightToolbar({
  activeTab,
  setActiveTab,
  isCompact = false,
}: EditorToolbarProps) {
  const containerClass = isCompact
    ? "fixed inset-x-0 bottom-0 z-40 flex h-16 w-full flex-row items-center justify-around gap-2 border-t border-brand-border bg-surface/95 px-2 py-2 shadow-panel backdrop-blur"
    : "flex h-full w-16 shrink-0 flex-col items-center gap-1.5 rounded-panel border border-brand-border bg-surface px-1.5 py-3 shadow-card";

  return (
    <div
      className={containerClass}
      style={
        isCompact
          ? {
              paddingBottom:
                "calc(0.5rem + env(safe-area-inset-bottom))",
            }
          : undefined
      }
      aria-label="ابزارهای ویرایشگر"
      dir="rtl"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        const visibilityClass =
          item.mobileOnly && !isCompact ? "hidden" : "";

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex h-12 min-w-12 flex-col items-center justify-center gap-1 rounded-control px-2 transition-colors ${
              isActive
                ? "bg-brand-muted text-brand-strong"
                : "text-content-muted hover:bg-brand-soft hover:text-brand"
            } ${visibilityClass}`}
            aria-pressed={isActive}
            aria-label={item.label}
          >
            <Icon size={22} strokeWidth={2} aria-hidden="true" />
            <span className="text-[11px] font-medium leading-none">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
