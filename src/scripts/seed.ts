import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be configured.');
  }

  if (adminPassword.length < 16) {
    throw new Error('SEED_ADMIN_PASSWORD must be at least 16 characters long.');
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  try {
    for (const name of ['USER', 'ADMIN']) {
      await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const adminUser = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash },
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

    const existingSub = await prisma.subscription.findFirst({
      where: { userId: adminUser.id },
    });
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

    console.log(`Seed done. Admin account configured for ${adminEmail}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error('Seed failed. Check the database connection and seed configuration.');
  process.exitCode = 1;
});
