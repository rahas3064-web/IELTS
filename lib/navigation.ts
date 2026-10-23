import { useMemo } from "react";
import { useLocation, useNavigate, useSearchParams as useRouterSearchParams } from "react-router-dom";

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  const [params] = useRouterSearchParams();
  return params;
}

export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push(href: string) {
        navigate(href);
      },
      replace(href: string) {
        navigate(href, { replace: true });
      },
    }),
    [navigate],
  );
}
