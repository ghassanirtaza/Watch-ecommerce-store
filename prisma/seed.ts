import { PrismaClient, RoleName } from "@prisma/client";
import { PERMISSIONS, ROLE_PERMISSIONS, permissionKey } from "../src/lib/permissions/permissions";

const db = new PrismaClient();

async function main() {
  console.log("Seeding roles and permissions...");

  await seedPrimaryLocation();


  // 1. Create all permissions from the domain map.
  const allPermissionKeys: string[] = [];
  for (const [domain, actions] of Object.entries(PERMISSIONS)) {
    for (const action of actions) {
      allPermissionKeys.push(permissionKey(domain as keyof typeof PERMISSIONS, action));
    }
  }

  for (const key of allPermissionKeys) {
    const [domain = key] = key.split(".");
    await db.permission.upsert({
      where: { key },
      update: {},
      create: { key, domain },
    });
  }
  console.log(`  ${allPermissionKeys.length} permissions ensured.`);

  // 2. Create the 6 fixed roles.
  const roleNames = Object.values(RoleName);
  const roleRecords: Record<string, string> = {};

  for (const name of roleNames) {
    const role = await db.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    roleRecords[name] = role.id;
  }
  console.log(`  ${roleNames.length} roles ensured.`);

  // 3. Wire role -> permission mappings. SUPER_ADMIN gets every
  // permission explicitly in the DB (rather than relying only on the
  // "*" shortcut in code) so admin UI listing "what can this role do"
  // reflects reality, and so DB-driven permission checks (if added
  // later) work without a code-level special case.
  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    const roleId = roleRecords[roleName];
    if (!roleId) continue;

    const keysToAssign = permKeys.includes("*") ? allPermissionKeys : permKeys;

    for (const key of keysToAssign) {
      const permission = await db.permission.findUnique({ where: { key } });
      if (!permission) continue;

      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permission.id } },
        update: {},
        create: { roleId, permissionId: permission.id },
      });
    }
    console.log(`  ${roleName}: ${keysToAssign.length} permissions assigned.`);
  }

  // 4. Bootstrap a Super Admin user if none exists. Password must be
  // set via Better Auth's own credential flow (not directly here) —
  // this only creates the User + role assignment shell so the very
  // first admin has somewhere to sign up against. In practice, run
  // this seed, then use Better Auth's sign-up flow with this email,
  // then confirm the role assignment below matches.
  const bootstrapEmail = process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL;
  if (!bootstrapEmail) {
    console.log(
      "  Skipping Super Admin bootstrap — set BOOTSTRAP_SUPER_ADMIN_EMAIL to create one."
    );
  } else {
    const user = await db.user.upsert({
      where: { email: bootstrapEmail },
      update: { isAdminUser: true },
      create: {
        email: bootstrapEmail,
        isAdminUser: true,
        emailVerified: true,
      },
    });

    const superAdminRoleId = roleRecords["SUPER_ADMIN"];
    if (superAdminRoleId) {
      await db.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: superAdminRoleId } },
        update: {},
        create: { userId: user.id, roleId: superAdminRoleId },
      });
    }
    console.log(`  Super Admin shell ready for ${bootstrapEmail}.`);
    console.log(
      "  IMPORTANT: this user has no password yet — sign up through the app's auth flow with this same email to set one, or use Better Auth's admin API."
    );
  }

  console.log("Seed complete.");
}

async function seedPrimaryLocation() {
  const existing = await db.inventoryLocation.findFirst({ where: { isPrimary: true } });
  if (existing) return;

  await db.inventoryLocation.create({
    data: { name: "Main Warehouse", isPrimary: true },
  });
  console.log("  Primary inventory location created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
