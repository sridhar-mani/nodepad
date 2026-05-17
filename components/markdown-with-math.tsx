"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import type { Components } from "react-markdown"

import "katex/dist/katex.min.css"

interface MarkdownWithMathProps {
  children: string
  className?: string
  components?: Components
}

export function MarkdownWithMath({
  children,
  className,
  components,
}: MarkdownWithMathProps) {
  return (
    <ReactMarkdown
      className={className}
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {children}
    </ReactMarkdown>
  )
}
