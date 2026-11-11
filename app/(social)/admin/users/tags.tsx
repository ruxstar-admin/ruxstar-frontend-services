import { Tag, type TagTone } from "@/components/ui";
import type { UserRow, UserStatus } from "@/lib/api/admin";

const STATUS: Record<UserStatus, [string, TagTone]> = {
  active: ["Active", "success"],
  locked: ["On hold", "danger"],
  deleted: ["Deleted", "neutral"],
};

export function StatusTag({ status }: { status: UserStatus }) {
  const [label, tone] = STATUS[status];
  return <Tag tone={tone}>{label}</Tag>;
}

export function RoleTags({ roles }: { roles: UserRow["roles"] }) {
  return (
    <>
      {roles.admin && <Tag tone="solid">Admin</Tag>}
      {roles.ruxstarStaff && !roles.admin && <Tag tone="solid">Staff</Tag>}
      {roles.vendor && <Tag>Vendor</Tag>}
      {roles.delivery && <Tag>Delivery</Tag>}
    </>
  );
}
