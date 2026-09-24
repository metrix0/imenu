// components/assistant/SalesMarkdown.tsx
"use client";

import type { ReactNode } from "react";

export default function SalesMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-4 text-sm leading-7 text-gray-700">
      {parseBlocks(content)}
    </div>
  );
}

function parseBlocks(source: string) {
  const lines = repairRepeatedBoldLabels(source)
    .replace(/\r\n?/g, "\n")
    .split("\n");
  const output: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fence = /^```([^\s`]*)\s*$/.exec(trimmed);
    if (fence) {
      const language = fence[1] || null;
      const code: string[] = [];
      index += 1;

      while (index < lines.length && !/^```\s*$/.test(lines[index]!.trim())) {
        code.push(lines[index]!);
        index += 1;
      }

      if (index < lines.length) index += 1;

      output.push(
        <pre
          key={`code-${output.length}`}
          className="overflow-x-auto rounded-xl border border-gray-200 bg-gray-950 px-4 py-3 text-xs leading-6 text-gray-100"
        >
          {language ? (
            <div className="mb-2 border-b border-white/10 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
              {language}
            </div>
          ) : null}
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const className =
        level === 1
          ? "text-xl font-bold tracking-tight text-gray-950"
          : level === 2
            ? "text-base font-bold text-gray-950"
            : "text-sm font-bold text-gray-900";

      output.push(
        level === 1 ? (
          <h2 key={`heading-${output.length}`} className={className}>
            {renderInline(text)}
          </h2>
        ) : level === 2 ? (
          <h3 key={`heading-${output.length}`} className={className}>
            {renderInline(text)}
          </h3>
        ) : (
          <h4 key={`heading-${output.length}`} className={className}>
            {renderInline(text)}
          </h4>
        ),
      );
      index += 1;
      continue;
    }

    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      output.push(
        <hr key={`rule-${output.length}`} className="border-gray-200" />,
      );
      index += 1;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index]!.trim())) {
        quote.push(lines[index]!.trim().replace(/^>\s?/, ""));
        index += 1;
      }

      output.push(
        <blockquote
          key={`quote-${output.length}`}
          className="rounded-r-xl border-l-4 border-brand/35 bg-brand-soft/35 px-4 py-3 text-gray-600"
        >
          {renderInlineLines(quote)}
        </blockquote>,
      );
      continue;
    }

    if (isTableStart(lines, index)) {
      const tableLines = [lines[index]!, lines[index + 1]!];
      index += 2;

      while (
        index < lines.length &&
        lines[index]!.includes("|") &&
        lines[index]!.trim()
      ) {
        tableLines.push(lines[index]!);
        index += 1;
      }

      output.push(renderTable(tableLines, output.length));
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = /^\s*[-*+]\s+(.+)$/.exec(lines[index]!);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }

      output.push(
        <ul
          key={`ul-${output.length}`}
          className="list-disc space-y-1.5 pl-5 marker:text-brand"
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (index < lines.length) {
        const match = /^\s*\d+[.)]\s+(.+)$/.exec(lines[index]!);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }

      output.push(
        <ol
          key={`ol-${output.length}`}
          className="list-decimal space-y-1.5 pl-5 marker:font-bold marker:text-brand"
        >
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    const paragraph = [trimmed];
    index += 1;

    while (index < lines.length && lines[index]!.trim()) {
      if (startsBlock(lines, index)) break;
      paragraph.push(lines[index]!.trim());
      index += 1;
    }

    output.push(
      <p key={`paragraph-${output.length}`} className="text-gray-700">
        {renderInlineLines(paragraph)}
      </p>,
    );
  }

  return output;
}

function repairRepeatedBoldLabels(value: string) {
  return value
    .replace(/^\s*\*{4}([^*\n]+?):\*{2}\s+\*{2}\s*/gm, "**$1:** ")
    .replace(/^\s*_{4}([^_\n]+?):_{2}\s+_{2}\s*/gm, "__$1:__ ");
}

function startsBlock(lines: string[], index: number) {
  const line = lines[index] ?? "";
  const trimmed = line.trim();

  return (
    /^```/.test(trimmed) ||
    /^(#{1,3})\s+/.test(trimmed) ||
    /^>\s?/.test(trimmed) ||
    /^\s*[-*+]\s+/.test(line) ||
    /^\s*\d+[.)]\s+/.test(line) ||
    /^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line) ||
    isTableStart(lines, index)
  );
}

function isTableStart(lines: string[], index: number) {
  const header = lines[index] ?? "";
  const separator = lines[index + 1] ?? "";

  return (
    header.includes("|") &&
    /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separator)
  );
}

function renderTable(lines: string[], keyIndex: number) {
  const header = splitTableRow(lines[0]);
  const rows = lines.slice(2).map(splitTableRow);

  return (
    <div
      key={`table-${keyIndex}`}
      className="overflow-x-auto rounded-xl border border-gray-200"
    >
      <table className="min-w-full border-collapse text-left text-xs">
        <thead className="bg-gray-50 text-gray-700">
          <tr>
            {header.map((cell, index) => (
              <th
                key={index}
                className="border-b border-gray-200 px-3 py-2.5 font-bold"
              >
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-gray-100 last:border-0"
            >
              {header.map((_, cellIndex) => (
                <td
                  key={cellIndex}
                  className="px-3 py-2.5 align-top text-gray-600"
                >
                  {renderInline(row[cellIndex] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderInlineLines(lines: string[]) {
  return lines.flatMap((line, index) => [
    ...(index > 0 ? [<br key={`break-${index}`} />] : []),
    ...renderInline(line, `line-${index}`),
  ]);
}

function renderInline(text: string, keyPrefix = "inline") {
  const tokenPattern =
    /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\([^\s)]+\)|\*[^*\n]+\*|_[^_\n]+_)/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));

    const token = match[0];
    const key = `${keyPrefix}-${nodes.length}`;

    if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      nodes.push(
        <strong key={key} className="font-bold text-gray-950">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[0.9em] font-semibold text-gray-800"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^\s)]+)\)$/.exec(token);
      const href = link ? safeHref(link[2]) : null;
      nodes.push(
        href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
          >
            {link![1]}
          </a>
        ) : (
          token
        ),
      );
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      );
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function safeHref(value: string) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? value : null;
  } catch {
    return null;
  }
}
