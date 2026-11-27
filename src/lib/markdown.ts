export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "link"; text: string; href: string };

export type MarkdownBlock =
  | { type: "h"; level: 2 | 3; inlines: Inline[] }
  | { type: "p"; inlines: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][] };

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/;

export function safeHref(href: string): string | null {
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    const url = new URL(href);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return null;
  }
  return null;
}

export function parseInlines(source: string): Inline[] {
  const inlines: Inline[] = [];
  let rest = source;
  while (rest.length) {
    const bold = rest.match(/^\*\*([^*]+)\*\*/);
    const italic = rest.match(/^\*([^*]+)\*/);
    const link = rest.match(LINK);
    const starts = [
      bold ? { kind: "bold" as const, index: 0, match: bold } : null,
      italic ? { kind: "italic" as const, index: 0, match: italic } : null,
      link && link.index === 0 ? { kind: "link" as const, index: 0, match: link } : null,
    ].filter((item) => item && item.match.index === 0);
    if (link && link.index !== undefined && link.index > 0 && starts.length === 0) {
      inlines.push({ type: "text", text: rest.slice(0, link.index) });
      rest = rest.slice(link.index);
      continue;
    }
    if (bold && bold.index === 0) {
      inlines.push({ type: "bold", text: bold[1] });
      rest = rest.slice(bold[0].length);
      continue;
    }
    if (italic && italic.index === 0) {
      inlines.push({ type: "italic", text: italic[1] });
      rest = rest.slice(italic[0].length);
      continue;
    }
    if (link && link.index === 0) {
      const href = safeHref(link[2]);
      inlines.push(href ? { type: "link", text: link[1], href } : { type: "text", text: link[0] });
      rest = rest.slice(link[0].length);
      continue;
    }
    const next = rest.slice(1).search(/[*[]/);
    const take = next === -1 ? rest.length : next + 1;
    inlines.push({ type: "text", text: rest.slice(0, take) });
    rest = rest.slice(take);
  }
  return inlines.filter((inline) => inline.type !== "text" || inline.text.length > 0);
}

export function parseMarkdown(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "h", level: heading[1].length === 2 ? 2 : 3, inlines: parseInlines(heading[2]) });
      index += 1;
      continue;
    }
    if (line.trim().startsWith("- ")) {
      const items: Inline[][] = [];
      while (index < lines.length && lines[index].trim().startsWith("- ")) {
        items.push(parseInlines(lines[index].trim().slice(2)));
        index += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !lines[index].match(/^#{2,3}\s/) && !lines[index].trim().startsWith("- ")) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "p", inlines: parseInlines(paragraph.join(" ")) });
  }
  return blocks;
}
