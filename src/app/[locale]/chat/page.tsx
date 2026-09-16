import { Suspense } from 'react'
import ChatPageClient from './ChatPage'

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="bg-white rounded-2xl border h-[600px]" />
        </div>
      </div>
    }>
      <ChatPageClient />
    </Suspense>
  )
}
