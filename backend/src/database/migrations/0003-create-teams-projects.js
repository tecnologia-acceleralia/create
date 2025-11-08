export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('teams', {
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
    captain_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL'
    },
    name: {
      type: Sequelize.STRING(200),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
    },
    requirements: {
      type: Sequelize.TEXT
    },
    status: {
      type: Sequelize.ENUM('open', 'closed'),
      defaultValue: 'open'
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

  await queryInterface.createTable('team_members', {
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
    team_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
      onDelete: 'CASCADE'
    },
    user_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'users', key: 'id' },
      onDelete: 'CASCADE'
    },
    role: {
      type: Sequelize.ENUM('captain', 'member', 'mentor'),
      defaultValue: 'member'
    },
    status: {
      type: Sequelize.ENUM('active', 'pending', 'invited'),
      defaultValue: 'active'
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

  await queryInterface.addConstraint('team_members', {
    type: 'unique',
    fields: ['team_id', 'user_id'],
    name: 'uniq_team_member'
  });

  await queryInterface.createTable('projects', {
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
    team_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: 'teams', key: 'id' },
      onDelete: 'CASCADE'
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    summary: {
      type: Sequelize.TEXT
    },
    problem: {
      type: Sequelize.TEXT
    },
    solution: {
      type: Sequelize.TEXT
    },
    status: {
      type: Sequelize.ENUM('draft', 'active', 'completed'),
      defaultValue: 'draft'
    },
    logo_url: {
      type: Sequelize.STRING(500)
    },
    repository_url: {
      type: Sequelize.STRING(500)
    },
    pitch_url: {
      type: Sequelize.STRING(500)
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

  await queryInterface.addIndex('teams', ['tenant_id', 'event_id']);
  await queryInterface.addIndex('team_members', ['tenant_id', 'user_id']);
  await queryInterface.addIndex('projects', ['tenant_id', 'event_id']);
}

export async function down(queryInterface) {
  await queryInterface.dropTable('projects');
  await queryInterface.dropTable('team_members');
  await queryInterface.dropTable('teams');
}

