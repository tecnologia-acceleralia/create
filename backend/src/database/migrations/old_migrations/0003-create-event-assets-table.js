export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('event_assets', {
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
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'Nombre identificador del recurso (usado en marcadores)'
    },
    original_filename: {
      type: Sequelize.STRING(500),
      allowNull: false,
      comment: 'Nombre original del archivo subido'
    },
    s3_key: {
      type: Sequelize.STRING(1000),
      allowNull: false,
      comment: 'Clave del objeto en S3/Spaces'
    },
    url: {
      type: Sequelize.STRING(1000),
      allowNull: false,
      comment: 'URL pública del archivo'
    },
    mime_type: {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'Tipo MIME del archivo'
    },
    file_size: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      comment: 'Tamaño del archivo en bytes'
    },
    uploaded_by: {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      },
      onDelete: 'RESTRICT'
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

  await queryInterface.addIndex('event_assets', ['tenant_id', 'event_id'], {
    name: 'idx_event_assets_tenant_event'
  });

  await queryInterface.addIndex('event_assets', ['tenant_id', 'event_id', 'name'], {
    name: 'idx_event_assets_tenant_event_name',
    unique: true
  });

  await queryInterface.addIndex('event_assets', ['event_id'], {
    name: 'idx_event_assets_event'
  });
}

export async function down(queryInterface) {
  await queryInterface.dropTable('event_assets');
}

