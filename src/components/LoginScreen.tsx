"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import { signInGoogle, signOutCurrent } from "@/lib/firebase/auth";
import { ADMIN_UID } from "@/lib/firebase/client";
import Button from "./ui/Button";

export default function LoginScreen({ user }: { user: User | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setBusy(true);
    setError(null);
    try {
      await signInGoogle();
    } catch (e) {
      setError(messageOf(e));
      setBusy(false);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    setError(null);
    try {
      await signOutCurrent();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }

  if (user && ADMIN_UID && user.uid !== ADMIN_UID) {
    return (
      <Frame>
        <h1 className="text-2xl font-display tracking-wide text-gold-deep">
          アクセス権がありません
        </h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          このアカウントは管理者として登録されていません。別のアカウントでログインし直してください。
        </p>
        <div className="mt-8 w-full">
          <Button onClick={handleSignOut} loading={busy} fullWidth>
            ログアウト
          </Button>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </Frame>
    );
  }

  if (user && !ADMIN_UID) {
    return (
      <Frame>
        <h1 className="text-2xl font-display tracking-wide text-gold-deep">
          管理者 UID 未設定
        </h1>
        <p className="mt-3 text-sm text-muted leading-relaxed">
          下の UID を環境変数{" "}
          <code className="bg-beige px-1.5 py-0.5 text-[12px]">
            NEXT_PUBLIC_ADMIN_UID
          </code>{" "}
          に登録してから再デプロイしてください。
        </p>
        <div className="mt-6 w-full bg-beige px-4 py-3 text-center break-all text-[12px] text-text font-mono">
          {user.uid}
        </div>
        <div className="mt-8 w-full">
          <Button
            variant="secondary"
            onClick={handleSignOut}
            loading={busy}
            fullWidth
          >
            ログアウト
          </Button>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </Frame>
    );
  }

  return (
    <Frame>
      <h1 className="text-2xl font-display tracking-wide text-gold-deep">
        参考価格めも
      </h1>
      <p className="mt-3 text-sm text-muted">管理者ログインが必要です</p>
      <div className="mt-10 w-full">
        <Button onClick={handleSignIn} loading={busy} fullWidth>
          Google でログイン
        </Button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full max-w-xs">{children}</div>
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[12px] text-[var(--color-danger)]">{children}</p>
  );
}

function messageOf(e: unknown): string {
  if (e && typeof e === "object") {
    const code = "code" in e && typeof e.code === "string" ? e.code : null;
    const msg =
      "message" in e && typeof e.message === "string" ? e.message : null;
    if (code && msg) return `${msg} (${code})`;
    if (code) return code;
    if (msg) return msg;
  }
  if (e instanceof Error) return e.message;
  return "エラーが発生しました";
}
