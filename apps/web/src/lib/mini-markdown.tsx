import type { ReactNode } from "react";

/** Rendu Markdown minimal (titres, paragraphes, listes, gras, liens internes) pour les pages éditoriales. */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((\/[^)\s]*|https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={`${key}-b${i++}`}>{m[1]}</strong>);
    else
      out.push(
        <a key={`${key}-a${i++}`} href={m[3]}>
          {m[2]}
        </a>,
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function MiniMarkdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n{2,}/);
  return (
    <div className="prose-cs">
      {blocks.map((b, i) => {
        const k = String(i);
        if (b.startsWith("### ")) return <h3 key={k}>{inline(b.slice(4), k)}</h3>;
        if (b.startsWith("## ")) return <h2 key={k}>{inline(b.slice(3), k)}</h2>;
        if (/^- /m.test(b) && b.split("\n").every((l) => l.startsWith("- ")))
          return (
            <ul key={k}>
              {b.split("\n").map((l, j) => (
                <li key={j}>{inline(l.slice(2), `${k}-${j}`)}</li>
              ))}
            </ul>
          );
        return <p key={k}>{inline(b.replace(/\n/g, " "), k)}</p>;
      })}
    </div>
  );
}
