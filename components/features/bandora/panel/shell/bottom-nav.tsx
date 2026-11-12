import { useLocation } from "react-router-dom";
import { Menu } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/src/i18n";
import { NAV_ICONS } from "@/components/features/bandora/panel/shell/nav-icons";
import { BOTTOM_NAV_ITEMS, MORE_ITEMS, isNavActive } from "@/components/features/bandora/panel/shell/nav-items";

/** Mobile bar: exactly four items (three shortcuts and "More"), no floating action button. */
export function BottomNav({ moreOpen, onMore }: { moreOpen: boolean; onMore: () => void }) {
  const { t } = useT();
  const { pathname } = useLocation();
  const inMore = MORE_ITEMS.some((item) => isNavActive(pathname, item.href));
  return (
    <nav className="bd-bottomnav" aria-label={t("nav.shortcuts")}>
      {BOTTOM_NAV_ITEMS.map((item) => {
        const Icon = NAV_ICONS[item.id];
        return (
          <Link key={item.id} href={item.href} aria-current={isNavActive(pathname, item.href) ? "page" : undefined}>
            <Icon size={20} strokeWidth={1.6} aria-hidden />
            <span>{t(item.shortKey ?? item.labelKey)}</span>
          </Link>
        );
      })}
      <button type="button" aria-expanded={moreOpen} aria-haspopup="dialog" data-current={inMore ? "true" : undefined} onClick={onMore}>
        <Menu size={20} strokeWidth={1.6} aria-hidden />
        <span>{t("nav.more")}</span>
      </button>
    </nav>
  );
}
