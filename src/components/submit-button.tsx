"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "ghost";
}) {
  const { pending } = useFormStatus();
  const style =
    variant === "primary"
      ? "bg-amber-400 text-zinc-950 hover:bg-amber-300"
      : "text-zinc-500 hover:text-red-400";
  return (
    <button disabled={pending} className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${style}`}>
      {pending ? (pendingLabel ?? "…") : children}
    </button>
  );
}
