export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('phases', {
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
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    name: {
      type: Sequelize.STRING(200),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
    },
    start_date: {
      type: Sequelize.DATE
    },
    end_date: {
      type: Sequelize.DATE
    },
    order_index: {
      type: Sequelize.INTEGER.UNSIGNED,
      defaultValue: 1
    },
    is_elimination: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  });

  await queryInterface.createTable('tasks', {
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
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'events',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    phase_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'phases',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
    },
    delivery_type: {
      type: Sequelize.ENUM('text', 'file', 'url', 'video', 'audio', 'zip'),
      defaultValue: 'file'
    },
    is_required: {
      type: Sequelize.BOOLEAN,
      defaultValue: true
    },
    due_date: {
      type: Sequelize.DATE
    },
    status: {
      type: Sequelize.ENUM('draft', 'active', 'closed'),
      defaultValue: 'draft'
    },
    created_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    },
    updated_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
    }
  });

  await queryInterface.addIndex('phases', ['tenant_id', 'event_id', 'order_index']);
  await queryInterface.addIndex('tasks', ['tenant_id', 'event_id', 'phase_id']);
}

export async function down(queryInterface) {
  await queryInterface.removeIndex('tasks', ['tenant_id', 'event_id', 'phase_id']);
  await queryInterface.removeIndex('phases', ['tenant_id', 'event_id', 'order_index']);
  await queryInterface.dropTable('tasks');
  await queryInterface.dropTable('phases');
}

