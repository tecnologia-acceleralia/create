export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('submissions', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE'
    },
    event_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'events', key: 'id' },
      onDelete: 'CASCADE'
    },
    task_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tasks', key: 'id' },
      onDelete: 'CASCADE'
    },
    team_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
      onDelete: 'CASCADE'
    },
    submitted_by: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    status: {
      type: Sequelize.ENUM('draft', 'final'),
      defaultValue: 'draft'
    },
    type: {
      type: Sequelize.ENUM('provisional', 'final'),
      defaultValue: 'provisional'
    },
    content: {
      type: Sequelize.TEXT
    },
    attachment_url: {
      type: Sequelize.STRING(500)
    },
    submitted_at: {
      type: Sequelize.DATE,
      defaultValue: Sequelize.NOW
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

  await queryInterface.createTable('evaluations', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE'
    },
    submission_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'submissions', key: 'id' },
      onDelete: 'CASCADE'
    },
    reviewer_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    score: {
      type: Sequelize.DECIMAL(5, 2)
    },
    comment: {
      type: Sequelize.TEXT
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

  await queryInterface.createTable('notifications', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    message: {
      type: Sequelize.TEXT,
      allowNull: false
    },
    type: {
      type: Sequelize.ENUM('system', 'evaluation', 'reminder'),
      defaultValue: 'system'
    },
    is_read: {
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

  await queryInterface.addIndex('submissions', ['tenant_id', 'task_id']);
  await queryInterface.addIndex('evaluations', ['tenant_id', 'submission_id']);
  await queryInterface.addIndex('notifications', ['tenant_id', 'user_id']);
}

export async function down(queryInterface) {
  await queryInterface.dropTable('notifications');
  await queryInterface.dropTable('evaluations');
  await queryInterface.dropTable('submissions');
}

