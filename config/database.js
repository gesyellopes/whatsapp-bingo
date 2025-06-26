require('dotenv').config();
const { Sequelize } = require('sequelize');

// Criando uma instância do Sequelize para se conectar ao banco de dados com SSL
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'mysql',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // ⚠️ Use false apenas se não tiver certificado confiável (para testes/dev)
    }
  }
});

module.exports = sequelize;
