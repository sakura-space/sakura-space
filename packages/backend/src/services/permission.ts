import { PrismaClient, Role, ApiType } from "@prisma/client";

const prisma = new PrismaClient();

export interface EnabledPermission {
  api: ApiType;
  action: string;
  label: string;
}

export async function getEnabledPermissions(role: Role): Promise<EnabledPermission[]> {
  const perms = await prisma.apiPermission.findMany({
    where: { role, enabled: true },
  });
  return perms.map((p) => ({ api: p.api, action: p.action, label: p.label }));
}
