export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('tenants', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    slug: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    subdomain: {
      type: Sequelize.STRING(100),
      allowNull: false,
      unique: true
    },
    custom_domain: {
      type: Sequelize.STRING(255)
    },
    logo_url: {
      type: Sequelize.STRING(500)
    },
    primary_color: {
      type: Sequelize.STRING(7)
    },
    secondary_color: {
      type: Sequelize.STRING(7)
    },
    accent_color: {
      type: Sequelize.STRING(7)
    },
    plan_type: {
      type: Sequelize.ENUM('free', 'basic', 'professional', 'enterprise'),
      defaultValue: 'free'
    },
    max_mentors: {
      type: Sequelize.INTEGER.UNSIGNED
    },
    max_mentees: {
      type: Sequelize.INTEGER.UNSIGNED
    },
    max_appointments_per_month: {
      type: Sequelize.INTEGER.UNSIGNED
    },
    status: {
      type: Sequelize.ENUM('active', 'suspended', 'trial', 'cancelled'),
      defaultValue: 'trial'
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

  await queryInterface.createTable('roles', {
    id: {
      type: Sequelize.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      references: {
        model: 'tenants',
        key: 'id'
      },
      onDelete: 'CASCADE',
      allowNull: true
    },
    name: {
      type: Sequelize.STRING(150),
      allowNull: false
    },
    scope: {
      type: Sequelize.ENUM('super_admin', 'tenant_admin', 'organizer', 'mentor', 'participant', 'team_captain'),
      allowNull: false
    },
    description: {
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

  await queryInterface.createTable('users', {
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
    role_id: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'roles',
        key: 'id'
      },
      onDelete: 'RESTRICT'
    },
    email: {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: true
    },
    password: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    first_name: {
      type: Sequelize.STRING(150),
      allowNull: false
    },
    last_name: {
      type: Sequelize.STRING(150),
      allowNull: false
    },
    avatar_url: {
      type: Sequelize.STRING(500)
    },
    language: {
      type: Sequelize.STRING(10),
      defaultValue: 'es'
    },
    status: {
      type: Sequelize.ENUM('active', 'inactive', 'invited'),
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

  await queryInterface.createTable('events', {
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
    created_by: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'RESTRICT'
    },
    name: {
      type: Sequelize.STRING(255),
      allowNull: false
    },
    description: {
      type: Sequelize.TEXT
    },
    start_date: {
      type: Sequelize.DATE,
      allowNull: false
    },
    end_date: {
      type: Sequelize.DATE,
      allowNull: false
    },
    min_team_size: {
      type: Sequelize.INTEGER.UNSIGNED,
      defaultValue: 1
    },
    max_team_size: {
      type: Sequelize.INTEGER.UNSIGNED,
      defaultValue: 8
    },
    status: {
      type: Sequelize.ENUM('draft', 'published', 'archived'),
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

  await queryInterface.addIndex('users', ['tenant_id', 'email']);
  await queryInterface.addIndex('events', ['tenant_id', 'start_date']);
}

export async function down(queryInterface) {
  await queryInterface.removeIndex('events', ['tenant_id', 'start_date']);
  await queryInterface.removeIndex('users', ['tenant_id', 'email']);
  await queryInterface.dropTable('events');
  await queryInterface.dropTable('users');
  await queryInterface.dropTable('roles');
  await queryInterface.dropTable('tenants');
}

