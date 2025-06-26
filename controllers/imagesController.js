// controllers/ImagesController.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const StorageController = require('./StorageController');

class ImagesController {
    async downloadAndSaveImage(imageUrl) {
        const hash = crypto.randomBytes(16).toString('hex');
        const fileExtension = path.extname(imageUrl).split('?')[0];
        const fileName = `${hash}${fileExtension}`;
        const savePath = path.join(__dirname, '../public/original', fileName);

        try {
            const response = await axios({
                method: 'get',
                url: imageUrl,
                responseType: 'stream'
            });

            const writer = fs.createWriteStream(savePath);

            return new Promise((resolve, reject) => {
                response.data.pipe(writer);

                writer.on('finish', async () => {
                    const uploadResult = await StorageController.uploadFileToStorage(savePath, fileName);

                    uploadResult.storage_name = uploadResult.file_id;

                    // 🔥 Garante que file_id seja o nome do arquivo local salvo
                    uploadResult.file_id = fileName;
                    

                    resolve(uploadResult);
                });

                writer.on('error', (error) => {
                    reject({ success: false, message: 'Erro ao salvar a imagem', error });
                });
            });

        } catch (error) {
            console.error('Erro ao baixar a imagem:', error);
            return { success: false, message: 'Erro ao baixar a imagem', error };
        }
    }
}

module.exports = new ImagesController();
