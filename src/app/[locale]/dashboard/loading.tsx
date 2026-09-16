export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header skeleton */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-64 animate-pulse" />
        </div>
        <div className="h-10 bg-gray-200 rounded-lg w-32 animate-pulse" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-white rounded-xl p-4 border border-gray-100">
            <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse" />
            <div className="h-8 bg-gray-200 rounded w-16 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 bg-gray-200 rounded-lg w-24 animate-pulse" />
        ))}
      </div>

      {/* Content skeleton */}
      <div className="bg-white rounded-xl p-6 border border-gray-100">
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-16 w-16 bg-gray-200 rounded-lg animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
