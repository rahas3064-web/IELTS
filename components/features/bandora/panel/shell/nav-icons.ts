import {
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  PenLine,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { NavId } from "@/components/features/bandora/panel/shell/nav-items";

export const NAV_ICONS: Record<NavId, LucideIcon> = {
  dashboard: LayoutDashboard,
  plan: CalendarDays,
  practice: PenLine,
  mock: FileText,
  progress: LineChart,
  feedback: MessageSquare,
  assistant: Sparkles,
  profile: UserRound,
  subscription: CreditCard,
};
