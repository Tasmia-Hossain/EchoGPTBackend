import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  for (const name of ['USER', 'ADMIN']) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }

  const adminEmail = 'admin@echogpt.dev';
  const adminPassword = 'Admin123!Change';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { email: adminEmail, passwordHash, name: 'Admin' },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + 30);

  const existingSub = await prisma.subscription.findFirst({ where: { userId: adminUser.id } });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        userId: adminUser.id,
        plan: 'PREMIUM',
        status: 'ACTIVE',
        requestLimit: 1000,
        usedRequests: 0,
        currentPeriodStart: start,
        currentPeriodEnd: end,
      },
    });
  }

  console.log(`Seed done. Admin login: ${adminEmail} / ${adminPassword}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});