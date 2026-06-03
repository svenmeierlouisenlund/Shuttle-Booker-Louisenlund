import { useGetAdminMe } from "@workspace/api-client-react";

export function useIsReadOnly(): boolean {
  const { data } = useGetAdminMe();
  return data?.role === "schulbuero" || data?.role === "fahrer";
}
