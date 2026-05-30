import type { ReactNode } from "react";

/**
 * The one shared empty-state template (CONTRACT §11).
 *
 * A centered, narrow card on the --elev-card surface used by every "nothing
 * here yet" surface in the viewer: MissingPage, the empty ChangelogView, the
 * empty-view guard, and the tour landing. Keeping a single template means all
 * empty states share one voice: a quiet line-art glyph, a --text-strong title,
 * a --text-muted body, and an optional ghost-link actions row.
 *
 * Presentation only — it owns no state and triggers no motion of its own. The
 * exact glyph, copy, and exit actions are supplied by the caller so this
 * component never advertises an affordance the surface doesn't actually have.
 */
export interface EmptyStateProps {
  /** Line-art glyph (e.g. a lucide icon). Rendered in --n-400, decorative. */
  icon: ReactNode;
  /** Short --text-strong headline, e.g. "No doc page yet". */
  title: string;
  /** Supporting --text-muted copy. ReactNode so callers can inline a mono ref. */
  body: ReactNode;
  /** Optional ghost-link / primary exits. Row collapses entirely when absent. */
  actions?: ReactNode;
}

export function EmptyState({ icon, title, body, actions }: EmptyStateProps) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div
        role="status"
        className="carto-empty flex w-full max-w-[440px] flex-col items-center px-8 py-8 text-center"
        style={{
          background: "var(--elev-card)",
          border: "1px solid var(--hairline)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <span
          aria-hidden="true"
          className="carto-empty__glyph mb-4 inline-flex items-center justify-center"
          style={{ color: "var(--n-400)" }}
        >
          {icon}
        </span>

        <h2
          className="carto-empty__title text-balance"
          style={{
            margin: 0,
            color: "var(--text-strong)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--fs-md)",
            fontWeight: "var(--fw-semibold)",
            lineHeight: "var(--lh-snug)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          {title}
        </h2>

        <div
          className="carto-empty__body mt-2 text-pretty"
          style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-sans)",
            fontSize: "var(--fs-sm)",
            lineHeight: "var(--lh-base)",
          }}
        >
          {body}
        </div>

        {actions ? (
          <div className="carto-empty__actions mt-6 flex flex-wrap items-center justify-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
