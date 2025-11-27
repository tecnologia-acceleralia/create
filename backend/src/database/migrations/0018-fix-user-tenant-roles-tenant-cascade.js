export async function up(queryInterface) {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(
      'user_tenant_roles',
      'user_tenant_roles_ibfk_1',
      { transaction }
    );

    await queryInterface.addConstraint('user_tenant_roles', {
      fields: ['tenant_id'],
      type: 'foreign key',
      name: 'user_tenant_roles_ibfk_1',
      references: {
        table: 'tenants',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
      transaction
    });
  });
}

export async function down(queryInterface) {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(
      'user_tenant_roles',
      'user_tenant_roles_ibfk_1',
      { transaction }
    );

    await queryInterface.addConstraint('user_tenant_roles', {
      fields: ['tenant_id'],
      type: 'foreign key',
      name: 'user_tenant_roles_ibfk_1',
      references: {
        table: 'tenants',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
      transaction
    });
  });
}

