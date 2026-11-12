import Link from "@/components/link";

export function Logo({ href = "/app" }: { href?: string }) {
  return (
    <Link href={href} className="bd-logo" dir="ltr">
      bandora<span>.</span>
    </Link>
  );
}
