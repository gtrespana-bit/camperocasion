'use client'

import LocalLink from '@/components/LocalLink'
import { ChevronRight, Home } from 'lucide-react'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.label,
      item: item.href ? `https://camperocasion.es${item.href}` : undefined
    }))
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <nav aria-label="Breadcrumb" className="py-3 px-4 bg-gray-50 border-b">
        <ol className="max-w-7xl mx-auto flex items-center gap-2 text-sm text-gray-600 flex-wrap">
          <li>
            <LocalLink href="/" className="hover:text-brand-primary transition flex items-center">
              <Home size={14} />
            </LocalLink>
          </li>
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-2">
              <ChevronRight size={12} className="text-gray-500" />
              {item.href ? (
                <LocalLink 
                  href={item.href} 
                  className="hover:text-brand-primary transition truncate max-w-[200px]"
                >
                  {item.label}
                </LocalLink>
              ) : (
                <span className="text-gray-900 font-medium truncate max-w-[200px]">
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </>
  )
}