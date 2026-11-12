import { useRef, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/src/i18n";
import { NAV_ICONS } from "@/components/features/bandora/panel/shell/nav-icons";
import { SIDEBAR_BOTTOM, SIDEBAR_GROUPS, isNavActive, type NavItem } from "@/components/features/bandora/panel/shell/nav-items";
import { useLogout } from "@/components/features/bandora/panel/shell/use-logout";

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const { t } = useT();
  const Icon = NAV_ICONS[item.id];
  const active = isNavActive(pathname, item.href);
  return (
    <Link href={item.href} className="bd-navlink" aria-current={active ? "page" : undefined}>
      <Icon size={18} strokeWidth={1.6} aria-hidden />
      <span>{t(item.labelKey)}</span>
    </Link>
  );
}

/** Desktop menu. It sits on the inline-start side: right in Persian, left in English. */
export function Sidebar() {
  const { t } = useT();
  const { pathname } = useLocation();
  const logout = useLogout();
  const nav = useRef<HTMLElement>(null);

  // Up/Down move between entries; Tab still walks them in order.
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const entries = [...(nav.current?.querySelectorAll<HTMLElement>("a, button") ?? [])];
    const index = entries.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    entries[(index + step + entries.length) % entries.length]?.focus();
  }

  return (
    <aside className="bd-sidebar">
      <nav ref={nav} aria-label={t("nav.label")} onKeyDown={onKeyDown}>
        {SIDEBAR_GROUPS.map((group) => (
          <div key={group.id} className="bd-navgroup" role="group" aria-labelledby={`nav-${group.id}`}>
            <p id={`nav-${group.id}`} className="bd-navgroup__label">{t(group.labelKey)}</p>
            {group.items.map((item) => (
              <SidebarLink key={item.id} item={item} pathname={pathname} />
            ))}
          </div>
        ))}
        <div className="bd-navgroup bd-navgroup--bottom">
          {SIDEBAR_BOTTOM.map((item) => (
            <SidebarLink key={item.id} item={item} pathname={pathname} />
          ))}
          <button type="button" className="bd-navlink" onClick={() => void logout()}>
            <LogOut size={18} strokeWidth={1.6} aria-hidden />
            <span>{t("nav.logout")}</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}
