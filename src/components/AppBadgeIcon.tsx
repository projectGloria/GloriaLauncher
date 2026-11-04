import React from "react";
import {
  Sparkles,
  RefreshCw,
  Atom,
  Zap,
  Trash2,
  Crosshair,
  Eye,
  Terminal,
  Search,
  Cpu,
  Music,
  BookOpen,
  GitBranch,
  Archive,
  Video,
  Disc,
  Keyboard,
  Gauge,
  Compass,
  Crown,
  Gamepad2,
  Layers,
  Joystick,
  HardDrive,
  Headphones,
  Sliders,
  Wand2,
  Play,
  Film,
  Tv,
  Box,
  Camera,
  Volume2,
  Smartphone,
  Image,
  Shield,
  Smile,
} from "lucide-react";

interface AppBadgeIconProps {
  iconKey: string;
  accentColor: string;
  isInstalled?: boolean;
  size?: "sm" | "md" | "lg";
}

export const AppBadgeIcon: React.FC<AppBadgeIconProps> = ({
  iconKey,
  accentColor,
  isInstalled = false,
  size = "md",
}) => {
  const dimensions =
    size === "sm"
      ? "w-9 h-9 rounded-[8px]"
      : size === "lg"
      ? "w-14 h-14 rounded-[12px]"
      : "w-11 h-11 rounded-[9px]";

  const iconSize = size === "sm" ? 18 : size === "lg" ? 28 : 22;

  const renderGlyph = () => {
    switch (iconKey) {
      case "rabbit":
        return <Sparkles size={iconSize} strokeWidth={2.2} />;
      case "convert":
        return <RefreshCw size={iconSize} strokeWidth={2.2} />;
      case "atom":
        return <Atom size={iconSize} strokeWidth={2.2} />;
      case "bolt":
        return <Zap size={iconSize} strokeWidth={2.2} />;
      case "broom":
        return <Trash2 size={iconSize} strokeWidth={2.2} />;
      case "crosshair":
        return <Crosshair size={iconSize} strokeWidth={2.2} />;
      case "eye":
        return <Eye size={iconSize} strokeWidth={2.2} />;
      case "terminal":
        return <Terminal size={iconSize} strokeWidth={2.2} />;
      case "search":
        return <Search size={iconSize} strokeWidth={2.2} />;
      case "zap":
        return <Zap size={iconSize} strokeWidth={2.2} />;
      case "cpu":
        return <Cpu size={iconSize} strokeWidth={2.2} />;
      case "music":
        return <Music size={iconSize} strokeWidth={2.2} />;
      case "book":
        return <BookOpen size={iconSize} strokeWidth={2.2} />;
      case "git":
        return <GitBranch size={iconSize} strokeWidth={2.2} />;
      case "archive":
        return <Archive size={iconSize} strokeWidth={2.2} />;
      case "video":
        return <Video size={iconSize} strokeWidth={2.2} />;
      case "disc":
        return <Disc size={iconSize} strokeWidth={2.2} />;
      case "keyboard":
        return <Keyboard size={iconSize} strokeWidth={2.2} />;
      case "gauge":
        return <Gauge size={iconSize} strokeWidth={2.2} />;
      case "compass":
        return <Compass size={iconSize} strokeWidth={2.2} />;
      case "crown":
        return <Crown size={iconSize} strokeWidth={2.2} />;
      case "gamepad":
        return <Gamepad2 size={iconSize} strokeWidth={2.2} />;
      case "layers":
        return <Layers size={iconSize} strokeWidth={2.2} />;
      case "joystick":
        return <Joystick size={iconSize} strokeWidth={2.2} />;
      case "harddrive":
        return <HardDrive size={iconSize} strokeWidth={2.2} />;
      case "headphones":
        return <Headphones size={iconSize} strokeWidth={2.2} />;
      case "sliders":
        return <Sliders size={iconSize} strokeWidth={2.2} />;
      case "wand":
        return <Wand2 size={iconSize} strokeWidth={2.2} />;
      case "play":
        return <Play size={iconSize} strokeWidth={2.2} />;
      case "film":
        return <Film size={iconSize} strokeWidth={2.2} />;
      case "tv":
        return <Tv size={iconSize} strokeWidth={2.2} />;
      case "camera":
        return <Camera size={iconSize} strokeWidth={2.2} />;
      case "volume":
        return <Volume2 size={iconSize} strokeWidth={2.2} />;
      case "smartphone":
        return <Smartphone size={iconSize} strokeWidth={2.2} />;
      case "image":
        return <Image size={iconSize} strokeWidth={2.2} />;
      case "shield":
        return <Shield size={iconSize} strokeWidth={2.2} />;
      case "smile":
        return <Smile size={iconSize} strokeWidth={2.2} />;
      default:
        return <Box size={iconSize} strokeWidth={2.2} />;
    }
  };

  if (isInstalled) {
    return (
      <div
        className={`${dimensions} shrink-0 flex items-center justify-center relative overflow-hidden border transition-transform duration-200 group-hover:scale-[1.03]`}
        style={{
          backgroundColor: accentColor,
          borderColor: "rgba(255,255,255,0.22)",
          color: "#09090b",
          boxShadow: `0 0 20px -4px ${accentColor}55`,
        }}
      >
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.8), transparent 60%)",
          }}
        />
        <span className="relative z-10 text-[#09090b] drop-shadow-xs">
          {renderGlyph()}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${dimensions} shrink-0 flex items-center justify-center relative overflow-hidden border border-[#2c2c34] bg-[#1a1a1f] text-[#a1a1aa] transition-colors duration-200 group-hover:border-[#3f3f4a] group-hover:text-[#e4e4e7]`}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-200 pointer-events-none"
        style={{ backgroundColor: accentColor }}
      />
      <span className="relative z-10">{renderGlyph()}</span>
    </div>
  );
};
