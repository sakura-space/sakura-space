import { PrismaClient, Role, ApiType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  {
    api: ApiType.SMARTHR,
    action: "get_employee_info",
    label: "従業員情報の取得",
  },
  {
    api: ApiType.SMARTHR,
    action: "get_leave_balance",
    label: "有給残日数の確認",
  },
  {
    api: ApiType.SMARTHR,
    action: "submit_leave_request",
    label: "有給申請の提出",
  },
  {
    api: ApiType.SMARTHR,
    action: "submit_attendance_correction",
    label: "打刻修正の申請",
  },
  {
    api: ApiType.SERVICENOW,
    action: "create_hrsd_case",
    label: "HRSDケースの作成",
  },
  {
    api: ApiType.SERVICENOW,
    action: "get_hrsd_case_status",
    label: "HRSDケースの状態確認",
  },
];

// Default enabled permissions per role
const DEFAULT_ENABLED: Record<string, string[]> = {
  USER: [
    "SMARTHR:get_leave_balance",
    "SMARTHR:submit_leave_request",
    "SERVICENOW:get_hrsd_case_status",
  ],
  OPERATOR: [
    "SMARTHR:get_employee_info",
    "SMARTHR:get_leave_balance",
    "SMARTHR:submit_leave_request",
    "SMARTHR:submit_attendance_correction",
    "SERVICENOW:create_hrsd_case",
    "SERVICENOW:get_hrsd_case_status",
  ],
  SUPERVISOR: [
    "SMARTHR:get_employee_info",
    "SMARTHR:get_leave_balance",
    "SMARTHR:submit_leave_request",
    "SMARTHR:submit_attendance_correction",
    "SERVICENOW:create_hrsd_case",
    "SERVICENOW:get_hrsd_case_status",
  ],
  ADMIN: [
    "SMARTHR:get_employee_info",
    "SMARTHR:get_leave_balance",
    "SMARTHR:submit_leave_request",
    "SMARTHR:submit_attendance_correction",
    "SERVICENOW:create_hrsd_case",
    "SERVICENOW:get_hrsd_case_status",
  ],
};

async function main() {
  console.log("🌱 Seeding database...");

  const password = await bcrypt.hash("password123", 10);

  const users = [
    { email: "admin@sakura.co", name: "管理者 太郎", role: Role.ADMIN },
    {
      email: "supervisor@sakura.co",
      name: "スーパーバイザー 花子",
      role: Role.SUPERVISOR,
    },
    {
      email: "operator1@sakura.co",
      name: "オペレータ 一郎",
      role: Role.OPERATOR,
    },
    {
      email: "operator2@sakura.co",
      name: "オペレータ 二郎",
      role: Role.OPERATOR,
    },
    { email: "user1@sakura.co", name: "田中 三郎", role: Role.USER },
    { email: "user2@sakura.co", name: "鈴木 四郎", role: Role.USER },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, password },
    });
    console.log(`  ✓ User: ${u.email} (${u.role})`);
  }

  // Seed permissions for all roles
  const roles = [Role.USER, Role.OPERATOR, Role.SUPERVISOR, Role.ADMIN];
  for (const role of roles) {
    for (const perm of ALL_PERMISSIONS) {
      const key = `${perm.api}:${perm.action}`;
      const enabled = DEFAULT_ENABLED[role]?.includes(key) ?? false;
      await prisma.apiPermission.upsert({
        where: {
          role_api_action: { role, api: perm.api, action: perm.action },
        },
        update: { enabled, label: perm.label },
        create: {
          role,
          api: perm.api,
          action: perm.action,
          enabled,
          label: perm.label,
        },
      });
    }
    console.log(`  ✓ Permissions: ${role}`);
  }

  // Create a sample room
  const user1 = await prisma.user.findUnique({
    where: { email: "user1@sakura.co" },
  });
  if (user1) {
    const room = await prisma.room.upsert({
      where: { id: "room-sample-001" },
      update: {},
      create: { id: "room-sample-001", name: "一般相談チャット" },
    });
    await prisma.roomMember.upsert({
      where: { roomId_userId: { roomId: room.id, userId: user1.id } },
      update: {},
      create: { roomId: room.id, userId: user1.id },
    });
    console.log(`  ✓ Sample room created`);
  }

  console.log("✅ Seeding complete!");
  console.log("\n📝 Login credentials (password: password123):");
  for (const u of users) {
    console.log(`  ${u.role.padEnd(12)} ${u.email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
