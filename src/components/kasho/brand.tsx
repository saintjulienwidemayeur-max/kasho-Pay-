export function KashoMark({ className = "h-9 w-9" }: { className?: string }) {
  return <img src="/brand/kasho-mark.png" alt="Kasho Pay" className={`${className} object-contain`} />;
}

export function KashoWordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center">
      <KashoMark className={compact ? "h-14 w-14" : "h-[72px] w-[72px]"} />
      <span className={`-ml-2 font-bold text-foreground ${compact ? "text-xl" : "text-2xl"}`}>Kasho Pay</span>
    </div>
  );
}
