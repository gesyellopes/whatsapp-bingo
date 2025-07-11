const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Importa a configuração do banco

const ImagensLote = sequelize.define('ImagensLote', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    phone_number: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    original_file: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    image_url: {
        type: DataTypes.STRING(512),
        allowNull: false,
    },
    deleted_storage: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    ready: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: sequelize.literal('CURRENT_TIMESTAMP'),
    },
}, {
    tableName: 'imagens_lote',
    timestamps: false, // Desativa uso automático de createdAt e updatedAt
});

module.exports = ImagensLote;