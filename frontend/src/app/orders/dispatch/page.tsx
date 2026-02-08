import { Suspense } from "react";
import { DispatchWorkspaceClient } from "./DispatchWorkspaceClient";
import { DispatchPageWrapper } from "./DispatchPageWrapper";

export default function OrdersDispatchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>}>
      <DispatchPageWrapper>
        <DispatchWorkspaceClient />
      </DispatchPageWrapper>
    </Suspense>
  );
}
