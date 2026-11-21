import { useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

// Markdown for descriptions (features, items, spells). Single line breaks are kept, as in the
// plain-text descriptions written before markdown support. Raw HTML is not rendered.
const COMPONENTS = {
  p:          ({ node, ...p }) => <p dir="auto" className="mt-2 first:mt-0" {...p} />,
  h1:         ({ node, ...p }) => <h4 dir="auto" className="mt-3 first:mt-0 text-base font-bold text-stone-100" {...p} />,
  h2:         ({ node, ...p }) => <h4 dir="auto" className="mt-3 first:mt-0 text-sm font-bold text-stone-100" {...p} />,
  h3:         ({ node, ...p }) => <h5 dir="auto" className="mt-2 first:mt-0 text-sm font-semibold text-stone-200" {...p} />,
  h4:         ({ node, ...p }) => <h5 dir="auto" className="mt-2 first:mt-0 text-sm font-semibold text-stone-200" {...p} />,
  h5:         ({ node, ...p }) => <h6 dir="auto" className="mt-2 first:mt-0 text-xs font-semibold text-stone-300" {...p} />,
  h6:         ({ node, ...p }) => <h6 dir="auto" className="mt-2 first:mt-0 text-xs font-semibold text-stone-300" {...p} />,
  strong:     ({ node, ...p }) => <strong className="font-semibold text-stone-100" {...p} />,
  em:         ({ node, ...p }) => <em className="italic" {...p} />,
  ul:         ({ node, ...p }) => <ul dir="auto" className="mt-1 first:mt-0 list-disc ps-5 space-y-0.5" {...p} />,
  ol:         ({ node, ...p }) => <ol dir="auto" className="mt-1 first:mt-0 list-decimal ps-5 space-y-0.5" {...p} />,
  a:          ({ node, ...p }) => <a className="text-sky-400 underline hover:text-sky-300" target="_blank" rel="noopener noreferrer"
                                     onClick={e => e.stopPropagation()} {...p} />,
  blockquote: ({ node, ...p }) => <blockquote dir="auto" className="mt-2 first:mt-0 border-s-2 border-stone-600 ps-3 text-stone-400 italic" {...p} />,
  code:       ({ node, ...p }) => <code className="rounded bg-stone-900 px-1 font-mono text-[0.85em]" {...p} />,
  pre:        ({ node, ...p }) => <pre className="mt-2 first:mt-0 overflow-x-auto rounded bg-stone-900 p-2 [&>code]:bg-transparent [&>code]:p-0" {...p} />,
  hr:         () => <hr className="my-3 border-stone-700" />,
  table:      ({ node, ...p }) => <div className="mt-2 first:mt-0 overflow-x-auto"><table className="border-collapse text-xs" {...p} /></div>,
  th:         ({ node, ...p }) => <th dir="auto" className="border border-stone-600 bg-stone-900/60 px-2 py-1 text-start font-semibold" {...p} />,
  td:         ({ node, ...p }) => <td dir="auto" className="border border-stone-700 px-2 py-1" {...p} />,
}

export default function Markdown({ text, className = '' }) {
  if (!text) return null
  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={COMPONENTS}>{text}</ReactMarkdown>
    </div>
  )
}

// Syntax reference: what you type → what it looks like
const EXAMPLES = [
  ['Bold',           '**Bonus action**'],
  ['Italic',         '*once per turn*'],
  ['Bold + italic',  '***Critical!***'],
  ['Strikethrough',  '~~Old rule~~'],
  ['Heading',        '## At higher levels'],
  ['Smaller heading','### Usage'],
  ['Bullet list',    '- Advantage on STR checks\n- Resistance to slashing'],
  ['Numbered list',  '1. Mark the target\n2. Add 1d4 damage'],
  ['Checklist',      '- [x] Infused armor\n- [ ] Infused weapon'],
  ['Link',           '[Rules](https://www.dndbeyond.com)'],
  ['Quote',          '> You cannot be surprised.'],
  ['Inline code',    'Roll `1d8+DEX`'],
  ['Divider',        'Above\n\n---\n\nBelow'],
  ['Table',          '| Level | Damage |\n|---|---|\n| 1 | 1d6 |\n| 5 | 3d6 |'],
]

function MarkdownHelp({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 text-left">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-stone-900 border border-stone-700 rounded-xl shadow-xl max-w-2xl w-full max-h-full flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-700">
          <h3 className="text-lg font-bold text-stone-100">Formatting descriptions</h3>
          <button type="button" onClick={onClose} className="text-stone-400 hover:text-stone-200 p-1"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 text-sm text-stone-300 leading-relaxed">
          <p className="mt-3">
            Descriptions of features, items and spells support <b>Markdown</b>: plain text with a few symbols for formatting.
            Each line break starts a new line, and an empty line starts a new paragraph. In the PDF export the symbols are
            removed and the text is printed plainly.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="text-stone-400 text-left">
                  <th className="py-1.5 pr-3 font-semibold">For</th>
                  <th className="py-1.5 pr-3 font-semibold">Type</th>
                  <th className="py-1.5 font-semibold">Shows as</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLES.map(([label, src]) => (
                  <tr key={label} className="border-t border-stone-800 align-top">
                    <td className="py-2 pr-3 text-stone-400 whitespace-nowrap">{label}</td>
                    <td className="py-2 pr-3"><pre className="font-mono text-amber-200/90 whitespace-pre-wrap break-words">{src}</pre></td>
                    <td className="py-2"><Markdown text={src} className="text-stone-300 text-sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-stone-400">
            To show a symbol literally (e.g. a real asterisk), put a backslash before it: <code className="font-mono text-amber-200/90">\*</code>.
          </p>
        </div>
      </div>
    </div>
  )
}

// Small link under a description box that opens the syntax reference
export function MarkdownHelpLink({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className={`text-xs text-sky-400 hover:text-sky-300 underline underline-offset-2 ${className}`}>
        Formatting help
      </button>
      {open && <MarkdownHelp onClose={() => setOpen(false)} />}
    </>
  )
}
