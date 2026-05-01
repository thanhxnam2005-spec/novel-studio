"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LibraryIcon,
  UploadIcon,
  GitCompareArrowsIcon,
  GlobeIcon,
  BrainIcon,
  PenLineIcon,
  ArrowRightIcon,
} from "lucide-react";

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("hasSeenWelcomeV1");
    if (!hasSeenWelcome) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem("hasSeenWelcomeV1", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[95vw] md:max-w-[85vw] lg:max-w-[70vw] p-0 overflow-hidden border-none rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl transition-all">
        <div className="relative bg-primary text-primary-foreground px-6 py-8 md:px-12 md:py-12 max-h-[90vh] overflow-y-auto scrollbar-hide">
          <div className="relative z-10 space-y-8">
            <div className="space-y-3 text-center md:text-left">
              <Badge variant="secondary" className="bg-white/10 text-white border-white/20 backdrop-blur-md px-4 py-1.5 text-[10px] md:text-xs uppercase tracking-[0.2em] font-black">
                Chào mừng tới Thuyết Thư Các
              </Badge>
              <DialogTitle className="font-heading text-3xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-white">
                Không gian sáng tạo <br className="hidden md:block" /> & đọc truyện tối ưu
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/70 text-sm md:text-xl max-w-2xl leading-relaxed font-medium">
                Hệ thống quản lý thư viện, công cụ dịch thuật chuyên sâu và trợ lý AI giúp bạn nâng tầm trải nghiệm đọc và viết truyện chữ.
              </DialogDescription>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pt-4">
              <FeatureItem 
                icon={LibraryIcon}
                title="Thư viện thông minh"
                desc="Quản lý toàn bộ kho truyện, theo dõi tiến độ đọc và tóm tắt nội dung tự động."
              />
              <FeatureItem 
                icon={UploadIcon}
                title="Nhập liệu đa năng"
                desc="Hỗ trợ TXT, EPUB, DOCX, PDF với khả năng nhận diện và chia chương thông minh."
              />
              <FeatureItem 
                icon={GitCompareArrowsIcon}
                title="Dịch thuật chuyên sâu"
                desc="Trình Convert Hán-Việt mạnh mẽ với bộ từ điển Name/VietPhrase tùy chỉnh."
              />
              <FeatureItem 
                icon={GlobeIcon}
                title="Thu thập dữ liệu"
                desc="Scraper tích hợp giúp lấy nội dung trực tiếp từ các trang web truyện lớn."
              />
              <FeatureItem 
                icon={BrainIcon}
                title="Trợ lý AI"
                desc="Kết nối OpenAI, Gemini, Anthropic để phân tích cốt truyện và nhân vật."
              />
              <FeatureItem 
                icon={PenLineIcon}
                title="Writing Pipeline"
                desc="Quy trình viết truyện chuyên nghiệp từ lên ý tưởng đến hoàn thiện bản thảo."
              />
            </div>

            <div className="pt-8 flex justify-center md:justify-start">
              <Button 
                onClick={handleClose}
                size="lg"
                className="bg-white text-primary hover:bg-white/90 font-black text-base md:text-lg px-10 py-8 rounded-2xl group transition-all shadow-xl shadow-black/20"
              >
                Vào App Ngay
                <ArrowRightIcon className="ml-3 size-6 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          </div>
          
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 size-[30rem] rounded-full bg-white/5 blur-[100px]" />
          <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/4 size-[20rem] rounded-full bg-primary-foreground/5 blur-[80px]" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="group flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white shadow-sm ring-1 ring-white/20 group-hover:scale-110 transition-transform">
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-bold text-white tracking-wide">{title}</h4>
        <p className="text-[11px] text-primary-foreground/60 leading-relaxed font-medium">
          {desc}
        </p>
      </div>
    </div>
  );
}
