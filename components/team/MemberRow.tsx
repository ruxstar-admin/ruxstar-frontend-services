"use client";

import Link from "next/link";
import { Avatar } from "@/components/profile/Avatar";
import { Icon, Tag } from "@/components/ui";
import { MEMBER_STATUS, inviteEnds, permissionsLine, type PermissionInfo, type TeamMember } from "@/lib/api/team";
import styles from "./team.module.css";

/** One person on a team, or invited to it. A link with `href`, a button with `onClick`. */
export function MemberRow({ member, catalog, href, onClick }: { member: TeamMember; catalog: PermissionInfo[]; href?: string; onClick?: () => void }) {
  const status = MEMBER_STATUS[member.status];
  const who = member.person.username ? `@${member.person.username}` : null;
  const detail = member.status === "invited" && member.expiresAt ? inviteEnds(member.expiresAt) : permissionsLine(catalog, member.permissions);
  const body = (
    <>
      <Avatar name={member.person.name} url={member.person.avatar} size={40} />
      <span className={styles.text}>
        <span className={styles.name}>{member.person.name}</span>
        <span className={styles.line}>{[who, detail].filter(Boolean).join(" · ")}</span>
      </span>
      <Tag tone={status.tone}>{status.label}</Tag>
      {(href || onClick) && <Icon name="chevron-right" size={18} />}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={styles.member}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" className={styles.member} onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className={styles.member}>{body}</div>;
}
