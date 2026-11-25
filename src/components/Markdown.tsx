"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/cn";

type MarkdownProps = {
  children: string;
  className?: string;
};

/**
 * Editorial Markdown. Links open in a new tab with `noreferrer`; images are
 * never rendered because briefings are text-only by design.
 */
export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("editorial-prose", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children: label }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              title={href}
            >
              {label}
            </a>
          ),
          img: () => null,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
