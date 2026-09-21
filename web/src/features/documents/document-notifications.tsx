export function DocumentNotification({ message, kind = "status" }: { message: string; kind?: "status" | "alert" }) {
  return <p role={kind}>{message}</p>;
}
