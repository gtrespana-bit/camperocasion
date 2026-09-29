import { Suspense } from 'react'
import ChatPageClient from './ChatPage'

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 py-3 md:py-4 flex flex-col gap-3 h-[calc(100dvh-56px-4rem)] md:h-[calc(100dvh-100px)] md:max-h-[820px]">
        <div className="animate-pulse space-y-4 flex-1 flex flex-col">
          <div className="h-7 bg-gray-200 rounded w-48 shrink-0" />
          <div className="bg-white rounded-2xl border flex-1" />
        </div>
      </div>
    }>
      <ChatPageClient />
    </Suspense>
  )
}
