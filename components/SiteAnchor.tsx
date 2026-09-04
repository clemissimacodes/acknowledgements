"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteAnchor() {
  const pathname = usePathname();
  const href = pathname === "/" ? "/about" : "/";

  return (
    <Link className="site-anchor" href={href}>
      Clementine Kay Shao
    </Link>
  );
}
