import React from "react";
import { RotateCw, LayoutGrid, List, Search, X } from "lucide-react";
import type { AppCategory } from "../types/app";

export type LauncherViewMode = "grid" | "table";
export type SortOption = "name-asc" | "updated-desc" | "category" | "status";

interface ToolbarProps {
  viewMode: LauncherViewMode;
  onChangeViewMode: (mode: LauncherViewMode) => void;
  sortBy: SortOption;
  onChangeSortBy: (sort: SortOption) => void;
  searchQuery: string;
  onChangeSearchQuery: (q: string) => void;
  selectedCategory: AppCategory | "ALL";
  onChangeCategory: (cat: AppCategory | "ALL") => void;
  isSyncing: boolean;
  onRefresh: () => void;
}

const CATEGORIES: Array<{ label: string; value: AppCategory | "ALL" }> = [
  { label: "ALL", value: "ALL" },
  { label: "DESKTOP", value: "Desktop Apps" },
  { label: "VS CODE", value: "VS Code & Editor" },
  { label: "BROWSER", value: "Browser Extensions" },
  { label: "ANDROID", value: "Android & Mobile" },
  { label: "CLI & SYS", value: "CLI & System" },
];

export const Toolbar: React.FC<ToolbarProps> = ({
  viewMode,
  onChangeViewMode,
  sortBy,
  onChangeSortBy,
  searchQuery,
  onChangeSearchQuery,
  selectedCategory,
  onChangeCategory,
  isSyncing,
  onRefresh,
}) => {
  return (
    <div className="w-full bg-[#0b0b0c] border-b border-[#1f1f24] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
      {/* Left: Refresh Button + Category Filter Pills */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isSyncing}
          title="Refresh catalog & GitHub telemetry"
          className="w-7 h-7 flex items-center justify-center bg-[#121215] border border-[#26262e] text-[#a1a1aa] hover:text-white hover:border-[#3e3e4a] transition-colors cursor-pointer disabled:opacity-50"
        >
          <RotateCw
            size={13}
            className={isSyncing ? "animate-spin text-[#00f0ff]" : ""}
          />
        </button>

        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => onChangeCategory(cat.value)}
                className={`px-2.5 py-1 font-mono-code text-[10px] tracking-[0.14em] uppercase border transition-colors cursor-pointer ${
                  active
                    ? "bg-[#222229] border-[#454552] text-white font-semibold"
                    : "bg-[#111114] border-[#1f1f25] text-[#7c7c88] hover:text-[#d4d4dc] hover:border-[#2e2e38]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Sort Dropdown + Search Box + Grid/List Switcher */}
      <div className="flex items-center gap-2.5 ml-auto">
        {viewMode === "grid" && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-mono-code text-[10px] tracking-[0.16em] text-[#7c7c88] uppercase">
              SORT
            </span>
            <select
              value={sortBy}
              onChange={(e) => onChangeSortBy(e.target.value as SortOption)}
              aria-label="Sort apps"
              className="h-7 bg-[#121215] border border-[#26262e] px-2.5 pr-6 text-xs text-[#e4e4e7] font-sans focus:outline-none focus:border-[#4b4b58] cursor-pointer"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="updated-desc">Last Updated</option>
              <option value="category">Category</option>
              <option value="status">Installed Status</option>
            </select>
          </div>
        )}

        {/* Search Input */}
        <div className="relative flex items-center">
          <Search
            size={12}
            className="absolute left-2.5 text-[#6b6b76] pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onChangeSearchQuery(e.target.value)}
            placeholder="Search apps"
            className="h-7 w-44 sm:w-52 bg-[#121215] border border-[#26262e] pl-7 pr-6 text-xs text-[#f2f1ee] placeholder-[#6b6b76] focus:outline-none focus:border-[#4b4b58] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onChangeSearchQuery("")}
              className="absolute right-2 text-[#7c7c88] hover:text-white cursor-pointer"
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Grid / Table View Switcher (Matches Screenshot 1 & 2 top-right) */}
        <div className="flex items-center border border-[#26262e] bg-[#121215]">
          <button
            type="button"
            onClick={() => onChangeViewMode("grid")}
            title="Grid View"
            className={`w-7 h-7 flex items-center justify-center transition-colors cursor-pointer ${
              viewMode === "grid"
                ? "bg-[#f2f1ee] text-[#0b0b0c]"
                : "text-[#8a8a96] hover:text-white"
            }`}
          >
            <LayoutGrid size={13} />
          </button>
          <button
            type="button"
            onClick={() => onChangeViewMode("table")}
            title="Table View"
            className={`w-7 h-7 flex items-center justify-center border-l border-[#26262e] transition-colors cursor-pointer ${
              viewMode === "table"
                ? "bg-[#f2f1ee] text-[#0b0b0c]"
                : "text-[#8a8a96] hover:text-white"
            }`}
          >
            <List size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
