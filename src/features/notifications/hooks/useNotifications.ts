import { useQuery } from "@tanstack/react-query";
import { goWildApi } from "../../../services/http/apiClient";

export function useNotificationsQuery() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => goWildApi.getNotifications(),
    staleTime: 30_000,
  });
}

