"use client";

import type { ReactNode } from "react";

type MailLinkProps = {
  children?: ReactNode;
  "aria-label"?: string;
};

export function MailLink({ children, "aria-label": ariaLabel }: MailLinkProps) {
  function open(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const name = ["clem", "shao"].join("");
    const domain = ["gmail", "com"].join(".");
    window.location.href = `mailto:${name}@${domain}`;
  }

  return (
    <a href="#mail" onClick={open} aria-label={ariaLabel}>
      {children ?? "clemshao at gmail dot com"}
    </a>
  );
}
