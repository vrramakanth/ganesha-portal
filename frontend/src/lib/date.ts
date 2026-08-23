export function formatEventWhen(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function formatCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
