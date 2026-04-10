type GestifyLogoProps = {
  size?: number;
  className?: string;
  showText?: boolean;
  textClassName?: string;
  subtitle?: string;
};

export function GestifyLogo({
  size = 56,
  className = "",
  showText = false,
  textClassName = "",
  subtitle,
}: GestifyLogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        style={{ width: size, height: size }}
        className="relative shrink-0 overflow-hidden rounded-[22px] bg-slate-950 shadow-[0_20px_40px_rgba(15,23,42,0.35)] ring-1 ring-white/10"
      >
        <div className="absolute inset-[1px] rounded-[21px] bg-gradient-to-br from-blue-500 via-cyan-400 to-emerald-400 opacity-95" />
        <div className="absolute inset-[1px] rounded-[21px] bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.28),transparent_35%),radial-gradient(circle_at_75%_70%,rgba(255,255,255,0.08),transparent_30%)]" />

        <svg
          viewBox="0 0 64 64"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="gestify-mark-stroke" x1="8" y1="10" x2="54" y2="54">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.88)" />
            </linearGradient>
          </defs>

          <path
            d="M45 24.5c-1.8-6.8-7.9-11.5-15.4-11.5-9.1 0-16.1 6.9-16.1 16.8 0 9.8 6.8 16.7 16.5 16.7 7.4 0 13.3-4 15.2-10.4"
            fill="none"
            stroke="url(#gestify-mark-stroke)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M33.5 31.5H49"
            fill="none"
            stroke="url(#gestify-mark-stroke)"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M41.5 23.5 50.5 31.5 41.5 39.5"
            fill="none"
            stroke="url(#gestify-mark-stroke)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <circle cx="18" cy="18" r="2.2" fill="rgba(255,255,255,0.9)" />
          <circle cx="46" cy="14" r="1.8" fill="rgba(255,255,255,0.75)" />
          <circle cx="49" cy="47" r="2" fill="rgba(255,255,255,0.8)" />
        </svg>
      </div>

      {showText ? (
        <div className={textClassName}>
          <div className="text-2xl font-black tracking-tight text-slate-950">
            Gestify
          </div>
          {subtitle ? (
            <div className="text-xs text-slate-500">{subtitle}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}