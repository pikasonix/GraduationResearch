import { Suspense } from 'react';
import MapPageClient from './MapPageClient';

export const dynamic = 'force-dynamic';

export default function MapPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading map...</div>}>
      <MapPageClient />
    </Suspense>
  );
}