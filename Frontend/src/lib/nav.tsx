import React from "react";
import {
  Link as TanStackLink,
  useRouter as useTanStackRouter,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  to?: string;
  children?: React.ReactNode;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, to, children, ...props }, ref) => {
    const target = to || href || "/";
    return (
      <TanStackLink ref={ref} to={target as any} {...(props as any)}>
        {children}
      </TanStackLink>
    );
  }
);
Link.displayName = "Link";

export function useRouter() {
  const router = useTanStackRouter();
  const navigate = useNavigate();
  return {
    ...router,
    push: (path: string) => navigate({ to: path } as any),
    replace: (path: string) => navigate({ to: path, replace: true } as any),
  };
}

export function usePathname(): string {
  try {
    const state = useRouterState();
    return state.location.pathname;
  } catch {
    if (typeof window !== "undefined") {
      return window.location.pathname;
    }
    return "/";
  }
}

export function useSearchParams(): URLSearchParams {
  if (typeof window !== "undefined") {
    return new URLSearchParams(window.location.search);
  }
  return new URLSearchParams();
}
