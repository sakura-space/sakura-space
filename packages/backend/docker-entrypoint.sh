#!/bin/sh
set -e

echo "⏳ Waiting for PostgreSQL..."
until npx prisma db push --skip-generate 2>/dev/null; do
  echo "  postgres not ready, retrying in 2s..."
  sleep 2
done

echo "🌱 Seeding database..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('password123', 10);
  const users = [
    { email: 'admin@sakura.co',      name: '管理者 太郎',          role: 'ADMIN' },
    { email: 'supervisor@sakura.co', name: 'スーパーバイザー 花子', role: 'SUPERVISOR' },
    { email: 'operator1@sakura.co',  name: 'オペレータ 一郎',       role: 'OPERATOR' },
    { email: 'operator2@sakura.co',  name: 'オペレータ 二郎',       role: 'OPERATOR' },
    { email: 'user1@sakura.co',      name: '田中 三郎',             role: 'USER' },
    { email: 'user2@sakura.co',      name: '鈴木 四郎',             role: 'USER' },
  ];
  for (const u of users) {
    await prisma.user.upsert({ where: { email: u.email }, update: {}, create: { ...u, password } });
  }

  const ALL_PERMISSIONS = [
    { api: 'SMARTHR',    action: 'get_employee_info',           label: '従業員情報の取得' },
    { api: 'SMARTHR',    action: 'get_leave_balance',           label: '有給残日数の確認' },
    { api: 'SMARTHR',    action: 'submit_leave_request',        label: '有給申請の提出' },
    { api: 'SMARTHR',    action: 'submit_attendance_correction',label: '打刻修正の申請' },
    { api: 'SERVICENOW', action: 'create_hrsd_case',            label: 'HRSDケースの作成' },
    { api: 'SERVICENOW', action: 'get_hrsd_case_status',        label: 'HRSDケースの状態確認' },
  ];
  const DEFAULT_ENABLED = {
    USER:       ['SMARTHR:get_leave_balance','SMARTHR:submit_leave_request','SERVICENOW:get_hrsd_case_status'],
    OPERATOR:   ['SMARTHR:get_employee_info','SMARTHR:get_leave_balance','SMARTHR:submit_leave_request','SMARTHR:submit_attendance_correction','SERVICENOW:create_hrsd_case','SERVICENOW:get_hrsd_case_status'],
    SUPERVISOR: ['SMARTHR:get_employee_info','SMARTHR:get_leave_balance','SMARTHR:submit_leave_request','SMARTHR:submit_attendance_correction','SERVICENOW:create_hrsd_case','SERVICENOW:get_hrsd_case_status'],
    ADMIN:      ['SMARTHR:get_employee_info','SMARTHR:get_leave_balance','SMARTHR:submit_leave_request','SMARTHR:submit_attendance_correction','SERVICENOW:create_hrsd_case','SERVICENOW:get_hrsd_case_status'],
  };
  for (const role of ['USER','OPERATOR','SUPERVISOR','ADMIN']) {
    for (const perm of ALL_PERMISSIONS) {
      const enabled = (DEFAULT_ENABLED[role] || []).includes(perm.api + ':' + perm.action);
      await prisma.apiPermission.upsert({
        where: { role_api_action: { role, api: perm.api, action: perm.action } },
        update: { enabled, label: perm.label },
        create: { role, api: perm.api, action: perm.action, enabled, label: perm.label },
      });
    }
  }

  const user1 = await prisma.user.findUnique({ where: { email: 'user1@sakura.co' } });
  if (user1) {
    const room = await prisma.room.upsert({ where: { id: 'room-sample-001' }, update: {}, create: { id: 'room-sample-001', name: '一般相談チャット' } });
    await prisma.roomMember.upsert({ where: { roomId_userId: { roomId: room.id, userId: user1.id } }, update: {}, create: { roomId: room.id, userId: user1.id } });
  }

  console.log('✅ Seed complete');
  await prisma.\$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
"

echo "🚀 Starting server..."
exec node dist/index.js
