/** 貼り付け用のゆるいパース（プレビュー用） */
export type ParsedRoot = {
  label: string;
  score: number | null;
  deviation: number | null;
  children: { label: string; deviation: number | null }[];
};

export function parseTestPaste(text: string): ParsedRoot[] {
  const lines = text.split(/\r?\n/);
  const roots: ParsedRoot[] = [];
  let current: ParsedRoot | null = null;

  const rootRe = /^(.+?)\s+([\d.]+)\s*点?\s*(?:偏差値?)?\s*([\d.]+)?\s*$/;
  const rootRe2 = /^(.+?)\s+偏差値?\s*([\d.]+)\s*$/;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) continue;

    if (/^\s/.test(raw)) {
      const cm = line.match(/^\s*(.+?)\s+(?:偏差値?)?\s*([\d.]+)\s*$/);
      if (cm && current) {
        current.children.push({
          label: cm[1].trim(),
          deviation: parseFloat(cm[2]),
        });
      }
      continue;
    }

    let m = line.match(rootRe);
    if (m) {
      current = {
        label: m[1].trim(),
        score: parseFloat(m[2]),
        deviation: m[3] != null ? parseFloat(m[3]) : null,
        children: [],
      };
      roots.push(current);
      continue;
    }
    m = line.match(rootRe2);
    if (m) {
      current = {
        label: m[1].trim(),
        score: null,
        deviation: parseFloat(m[2]),
        children: [],
      };
      roots.push(current);
      continue;
    }

    const simple = line.match(/^(.+?)\s+([\d.]+)\s+([\d.]+)\s*$/);
    if (simple) {
      current = {
        label: simple[1].trim(),
        score: parseFloat(simple[2]),
        deviation: parseFloat(simple[3]),
        children: [],
      };
      roots.push(current);
    }
  }

  return roots;
}
