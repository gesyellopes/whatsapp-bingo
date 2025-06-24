const moment = require('moment');  // Biblioteca para manipulação de datas (instale via npm install moment)

class WebhookController {
    analyzeWebhook(req, res) {
        const json_data = req.body;

        
        if (json_data.type !== 'message') {
            return ['false'];
        }

        // Extraindo as variáveis do JSON
        const { messageType, messageId, remoteJid, pushName} = json_data.data;

        //console.log(json_data);

        let response = [];

        // Verifica o tipo da mensagem
        if (messageType === 'extendedTextMessage') {
            // Caso seja uma mensagem de texto, apenas retorna o tipo como 'text'
            //response = ['text', json_data.data.msgContent.extendedTextMessage.text];

            response = {
                "type": "text"
            };

        } else if (messageType === 'imageMessage') {
            // Caso seja uma imagem, retorna os dados conforme solicitado

            let urlMedia = json_data.data.urlMedia;
            let recipientTimestamp = json_data.data.messageTimestamp;


            response = {
                "type": "image", // Tipo da mensagem
                "messageId": messageId, // ID da mensagem
                "from_number": remoteJid, // Telefone do remetente
                "from_name": pushName, // Nome do remetente
                "image_url": urlMedia, // URL da imagem
                "date": moment.unix(recipientTimestamp).format('YYYY-MM-DD HH:mm:ss') // Data no formato MySQL
            }

        } else {
            // Caso a mensagem seja de outro tipo, retorna um array vazio ou qualquer outra lógica de erro
            response = {
                "type": "invalid"
            };
        }

        // Retorna a resposta
        return response;
    }
}

module.exports = new WebhookController();
