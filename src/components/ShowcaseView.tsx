import React from "react";
import {
  ArrowUpRight,
  Download,
  LayoutGrid,
  Check,
  Copy,
  Sparkles,
} from "lucide-react";
import type { GloriaAppEntry, InstalledAppRecord } from "../types/app";
import { AppBadgeIcon } from "./AppBadgeIcon";
import { isTauriDesktop, openExternalUrl } from "../services/platformService";
import { Trans, useTranslation } from "react-i18next";

interface ShowcaseViewProps {
  apps: GloriaAppEntry[];
  installedMap: Record<string, InstalledAppRecord>;
  onSwitchToLauncher: () => void;
  onInspectApp: (app: GloriaAppEntry) => void;
  onPrimaryAction: (app: GloriaAppEntry, isInstalled: boolean) => void;
}

export const ShowcaseView: React.FC<ShowcaseViewProps> = ({
  apps,
  installedMap,
  onSwitchToLauncher,
  onInspectApp,
  onPrimaryAction,
}) => {
  const [copied, setCopied] = React.useState(false);
  const { t } = useTranslation();
  const isDesktop = isTauriDesktop();

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#0b0b0c] text-[#f2f1ee]">
      {/* SECTION 01: EDITORIAL HERO (getartcraft.com/apps style) */}
      <section className="max-w-7xl mx-auto px-6 pt-14 pb-16 border-x border-[#1f1f24]">
        <div className="flex items-center gap-3 font-mono-code text-[11px] tracking-[0.2em] text-[#8a8a96] uppercase mb-5">
          <span className="text-[#f2f1ee] font-semibold">{t("showcase.kicker")}</span>
          <span>·</span>
          <span>{t("showcase.appsCount", { count: apps.length })}</span>
          <span>·</span>
          <span>{t("showcase.openSource")}</span>
          <span>·</span>
          <span>{t("showcase.localFirst")}</span>
        </div>

        <h1 className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight text-[#f4f4f6] leading-[1.06] max-w-4xl">
          {t("showcase.heroTitle", { count: apps.length })}{" "}
          <span className="font-serif-editorial italic font-normal text-[#dc143c]">
            {t("showcase.heroAccent")}
          </span>
          .
        </h1>

        <p className="mt-6 text-base sm:text-lg text-[#a1a1aa] max-w-3xl leading-relaxed">
          <Trans
            i18nKey="showcase.heroBody"
            components={{ 1: <span className="text-[#f2f1ee] font-medium" /> }}
          />
        </p>

        {/* Primary CTA Buttons */}
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onSwitchToLauncher}
            className="h-11 px-6 bg-[#f2f1ee] hover:bg-white text-[#0b0b0c] font-mono-code text-xs font-bold tracking-[0.16em] uppercase flex items-center gap-2 transition-colors cursor-pointer"
          >
            <LayoutGrid size={14} />
            <span>{t("showcase.openLauncher")}</span>
          </button>

          {!isDesktop && (
            <button
              type="button"
              onClick={() =>
                openExternalUrl(
                  "https://github.com/projectGloria/GloriaLauncher/releases"
                )
              }
              className="h-11 px-5 bg-[#141418] hover:bg-[#1e1e24] border border-[#2e2e38] text-[#f2f1ee] font-mono-code text-xs font-semibold tracking-[0.15em] uppercase flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download size={14} />
              <span>{t("showcase.downloadDesktop")}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              openExternalUrl("https://github.com/projectGloria?tab=repositories")
            }
            className="h-11 px-5 bg-[#121215] hover:bg-[#1a1a20] border border-[#26262e] text-[#a1a1aa] hover:text-white font-mono-code text-xs tracking-[0.15em] uppercase flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span>{t("showcase.browseGithub")}</span>
            <ArrowUpRight size={14} />
          </button>

          <button
            type="button"
            onClick={handleCopyUrl}
            className="h-11 px-4 bg-[#121215] hover:bg-[#1a1a20] border border-[#26262e] text-[#8a8a96] hover:text-white font-mono-code text-[11px] tracking-[0.14em] uppercase flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check size={13} className="text-[#22c55e]" /> : <Copy size={13} />}
            <span>{copied ? t("showcase.copiedLink") : t("showcase.copyLink")}</span>
          </button>
        </div>

        {/* Recommended Notice Banner */}
        <div className="mt-6 inline-flex items-center gap-2.5 px-3.5 py-2 bg-[#121216] border border-[#23232c] text-xs text-[#9ca3af]">
          <Sparkles size={13} className="text-[#dc143c] shrink-0" />
          <span>
            <strong className="text-[#f2f1ee]">{t("showcase.recommendedLabel")}</strong>{" "}
            {t("showcase.recommendedBody")}
          </span>
        </div>

        {/* Interactive App Dock Strip (just like getartcraft.com/apps) */}
        <div className="mt-12 pt-8 border-t border-[#1f1f24]">
          <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 lg:grid-cols-12 gap-3">
            {apps.slice(0, 24).map((app) => (
              <button
                key={app.id}
                type="button"
                onClick={() => onInspectApp(app)}
                className="group flex flex-col items-center p-2.5 bg-[#101013] hover:bg-[#18181d] border border-[#1f1f25] hover:border-[#34343f] transition-all cursor-pointer text-center"
              >
                <AppBadgeIcon
                  repoId={app.id}
                  iconKey={app.iconKey}
                  accentColor={app.accentColor}
                  isInstalled={ true }
                  size="sm"
                />
                <span className="mt-2 font-sans text-[11px] font-medium text-[#d4d4dc] group-hover:text-white truncate w-full">
                  {app.displayName}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 02: THE LINEUP (Numbered Showcase Cards) */}
      <section className="max-w-7xl mx-auto border-x border-t border-[#1f1f24]">
        <div className="px-6 py-8 border-b border-[#1f1f24] flex flex-col sm:flex-row sm:items-end justify-between gap-4 bg-[#0d0d10]">
          <div>
            <div className="font-mono-code text-[11px] tracking-[0.2em] text-[#8a8a96] uppercase mb-2">
              {t("showcase.lineupKicker")}
            </div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#f4f4f6]">
              {t("showcase.lineupTitle")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onSwitchToLauncher}
            className="font-mono-code text-[11px] tracking-[0.16em] text-[#38bdf8] hover:underline uppercase cursor-pointer"
          >
            {t("showcase.switchToLauncher")}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app, idx) => {
            const isInstalled = Boolean(installedMap[app.id]);
            const num = String(idx + 1).padStart(2, "0");

            return (
              <div
                key={app.id}
                onClick={() => onInspectApp(app)}
                className="group relative flex flex-col justify-between p-6 border-b border-r border-[#1f1f24] bg-[#0b0b0c] hover:bg-[#121216] transition-colors cursor-pointer"
              >
                <div>
                  {/* Index + Category */}
                  <div className="flex items-center justify-between font-mono-code text-[10.5px] tracking-[0.16em] text-[#7c7c88] uppercase mb-5">
                    <span>
                      <strong className="text-[#f4f4f6]">{num}</strong> ·{" "}
                      {t(`categories.${app.category}`, { defaultValue: app.category })}
                    </span>
                    <span
                      style={{ color: app.accentColor }}
                      className="font-semibold"
                    >
                      v{app.version}
                    </span>
                  </div>

                  {/* Icon + Big Two-Tone Title */}
                  <div className="flex items-center gap-3.5 mb-4">
                    <AppBadgeIcon
                      repoId={app.id}
                      iconKey={app.iconKey}
                      accentColor={app.accentColor}
                      isInstalled={true}
                      size="md"
                    />
                    <div>
                      <h3 className="font-display font-bold text-xl text-[#f4f4f6]">
                        <span>{app.titlePrefix}</span>
                        <span style={{ color: app.accentColor }}>
                          {app.titleAccent}
                        </span>
                      </h3>
                      <p className="text-xs text-[#8a8a96]">{app.subtitle}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs sm:text-[13px] text-[#a1a1aa] leading-relaxed mb-5 line-clamp-3">
                    {app.description}
                  </p>
                </div>

                <div>
                  {/* Platform & Tech Badges */}
                  <div className="flex items-center flex-wrap gap-1.5 mb-5">
                    {app.platforms.map((plat) => (
                      <span
                        key={plat}
                        className="px-2 py-0.5 bg-[#15151a] border border-[#262630] font-mono-code text-[9.5px] tracking-[0.12em] text-[#d4d4dc] uppercase"
                      >
                        {plat}
                      </span>
                    ))}
                    {app.techStack.slice(0, 3).map((tech) => (
                      <span
                        key={tech}
                        lang="en"
                        className="px-2 py-0.5 bg-[#111114] border border-[#1f1f26] font-mono-code text-[9.5px] tracking-[0.1em] text-[#7c7c88]"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>

                  {/* Bottom Explore / Launch Row */}
                  <div className="pt-3 border-t border-[#1c1c22] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectApp(app);
                      }}
                      className="font-mono-code text-[11px] font-semibold tracking-[0.14em] text-[#e4e4e7] group-hover:text-white uppercase flex items-center gap-1 cursor-pointer"
                    >
                      <span>{t("showcase.explore", { name: app.displayName })}</span>
                      <ArrowUpRight size={13} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPrimaryAction(app, isInstalled);
                      }}
                      className="px-3 py-1 bg-[#1b1b22] hover:bg-[#f2f1ee] text-[#d4d4dc] hover:text-[#0b0b0c] border border-[#2e2e38] font-mono-code text-[10px] font-semibold tracking-[0.14em] uppercase transition-colors cursor-pointer"
                    >
                      {isInstalled
                        ? t("app.open")
                        : !isDesktop && app.webUrl
                        ? t("app.launchWeb")
                        : t("app.install")}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 03: PRINCIPLES (getartcraft.com/apps 03 / Principles style) */}
      <section className="max-w-7xl mx-auto border-x border-t border-b border-[#1f1f24] mb-12">
        <div className="px-6 py-8 border-b border-[#1f1f24] bg-[#0d0d10]">
          <div className="font-mono-code text-[11px] tracking-[0.2em] text-[#8a8a96] uppercase mb-2">
            {t("showcase.principlesKicker")}
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#f4f4f6]">
            {t("showcase.principlesTitle")}{" "}
            <span className="font-serif-editorial italic font-normal text-[#00f0ff]">
              Temet Nosce.
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              num: "01",
              title: t("showcase.principles.openSourceTitle"),
              body: t("showcase.principles.openSourceBody"),
            },
            {
              num: "02",
              title: t("showcase.principles.localTitle"),
              body: t("showcase.principles.localBody"),
            },
            {
              num: "03",
              title: t("showcase.principles.speedTitle"),
              body: t("showcase.principles.speedBody"),
            },
            {
              num: "04",
              title: t("showcase.principles.unifiedTitle"),
              body: t("showcase.principles.unifiedBody"),
            },
          ].map((p) => (
            <div
              key={p.num}
              className="p-6 border-r border-b lg:border-b-0 border-[#1f1f24] bg-[#0b0b0c]"
            >
              <div className="font-mono-code text-xs font-bold text-[#dc143c] mb-3">
                {p.num}
              </div>
              <h3 className="font-display font-bold text-lg text-[#f4f4f6] mb-2">
                {p.title}
              </h3>
              <p className="text-xs text-[#9ca3af] leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
