import { useLocation } from "react-router-dom";
import Link from "@/components/link";
import { useT } from "@/src/i18n";
import { BdIcon } from "@/components/features/bandora/panel/icons/bd-icon";
import { NAV_ICONS } from "@/components/features/bandora/panel/shell/nav-icons";
import { BOTTOM_NAV_ITEMS, isNavActive } from "@/components/features/bandora/panel/shell/nav-items";

/** Three tabs: خانه، دستیار، تمرین. */
export function BottomNav() {
  const { t } = useT();
  const { pathname } = useLocation();
  return (
    <nav className="bd-bottomnav" aria-label={t("nav.shortcuts")}>
      {BOTTOM_NAV_ITEMS.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link key={item.id} href={item.href} aria-current={active ? "page" : undefined}>
            <BdIcon name={NAV_ICONS[item.id]} active={active} />
            <span>{t(item.shortKey ?? item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
