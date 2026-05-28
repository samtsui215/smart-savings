/**
 * Optional seed: creates a demo user row with a few categories so the
 * dashboard has data to show. Authentication is owned by Firebase, so this
 * row has no password — it becomes reachable when someone signs in via
 * Firebase with the matching email (we match by email on first login).
 *
 * Safe to re-run — skips if the demo user already exists.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const email = "demo@example.com";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Demo user ${email} already exists — skipping seed.`);
    return;
  }

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, totalBalance: 0 },
    });

    // The Unassigned bucket is mandatory for every user.
    await tx.category.create({
      data: { userId: user.id, name: "Unassigned", isUnassigned: true },
    });

    await tx.category.createMany({
      data: [
        { userId: user.id, name: "Emergency Fund", targetAmount: 500_000, position: 1 },
        { userId: user.id, name: "Travel",         targetAmount: 200_000, position: 2 },
        { userId: user.id, name: "Rent",           targetAmount: 150_000, position: 3 },
      ],
    });
  });

  console.log(`Seeded demo user: ${email} (sign in via Firebase with this email to claim it)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
