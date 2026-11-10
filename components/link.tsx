import type { AnchorHTMLAttributes, ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  replace?: boolean;
  viewTransition?: boolean;
  children?: ReactNode;
};

export default function Link({ href, replace, viewTransition, children, ...props }: LinkProps) {
  return (
    <RouterLink to={href} replace={replace} viewTransition={viewTransition} {...props}>
      {children}
    </RouterLink>
  );
}
