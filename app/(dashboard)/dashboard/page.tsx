"use client";

import { navConfig } from "@/components/app-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/lib/hooks";
import { useLiveQuery } from "dexie-react-hooks";
import {
  BookOpenIcon,
  FileTextIcon,
  PenLineIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatRelative(date: Date) {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return date.toLocaleDateString("vi-VN", { day: "numeric", month: "short" });
}

const QUICK_NAV_HREFS = [
  "/library",
  "/import",
  "/convert",
  "/settings/providers",
  "/settings/data",
];
const QUICK_NAV = navConfig.filter((item) =>
  QUICK_NAV_HREFS.includes(item.href),
);

export default function DashboardPage() {
  const stats = useDashboardStats();
  
  const novelsWithStats = useLiveQuery(async () => {
    const { db } = await import("@/lib/db");
    const novelsList = await db.novels.orderBy("updatedAt").reverse().toArray();
    const countMap = new Map<string, number>();
    await db.chapters.each(ch => {
      countMap.set(ch.novelId, (countMap.get(ch.novelId) || 0) + 1);
    });
    return novelsList.map(novel => ({
      novel,
      chapterCount: countMap.get(novel.id) || 0
    }));
  }, []);

  return (
    <main className="mx-auto w-full min-w-0 max-w-5xl overflow-hidden px-4 py-6 md:px-6 md:py-8 space-y-10">
      {/* Danh Sách Truyện Section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BookOpenIcon className="size-5 text-primary fill-primary/20" />
          <h3 className="text-lg font-bold tracking-tight">Danh Sách Truyện</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {novelsWithStats === undefined ? (
             Array.from({ length: 5 }).map((_, i) => (
               <Skeleton key={i} className="aspect-[2/3] w-full rounded-xl" />
             ))
          ) : novelsWithStats.length === 0 ? (
            <div className="col-span-full py-8 text-center text-sm text-muted-foreground italic border border-dashed rounded-xl border-border/50">
              Chưa có dữ liệu
            </div>
          ) : (
            novelsWithStats.map((item, i) => (
              <Link key={item.novel.id} href={`/novels/${item.novel.id}`} className="group flex flex-col gap-2">
                <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted border border-border/50 group-hover:border-primary/50 transition-colors shadow-sm">
                  {item.novel.coverImage ? (
                    <img src={item.novel.coverImage} alt={item.novel.title} className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <div className={`absolute inset-0 bg-gradient-to-br opacity-20 ${i % 2 === 0 ? 'from-blue-500 to-purple-500' : 'from-green-500 to-emerald-500'}`}></div>
                      <div className="absolute inset-0 flex p-3 items-center justify-center text-center">
                        <span className="font-heading font-bold text-sm line-clamp-4">{item.novel.title}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="px-1">
                  <h4 className="text-sm font-semibold line-clamp-2 leading-tight group-hover:text-primary transition-colors" title={item.novel.title}>
                    {item.novel.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">{item.chapterCount} chương</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      {/* Stats - Kept small at bottom */}
      <section>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats && (
            <>
              <StatCard label="Tiểu thuyết" value={stats.novelCount} icon={BookOpenIcon} />
              <StatCard label="Chương" value={stats.chapterCount} icon={FileTextIcon} />
              <StatCard label="Tổng từ" value={stats.wordCount} icon={PenLineIcon} />
              <StatCard label="Nhân vật" value={stats.characterCount} icon={UsersIcon} />
            </>
          )}
        </div>
      </section>

      {/* Quick Nav */}
      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {QUICK_NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-card border border-border/50 hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <item.icon className="size-5 text-muted-foreground" />
            <span className="text-xs font-medium text-center">{item.title}</span>
          </Link>
        ))}
      </section>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
}) {
  return (
    <Card className="transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 bg-gradient-to-br from-card to-muted/20">
      <CardContent className="flex items-center gap-4 py-5">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 shadow-inner ring-1 ring-primary/10">
          <Icon className="size-5 text-primary drop-shadow-sm" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-bold tabular-nums tracking-tight mt-0.5 drop-shadow-sm">
            {formatNumber(value)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}


