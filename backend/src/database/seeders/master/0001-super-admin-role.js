export async function up(queryInterface) {
  await queryInterface.bulkInsert('roles', [
    {
      name: 'Super Admin',
      scope: 'super_admin',
      tenant_id: null,
      created_at: new Date(),
      updated_at: new Date()
    }
  ]);
}

export async function down(queryInterface) {
  await queryInterface.bulkDelete('roles', { scope: 'super_admin' });
}

