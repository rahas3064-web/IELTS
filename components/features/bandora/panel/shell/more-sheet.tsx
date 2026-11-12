import { useLocation } from "react-router-dom";
import { LogOut } from "lucide-react";
import Link from "@/components/link";
import { useT } from "@/src/i18n";
import { Modal } from "@/components/features/bandora/panel/ui/modal";
import { NAV_ICONS } from "@/components/features/bandora/panel/shell/nav-icons";
import { MORE_ITEMS, isNavActive } from "@/components/features/bandora/panel/shell/nav-items";
import { useLogout } from "@/components/features/bandora/panel/shell/use-logout";

/** The "More" sheet: every menu item that is not one of the three bottom shortcuts, and the logout. */
export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const { pathname } = useLocation();
  const logout = useLogout();
  return (
    <Modal open={open} onClose={onClose} title={t("nav.more")}>
      <nav aria-label={t("nav.more")} className="bd-more">
        {MORE_ITEMS.map((item) => {
          const Icon = NAV_ICONS[item.id];
          return (
            <Link
              key={item.id}
              href={item.href}
              className="bd-navlink"
              aria-current={isNavActive(pathname, item.href) ? "page" : undefined}
              onClick={onClose}
            >
              <Icon size={18} strokeWidth={1.6} aria-hidden />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
        <button type="button" className="bd-navlink" onClick={() => { onClose(); void logout(); }}>
          <LogOut size={18} strokeWidth={1.6} aria-hidden />
          <span>{t("nav.logout")}</span>
        </button>
      </nav>
    </Modal>
  );
}
