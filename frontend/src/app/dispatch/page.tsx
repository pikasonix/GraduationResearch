import { Suspense } from 'react';
import DispatchClient from './DispatchClient';
import { OldDispatchPageWrapper } from './OldDispatchPageWrapper';

export const dynamic = 'force-dynamic';

export default function DispatchPage() {
  return (
    <OldDispatchPageWrapper>
      <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading Dispatch Console...</div>}>
        <DispatchClient />
      </Suspense>
    </OldDispatchPageWrapper>
  );
}
