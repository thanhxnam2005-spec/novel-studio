"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { SparklesIcon } from "lucide-react";

const GENRES = [
  "Huyền huyễn",
  "Tiên hiệp",
  "Ngôn tình",
  "Đô thị",
  "Khoa học viễn tưởng",
  "Trinh thám",
  "Kinh dị",
  "Lịch sử",
  "Quân sự",
  "Phiêu lưu",
  "Fantasy",
  "Khác",
];

const STYLES = [
  "Nghiêm túc",
  "Hài hước",
  "Lãng mạn",
  "Đen tối",
  "Sử thi",
  "Nhẹ nhàng",
];

export interface IdeaFormData {
  genre: string;
  setting: string;
  idea: string;
  style: string;
}

export function IdeaForm({
  onSubmitAction,
  isLoading,
}: {
  onSubmitAction: (data: IdeaFormData) => void;
  isLoading?: boolean;
}) {
  const [genre, setGenre] = useState("");
  const [setting, setSetting] = useState("");
  const [idea, setIdea] = useState("");
  const [style, setStyle] = useState("");

  const canSubmit = idea.trim().length > 0;

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Bắt đầu truyện mới</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mô tả ý tưởng của bạn, AI sẽ xây dựng bộ khung truyện hoàn chỉnh.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Thể loại</Label>
          <NativeSelect
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">Để AI suy luận</NativeSelectOption>
            {GENRES.map((g) => (
              <NativeSelectOption key={g} value={g}>
                {g}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-2">
          <Label>Bối cảnh</Label>
          <Input
            placeholder="Ví dụ: Thế giới tu tiên cổ đại, Đô thị hiện đại..."
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>
            Mô tả ý tưởng <span className="text-destructive">*</span>
          </Label>
          <Textarea
            placeholder="Mô tả ý tưởng truyện của bạn (2-5 câu)..."
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            rows={4}
          />
        </div>

        <div className="space-y-2">
          <Label>
            Phong cách viết{" "}
            <span className="text-muted-foreground text-xs">(tùy chọn)</span>
          </Label>
          <NativeSelect
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="w-full"
          >
            <NativeSelectOption value="">Để AI quyết định</NativeSelectOption>
            {STYLES.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {s}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Button
        onClick={() =>
          onSubmitAction({ genre, setting, idea, style })
        }
        disabled={!canSubmit || isLoading}
        className="w-full"
        size="lg"
      >
        <SparklesIcon className="h-4 w-4 mr-2" />
        {isLoading ? "Đang tạo..." : "Tạo bộ khung truyện"}
      </Button>
    </div>
  );
}
