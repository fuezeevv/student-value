import React from "react";
/** Literal string matching. Never interpret transcript text or a query as HTML/regex. */
export function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query) return <>{text}</>;
  const lower = text.toLocaleLowerCase("ru");
  const needle = query.toLocaleLowerCase("ru");
  const parts: React.ReactNode[] = [];
  let offset = 0;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    parts.push(text.slice(offset, index));
    parts.push(
      <mark key={index} className="bg-cyan-500/30 text-cyan-200 px-1 rounded">
        {text.slice(index, index + query.length)}
      </mark>,
    );
    offset = index + query.length;
    index = lower.indexOf(needle, offset);
  }
  parts.push(text.slice(offset));
  return <>{parts}</>;
}
