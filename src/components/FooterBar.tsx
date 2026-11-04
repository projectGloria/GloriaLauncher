import React from "react";
import { Globe, GitBranch, Sparkles, Monitor, Terminal } from "lucide-react";
import { isTauriDesktop, openExternalUrl } from "../services/platformService";

interface FooterBarProps {
  checkedAt: Date;
  isSyncing: boolean;
  totalApps: number;
  installedCount: number;
}

export const FooterBar: React.FC<FooterBarProps> = ({
  checkedAt,
  isSyncing,
  totalApps,
  installedCount,
}) => {
  const isDesktop = isTauriDesktop();

  const timeDiffLabel = () => {
    if (isSyncing) return "SYNCING WITH GITHUB API...";
    const diffSec = Math.floor((Date.now() - checkedAt.getTime()) / 1000);
    if (diffSec < 90) return "CHECKED JUST NOW";
    const mins = Math.floor(diffSec / 60);
    return `CHECKED ${mins}M AGO`;
  };

  return (
    <footer className="h-8 w-full bg-[#0b0b0c] border-t border-[#1f1f24] px-4 flex items-center justify-between select-none shrink-0 z-20">
      {/* Left Telemetry Status (Matches Screenshot bottom-left) */}
      <div className="flex items-center gap-2 font-mono-code text-[9.5px] tracking-[0.18em] text-[#6b6b76] uppercase truncate">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isSyncing ? "bg-[#00f0ff] animate-pulse" : "bg-[#22c55e]"
          }`}
        />
        <span>
          {timeDiffLabel()} · USING GLORIA API AND GITHUB ({installedCount}/
          {totalApps} {isDesktop ? "INSTALLED" : "PINNED"})
        </span>
      </div>

      {/* Right Social & Ecosystem Icons (Matches Screenshot bottom-right) */}
      <div className="flex items-center gap-3.5 text-[#6b6b76]">
        <span className="hidden sm:inline-flex items-center gap-1 font-mono-code text-[9.5px] tracking-[0.14em] text-[#7c7c88] uppercase">
          {isDesktop ? <Monitor size={11} /> : <Globe size={11} />}
          <span>{isDesktop ? "DESKTOP RUNTIME" : "WEB EDITION"}</span>
        </span>

        <button
          type="button"
          onClick={() => openExternalUrl("https://projectgloria.github.io/GloriaLauncher/")}
          title="GloriaLauncher Web (GitHub Pages)"
          className="hover:text-white transition-colors cursor-pointer"
        >
          <Globe size={12} />
        </button>

        <button
          type="button"
          onClick={() => openExternalUrl("https://github.com/projectGloria")}
          title="@projectGloria on GitHub"
          className="hover:text-white transition-colors cursor-pointer"
        >
          <GitBranch size={12} />
        </button>

        <button
          type="button"
          onClick={() =>
            openExternalUrl(
              "https://marketplace.visualstudio.com/items?itemName=Nihilnia.gloria-theme"
            )
          }
          title="Gloria Theme on VS Code Marketplace"
          className="hover:text-white transition-colors cursor-pointer"
        >
          <Sparkles size={12} />
        </button>

        <button
          type="button"
          onClick={() => openExternalUrl("https://github.com/Nihilnia")}
          title="Built by Nihil"
          className="hover:text-white transition-colors cursor-pointer"
        >
          <Terminal size={12} />
        </button>
      </div>
    </footer>
  );
};
