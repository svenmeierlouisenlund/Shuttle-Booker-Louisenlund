import { useGetAdminMe } from "@workspace/api-client-react";

export function useIsReadOnly(): boolean {
  const { data } = useGetAdminMe();
  return data?.role === "schulbuero" || data?.role === "fahrer";
}

export function useIsBusReadOnly(): boolean {
  const { data } = useGetAdminMe();
  return data?.role === "schulbuero" || data?.role === "fahrer" || data?.role === "buchhaltung";
}

export function useIsFahrer(): boolean {
  const { data } = useGetAdminMe();
  return data?.role === "fahrer";
}

export function useIsBuchhaltung(): boolean {
  const { data } = useGetAdminMe();
  return data?.role === "buchhaltung";
}

export function useAdminRole(): string | undefined {
  const { data } = useGetAdminMe();
  return data?.role ?? undefined;
}
