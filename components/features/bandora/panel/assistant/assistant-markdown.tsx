import { Fragment } from "react";
import { parseMarkdown, type Inline } from "./assistant-model";

function Inlines({ items }: { items: Inline[] }) {
  return (
    <>
      {items.map((item, index) => {
        if (item.type === "strong") return <strong key={index}>{item.text}</strong>;
        if (item.type === "em") return <em key={index}>{item.text}</em>;
        if (item.type === "code") return <code key={index} dir="ltr">{item.text}</code>;
        return <Fragment key={index}>{item.text}</Fragment>;
      })}
    </>
  );
}

/** Model reply as safe React elements. Each block picks its own direction (Persian or English). */
export function AssistantMarkdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  return (
    <div className="bd-md">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "heading":
            return <h3 key={index} dir="auto" className={block.level <= 2 ? "bd-md__h2" : "bd-md__h3"}><Inlines items={block.inlines} /></h3>;
          case "list": {
            const items = block.items.map((item, i) => <li key={i} dir="auto"><Inlines items={item} /></li>);
            return block.ordered ? <ol key={index} start={block.start}>{items}</ol> : <ul key={index}>{items}</ul>;
          }
          case "code":
            return <pre key={index} dir="ltr"><code>{block.text}</code></pre>;
          case "rule":
            return <hr key={index} />;
          default:
            return <p key={index} dir="auto"><Inlines items={block.inlines} /></p>;
        }
      })}
    </div>
  );
}
