import React, { useState } from "react";
import { X, KeyRound, RotateCcw, Check } from "lucide-react";
import { isTauriDesktop } from "../services/platformService";

interface SettingsModalProps {
  isOpen: boolean;
  githubToken: string;
  onSaveToken: (token: string) => void;
  onResetPinned: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  githubToken,
  onSaveToken,
  onResetPinned,
  onClose,
}) => {
  const [tokenInput, setTokenInput] = useState(githubToken);
  const [saved, setSaved] = useState(false);
  const isDesktop = isTauriDesktop();

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveToken(tokenInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[2px] p-4">
      <div className="w-full max-w-lg bg-[#0e0e12] border border-[#282832] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1f1f26] flex items-center justify-between">
          <div className="font-mono-code text-xs font-bold tracking-[0.18em] text-[#f4f4f6] uppercase">
            GLORIA LAUNCHER SETTINGS
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center bg-[#15151b] hover:bg-[#23232c] border border-[#2a2a35] text-[#a1a1aa] hover:text-white cursor-pointer"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-5">
          <div>
            <label className="flex items-center gap-1.5 font-mono-code text-[10.5px] font-semibold tracking-[0.14em] text-[#d4d4dc] uppercase mb-2">
              <KeyRound size={12} className="text-[#00f0ff]" />
              <span>GitHub Personal Access Token (Optional)</span>
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ghp_... (Increases GitHub API rate limit from 60 to 5,000 req/hr)"
              className="w-full h-9 bg-[#141419] border border-[#2b2b36] px-3 text-xs text-[#f2f1ee] placeholder-[#6b6b76] font-mono-code focus:outline-none focus:border-[#00f0ff]"
            />
            <p className="mt-1.5 text-[11px] text-[#7c7c88] leading-relaxed">
              Stored locally on your device only. Used when querying{" "}
              <code>api.github.com/users/projectGloria</code> for live release
              assets and commit timestamps.
            </p>
          </div>

          <div className="pt-3 border-t border-[#1f1f26] flex items-center justify-between">
            <button
              type="button"
              onClick={onResetPinned}
              className="h-8 px-3 bg-[#15151a] hover:bg-[#22222b] border border-[#2b2b36] text-[#a1a1aa] hover:text-white font-mono-code text-[10px] tracking-[0.14em] uppercase flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>
                {isDesktop ? "Rescan Local Workspace" : "Reset Default Pinned"}
              </span>
            </button>

            <button
              type="submit"
              className="h-8 px-4 bg-[#f2f1ee] hover:bg-white text-[#0b0b0c] font-mono-code text-[10.5px] font-bold tracking-[0.16em] uppercase flex items-center gap-1.5 cursor-pointer"
            >
              {saved && <Check size={12} />}
              <span>{saved ? "SAVED" : "SAVE SETTINGS"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
