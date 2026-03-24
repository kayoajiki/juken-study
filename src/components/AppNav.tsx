"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Home,
  Settings,
} from "lucide-react";

const items = [
  { href: "/", label: "ホーム", Icon: Home },
  { href: "/study", label: "勉強", Icon: BookOpen },
  { href: "/stats", label: "記録", Icon: BarChart3 },
  { href: "/schedule", label: "予定", Icon: CalendarClock },
  { href: "/tests", label: "テスト", Icon: ClipboardList },
  { href: "/settings", label: "設定", Icon: Settings },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t-2 border-pink-300 bg-gradient-to-r from-pink-50 via-white to-fuchsia-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(236,72,153,0.15)]">
      <ul className="mx-auto flex max-w-lg justify-around gap-1 px-2 py-2">
        {items.map(({ href, label, Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={`flex min-w-[3rem] flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[10px] font-bold transition-all ${
                  active
                    ? "bg-gradient-to-b from-pink-500 to-fuchsia-600 text-white shadow-md shadow-pink-200"
                    : "text-fuchsia-600 hover:bg-pink-50 hover:text-pink-600"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
