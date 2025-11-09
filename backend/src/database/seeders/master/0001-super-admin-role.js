import bcrypt from 'bcryptjs';

const SUPER_ADMIN_EMAIL = 'superadmin@create.dev';
const SUPER_ADMIN_PASSWORD = 'SuperAdmin2025!';

export async function up(queryInterface) {
  const now = new Date();

  const [[existingRole]] = await queryInterface.sequelize.query(
    "SELECT id FROM roles WHERE scope = 'super_admin' LIMIT 1"
  );

  if (!existingRole) {
    await queryInterface.bulkInsert('roles', [
      {
        name: 'Super Admin',
        scope: 'super_admin',
        tenant_id: null,
        created_at: now,
        updated_at: now
      }
    ]);
  }

  const [[existingUser]] = await queryInterface.sequelize.query(
    `SELECT id FROM users WHERE email = '${SUPER_ADMIN_EMAIL}' LIMIT 1`
  );

  if (!existingUser) {
    const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);

    await queryInterface.bulkInsert('users', [
      {
        email: SUPER_ADMIN_EMAIL,
        password: passwordHash,
        first_name: 'Super',
        last_name: 'Admin',
        language: 'es',
        status: 'active',
        profile_image_url: null,
        is_super_admin: true,
        created_at: now,
        updated_at: now
      }
    ]);
  }
}

export async function down(queryInterface) {
  await queryInterface.bulkDelete('users', { email: SUPER_ADMIN_EMAIL });
  await queryInterface.bulkDelete('roles', { scope: 'super_admin' });
}

