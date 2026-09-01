export function CuttingPerformanceLogo({ variant = 'dark', compact = false }: { variant?: 'dark' | 'light'; compact?: boolean }) {
  return (
    <div className={`cutting-logo cutting-logo-${variant} ${compact ? 'is-compact' : ''}`} aria-label="Cutting Performance">
      <svg className="cutting-mark" viewBox="0 0 58 68" role="img" aria-hidden="true">
        <path d="M28 2 54 54H42L29 28 15 58H3L28 2Z" fill={variant === 'dark' ? '#f6fbff' : '#092044'} />
        <path d="m28 2 8 16-8 11-7-11L28 2Z" fill="#8fd6f3" />
        <path d="m4 55 13-1-7 13H0l4-12Z" fill="#128ee8" />
        <path d="m15 43 24-1-7 10-21 2 4-11Z" fill="#22b7e8" />
        <path d="m39 42 15 12H42l-9-5 6-7Z" fill="#1f73c9" />
      </svg>
      {!compact && <span className="cutting-wordmark"><strong>CUTTING</strong><small>PERFORMANCE</small></span>}
    </div>
  )
}
