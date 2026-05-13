type AuthMessageProps = Readonly<{
  type: "error" | "success";
  message: string;
}>;

export function AuthMessage({ type, message }: AuthMessageProps) {
  const classes =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <p className={`rounded-lg border px-3 py-2 text-sm ${classes}`}>{message}</p>;
}
