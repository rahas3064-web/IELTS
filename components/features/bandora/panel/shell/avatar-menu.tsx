import { useId } from "react";
import Link from "@/components/link";
import { UserRound } from "lucide-react";
import { useAuth } from "@/src/auth/auth-provider";
import { useT } from "@/src/i18n";
import { LocaleSwitch } from "@/components/features/bandora/panel/shell/locale-switch";
import { usePopover } from "@/components/features/bandora/panel/shell/use-popover";

export function AvatarMenu() {
  const { t } = useT();
  const { me } = useAuth();
  const popover = usePopover();
  const panelId = useId();
  const name = me ? `${me.user.firstName} ${me.user.lastName}`.trim() : "";
  const initial = me?.user.firstName.slice(0, 1) ?? "";

  return (
    <div className="bd-pop-wrap" ref={popover.wrap}>
      <button
        type="button"
        className="bd-iconbtn bd-avatar"
        data-popover-trigger
        aria-label={t("account.menu")}
        aria-expanded={popover.open}
        aria-controls={popover.open ? panelId : undefined}
        onClick={popover.toggle}
      >
        {initial || <UserRound size={18} strokeWidth={1.6} aria-hidden />}
      </button>
      {popover.open ? (
        <div className="bd-pop bd-pop--narrow" id={panelId} role="region" aria-label={t("account.menu")}>
          <p className="bd-pop__name">{name}</p>
          <Link href="/app/profile" className="bd-menuitem" onClick={popover.close}>{t("nav.profile")}</Link>
          <div className="bd-pop__lang">
            <span className="bd-hint">{t("locale.label")}</span>
            <LocaleSwitch />
          </div>
        </div>
      ) : null}
    </div>
  );
}
