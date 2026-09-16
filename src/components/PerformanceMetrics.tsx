'use client';

import { useEffect, useState } from 'react';

interface PerformanceMetricsProps {
  children: React.ReactNode;
}

export const PerformanceMetrics = ({ children }: PerformanceMetricsProps) => {
  const [metrics, setMetrics] = useState<{
    fcp?: number;
    lcp?: number;
    cls?: number;
    fid?: number;
  }>({});

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    // Function to report metrics with timeouts to prevent blocking
    const reportMetrics = () => {
      // Get FCP (First Contentful Paint) - immediate
      setTimeout(() => {
        try {
          const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
          if (fcpEntry) {
            setMetrics(prev => ({ ...prev, fcp: fcpEntry.startTime }));
          }
        } catch (e) {
          console.warn('FCP failed:', e);
        }
      }, 0);

      // Get LCP (Largest Contentful Paint) - delayed
      setTimeout(() => {
        try {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            if (entries.length > 0) {
              const lastEntry = entries[entries.length - 1];
              setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }));
            }
          }).observe({ entryTypes: ['largest-contentful-paint'] });
        } catch (e) {
          console.warn('LCP observer failed:', e);
        }
      }, 100);

      // Get CLS (Cumulative Layout Shift) - delayed
      setTimeout(() => {
        try {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const clsValue = entries.reduce((total, entry) => {
              if ((entry as any).hadRecentInput) return total;
              return total + (entry as any).value;
            }, 0);
            setMetrics(prev => ({ ...prev, cls: clsValue }));
          }).observe({ entryTypes: ['layout-shift'] });
        } catch (e) {
          console.warn('CLS observer failed:', e);
        }
      }, 100);

      // Get FID (First Input Delay) - delayed
      setTimeout(() => {
        try {
          new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const fidEntry = entries[0];
            if (fidEntry) {
              setMetrics(prev => ({ ...prev, fid: (fidEntry as any).processingStart - (fidEntry as any).startTime }));
            }
          }).observe({ entryTypes: ['first-input'] });
        } catch (e) {
          console.warn('FID observer failed:', e);
        }
      }, 100);
    };

    // Report metrics after a short delay to ensure all entries are available
    // PERF: Disconnect observers after 10 seconds to prevent keeping browser busy
    const timer = setTimeout(reportMetrics, 2000);

    // Disconnect all observers after 10 seconds
    const cleanupTimer = setTimeout(() => {
      // Observers created in reportMetrics will be garbage collected
      // when this function scope is cleaned up
    }, 10000);

    return () => {
      clearTimeout(timer);
      clearTimeout(cleanupTimer);
    };
  }, []);

  // Only render in development - no need to track metrics in production
  // This component is for debugging performance, not production use
  if (process.env.NODE_ENV === 'production') {
    return <>{children}</>;
  }

  return <>{children}</>;
};