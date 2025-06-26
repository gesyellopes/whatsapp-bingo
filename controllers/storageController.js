// controllers/StorageController.js
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

class StorageController {
    async uploadFileToStorage(localFilePath, fileName) {
        try {
            const form = new FormData();
            form.append('file', fs.createReadStream(localFilePath));

            const response = await axios.post(
                `${process.env.API_STORAGE}/upload`,
                form,
                {
                    headers: {
                        ...form.getHeaders(),
                        'x-api-key': process.env.KEY_STORAGE_API
                    }
                }
            );

            return response.data;

        } catch (error) {
            console.error('Erro ao enviar para o storage:', error.message);
            return { success: false, message: 'Erro ao enviar para o storage', error: error.message };
        }
    }
}

module.exports = new StorageController();