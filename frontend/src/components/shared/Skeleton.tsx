export function SkeletonCard() {
  return (
    <div className="skeleton-card p-5">
      <div className="flex justify-between mb-4">
        <div className="skeleton w-11 h-11 rounded-xl" />
        <div className="skeleton w-12 h-8 rounded-lg" />
      </div>
      <div className="skeleton-text w-24 mb-2" />
      <div className="skeleton-text w-16" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-4">
      <div className="skeleton w-20 h-4 rounded" />
      <div className="skeleton w-24 h-4 rounded" />
      <div className="skeleton w-32 h-4 rounded" />
      <div className="skeleton w-20 h-6 rounded-full" />
      <div className="skeleton w-28 h-4 rounded" />
      <div className="skeleton w-24 h-4 rounded flex-1" />
      <div className="skeleton w-20 h-4 rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="glass-card-solid overflow-hidden">
      <div className="px-4 py-3 bg-surface border-b border-gray-100">
        <div className="flex gap-8">
          {[80, 96, 128, 80, 112, 96, 80].map((w, i) => (
            <div key={i} className={`skeleton h-3 rounded`} style={{ width: w }} />
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

export function SkeletonMetrics() {
  return (
    <div className="grid grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonForm() {
  return (
    <div className="glass-card-solid p-8 space-y-6">
      <div className="skeleton-heading" />
      <div className="grid grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-11 rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
