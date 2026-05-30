import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import { ArrowRight, FileX2, Link2 } from 'lucide-react'

import { EmptyState } from './EmptyState'
import type { DocPage } from '../lib/types'

// ============================================================================
// MarkdownPage — CONTRACT §11. Renders a doc page from the inlined data island.
//
// Fixture truth: pages/**.md DO NOT EXIST, so `pages` is `{}` and EVERY doc
// route lands on the missing-page state — that is the common case, not the edge
// case. The gate below keeps <Markdown> from ever receiving a non-string body.
//
// react-markdown v9 gotchas baked in here:
//   - the <code> override has NO `inline` prop -> detect a fenced block via the
//     className carrying `language-`.
//   - <Markdown> dropped its own root `className` -> wrap it in our own div.
//   - raw HTML is escaped by default (no rehype-raw) -> safe for agent docs.
//   - the default urlTransform already neutralises `javascript:` links; we only
//     decide the safe target/rel pair for external links.
// ============================================================================

export interface MarkdownPageProps {
  /** The node's `data.doc` ref (a key into the pages island). */
  docRef?: string
  /** The resolved page, or undefined when the file never existed. */
  page?: DocPage
  /** Selects the node on the canvas (the launchpad out of the empty state). */
  onOpenInArchitecture?: (nodeId: string) => void
  /** The node's Source URL (data.links[0].url) for "Copy source link". */
  sourceUrl?: string
}

/** True when there is no page or the body is empty/whitespace -> show MissingPage. */
function isPageMissing(page?: DocPage): boolean {
  if (!page) return true
  if (typeof page.body !== 'string') return true
  return page.body.trim() === ''
}

/** v9: no `inline` prop. A fenced block is the one whose className has `language-`. */
function isFencedCode(className?: string): boolean {
  return /\blanguage-[\w-]+/.test(className ?? '')
}

/** External http(s) links open in a new tab with a hardened rel; others stay in-tab. */
function safeLinkAttrs(href?: string): { target?: string; rel?: string } {
  if (href && /^https?:\/\//i.test(href)) {
    return { target: '_blank', rel: 'noopener noreferrer' }
  }
  return {}
}

// Element -> Cartograph token map. The colour/typography rhythm lives in the
// scoped .carto-md__* stylesheet (read tokens directly) so block-level styling
// never collides with other component CSS blocks. The wrapper div carries the
// contract's `cartograph-prose max-w-[72ch]` (v9 dropped <Markdown>'s className).
const components: Components = {
  h1: (p) => <h1 className="carto-md__h1" {...p} />,
  h2: (p) => <h2 className="carto-md__h2" {...p} />,
  h3: (p) => <h3 className="carto-md__h3" {...p} />,
  p: (p) => <p className="carto-md__p" {...p} />,
  ul: (p) => <ul className="carto-md__ul" {...p} />,
  ol: (p) => <ol className="carto-md__ol" {...p} />,
  li: (p) => <li className="carto-md__li" {...p} />,
  a: ({ href, ...p }) => (
    <a href={href} {...safeLinkAttrs(href)} className="carto-md__a" {...p} />
  ),
  blockquote: (p) => <blockquote className="carto-md__quote" {...p} />,
  code({ className, children, ...rest }) {
    if (isFencedCode(className)) {
      // fenced block: keep the language- class for downstream styling/hljs hooks.
      return (
        <code className={`carto-md__code-block ${className ?? ''}`} {...rest}>
          {children}
        </code>
      )
    }
    return (
      <code className="carto-md__code-inline" {...rest}>
        {children}
      </code>
    )
  },
  pre: (p) => <pre className="carto-md__pre" {...p} />,
  table: (p) => (
    <div className="carto-md__table-wrap">
      <table className="carto-md__table" {...p} />
    </div>
  ),
  thead: (p) => <thead className="carto-md__thead" {...p} />,
  th: (p) => <th className="carto-md__th" {...p} />,
  td: (p) => <td className="carto-md__td" {...p} />,
  hr: () => <hr className="carto-md__hr" />,
  img: ({ alt, ...p }) => <img alt={alt ?? ''} className="carto-md__img" {...p} />,
}

/**
 * The missing-page empty state (CONTRACT §11) — the COMMON case for the fixture.
 * Centered card via the shared EmptyState template: line-art doc-slash glyph,
 * "No doc page yet", the EXACT docRef in a mono `--canvas-sunken` well, and two
 * actions: primary "Open in architecture" (--n-900 fill / --text-on-accent) +
 * ghost "Copy source link".
 */
export function MissingPage({
  docRef,
  onOpenInArchitecture,
  sourceUrl,
}: Pick<MarkdownPageProps, 'docRef' | 'onOpenInArchitecture' | 'sourceUrl'>) {
  const [copied, setCopied] = useState(false)

  const nodeId = docRefToNodeId(docRef)
  const canOpen = Boolean(nodeId && onOpenInArchitecture)

  const copySourceLink = async () => {
    if (!sourceUrl) return
    try {
      await navigator.clipboard?.writeText(sourceUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard denied (e.g. file://) — leave the affordance honest, no crash.
    }
  }

  const body = docRef
    ? 'This node points to a doc page that has not been written yet.'
    : 'This node has no linked doc page yet.'

  return (
    <div className="carto-md__missing-host">
      <EmptyState
        icon={<FileX2 size={36} strokeWidth={1.5} aria-hidden />}
        title="No doc page yet"
        body={
          <>
            <span>{body}</span>
            {docRef ? (
              <code className="carto-md__docref-well" title={docRef}>
                {docRef}
              </code>
            ) : null}
          </>
        }
        actions={
          <>
            {canOpen ? (
              <button
                type="button"
                className="carto-md__action carto-md__action--primary"
                onClick={() => onOpenInArchitecture?.(nodeId as string)}
              >
                Open in architecture
                <ArrowRight size={14} strokeWidth={2} aria-hidden />
              </button>
            ) : null}
            {sourceUrl ? (
              <button
                type="button"
                className="carto-md__action carto-md__action--ghost"
                onClick={copySourceLink}
                aria-live="polite"
              >
                <Link2 size={14} strokeWidth={2} aria-hidden />
                {copied ? 'Copied' : 'Copy source link'}
              </button>
            ) : null}
          </>
        }
      />
    </div>
  )
}

/**
 * MarkdownPage — gates the renderer. If the page is missing/empty it shows the
 * MissingPage launchpad; otherwise it renders the themed react-markdown body in
 * its own wrapper div (v9 dropped the root className).
 */
export function MarkdownPage({
  docRef,
  page,
  onOpenInArchitecture,
  sourceUrl,
}: MarkdownPageProps) {
  if (isPageMissing(page)) {
    return (
      <MissingPage
        docRef={docRef}
        onOpenInArchitecture={onOpenInArchitecture}
        sourceUrl={sourceUrl}
      />
    )
  }

  // page is guaranteed non-empty here.
  const title =
    typeof page?.frontmatter?.title === 'string' ? page.frontmatter.title : null

  return (
    <article className="carto-md__article">
      {title ? <h1 className="carto-md__h1 carto-md__doc-title">{title}</h1> : null}
      <div className="cartograph-prose max-w-[72ch]">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {page!.body}
        </Markdown>
      </div>
    </article>
  )
}

/**
 * Derive the canvas node id from a doc ref. The App binds `onOpenInArchitecture`
 * already knowing the route's node; we pass the docRef (the only handle we hold)
 * so the button is never dead when a ref exists. Returns null only when there is
 * nothing to open, so the primary action collapses cleanly.
 */
function docRefToNodeId(docRef?: string): string | null {
  return docRef && docRef.trim() ? docRef : null
}
