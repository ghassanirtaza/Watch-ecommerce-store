/**
 * Every rich-text field (product descriptions, CMS content, banner
 * text) must pass through this before persisting. Per AI_CONTEXT.md:
 * no raw HTML/script fields anywhere in admin content.
 *
 * NOT YET WIRED to a real sanitization library — this is a Phase 2
 * placeholder that must be replaced with a real allowlist-based
 * sanitizer (e.g. `isomorphic-dompurify` or `sanitize-html`) before
 * any admin-authored content reaches production. Treat the current
 * passthrough-with-strip as unsafe; do not ship it.
 */
export function sanitizeRichText(html: string): string {
  // Minimal stopgap: strips <script> tags and inline event handlers.
  // This is NOT sufficient sanitization on its own — replace with a
  // real library call before Phase 6 (admin CMS) ships to production.
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}
