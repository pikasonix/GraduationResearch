import { DispatchWorkspaceClient } from "./DispatchWorkspaceClient";
import { DispatchPageWrapper } from "./DispatchPageWrapper";

export default function OrdersDispatchPage() {
  return (
    <DispatchPageWrapper>
      <DispatchWorkspaceClient />
    </DispatchPageWrapper>
  );
}
