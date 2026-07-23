/**
 * Mirrors how Cursor names `~/.cursor/projects/<slug>` from an absolute workspace path (Unix).
 * Used only for --workspace selection and authoring-guide match — never to invent abs paths from slugs.
 *
 * Observed Cursor behavior: strip leading `/`, replace `/` and `_` with `-` (underscores in
 * path segments become hyphens in the slug).
 */
export function encodeCursorProjectSlug(absPath: string): string {
  const normalized = absPath.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalized.replace(/^\//, '').replaceAll('/', '-').replaceAll('_', '-');
}
