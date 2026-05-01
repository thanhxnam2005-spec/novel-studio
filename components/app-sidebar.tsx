"use client";

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

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar">
      <SidebarHeader className="px-4 py-6">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 overflow-hidden mb-6"
        >
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-transparent overflow-hidden">
            <img src="/logo.png" alt="Thuyết Thư Các Logo" className="w-full h-full object-cover rounded-xl" />
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
        <div className="flex flex-col gap-2">
          {/* Authenticated User Block Mock */}
          <div className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 border border-border/50">
            <div className="size-10 rounded-full bg-sidebar-accent overflow-hidden shrink-0">
              <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=obama" alt="avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-semibold text-sm truncate">Obama</span>
              <span className="text-[10px] uppercase font-bold text-primary px-1.5 py-0.5 bg-primary/10 rounded-sm w-fit mt-1">ĐỘC GIẢ</span>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive transition-colors">
              <LogOutIcon className="size-4" />
            </Button>
          </div>

          {/* Google Login Button Mock */}
          <Button variant="outline" className="w-full flex items-center justify-center gap-2 bg-card border-border/50 shadow-sm mt-1">
            <svg viewBox="0 0 24 24" className="size-4" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span className="font-semibold text-sm">Đăng nhập Google</span>
          </Button>
        </div>
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
