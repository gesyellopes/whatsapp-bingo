# Usar uma imagem base do Node.js
FROM node:16

# Definir o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copiar o package.json e package-lock.json (caso existam)
COPY package*.json ./

# Instalar as dependências
RUN npm install

# Copiar todo o código para dentro do container
COPY . .

# Definir a variável de ambiente para o arquivo .env
COPY .env .env

# Expor a porta que o app vai rodar
EXPOSE 3001

# Definir o comando de inicialização da aplicação
CMD ["node", "server.js"]
