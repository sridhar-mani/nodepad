import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

// Resolve the /content/blog directory relative to the project root.
// Using process.cwd() is required in the App Router because __dirname
// is not reliable in Next.js server bundles.
const BLOG_DIR = path.join(process.cwd(), 'content', 'blog')

export interface PostMeta {
  slug: string
  title: string
  description: string
  date: string
  author?: string
  tags?: string[]
  category?: string
  readingTime?: string
}

export interface Post extends PostMeta {
  content: string
}

/**
 * Returns a list of all blog post slugs without reading file contents.
 * Safe to call on large directories — only the filename is inspected.
 */
export function getAllSlugs(): string[] {
  if (!fs.existsSync(BLOG_DIR)) return []
  return fs
    .readdirSync(BLOG_DIR)
    .filter((file) => file.endsWith('.md'))
    .map((file) => file.replace(/\.md$/, ''))
}

/**
 * Returns metadata for every post (no body content).
 * Uses streaming-friendly sequential reads — suitable for generating
 * a blog index even on large corpora.
 */
export function getAllPostMeta(): PostMeta[] {
  const slugs = getAllSlugs()
  return slugs
    .map((slug) => {
      const filePath = path.join(BLOG_DIR, `${slug}.md`)
      const raw = fs.readFileSync(filePath, 'utf-8')
      const { data } = matter(raw)
      return {
        slug,
        title: data.title ?? slug,
        description: data.description ?? '',
        date: data.date ? String(data.date) : '',
        author: data.author,
        tags: data.tags,
        category: data.category,
        readingTime: data.readingTime,
      } satisfies PostMeta
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1)) // newest first
}

/**
 * Reads and parses a single post by slug.
 * Returns null if the file does not exist.
 *
 * This is intentionally NOT called at build time with generateStaticParams.
 * Instead, it is invoked on each request (SSR/ISR), keeping memory usage
 * flat regardless of corpus size.
 */
export function getPostBySlug(slug: string): Post | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)

  return {
    slug,
    content,
    title: data.title ?? slug,
    description: data.description ?? '',
    date: data.date ? String(data.date) : '',
    author: data.author,
    tags: data.tags,
    category: data.category,
    readingTime: data.readingTime,
  }
}
