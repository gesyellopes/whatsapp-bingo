const { DataTypes } = require('sequelize');
const sequelize = require('../config/database'); // Importa a configuração do banco

const TicketStub = sequelize.define('TicketStub', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    message_id: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    from_number: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    from_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
    },
    message_date: {
        type: DataTypes.DATE,  // Usando DataTypes.DATE em vez de TIMESTAMP
        allowNull: true,
    },
    original_file: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    processed_file: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    processed_status: {
        type: DataTypes.ENUM('pending', 'processed', 'failed'),
        defaultValue: 'pending',
    },
    ticket_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
    message_status: {
        type: DataTypes.ENUM('received', 'read', 'error'),
        defaultValue: 'received',
    },
    created_at: {
        type: DataTypes.DATE, // Correção para DataTypes.DATE
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
        type: DataTypes.DATE, // Correção para DataTypes.DATE
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: sequelize.literal('CURRENT_TIMESTAMP'),
    },
}, {
    tableName: 'ticket_stub', // Nome da tabela no banco de dados
    timestamps: false, // Desativa o uso automático de createdAt e updatedAt
});

module.exports = TicketStub;
