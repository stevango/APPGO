/**
 * Lightweight page-transition loader featuring the GO app icon.
 * Used as the Suspense fallback while a lazy route chunk loads — keeps the
 * brand on screen (never a blank/gray flash) during navigation.
 */
export default function PageLoader() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#243FF7] flex flex-col items-center justify-center gap-6">
      <div className="relative w-28 h-28 flex items-center justify-center">
        {/* Spinning ring */}
        <div className="absolute inset-0 rounded-full border-[3px] border-white/15 border-t-[#E2FF04] animate-spin" />

        {/* GO app icon (same mark as the launcher icon) */}
        <div className="animate-go-icon">
          <svg width="76" height="76" viewBox="0 0 1024 1024" aria-label="GO" role="img">
            <circle cx="512" cy="512" r="300" fill="#E2FF04" />
            <path d="M512 300 L702 716 L512 626 L322 716 Z" fill="#243FF7" />
          </svg>
        </div>
      </div>

      <div className="text-2xl font-black text-white tracking-tight">
        Go<span className="text-[#E2FF04]">!</span>
      </div>
    </div>
  );
}
