export type SubjectId =
  | "math"
  | "japanese"
  | "science"
  | "social"
  | "aptitude";

export const SUBJECTS: {
  id: SubjectId;
  label: string;
  /** 宿題など通常時の背景クラス */
  homeworkClass: string;
  /** 自主学習のキラキラグラデクラス */
  selfStudyClass: string;
  /** recharts などで使うチャート色 */
  chartColor: string;
}[] = [
  {
    id: "math",
    label: "算数",
    homeworkClass: "bg-sky-500 text-white",
    selfStudyClass:
      "bg-gradient-to-br from-cyan-200 via-sky-400 to-blue-600 text-fuchsia-50 shadow-[0_0_16px_rgba(56,189,248,.50)] ring-2 ring-sky-100/70",
    chartColor: "#38bdf8",
  },
  {
    id: "japanese",
    label: "国語",
    homeworkClass: "bg-rose-500 text-white",
    selfStudyClass:
      "bg-gradient-to-br from-pink-200 via-rose-400 to-red-600 text-fuchsia-50 shadow-[0_0_16px_rgba(251,113,133,.50)] ring-2 ring-rose-100/70",
    chartColor: "#fb7185",
  },
  {
    id: "science",
    label: "理科",
    homeworkClass: "bg-emerald-500 text-white",
    selfStudyClass:
      "bg-gradient-to-br from-lime-200 via-emerald-400 to-teal-600 text-fuchsia-50 shadow-[0_0_16px_rgba(52,211,153,.50)] ring-2 ring-emerald-100/70",
    chartColor: "#34d399",
  },
  {
    id: "social",
    label: "社会",
    homeworkClass: "bg-amber-500 text-white",
    selfStudyClass:
      "bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-500 text-fuchsia-50 shadow-[0_0_16px_rgba(251,191,36,.50)] ring-2 ring-amber-100/70",
    chartColor: "#fbbf24",
  },
  {
    id: "aptitude",
    label: "適性",
    homeworkClass: "bg-violet-500 text-white",
    selfStudyClass:
      "bg-gradient-to-br from-fuchsia-200 via-purple-400 to-violet-700 text-fuchsia-50 shadow-[0_0_16px_rgba(192,132,252,.50)] ring-2 ring-fuchsia-100/70",
    chartColor: "#c084fc",
  },
];

export function subjectById(id: string) {
  return SUBJECTS.find((s) => s.id === id);
}
