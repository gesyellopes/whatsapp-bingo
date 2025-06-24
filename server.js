require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');  // Para fazer requisição HTTP para a API externa

// Controllers
const webhookController = require('./controllers/webhookController');
const imagesController = require('./controllers/imagesController');
const TicketStub = require('./models/ticketStub'); // Importando o modelo do ticket
const whatsappController = require('./controllers/whatsappController');  // Novo controller

const app = express();
const port = 3001;

// Middleware para parsear o corpo da requisição como JSON
app.use(express.json());

// Rota para ouvir o Webhook do WhatsApp
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        // Chama a função analyzeWebhook do WebhookController
        const analyzeWhatsapp = await webhookController.analyzeWebhook(req, res);

        if (analyzeWhatsapp.type === 'image') {
            // Aguarda o processo de download da imagem ser concluído
            let downloadImage = await imagesController.downloadAndSaveImage(analyzeWhatsapp.image_url);

            // Agora salve no banco de dados as informações recebidas + dados da imagem original
            const { messageId, from_number, from_name, date } = analyzeWhatsapp;
            const fileName = downloadImage.fileName;

            // Dados para salvar no banco de dados
            const ticketData = {
                message_id: messageId,
                from_number: from_number,
                from_name: from_name,
                message_date: date,
                original_file: fileName,  // Salvando o nome do arquivo original
                processed_file: null,     // Se você tiver um arquivo processado, pode preencher isso depois
                processed_status: 'pending', // Status do processamento
                message_status: 'received', // Status da mensagem (pode ser ajustado conforme necessário)
            };

            // Salvar o ticket no banco de dados
            const newTicket = await TicketStub.create(ticketData);

            // Agora, chama a API do Python passando o endereço da imagem recebida
            const processImageUrl = process.env.PROCESS_IMAGE_URL;
            const imageUrl = `${process.env.IMAGE_HOST_URL}/${fileName}`;

            // Tenta fazer a requisição para a API de processamento de imagem
            try {
                const processResponse = await axios.post(processImageUrl, { image_url: imageUrl });

                // Verifica se a resposta foi bem-sucedida
                if (!processResponse.data.success) {
                    await TicketStub.update(
                        { processed_status: 'failed' },
                        { where: { message_id: messageId } }
                    );

                    // Envia mensagem de erro para o WhatsApp
                    const imageUrl = `${process.env.IMAGE_HOST_URL}/${fileName}`;
                    await whatsappController.sendImageMessage(from_number, imageUrl, "A imagem enviada não pode ser processada. Envie novamente");

                    return res.status(200).json({
                        success: false,
                        message: 'Imagem não pode ser processada'
                    });

                }

                // Se a resposta for verdadeira, processa o base64
                const base64_data = processResponse.data.processed_image_base64;
                const processedFileName = processResponse.data.ticket_number;

                // Chama a função base64Decode para salvar a imagem processada
                const base64Result = await imagesController.base64Decode(base64_data, processedFileName);

                if (base64Result.success) {
                    // Enviar a mensagem para a API do WhatsApp
                    const messageBody = {
                        to: from_number,
                        text: `O canhoto *${base64Result.ticketNumber}* foi processado com sucesso`
                    };

                    try {
                        await whatsappController.sendTextMessage(from_number, `O canhoto *${base64Result.ticketNumber}* foi processado com sucesso`);

                        // Atualizar o banco de dados
                        await TicketStub.update(
                            { processed_file: processedFileName, processed_status: 'processed' },
                            { where: { message_id: messageId } }
                        );

                        return res.status(200).json({
                            success: true,
                            message: 'Imagem processada e salva com sucesso'
                        });
                    } catch (error) {
                        // Erro ao enviar a mensagem ao WhatsApp
                        return res.status(500).json({
                            success: false,
                            message: 'Erro ao enviar a mensagem para a API do WhatsApp'
                        });
                    }
                } else {
                    return res.status(500).json({
                        success: false,
                        message: 'Erro ao processar a imagem'
                    });
                }
            } catch (axiosError) {
                // Tratar erro específico da requisição do axios
                //console.error('Erro ao processar a imagem na API:', axiosError);
                return res.status(500).json({
                    success: false,
                    message: 'Erro ao chamar a API de processamento de imagem'
                });
            }

        } else {
            // Caso não seja uma imagem, envia a resposta normalmente
            return res.status(200).json(analyzeWhatsapp);
        }
    } catch (error) {
        // Erro no processo de download ou no banco de dados
        return res.status(500).json({ success: false, message: 'Erro ao processar a imagem' });
    }

});

// Rota para entregar imagem original
app.get('/images/original/:file_name', (req, res) => {
    const { file_name } = req.params;
    const filePath = path.join(__dirname, 'public/original', file_name);

    // Verifica se o arquivo existe
    fs.exists(filePath, (exists) => {
        if (!exists) {
            return res.status(404).json({ error: "File not found" });
        }

        // Retorna a imagem
        res.sendFile(filePath);
    });
});

// Rota para entregar imagem processada
app.get('/images/processed/:file_name', (req, res) => {
    const { file_name } = req.params;
    const filePath = path.join(__dirname, 'public/processed', file_name); // Corrigido o caminho da pasta de imagens processadas

    // Verifica se o arquivo processado existe
    fs.exists(filePath, (exists) => {
        if (!exists) {
            return res.status(404).json({ error: "File not found" });
        }

        // Retorna a imagem processada
        res.sendFile(filePath);
    });
});

// Inicia o servidor
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
