import React from "react";
import {
  Settings,
  Minus,
  Square,
  X,
  Download,
  LayoutGrid,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import {
  isTauriDesktop,
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  openExternalUrl,
} from "../services/platformService";

export type ActivePageMode = "launcher" | "showcase";

interface TitlebarProps {
  activeMode: ActivePageMode;
  onChangeMode: (mode: ActivePageMode) => void;
  onOpenSettings: () => void;
  totalAppsCount: number;
  installedCount: number;
}

export const Titlebar: React.FC<TitlebarProps> = ({
  activeMode,
  onChangeMode,
  onOpenSettings,
  totalAppsCount,
  installedCount,
}) => {
  const isDesktop = isTauriDesktop();

  return (
    <header
      data-tauri-drag-region
      className="h-11 w-full bg-[#0b0b0c] border-b border-[#1f1f24] flex items-center justify-between px-4 select-none shrink-0 z-30"
    >
      {/* Left Brand + Suite Navigation */}
      <div className="flex items-center gap-5" data-tauri-drag-region>
        <button
          type="button"
          onClick={() => onChangeMode("launcher")}
          className="flex items-center gap-2.5 text-left group cursor-pointer focus:outline-none"
        >
          <span className="font-display font-extrabold tracking-[0.14em] text-[15px] text-[#f4f4f6] group-hover:text-white transition-colors">
            GLORIA
          </span>
          <span className="text-[#2e2e36] text-xs">|</span>
          <span className="font-mono-code text-[11px] tracking-[0.2em] text-[#8a8a96] uppercase">
            CRAFT APP SUITE
          </span>
        </button>

        {/* Mode Switcher Tabs */}
        <nav className="hidden sm:flex items-center bg-[#121215] border border-[#232329] p-0.5">
          <button
            type="button"
            onClick={() => onChangeMode("launcher")}
            className={`flex items-center gap-1.5 px-2.5 py-1 font-mono-code text-[10px] tracking-[0.14em] uppercase transition-colors cursor-pointer ${
              activeMode === "launcher"
                ? "bg-[#24242b] text-white font-semibold"
                : "text-[#7c7c88] hover:text-[#d4d4dc]"
            }`}
          >
            <LayoutGrid size={11} />
            <span>Launcher</span>
            <span className="text-[9px] text-[#71717a] ml-0.5">
              ({installedCount}/{totalAppsCount})
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChangeMode("showcase")}
            className={`flex items-center gap-1.5 px-2.5 py-1 font-mono-code text-[10px] tracking-[0.14em] uppercase transition-colors cursor-pointer ${
              activeMode === "showcase"
                ? "bg-[#24242b] text-white font-semibold"
                : "text-[#7c7c88] hover:text-[#d4d4dc]"
            }`}
          >
            <Sparkles size={11} />
            <span>Lineup &amp; Showcase</span>
          </button>
        </nav>
      </div>

      {/* Right Controls */}
      <div className="flex items-center h-full">
        {!isDesktop && (
          <button
            type="button"
            onClick={() =>
              openExternalUrl(
                "https://github.com/projectGloria/GloriaLauncher/releases"
              )
            }
            className="hidden md:flex items-center gap-1.5 mr-3 px-2.5 py-1 bg-[#f2f1ee] hover:bg-white text-[#0b0b0c] font-mono-code text-[10px] font-semibold tracking-[0.12em] uppercase transition-colors cursor-pointer"
            title="Download native Windows GloriaLauncher"
          >
            <Download size={11} strokeWidth={2.4} />
            <span>Get Desktop App</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => openExternalUrl("https://github.com/projectGloria")}
          className="hidden lg:flex items-center gap-1 px-3 h-full border-l border-[#1f1f24] text-[#8a8a96] hover:text-white hover:bg-[#141418] font-mono-code text-[10px] tracking-[0.14em] uppercase transition-colors cursor-pointer"
          title="Open @projectGloria on GitHub"
        >
          <span>@projectGloria</span>
          <ExternalLink size={10} />
        </button>

        {/* Settings Icon */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-10 h-full flex items-center justify-center border-l border-[#1f1f24] text-[#8a8a96] hover:text-white hover:bg-[#141418] transition-colors cursor-pointer"
          title="Launcher Settings"
        >
          <Settings size={14} />
        </button>

        {/* Native Window Controls (Desktop Tauri Mode) */}
        {isDesktop && (
          <div className="flex items-center h-full border-l border-[#1f1f24]">
            <button
              type="button"
              onClick={minimizeWindow}
              className="w-10 h-full flex items-center justify-center text-[#8a8a96] hover:text-white hover:bg-[#18181d] transition-colors cursor-pointer"
              title="Minimize"
            >
              <Minus size={13} />
            </button>
            <button
              type="button"
              onClick={toggleMaximizeWindow}
              className="w-10 h-full flex items-center justify-center text-[#8a8a96] hover:text-white hover:bg-[#18181d] transition-colors cursor-pointer"
              title="Maximize"
            >
              <Square size={11} />
            </button>
            <button
              type="button"
              onClick={closeWindow}
              className="w-10 h-full flex items-center justify-center text-[#8a8a96] hover:text-white hover:bg-[#dc143c] transition-colors cursor-pointer"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
