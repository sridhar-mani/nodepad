import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getPostBySlug } from '@/lib/blog'

// ─────────────────────────────────────────────────────────────────────────────
// Scalability note:
//   generateStaticParams is intentionally OMITTED here.
//   Without it, Next.js defaults to dynamic (SSR) rendering for every slug.
//   Setting `revalidate` below enables ISR: the first request builds the page
//   on-demand, and subsequent requests reuse the cached render until the TTL
//   expires. This keeps memory flat at build time regardless of corpus size.
// ─────────────────────────────────────────────────────────────────────────────

// ISR: cache each rendered post for 5 minutes, then refresh on next request.
export const revalidate = 300

// ── Dynamic Open Graph metadata ──────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}

  return {
    title: `${post.title} — Nodepad Blog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
      authors: post.author ? [post.author] : undefined,
      tags: post.tags,
    },
  }
}

// ── Page component ────────────────────────────────────────────────────────────
export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  if (!post) notFound()

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ── Sticky breadcrumb ── */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Nodepad
          </Link>
          <span className="text-border">/</span>
          <Link
            href="/blog"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Blog
          </Link>
          <span className="text-border">/</span>
          <span className="truncate text-foreground font-medium max-w-[280px]">
            {post.title}
          </span>
        </div>
      </div>

      <article className="max-w-4xl mx-auto px-6 py-16">
        {/* ── Post header ── */}
        <header className="mb-12">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-5">
            {post.date && (
              <time dateTime={post.date}>
                {new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </time>
            )}
            {post.author && (
              <>
                <span>·</span>
                <span>{post.author}</span>
              </>
            )}
            {post.readingTime && (
              <>
                <span>·</span>
                <span>{post.readingTime}</span>
              </>
            )}
          </div>

          <h1 className="text-4xl font-bold tracking-tight leading-tight mb-5">
            {post.title}
          </h1>

          {post.description && (
            <p className="text-xl text-muted-foreground leading-relaxed border-l-4 border-primary/50 pl-4">
              {post.description}
            </p>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-6">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-3 py-1 rounded-full bg-accent text-accent-foreground border border-border/50"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* ── Markdown body ── */}
        <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3 prose-p:leading-relaxed prose-p:text-[0.96rem] prose-li:text-[0.96rem] prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-hr:border-border/50 prose-blockquote:border-primary/40 prose-blockquote:text-muted-foreground prose-code:bg-accent prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-accent prose-pre:border prose-pre:border-border/50">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {post.content}
          </ReactMarkdown>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-20 pt-8 border-t border-border/50 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <Link
            href="/blog"
            className="hover:text-foreground transition-colors"
          >
            ← All articles
          </Link>
          <Link href="/" className="hover:text-foreground transition-colors">
            Open Nodepad →
          </Link>
        </footer>
      </article>
    </main>
  )
}
