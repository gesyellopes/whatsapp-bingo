const fs = require('fs');
const path = require('path');
const axios = require('axios');
const moment = require('moment');
const crypto = require('crypto');  // Módulo para gerar hash


// Função para extrair o tipo MIME da string base64
function getFileTypeFromBase64(base64String) {
    const match = base64String.match(/^data:(.+);base64,/);
    if (match) {
        return match[1];  // Retorna o mime type, exemplo: image/jpeg
    } else {
        return null; // Não possui header
    }
}

class ImagesController {

    // Função para baixar e salvar a imagem
    async downloadAndSaveImage(imageUrl) {
        // Gerar um hash único para o nome do arquivo
        const hash = crypto.randomBytes(16).toString('hex');  // Gera um hash de 16 bytes em formato hexadecimal
        const fileExtension = path.extname(imageUrl);  // Obtém a extensão do arquivo da URL
        const fileName = `${hash}${fileExtension}`;  // Combina o hash com a extensão da imagem

        const savePath = path.join(__dirname, '../public/original', fileName);  // Caminho para salvar a imagem

        try {
            // Fazendo o download da imagem usando axios
            const response = await axios({
                method: 'get',
                url: imageUrl,
                responseType: 'stream'
            });

            // Criando o arquivo e escrevendo o conteúdo da imagem
            const writer = fs.createWriteStream(savePath);

            // Retorna uma Promise para aguardar o término do processo de gravação da imagem
            return new Promise((resolve, reject) => {
                response.data.pipe(writer);

                writer.on('finish', () => {
                    // Quando o arquivo for gravado com sucesso, resolve a Promise
                    resolve({ success: true, fileName });
                });

                writer.on('error', (error) => {
                    // Em caso de erro, rejeita a Promise
                    reject({ success: false, message: 'Erro ao salvar a imagem', error });
                });
            });

        } catch (error) {
            console.error('Erro ao baixar a imagem:', error);
            // Retorna uma Promise rejeitada caso ocorra algum erro na requisição HTTP
            return { success: false, message: 'Erro ao baixar a imagem', error };
        }
    }

    // Função para entregar a imagem ao cliente
    deliverImage(req, res) {
        const { fileName } = req.params; // Pega o nome do arquivo da URL
        const filePath = path.join(__dirname, '../saved_images', fileName); // Caminho do arquivo salvo

        // Verifica se o arquivo existe
        fs.exists(filePath, (exists) => {
            if (!exists) {
                return res.status(404).json({ success: false, message: 'Imagem não encontrada' });
            }

            // Envia a imagem ao cliente
            res.sendFile(filePath);
        });
    }

    // Função base64Decode agora retorna uma Promise
    async base64Decode(base64_data, fileName) {
        // Remover o prefixo "data:image/...;base64," se existir
        const base64DataWithoutPrefix = base64_data.replace(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/, '');

        // Detectar a extensão com base no primeiro caractere do conteúdo base64
        let fileExtension = '';

        const firstChar = base64DataWithoutPrefix.charAt(0); // O primeiro caractere do base64 (após o prefixo)
        switch (firstChar) {
            case '/':  // Para imagens JPEG
                fileExtension = 'jpg';
                break;
            case 'i':  // Para imagens PNG
                fileExtension = 'png';
                break;
            case 'R':  // Para imagens GIF
                fileExtension = 'gif';
                break;
            case 'U':  // Para imagens WebP
                fileExtension = 'webp';
                break;
            default:
                console.error('Tipo de imagem não reconhecido');
                return { success: false, message: 'Tipo de imagem não reconhecido' };
        }

        // Gerar um nome único para o arquivo usando hash
        const newFileName = `${fileName}.${fileExtension}`; // Atribui o nome com a extensão correta

        // Caminho para salvar a imagem processada
        const savePath = path.join(__dirname, '../public/processed', newFileName);

        // Convertendo base64 para buffer
        const buffer = Buffer.from(base64DataWithoutPrefix, 'base64');

        // Retorna uma Promise que resolve ou rejeita com base no resultado de salvar o arquivo
        return new Promise((resolve, reject) => {
            fs.writeFile(savePath, buffer, (err) => {
                if (err) {
                    console.error('Erro ao salvar a imagem base64:', err);
                    reject({ success: false, message: 'Erro ao salvar a imagem' });
                } else {
                    resolve({ success: true, fileName: newFileName, ticketNumber: fileName });
                }
            });
        });
    }
}

module.exports = new ImagesController();
