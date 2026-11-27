import type { Inline, MarkdownBlock } from "@/lib/markdown";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((item, index) => {
        if (item.type === "bold") return <strong key={index}>{item.text}</strong>;
        if (item.type === "italic") return <em key={index}>{item.text}</em>;
        if (item.type === "link")
          return (
            <a key={index} href={item.href} className="text-ink underline decoration-line underline-offset-2" target={item.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {item.text}
            </a>
          );
        return <span key={index}>{item.text}</span>;
      })}
    </>
  );
}

export function RichText({ blocks }: { blocks: MarkdownBlock[] }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-secondary">
      {blocks.map((block, index) => {
        if (block.type === "h") {
          const Tag = block.level === 2 ? "h3" : "h4";
          return (
            <Tag key={index} className="pt-1 text-sm font-medium text-ink">
              <Inlines items={block.inlines} />
            </Tag>
          );
        }
        if (block.type === "ul" || block.type === "ol") {
          const Tag = block.type === "ul" ? "ul" : "ol";
          return (
            <Tag key={index} className={block.type === "ul" ? "list-disc space-y-1 pl-5" : "list-decimal space-y-1 pl-5"}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inlines items={item} />
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={index}>
            <Inlines items={block.inlines} />
          </p>
        );
      })}
    </div>
  );
}
