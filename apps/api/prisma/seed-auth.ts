import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const saltRounds = 12;

const authUsers = [
  {
    name: '系统管理员',
    username: 'admin',
    password: 'Admin@123456',
    role: UserRole.ADMIN,
  },
  {
    name: '采购A',
    username: 'purchaser_a',
    password: 'Purchaser@123456',
    role: UserRole.PURCHASER,
  },
  {
    name: '采购B',
    username: 'purchaser_b',
    password: 'PurchaserB@123456',
    role: UserRole.PURCHASER,
  },
  {
    name: '运营查看',
    username: 'operator',
    password: 'Viewer@123456',
    role: UserRole.VIEWER,
  },
] as const;

async function main() {
  for (const user of authUsers) {
    const passwordHash = await bcrypt.hash(user.password, saltRounds);

    await prisma.user.upsert({
      where: { username: user.username },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
        status: 'ACTIVE',
      },
      create: {
        name: user.name,
        username: user.username,
        passwordHash,
        role: user.role,
        status: 'ACTIVE',
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
