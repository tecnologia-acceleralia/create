export async function up(queryInterface, Sequelize) {
  const tableDescription = await queryInterface.describeTable('notifications').catch(() => null);
  if (!tableDescription) return;

  if (!tableDescription.metadata) {
    await queryInterface.addColumn('notifications', 'metadata', {
      type: Sequelize.JSON,
      allowNull: true
    });
  }

  await queryInterface.sequelize.query(
    `UPDATE notifications SET created_at = COALESCE(created_at, updated_at, CURRENT_TIMESTAMP) WHERE created_at IS NULL`
  ).catch(() => {});
}

export async function down(queryInterface) {
  const tableDescription = await queryInterface.describeTable('notifications').catch(() => null);
  if (!tableDescription?.metadata) return;
  await queryInterface.removeColumn('notifications', 'metadata');
}
