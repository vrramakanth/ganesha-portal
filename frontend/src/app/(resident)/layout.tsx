import ResidentNav from "@/components/ResidentNav";

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="flex-1 w-full max-w-lg mx-auto pb-20">{children}</main>
      <ResidentNav />
    </>
  );
}
