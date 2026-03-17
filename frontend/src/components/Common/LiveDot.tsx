export function LiveDot() {
  return (
    <span className="relative inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-long opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-long" />
      </span>
      <span className="text-xs font-medium text-brand-long tracking-wide">LIVE</span>
    </span>
  );
}
