export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('password_reset_tokens', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    code_hash: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    expires_at: {
      type: Sequelize.DATE,
      allowNull: false
    },
    consumed_at: {
      type: Sequelize.DATE,
      allowNull: true
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.NOW
    }
  });

  await queryInterface.addIndex('password_reset_tokens', ['tenant_id', 'user_id'], {
    name: 'password_reset_tokens_tenant_user_idx'
  });

  await queryInterface.addIndex(
    'password_reset_tokens',
    ['tenant_id', 'expires_at'],
    {
      name: 'password_reset_tokens_tenant_expiration_idx'
    }
  );
}

export async function down(queryInterface) {
  await queryInterface.removeIndex('password_reset_tokens', 'password_reset_tokens_tenant_user_idx');
  await queryInterface.removeIndex('password_reset_tokens', 'password_reset_tokens_tenant_expiration_idx');
  await queryInterface.dropTable('password_reset_tokens');
}


