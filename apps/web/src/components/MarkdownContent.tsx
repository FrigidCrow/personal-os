import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function MarkdownContent({ content, compact = false }: { content: string; compact?: boolean }) {
  return (
    <div className={`markdown-content${compact ? " markdown-content-compact" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, title }) => <a href={href} title={title} target="_blank" rel="noreferrer">{children}</a>
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
