// Plain text for places that can't render markdown (the PDF export)
const ESCAPABLE = /\\([\\`*_{}[\]()#+\-.!|>~])/g

export function stripMarkdown(text) {
  if (!text) return text
  // Hide escaped symbols (\*) from the rules below, then put them back without the backslash
  const escaped = []
  const hide = s => s.replace(ESCAPABLE, (_, c) => `\u0000${escaped.push(c) - 1}\u0000`)
  return hide(String(text))
    .replace(/```[^\n]*\n?/g, '')                                       // code fences
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')                                 // headings
    .replace(/^\s{0,3}>\s?/gm, '')                                      // blockquotes
    .replace(/^\s*([-*_])(\s*\1){2,}\s*$/gm, '')                        // horizontal rules
    .replace(/^(\s*)[-*+]\s+\[([ xX])\]\s+/gm, (_, s, c) => `${s}${c === ' ' ? '☐' : '☑'} `) // task lists
    .replace(/^(\s*)[-*+]\s+/gm, '$1• ')                                // bullet lists
    .replace(/^\s*\|?(\s*:?-+:?\s*\|)+\s*:?-*:?\s*$/gm, '')             // table separator rows
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')                           // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')                            // links
    .replace(/(\*\*|__)(.+?)\1/g, '$2')                                 // bold
    .replace(/(^|[^\w*])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1$2')           // italic *x*
    .replace(/(^|[^\w_])_(?!\s)([^_\n]+?)_(?!\w)/g, '$1$2')             // italic _x_
    .replace(/~~(.+?)~~/g, '$1')                                        // strikethrough
    .replace(/`([^`]+)`/g, '$1')                                        // inline code
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\u0000(\d+)\u0000/g, (_, i) => escaped[i])
}
