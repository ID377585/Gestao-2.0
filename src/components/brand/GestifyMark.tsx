type GestifyMarkProps = {
  size?: number;
  className?: string;
  compact?: boolean;
  textClassName?: string;
};

export function GestifyMark({
  size = 40,
  className = "",
  compact = false,
  textClassName = "",
}: GestifyMarkProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        style={{ width: size, height: size }}
        className="relative shrink-0 overflow-hidden rounded-[18px] bg-slate-950 shadow-[0_12px_24px_rgba(15,23,42,0.22)] ring-1 ring-black/5"
      >
        <div className="absolute inset-[1px] rounded-[17px] bg-gradient-to-br from-blue-600 via-cyan-500 to-emerald-500" />
        <div className="absolute inset-[1px] rounded-[17px] bg-[radial-gradient(circle_at_28%_28%,rgba(255,255,255,0.30),transparent_34%),radial-gradient(circle_at_74%_70%,rgba(255,255,255,0.10),transparent_28%)]" />

        <svg
          viewBox="0 0 64 64"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="gestify-sidebar-stroke" x1="8" y1="10" x2="54" y2="54">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.88)" />
            </linearGradient>
          </defs>

          <path
            d="M45 24.5c-1.8-6.8-7.9-11.5-15.4-11.5-9.1 0-16.1 6.9-16.1 16.8 0 9.8 6.8 16.7 16.5 16.7 7.4 0 13.3-4 15.2-10.4"
            fill="none"
            stroke="url(#gestify-sidebar-stroke)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M33.5 31.5H49"
            fill="none"
            stroke="url(#gestify-sidebar-stroke)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M41.5 23.5 50.5 31.5 41.5 39.5"
            fill="none"
            stroke="url(#gestify-sidebar-stroke)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {!compact && (
        <div className={textClassName}>
          <div className="text-[28px] font-black tracking-tight text-slate-950 leading-none">
            Gestify
          </div>
        </div>
      )}
    </div>
  );
}