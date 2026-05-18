import Link from 'next/link'
import type { Metadata } from 'next'
import { getAllPostMeta } from '@/lib/blog'

export const metadata: Metadata = {
  title: 'Blog — Nodepad',
  description:
    'Guides, deep-dives, and tutorials on spatial note-taking, AI-augmented research, mind mapping, and knowledge management with Nodepad.',
}

// ISR: revalidate the blog index page every 60 seconds so new posts
// appear without a full rebuild.
export const revalidate = 60

export default function BlogIndexPage() {
  const posts = getAllPostMeta()

  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* ── Header ── */}
      <div className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Nodepad
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium">Blog</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* ── Hero ── */}
        <div className="mb-14">
          <h1 className="text-4xl font-bold tracking-tight mb-3">
            The Nodepad Blog
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Deep-dives into spatial note-taking, AI-augmented research, mind
            mapping, and the future of knowledge work.
          </p>
        </div>

        {/* ── Post list ── */}
        {posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet — check back soon.</p>
        ) : (
          <ul className="space-y-px">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col gap-2 rounded-xl p-6 -mx-6 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {post.date && (
                      <time dateTime={post.date}>
                        {new Date(post.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </time>
                    )}
                    {post.category && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{post.category}</span>
                      </>
                    )}
                    {post.readingTime && (
                      <>
                        <span>·</span>
                        <span>{post.readingTime}</span>
                      </>
                    )}
                  </div>

                  <h2 className="text-xl font-semibold leading-snug group-hover:text-primary transition-colors">
                    {post.title}
                  </h2>

                  {post.description && (
                    <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2">
                      {post.description}
                    </p>
                  )}

                  {post.tags && post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1">
                      {post.tags.slice(0, 4).map((tag) => (
                        <span
                          key={tag}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground border border-border/50"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
