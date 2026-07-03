export const BADGE_WORDS: readonly string[] = [
  'fox', 'ember', 'moss', 'wren', 'birch', 'coral', 'dune', 'fern',
  'sage', 'cedar', 'iris', 'kite', 'lark', 'maple', 'newt', 'otter',
  'pearl', 'quill', 'reef', 'slate', 'teal', 'umber', 'vale', 'willow',
  'yarrow', 'zephyr', 'aspen', 'brook', 'cliff', 'delta', 'glen', 'heron',
];

export function assignBadge(used: ReadonlySet<string>): string {
  for (const word of BADGE_WORDS) {
    if (!used.has(word)) {
      return word;
    }
  }
  let index = 1;
  while (used.has(`s${index}`)) {
    index += 1;
  }
  return `s${index}`;
}
