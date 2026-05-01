"use client";

import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useNovels } from "@/lib/hooks";
import { useQTEngineStatus } from "@/lib/hooks/use-qt-engine";
import {
  BookOpenIcon,
  BrainIcon,
  DatabaseIcon,
  GitCompareArrowsIcon,
  GlobeIcon,
  HomeIcon,
  LibraryIcon,
  LoaderIcon,
  PenLineIcon,
  ServerIcon,
  UploadIcon,
  SettingsIcon,
  ChevronRightIcon,
  LogOutIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const navConfig = [
  { title: "Trang chủ", href: "/dashboard", icon: HomeIcon },
  { title: "Thư viện", href: "/library", icon: LibraryIcon },
  { title: "Nhập sách", href: "/import", icon: UploadIcon },
  { title: "Convert Live", href: "/convert", icon: GitCompareArrowsIcon },
  { title: "Import Truyện", href: "/scraper", icon: GlobeIcon },
  { title: "Nhà cung cấp AI", href: "/settings/providers", icon: ServerIcon },
  {
    title: "Cài đặt AI",
    href: "/settings/ai-settings",
    icon: BrainIcon,
  },
  {
    title: "Quản lý dữ liệu",
    href: "/settings/data",
    icon: DatabaseIcon,
  },
] as const;

export const miscNav = [] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const novels = useNovels();
  const recentNovels = novels?.slice(0, 5);

  const mainNav = navConfig.filter(
    (item) => !item.href.startsWith("/settings"),
  );
  const settingsNav = navConfig.filter((item) =>
    item.href.startsWith("/settings"),
  );

  const [logoError, setLogoError] = useState(false);

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar">
      <SidebarHeader className="px-4 py-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 overflow-hidden mb-6"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary overflow-hidden relative">
            {!logoError ? (
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-full h-full object-cover rounded-xl" 
                onError={() => setLogoError(true)}
              />
            ) : (
              <BookOpenIcon className="size-6" />
            )}
          </div>
          <div className="flex flex-col gap-0.5 leading-none">
            <span className="font-heading text-lg font-bold tracking-tight text-sidebar-foreground">
              Thuyết Thư Các
            </span>
            <span className="text-xs text-sidebar-foreground/60">
              Kho tàng truyện chữ
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Điều hướng</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    className="text-base font-medium py-2.5 h-auto"
                  >
                    <Link href={item.href}>
                      <item.icon className="size-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Tiểu thuyết gần đây</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {recentNovels && recentNovels.length > 0 ? (
                recentNovels.map((novel) => (
                  <SidebarMenuItem key={novel.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === `/novels/${novel.id}`}
                      tooltip={novel.title}
                      className="text-base font-medium py-2 h-auto"
                    >
                      <Link href={`/novels/${novel.id}`}>
                        <BookOpenIcon className="size-5" />
                        <span className="truncate">{novel.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Chưa có tiểu thuyết"
                    className="text-sidebar-foreground/60"
                  >
                    <BookOpenIcon />
                    <span className="italic">Chưa có tiểu thuyết</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Cài đặt</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Collapsible defaultOpen className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton tooltip="Cài đặt" className="text-base font-medium py-2.5 h-auto w-full justify-between">
                      <div className="flex items-center gap-2">
                        <SettingsIcon className="size-5" />
                        <span>Cài đặt hệ thống</span>
                      </div>
                      <ChevronRightIcon className="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {settingsNav.map((item) => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton asChild isActive={pathname === item.href} className="text-sm py-2 h-auto">
                            <Link href={item.href}>
                              <item.icon className="size-4" />
                              <span>{item.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>


      </SidebarContent>

      <DictLoadingFooter />
      <SidebarRail />
    </Sidebar>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  names: "Names",
  names2: "Names2",
  phienam: "Phiên âm",
  luatnhan: "Luật nhân",
  vietphrase: "VietPhrase",
};

function DictLoadingFooter() {
  const { phase, loadingSource, loadingPercent } = useQTEngineStatus();

  if (phase === "idle" || phase === "ready") return null;

  return (
    <SidebarFooter className="border-t px-3 py-2">
      {phase === "error" ? (
        <p className="text-xs text-red-500">Lỗi tải từ điển</p>
      ) : (
        <div className="space-y-1.5">
          {phase === "loading" && (
            <Progress value={loadingPercent} className="h-1.5" />
          )}
          <div className="flex items-center gap-2">
            <LoaderIcon className="size-3.5 shrink-0 animate-spin text-blue-500" />
            <span className="text-xs text-sidebar-foreground/70">
              {phase === "loading"
                ? `Đang tải ${SOURCE_LABELS[loadingSource] ?? loadingSource}...`
                : "Đang khởi tạo engine..."}
            </span>
            <span className="ml-auto text-xs text-sidebar-foreground/50">
              {phase === "loading" ? `${loadingPercent}%` : null}
            </span>
          </div>
        </div>
      )}
    </SidebarFooter>
  );
}
