"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createMonthlyReportAction,
  deleteMonthlyReportAction,
  listAllTestNodesForChartsAction,
  listTestNodesAction,
  saveTestNodesAction,
} from "@/app/actions/tests";
import { SUBJECTS, subjectById, type SubjectId } from "@/lib/subjects";
import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Cell,
} from "recharts";

type Report = { id: string; year_month: string; title: string | null };
type TNode = {
  id: string;
  report_id: string;
  parent_id: string | null;
  label: string;
  subject_key: string | null;
  score: number | null;      // 教科=得点, 単元=得点
  deviation: number | null;  // 教科=偏差値, 単元=配点
  scale10: number | null;
  rank_national: string | null;
  rank_gender: string | null;
  sort_order: number;
};

type UnitInput = { tmpId: string; label: string; score: string; maxScore: string };
type SubjectInput = {
  tmpId: string;
  subjectKey: SubjectId;
  score: string;
  deviation: string;
  scale10: string;
  rankNational: string;
  rankGender: string;
  units: UnitInput[];
};

type Tab = "input" | "trend" | "weak" | "units";

function getRating(score: number, max: number) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 90) return { label: "A", pct: Math.round(pct), cls: "bg-emerald-100 text-emerald-700 border-emerald-300" };
  if (pct >= 70) return { label: "B", pct: Math.round(pct), cls: "bg-sky-100 text-sky-700 border-sky-300" };
  if (pct >= 40) return { label: "C", pct: Math.round(pct), cls: "bg-amber-100 text-amber-700 border-amber-300" };
  return { label: "D", pct: Math.round(pct), cls: "bg-rose-100 text-rose-700 border-rose-300" };
}

function barColor(pct: number) {
  if (pct >= 90) return "#34d399";
  if (pct >= 70) return "#38bdf8";
  if (pct >= 40) return "#fbbf24";
  return "#fb7185";
}

const DEFAULT_SUBJECTS: SubjectId[] = ["japanese", "math"];

const SUBJECT_NAME_MAP: Record<string, SubjectId> = {
  国語: "japanese", 算数: "math", 理科: "science", 社会: "social", 適性: "aptitude",
};

// ── Claude プロンプトテキスト ──────────────────────────────────────
const PHOTO1_PROMPT = `テスト成績表の写真を見て、以下のフォーマットで出力してください。

【フォーマット】
国語 得点:78 偏差値:57 10段階:7 全国順位:214/803 男女別順位:128/443
  言語の理解 8/10
  読解力 15/18
算数 得点:72 偏差値:57 10段階:7 全国順位:228/804 男女別順位:118/443
  計算 18/20
  数の性質 9/12

【ルール】
- 教科名は「国語・算数・理科・社会・適性」を使う
- 2科・4科などの合計科目は含めない
- 領域別は「単元名 得点/配点」の形式で書く（平均・評価は不要）
- 10段階・全国順位・男女別順位が写真にない場合は省略してよい`;

// ── パーサー ────────────────────────────────────────────────────
function parsePhoto1Text(text: string): SubjectInput[] | null {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/　/g, " ").replace(/\*\*/g, "").replace(/[：:]/g, ":"));

  const subjects: SubjectInput[] = [];
  let current: SubjectInput | null = null;

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const subjectName = Object.keys(SUBJECT_NAME_MAP).find((k) => trimmed.startsWith(k));

    if (subjectName) {
      const scoreM = trimmed.match(/得点:(\d+)/);
      const devM = trimmed.match(/偏差値:(\d+)/);
      const scale10M = trimmed.match(/10段階:(\d+)/);
      const rankNatM = trimmed.match(/全国順位:([\d/]+)/);
      const rankGenM = trimmed.match(/男女別順位:([\d/]+)/);
      current = {
        tmpId: `imp-${Date.now()}-${Math.random()}`,
        subjectKey: SUBJECT_NAME_MAP[subjectName],
        score: scoreM?.[1] ?? "",
        deviation: devM?.[1] ?? "",
        scale10: scale10M?.[1] ?? "",
        rankNational: rankNatM?.[1] ?? "",
        rankGender: rankGenM?.[1] ?? "",
        units: [],
      };
      subjects.push(current);
    } else if (current) {
      const slashMatch = trimmed.match(/^(.+?)\s+(\d+)\/(\d+)/);
      if (slashMatch) {
        current.units.push({
          tmpId: `u-${Date.now()}-${Math.random()}`,
          label: slashMatch[1].trim(),
          score: slashMatch[2],
          maxScore: slashMatch[3],
        });
      }
    }
  }
  return subjects.length > 0 ? subjects : null;
}


function makeDefaultForm(subjectKeys: SubjectId[]): SubjectInput[] {
  return subjectKeys.map((k, i) => ({
    tmpId: String(i),
    subjectKey: k,
    score: "",
    deviation: "",
    scale10: "",
    rankNational: "",
    rankGender: "",
    units: [],
  }));
}

type NodeRow = {
  id: string; reportId: string; parentId: string | null; label: string;
  subjectKey: string | null; score: number | null; deviation: number | null;
  scale10: number | null; rankNational: string | null; rankGender: string | null;
  sortOrder: number;
};

function nodeRowToTNode(r: NodeRow): TNode {
  return {
    id: r.id, report_id: r.reportId, parent_id: r.parentId, label: r.label,
    subject_key: r.subjectKey, score: r.score, deviation: r.deviation,
    scale10: r.scale10 ?? null, rank_national: r.rankNational ?? null,
    rank_gender: r.rankGender ?? null, sort_order: r.sortOrder,
  };
}

export function TestsClient({
  initialReports,
  initialNodes,
}: {
  initialReports: Report[];
  initialNodes: NodeRow[];
}) {
  const [reports, setReports] = useState<Report[]>(initialReports);
  const [selectedId, setSelectedId] = useState<string | null>(initialReports[0]?.id ?? null);
  const [weakSelectedId, setWeakSelectedId] = useState<string | null>(
    initialReports[initialReports.length - 1]?.id ?? null
  );
  const [tab, setTab] = useState<Tab>("input");
  const [ym, setYm] = useState(() => new Date().toISOString().slice(0, 7));
  const [msg, setMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [allNodes, setAllNodes] = useState<TNode[]>(() => initialNodes.map(nodeRowToTNode));

  // 入力フォーム状態
  const [form, setForm] = useState<SubjectInput[]>(makeDefaultForm(DEFAULT_SUBJECTS));
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");

  // 選択月のデータをフォームに反映
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!selectedId) { setForm(makeDefaultForm(DEFAULT_SUBJECTS)); return; }
      const nodes = (await listTestNodesAction(selectedId)) as TNode[];
      if (cancelled) return;
      const roots = nodes.filter((n) => !n.parent_id);
      if (roots.length === 0) {
        setForm(makeDefaultForm(DEFAULT_SUBJECTS));
        return;
      }
      setForm(
        roots.map((r, i) => ({
          tmpId: String(i),
          subjectKey: (r.subject_key ?? "math") as SubjectId,
          score: r.score != null ? String(r.score) : "",
          deviation: r.deviation != null ? String(r.deviation) : "",
          scale10: r.scale10 != null ? String(r.scale10) : "",
          rankNational: r.rank_national ?? "",
          rankGender: r.rank_gender ?? "",
          units: nodes
            .filter((n) => n.parent_id === r.id)
            .map((u, j) => ({
              tmpId: `${i}-${j}`,
              label: u.label,
              score: u.score != null ? String(u.score) : "",
              maxScore: u.deviation != null ? String(u.deviation) : "",
            })),
        }))
      );
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const createReport = async () => {
    setMsg(null);
    const res = await createMonthlyReportAction(ym);
    if (!res.ok) { setMsg(res.error); return; }
    const newRep: Report = { id: res.id, year_month: ym, title: null };
    const next = [...reports, newRep].sort((a, b) => a.year_month.localeCompare(b.year_month));
    setReports(next);
    setSelectedId(res.id);
    setWeakSelectedId(res.id);
    setForm(makeDefaultForm(DEFAULT_SUBJECTS));
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm("この月のデータを削除しますか？")) return;
    const res = await deleteMonthlyReportAction(reportId);
    if (!res.ok) { setMsg(res.error); return; }
    const next = reports.filter((r) => r.id !== reportId);
    setReports(next);
    setAllNodes((prev) => prev.filter((n) => n.report_id !== reportId));
    const newSel = next[next.length - 1]?.id ?? null;
    setSelectedId(newSel);
    setWeakSelectedId(newSel);
  };

  const saveForm = async () => {
    if (!selectedId) return;
    setMsg(null);
    const nodes: Parameters<typeof saveTestNodesAction>[1] = [];
    for (const sub of form) {
      const rootTmpId = sub.tmpId;
      nodes.push({
        id: rootTmpId,
        parent_id: null,
        label: subjectById(sub.subjectKey)?.label ?? sub.subjectKey,
        subject_key: sub.subjectKey,
        score: sub.score !== "" ? Number(sub.score) : null,
        deviation: sub.deviation !== "" ? Number(sub.deviation) : null,
        scale10: sub.scale10 !== "" ? Number(sub.scale10) : null,
        rank_national: sub.rankNational || null,
        rank_gender: sub.rankGender || null,
        sort_order: 0,
      });
      for (const u of sub.units) {
        nodes.push({
          id: u.tmpId,
          parent_id: rootTmpId,
          label: u.label,
          subject_key: null,
          score: u.score !== "" ? Number(u.score) : null,
          deviation: u.maxScore !== "" ? Number(u.maxScore) : null,
          sort_order: 0,
        });
      }
    }
    const res = await saveTestNodesAction(selectedId, nodes);
    if (!res.ok) { setMsg(res.error); return; }
    // グラフ更新
    const data = await listAllTestNodesForChartsAction();
    setAllNodes(data as TNode[]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const updateSubject = (tmpId: string, patch: Partial<SubjectInput>) => {
    setForm((f) => f.map((s) => s.tmpId === tmpId ? { ...s, ...patch } : s));
  };

  const addUnit = (subTmpId: string) => {
    setForm((f) => f.map((s) => s.tmpId === subTmpId
      ? { ...s, units: [...s.units, { tmpId: `${subTmpId}-${Date.now()}`, label: "", score: "", maxScore: "" }] }
      : s
    ));
  };

  const updateUnit = (subTmpId: string, uTmpId: string, patch: Partial<UnitInput>) => {
    setForm((f) => f.map((s) => s.tmpId === subTmpId
      ? { ...s, units: s.units.map((u) => u.tmpId === uTmpId ? { ...u, ...patch } : u) }
      : s
    ));
  };

  const removeUnit = (subTmpId: string, uTmpId: string) => {
    setForm((f) => f.map((s) => s.tmpId === subTmpId
      ? { ...s, units: s.units.filter((u) => u.tmpId !== uTmpId) }
      : s
    ));
  };

  const addSubject = (key: SubjectId) => {
    if (form.find((s) => s.subjectKey === key)) return;
    setForm((f) => [...f, { tmpId: String(Date.now()), subjectKey: key, score: "", deviation: "", scale10: "", rankNational: "", rankGender: "", units: [] }]);
  };

  const removeSubject = (tmpId: string) => {
    setForm((f) => f.filter((s) => s.tmpId !== tmpId));
  };

  // 偏差値推移グラフデータ
  const trendData = useMemo(() => {
    return reports.map((rep) => {
      const roots = allNodes.filter((n) => !n.parent_id && n.report_id === rep.id);
      const row: Record<string, string | number | null> = { month: rep.year_month };
      for (const s of SUBJECTS) {
        const root = roots.find((r) => r.subject_key === s.id);
        row[s.id] = root?.deviation ?? null;
      }
      return row;
    });
  }, [reports, allNodes]);

  // 単元推移
  const [unitSubject, setUnitSubject] = useState<SubjectId>("japanese");
  const UNIT_COLORS = ["#c026d3", "#2563eb", "#16a34a", "#ea580c", "#0891b2", "#7c3aed", "#be185d", "#ca8a04"];
  const unitTrendData = useMemo(() => {
    const subjectRoots = allNodes.filter((n) => !n.parent_id && n.subject_key === unitSubject);
    // 全ユニークラベルを収集
    const labelSet = new Set<string>();
    for (const root of subjectRoots) {
      allNodes.filter((n) => n.parent_id === root.id).forEach((u) => labelSet.add(u.label));
    }
    const unitLabels = [...labelSet];
    // 月ごとのデータ
    const months = reports.map((rep) => {
      const root = subjectRoots.find((r) => r.report_id === rep.id);
      const row: Record<string, string | number | null> = { month: rep.year_month };
      if (root) {
        const units = allNodes.filter((n) => n.parent_id === root.id);
        for (const lbl of unitLabels) {
          const u = units.find((x) => x.label === lbl);
          if (u && u.score != null && u.deviation != null && u.deviation > 0) {
            row[lbl] = Math.round((u.score / u.deviation) * 100);
            row[`${lbl}_raw`] = `${u.score}/${u.deviation}`;
          } else {
            row[lbl] = null;
          }
        }
      }
      return row;
    });
    return { months, unitLabels };
  }, [allNodes, reports, unitSubject]);

  // 単元スコア一覧表データ
  const unitTableData = useMemo(() => {
    const subjectRoots = allNodes.filter((n) => !n.parent_id && n.subject_key === unitSubject);
    const labelSet = new Set<string>();
    for (const root of subjectRoots) {
      allNodes.filter((n) => n.parent_id === root.id).forEach((u) => labelSet.add(u.label));
    }
    const unitLabels = [...labelSet];
    const rows = unitLabels.map((lbl) => {
      const cells: { month: string; score: number | null; max: number | null; pct: number | null }[] = [];
      for (const rep of reports) {
        const root = subjectRoots.find((r) => r.report_id === rep.id);
        const u = root ? allNodes.find((n) => n.parent_id === root.id && n.label === lbl) : null;
        cells.push({
          month: rep.year_month,
          score: u?.score ?? null,
          max: u?.deviation ?? null,
          pct: u?.score != null && u.deviation != null && u.deviation > 0
            ? Math.round((u.score / u.deviation) * 100) : null,
        });
      }
      return { label: lbl, cells };
    });
    return rows;
  }, [allNodes, reports, unitSubject]);

  // 弱点チェック: 選択月の単元別正答率
  const weakData = useMemo(() => {
    if (!weakSelectedId) return [];
    const roots = allNodes.filter((n) => !n.parent_id && n.report_id === weakSelectedId);
    const result: { name: string; pct: number; subject: string }[] = [];
    for (const root of roots) {
      const units = allNodes.filter((n) => n.parent_id === root.id);
      for (const u of units) {
        if (u.score != null && u.deviation != null && u.deviation > 0) {
          result.push({
            name: u.label,
            pct: Math.round((u.score / u.deviation) * 100),
            subject: root.subject_key ?? "",
          });
        }
      }
    }
    return result.sort((a, b) => a.pct - b.pct);
  }, [allNodes, weakSelectedId]);

  const selectedReport = reports.find((r) => r.id === selectedId);
  const weakSelectedReport = reports.find((r) => r.id === weakSelectedId);

  const TABS: { key: Tab; label: string }[] = [
    { key: "input", label: "📝 記録する" },
    { key: "trend", label: "📈 推移" },
    { key: "units", label: "🔬 単元推移" },
    { key: "weak", label: "🔍 弱点" },
  ];

  return (
    <main className="mx-auto max-w-lg space-y-5 px-4 py-8">
      <h1 className="text-xl font-bold text-violet-950">📝 テスト結果</h1>

      {/* タブ */}
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-full py-2 text-xs font-bold transition-all ${
              tab === t.key
                ? "bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-md"
                : "border-2 border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 📝 記録タブ */}
      {tab === "input" && (
        <section className="space-y-4">
          {/* 月選択 */}
          <div className="rounded-2xl border-2 border-pink-200 bg-white p-4 shadow-md shadow-pink-100">
            <p className="mb-2 text-xs font-bold text-pink-600">📅 月を選ぶ / 追加する</p>
            <div className="flex gap-2">
              <input
                type="month"
                value={ym}
                onChange={(e) => setYm(e.target.value)}
                className="flex-1 rounded-lg border border-fuchsia-200 bg-violet-50 px-3 py-2 font-semibold text-violet-900"
              />
              <button
                type="button"
                onClick={createReport}
                className="rounded-lg bg-gradient-to-r from-fuchsia-500 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm"
              >
                新規追加
              </button>
            </div>
            {reports.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-center rounded-full text-xs font-bold transition-all ${
                      selectedId === r.id
                        ? "bg-fuchsia-500 text-white"
                        : "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className="pl-3 pr-1 py-1"
                    >
                      {r.year_month}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteReport(r.id)}
                      className={`pr-2 py-1 opacity-60 hover:opacity-100 ${selectedId === r.id ? "text-white" : "text-rose-400"}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            {msg && <p className="mt-2 text-xs font-semibold text-rose-600">{msg}</p>}
          </div>

          {!selectedId ? (
            <p className="text-center text-sm text-slate-400">月を選ぶか追加してください</p>
          ) : (
            <>
              <p className="text-sm font-bold text-violet-800">
                {selectedReport?.year_month} の成績を入力
              </p>

              {/* 📷 クロード読み取りインポート */}
              <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-3 shadow-sm">
                  <button
                    type="button"
                    onClick={() => { setShowImport((v) => !v); setImportText(""); }}
                    className="flex w-full items-center justify-between text-sm font-bold text-sky-700"
                  >
                    <span>📋 個人成績表を取り込む</span>
                    <span className="text-lg">{showImport ? "▲" : "▼"}</span>
                  </button>
                  {showImport && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-bold text-sky-700">① クロード（claude.ai）に写真を送って、このプロンプトで読み取る：</p>
                      <div className="relative">
                        <pre className="whitespace-pre-wrap rounded-lg border border-sky-200 bg-white p-2 font-mono text-[10px] text-slate-700 leading-relaxed">{PHOTO1_PROMPT}</pre>
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard.writeText(PHOTO1_PROMPT)}
                          className="absolute right-2 top-2 rounded bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-600 hover:bg-sky-200"
                        >
                          コピー
                        </button>
                      </div>
                      <p className="text-xs font-bold text-sky-700">② クロードの出力をここに貼り付ける：</p>
                      <textarea
                        placeholder={"国語 得点:78 偏差値:57 10段階:7 全国順位:214/803 男女別順位:128/443\n  言語の理解 8/10\n算数 得点:72 偏差値:57 10段階:7 全国順位:228/804 男女別順位:118/443"}
                        value={importText}
                        onChange={(e) => setImportText(e.target.value)}
                        rows={5}
                        className="w-full rounded-lg border border-sky-200 bg-white px-3 py-2 font-mono text-xs text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const parsed = parsePhoto1Text(importText);
                          if (parsed) {
                            setForm(parsed);
                            setImportText("");
                            setShowImport(false);
                          } else {
                            alert("国語・算数などの教科名が見つかりませんでした。\nクロードの出力をそのまま貼り付けてみてください。");
                          }
                        }}
                        className="w-full rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 py-2 text-sm font-bold text-white shadow-sm"
                      >
                        ✨ フォームに反映する
                      </button>
                    </div>
                  )}
              </div>

              {/* 教科追加ボタン */}
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.filter((s) => !form.find((f) => f.subjectKey === s.id)).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addSubject(s.id)}
                    className="rounded-full border-2 border-violet-200 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-600 hover:bg-violet-100"
                  >
                    ＋ {s.label}
                  </button>
                ))}
              </div>

              {form.map((sub) => {
                const subInfo = subjectById(sub.subjectKey);
                return (
                  <div
                    key={sub.tmpId}
                    className="rounded-2xl border-2 border-fuchsia-200 bg-white p-4 shadow-sm"
                  >
                    {/* 教科ヘッダー */}
                    <div className="mb-3 flex items-center justify-between">
                      <span className={`rounded-full px-3 py-1 text-sm font-bold ${subInfo?.homeworkClass ?? "bg-violet-200 text-violet-800"}`}>
                        {subInfo?.label ?? sub.subjectKey}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSubject(sub.tmpId)}
                        className="text-xs text-rose-400 hover:text-rose-600"
                      >
                        削除
                      </button>
                    </div>

                    {/* 得点・偏差値・10段階 */}
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <label className="text-xs font-bold text-violet-700">
                        得点
                        <input
                          type="number"
                          placeholder="78"
                          value={sub.score}
                          onChange={(e) => updateSubject(sub.tmpId, { score: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-fuchsia-200 bg-violet-50 px-2 py-2 font-bold text-violet-900"
                        />
                      </label>
                      <label className="text-xs font-bold text-violet-700">
                        偏差値
                        <input
                          type="number"
                          placeholder="57"
                          value={sub.deviation}
                          onChange={(e) => updateSubject(sub.tmpId, { deviation: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-fuchsia-200 bg-violet-50 px-2 py-2 font-bold text-violet-900"
                        />
                      </label>
                      <label className="text-xs font-bold text-violet-700">
                        10段階
                        <input
                          type="number"
                          placeholder="7"
                          min={1}
                          max={10}
                          value={sub.scale10}
                          onChange={(e) => updateSubject(sub.tmpId, { scale10: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-fuchsia-200 bg-violet-50 px-2 py-2 font-bold text-violet-900"
                        />
                      </label>
                    </div>
                    {/* 順位 */}
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <label className="text-xs font-bold text-violet-700">
                        全国順位
                        <input
                          type="text"
                          placeholder="214/803"
                          value={sub.rankNational}
                          onChange={(e) => updateSubject(sub.tmpId, { rankNational: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-fuchsia-200 bg-violet-50 px-2 py-2 text-sm font-bold text-violet-900"
                        />
                      </label>
                      <label className="text-xs font-bold text-violet-700">
                        男女別順位
                        <input
                          type="text"
                          placeholder="128/443"
                          value={sub.rankGender}
                          onChange={(e) => updateSubject(sub.tmpId, { rankGender: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-fuchsia-200 bg-violet-50 px-2 py-2 text-sm font-bold text-violet-900"
                        />
                      </label>
                    </div>

                    {/* 領域別 */}
                    <p className="mb-2 text-xs font-bold text-pink-600">領域別（単元）</p>
                    <div className="space-y-2">
                      {sub.units.map((u) => {
                        const s = Number(u.score);
                        const m = Number(u.maxScore);
                        const rating = u.score && u.maxScore && m > 0 ? getRating(s, m) : null;
                        return (
                          <div key={u.tmpId} className="rounded-xl border border-fuchsia-100 bg-fuchsia-50 p-2">
                            <div className="flex items-center gap-2">
                              <input
                                placeholder="単元名（例: 漢字の読み書き）"
                                value={u.label}
                                onChange={(e) => updateUnit(sub.tmpId, u.tmpId, { label: e.target.value })}
                                className="flex-1 rounded-lg border border-fuchsia-200 bg-white px-2 py-1 text-xs font-medium text-violet-900"
                              />
                              <button
                                type="button"
                                onClick={() => removeUnit(sub.tmpId, u.tmpId)}
                                className="text-[10px] text-rose-400"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <input
                                type="number"
                                placeholder="得点"
                                value={u.score}
                                onChange={(e) => updateUnit(sub.tmpId, u.tmpId, { score: e.target.value })}
                                className="w-16 rounded-lg border border-fuchsia-200 bg-white px-2 py-1 text-xs font-bold text-violet-900"
                              />
                              <span className="text-xs text-slate-400">／</span>
                              <input
                                type="number"
                                placeholder="配点"
                                value={u.maxScore}
                                onChange={(e) => updateUnit(sub.tmpId, u.tmpId, { maxScore: e.target.value })}
                                className="w-16 rounded-lg border border-fuchsia-200 bg-white px-2 py-1 text-xs font-bold text-violet-900"
                              />
                              {rating && (
                                <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${rating.cls}`}>
                                  {rating.label} {rating.pct}%
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => addUnit(sub.tmpId)}
                        className="w-full rounded-xl border-2 border-dashed border-fuchsia-200 py-2 text-xs font-bold text-fuchsia-500 hover:bg-fuchsia-50"
                      >
                        ＋ 単元を追加
                      </button>
                    </div>
                  </div>
                );
              })}

              {saved && (
                <p className="rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-emerald-700">
                  ✅ 保存しました！
                </p>
              )}
              <button
                type="button"
                onClick={saveForm}
                className="w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 py-3 font-bold text-white shadow-md"
              >
                💾 この月の成績を保存
              </button>
            </>
          )}
        </section>
      )}

      {/* 📈 偏差値推移タブ */}
      {tab === "trend" && (
        <section className="space-y-4">
          {reports.length < 2 ? (
            <p className="text-center text-sm text-slate-400">2ヶ月以上記録すると推移グラフが表示されます</p>
          ) : (
            <div className="rounded-2xl border border-fuchsia-200 bg-white p-3 shadow-sm">
              <p className="mb-2 text-xs font-bold text-violet-800">偏差値の推移</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#dac4f8" />
                    <XAxis dataKey="month" tick={{ fill: "#6040a8", fontSize: 10 }} />
                    <YAxis domain={[30, 80]} tick={{ fill: "#6040a8", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#f5eaff", border: "1px solid #c0a0ec" }} />
                    <Legend />
                    {SUBJECTS.filter((s) => trendData.some((d) => d[s.id] != null)).map((s) => (
                      <Line
                        key={s.id}
                        type="monotone"
                        dataKey={s.id}
                        name={s.label}
                        stroke={s.chartColor}
                        strokeWidth={2}
                        dot={{ r: 4, fill: s.chartColor }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 月別スコア一覧 */}
          <div className="space-y-2">
            {[...reports].reverse().map((rep) => {
              const roots = allNodes.filter((n) => !n.parent_id && n.report_id === rep.id);
              return (
                <div key={rep.id} className="rounded-xl border border-fuchsia-100 bg-white p-3 shadow-sm">
                  <p className="mb-2 text-xs font-bold text-fuchsia-700">{rep.year_month}</p>
                  <div className="flex flex-wrap gap-2">
                    {roots.map((r) => {
                      const sub = subjectById(r.subject_key ?? "");
                      return (
                        <div key={r.id} className={`rounded-full px-3 py-1 text-xs font-bold ${sub?.homeworkClass ?? "bg-violet-200 text-violet-800"}`}>
                          {sub?.label ?? r.label}：{r.score ?? "－"}点
                          {r.deviation != null && <span className="ml-1 opacity-80">偏{r.deviation}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 🔍 弱点チェックタブ */}
      {tab === "weak" && (
        <section className="space-y-4">
          {/* 月選択チップ */}
          {reports.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {[...reports].reverse().map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setWeakSelectedId(r.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                    weakSelectedId === r.id
                      ? "bg-fuchsia-500 text-white shadow-sm"
                      : "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600"
                  }`}
                >
                  {r.year_month}
                </button>
              ))}
            </div>
          )}

          {!weakSelectedReport ? (
            <p className="text-center text-sm text-slate-400">記録タブで成績を登録してください</p>
          ) : weakData.length === 0 ? (
            <p className="text-center text-sm text-slate-400">{weakSelectedReport.year_month} の領域別データがありません。<br />記録タブで単元を追加してください。</p>
          ) : (
            <>
              {/* 判定ガイド */}
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 border border-emerald-300">A 90%以上</span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700 border border-sky-300">B 70〜89%</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 border border-amber-300">C 40〜69%</span>
                <span className="rounded-full bg-rose-100 px-3 py-1 text-rose-700 border border-rose-300">D 39%以下</span>
              </div>

              {/* 棒グラフ */}
              <div className="rounded-2xl border border-fuchsia-200 bg-white p-3 shadow-sm">
                <div style={{ height: `${Math.max(180, weakData.length * 36)}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weakData} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e9d5ff" horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: "#6040a8", fontSize: 10 }} unit="%" />
                      <YAxis type="category" dataKey="name" tick={{ fill: "#6040a8", fontSize: 10 }} width={90} />
                      <Tooltip formatter={(v) => [`${v}%`, "正答率"]} contentStyle={{ background: "#f5eaff", border: "1px solid #c0a0ec" }} />
                      <Bar dataKey="pct" radius={[0, 6, 6, 0]} label={{ position: "right", fontSize: 10, fill: "#6040a8", formatter: (v: unknown) => `${v ?? 0}%` }}>
                        {weakData.map((d, i) => (
                          <Cell key={i} fill={barColor(d.pct)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 要注意単元 */}
              {weakData.filter((d) => d.pct < 70).length > 0 && (
                <div className="rounded-2xl border-2 border-rose-200 bg-rose-50 p-4">
                  <p className="mb-2 text-sm font-bold text-rose-700">⚠️ 重点的に復習しよう！</p>
                  <ul className="space-y-1">
                    {weakData.filter((d) => d.pct < 70).map((d, i) => {
                      const sub = subjectById(d.subject);
                      const r = getRating(d.pct, 100);
                      return (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <span className={`rounded-full border px-2 py-0.5 text-xs font-bold ${r.cls}`}>{r.label}</span>
                          <span className="font-semibold text-rose-800">{d.name}</span>
                          <span className="text-xs text-rose-400">({sub?.label ?? d.subject}・{d.pct}%)</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {weakData.filter((d) => d.pct >= 90).length > 0 && (
                <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
                  <p className="mb-2 text-sm font-bold text-emerald-700">🌟 得意なところ！</p>
                  <ul className="space-y-1">
                    {weakData.filter((d) => d.pct >= 90).map((d, i) => {
                      const sub = subjectById(d.subject);
                      return (
                        <li key={i} className="text-sm font-semibold text-emerald-800">
                          ⭐ {d.name}
                          <span className="ml-1 text-xs text-emerald-500">({sub?.label ?? d.subject}・{d.pct}%)</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* 🔬 単元推移タブ */}
      {tab === "units" && (
        <section className="space-y-4">
          {/* 教科セレクター */}
          <div className="flex flex-wrap gap-2">
            {SUBJECTS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setUnitSubject(s.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                  unitSubject === s.id
                    ? "bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-md"
                    : "border-2 border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {unitTrendData.unitLabels.length === 0 ? (
            <p className="text-center text-sm text-slate-400">単元データがありません。記録タブで領域別の得点を入力してください。</p>
          ) : (
            <>
              {/* 折れ線グラフ（2ヶ月以上ある場合） */}
              {reports.length >= 2 && (
                <div className="rounded-2xl border border-fuchsia-200 bg-white p-3 shadow-sm">
                  <p className="mb-2 text-xs font-bold text-violet-800">単元別 正答率の推移（%）</p>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={unitTrendData.months}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#dac4f8" />
                        <XAxis dataKey="month" tick={{ fill: "#6040a8", fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fill: "#6040a8", fontSize: 11 }} unit="%" />
                        <Tooltip
                          formatter={(v, name) => [`${v}%`, name]}
                          contentStyle={{ background: "#f5eaff", border: "1px solid #c0a0ec", fontSize: 11 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        {unitTrendData.unitLabels.map((lbl, i) => (
                          <Line
                            key={lbl}
                            type="monotone"
                            dataKey={lbl}
                            name={lbl}
                            stroke={UNIT_COLORS[i % UNIT_COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 4, fill: UNIT_COLORS[i % UNIT_COLORS.length] }}
                            connectNulls={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* 月別スコア一覧表 */}
              <div className="rounded-2xl border border-fuchsia-200 bg-white shadow-sm overflow-hidden">
                <p className="px-4 pt-3 pb-2 text-xs font-bold text-violet-800">単元別スコア一覧</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-fuchsia-100 bg-fuchsia-50">
                        <th className="sticky left-0 bg-fuchsia-50 px-3 py-2 text-left font-bold text-fuchsia-700 min-w-[120px]">単元</th>
                        {reports.map((r) => (
                          <th key={r.id} className="px-3 py-2 text-center font-bold text-fuchsia-700 whitespace-nowrap">{r.year_month}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {unitTableData.map((row) => (
                        <tr key={row.label} className="border-b border-fuchsia-50 hover:bg-fuchsia-50/50">
                          <td className="sticky left-0 bg-white px-3 py-2 font-semibold text-violet-800">{row.label}</td>
                          {row.cells.map((c, i) => {
                            if (c.score == null) return <td key={i} className="px-3 py-2 text-center text-slate-300">－</td>;
                            const r = c.pct != null ? getRating(c.pct, 100) : null;
                            return (
                              <td key={i} className="px-3 py-2 text-center">
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="font-bold text-violet-900">{c.score}/{c.max}</span>
                                  {r && (
                                    <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-bold ${r.cls}`}>
                                      {r.label} {r.pct}%
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 伸び・落ち分析（2ヶ月以上） */}
              {reports.length >= 2 && (
                <div className="rounded-2xl border-2 border-violet-200 bg-violet-50 p-4">
                  <p className="mb-2 text-sm font-bold text-violet-700">📊 前回比</p>
                  <div className="space-y-1">
                    {unitTableData.map((row) => {
                      const last = row.cells.filter((c) => c.pct != null);
                      if (last.length < 2) return null;
                      const prev = last[last.length - 2];
                      const curr = last[last.length - 1];
                      const diff = (curr.pct ?? 0) - (prev.pct ?? 0);
                      if (diff === 0) return null;
                      return (
                        <div key={row.label} className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-violet-800">{row.label}</span>
                          <span className={`font-bold ${diff > 0 ? "text-emerald-600" : "text-rose-600"}`}>
                            {diff > 0 ? "▲" : "▼"} {Math.abs(diff)}pt
                            <span className="ml-1 font-normal text-slate-500">({prev.pct}% → {curr.pct}%)</span>
                          </span>
                        </div>
                      );
                    }).filter(Boolean)}
                    {unitTableData.every((row) => {
                      const last = row.cells.filter((c) => c.pct != null);
                      return last.length < 2 || (last[last.length - 2].pct === last[last.length - 1].pct);
                    }) && (
                      <p className="text-xs text-slate-400">変化なし（または比較できるデータが不足しています）</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}
    </main>
  );
}
