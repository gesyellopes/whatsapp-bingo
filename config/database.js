require('dotenv').config();
const { Sequelize } = require('sequelize');

// Criando uma instância do Sequelize para se conectar ao banco de dados
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false, // Pode ser setado para `console.log` para ver as queries SQL geradas
});

module.exports = sequelize;
