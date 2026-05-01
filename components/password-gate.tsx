"use client";

import { useState, useEffect } from "react";
import { LockIcon, UnlockIcon, ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EXPECTED_HASH = "ba723435a66e490530c3efdfeac868e06fde6e35dcc43fa8528fb1b2c9411ef5";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const unlocked = sessionStorage.getItem("app_unlocked");
    if (unlocked === "true") {
      setIsUnlocked(true);
    }
    setIsChecking(false);
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    try {
      // Hash the password using Web Crypto API
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      if (hashHex === EXPECTED_HASH) {
        sessionStorage.setItem("app_unlocked", "true");
        setIsUnlocked(true);
        setError(false);
      } else {
        setError(true);
        // Shake animation reset
        setTimeout(() => setError(false), 500);
      }
    } catch (err) {
      console.error("Hashing error", err);
    }
  };

  if (isChecking) {
    return <div className="h-full w-full flex items-center justify-center"><div className="animate-pulse flex items-center gap-2"><LockIcon className="size-5 text-muted-foreground" /> <span className="text-muted-foreground">Đang kiểm tra bảo mật...</span></div></div>;
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-background/50 backdrop-blur-sm p-4">
      <div className={`w-full max-w-sm p-8 bg-card rounded-3xl shadow-2xl border border-border/50 flex flex-col items-center gap-6 ${error ? 'animate-shake' : ''}`}>
        <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <LockIcon className="size-8" />
        </div>
        
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-bold font-heading">Khu vực bảo mật</h2>
          <p className="text-sm text-muted-foreground">Vui lòng nhập mật khẩu để truy cập</p>
        </div>

        <form onSubmit={handleUnlock} className="w-full space-y-4">
          <div className="space-y-2">
            <Input 
              type="password" 
              placeholder="Nhập mật khẩu..." 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`h-12 rounded-xl text-center text-lg ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              autoFocus
            />
            {error && <p className="text-xs text-destructive text-center font-medium">Mật khẩu không chính xác</p>}
          </div>
          
          <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold">
            Mở Khóa
            <UnlockIcon className="ml-2 size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
