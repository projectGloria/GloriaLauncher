import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Components } from "react-markdown";
import { openExternalUrl } from "../services/platformService";

interface ReadmeViewerProps {
  markdown: string;
  repoId: string;
  branch: string;
}

const GITHUB_OWNER = "projectGloria";

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "picture",
    "source",
    "details",
    "summary",
    "kbd",
    "mark",
    "sub",
    "sup",
    "ins",
    "del",
    "abbr",
    "figure",
    "figcaption",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": [
      ...(defaultSchema.attributes?.["*"] || []),
      "align",
      "className",
      "id",
      "title",
    ],
    img: [
      ...(defaultSchema.attributes?.img || []),
      "src",
      "alt",
      "width",
      "height",
      "align",
      "loading",
    ],
    source: ["srcSet", "srcset", "media", "type"],
    a: [...(defaultSchema.attributes?.a || []), "href", "target", "rel"],
    td: [...(defaultSchema.attributes?.td || []), "align", "colSpan", "rowSpan"],
    th: [...(defaultSchema.attributes?.th || []), "align", "colSpan", "rowSpan"],
    details: ["open"],
  },
};

function isAbsoluteUrl(url: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(url);
}

function resolveRawUrl(url: string, repoId: string, branch: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("data:") || trimmed.startsWith("#")) return trimmed;

  // Convert GitHub blob URLs in image tags to raw.githubusercontent.com so images render.
  const blobMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/i
  );
  if (blobMatch) {
    return `https://raw.githubusercontent.com/${blobMatch[1]}/${blobMatch[2]}/${blobMatch[3]}`;
  }

  if (isAbsoluteUrl(trimmed)) return trimmed;

  const cleanPath = trimmed.replace(/^\.?\//, "");
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${repoId}/${branch}/${cleanPath}`;
}

function resolveRepoLinkUrl(
  href: string,
  repoId: string,
  branch: string
): string {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#")) return trimmed;
  if (isAbsoluteUrl(trimmed)) return trimmed;

  const cleanPath = trimmed.replace(/^\.?\//, "");
  return `https://github.com/${GITHUB_OWNER}/${repoId}/blob/${branch}/${cleanPath}`;
}

function resolveSrcSet(
  srcSet: string,
  repoId: string,
  branch: string
): string {
  return srcSet
    .split(",")
    .map((entry) => {
      const parts = entry.trim().split(/\s+/);
      if (!parts[0]) return entry;
      parts[0] = resolveRawUrl(parts[0], repoId, branch);
      return parts.join(" ");
    })
    .join(", ");
}

function slugifyHeading(children: React.ReactNode): string {
  const text = extractText(children);
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

export const ReadmeViewer: React.FC<ReadmeViewerProps> = ({
  markdown,
  repoId,
  branch,
}) => {
  const components = useMemo<Components>(
    () => ({
      a: ({ href, children, ...props }) => {
        const resolved = href ? resolveRepoLinkUrl(href, repoId, branch) : "";
        const isAnchor = resolved.startsWith("#");
        return (
          <a
            {...props}
            href={resolved || undefined}
            onClick={(e) => {
              if (!resolved) return;
              if (isAnchor) {
                e.preventDefault();
                const targetId = decodeURIComponent(resolved.slice(1));
                const el = document.getElementById(targetId);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              } else {
                e.preventDefault();
                void openExternalUrl(resolved);
              }
            }}
          >
            {children}
          </a>
        );
      },
      img: ({ src, alt, ...props }) => {
        const resolved = src ? resolveRawUrl(src, repoId, branch) : "";
        return (
          <img
            {...props}
            src={resolved}
            alt={alt || ""}
            loading="lazy"
          />
        );
      },
      source: ({ srcSet, ...props }) => {
        const resolved = srcSet
          ? resolveSrcSet(srcSet, repoId, branch)
          : undefined;
        return <source {...props} srcSet={resolved} />;
      },
      h1: ({ children, id, ...props }) => (
        <h1 id={id || slugifyHeading(children)} {...props}>
          {children}
        </h1>
      ),
      h2: ({ children, id, ...props }) => (
        <h2 id={id || slugifyHeading(children)} {...props}>
          {children}
        </h2>
      ),
      h3: ({ children, id, ...props }) => (
        <h3 id={id || slugifyHeading(children)} {...props}>
          {children}
        </h3>
      ),
      h4: ({ children, id, ...props }) => (
        <h4 id={id || slugifyHeading(children)} {...props}>
          {children}
        </h4>
      ),
      table: ({ children, ...props }) => (
        <div className="gloria-readme-table-wrap">
          <table {...props}>{children}</table>
        </div>
      ),
    }),
    [repoId, branch]
  );

  return (
    <div className="gloria-readme p-6 bg-[#0a0a0d] border border-[#1f1f27]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, SANITIZE_SCHEMA]]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
};
