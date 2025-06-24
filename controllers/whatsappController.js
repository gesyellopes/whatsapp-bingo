const axios = require('axios');

// Função para enviar mensagem de texto para o WhatsApp
async function sendTextMessage(to, text) {
    try {
        const apiUrl = `${process.env.API_WHATSAPP_URL}/${process.env.WHATSAPP_KEY}/message/text`;
        const messageBody = {
            to: to,
            text: text
        };

        // Envia a requisição para a API do WhatsApp
        const response = await axios.post(apiUrl, messageBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Erro ao enviar a mensagem para o WhatsApp:', error);
        throw error;
    }
}

// Função para enviar mensagem com imagem para o WhatsApp
async function sendImageMessage(to, url, caption) {
    try {
        const apiUrl = `${process.env.API_WHATSAPP_URL}/${process.env.WHATSAPP_KEY}/message/image`;
        const messageBody = {
            to: to,
            url: url,
            caption: caption
        };

        // Envia a requisição para a API do WhatsApp
        const response = await axios.post(apiUrl, messageBody, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Erro ao enviar a mensagem de imagem para o WhatsApp:', error);
        throw error;
    }
}

module.exports = { sendTextMessage, sendImageMessage };
