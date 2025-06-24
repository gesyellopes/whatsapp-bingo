const express = require('express');
const path = require('path');
const fs = require('fs');
const axios = require('axios');  // Para fazer requisição HTTP para a API externa

// Controllers
const webhookController = require('./controllers/webhookController');
const imagesController = require('./controllers/imagesController');
const TicketStub = require('./models/ticketStub'); // Importando o modelo do ticket

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
            const processImageUrl = `http://127.0.0.1:5000/process-image`;
            const imageUrl = `http://localhost:3001/images/original/${fileName}`;

            // Envia a requisição para processar a imagem
            try {
                const processResponse = await axios.post(processImageUrl, { image_url: imageUrl });

                if (!processResponse.data.success) {
                    // Se a resposta for false, devolve a mensagem e atualiza o status no banco
                    await TicketStub.update(
                        { processed_status: 'failed' },
                        { where: { message_id: messageId } }
                    );

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

                const whatsappKey = "2567xec639bc44e";

                // Após decodificar e salvar a imagem processada, atualiza o banco de dados
                if (base64Result.success) {
                    // Enviar a mensagem para a API
                    const apiUrl = `https://us.api-wa.me/${whatsappKey}/message/text`;
                    const messageBody = {
                        to: from_number,
                        text: `O canhoto *${base64Result.ticketNumber}* foi processado com sucesso`
                    };

                    try {
                        await axios.post(apiUrl, messageBody, {
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });

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
                    // Caso o processamento da imagem falhe, envie uma mensagem de erro
                    const imgTeste = 'http://nextcloud-aockssg8cs8sgg4c4sww40gk.82.29.61.87.sslip.io/apps/files_sharing/publicpreview/NyZtpGefdJRePHx?file=/&fileId=270&x=1920&y=1080&a=true&etag=5a504a57e1e8391176aa645fea199c3e';

                    const apiUrl = `https://us.api-wa.me/${whatsappKey}/message/image`;
                    const messageBody = {
                        to: from_number,
                        url: imgTeste,
                        caption: "A imagem enviada não pode ser processada. Envie novamente"
                    };

                    try {
                        await axios.post(apiUrl, messageBody, {
                            headers: {
                                'Content-Type': 'application/json'
                            }
                        });

                        return res.status(500).json({
                            success: false,
                            message: 'Erro ao processar a imagem'
                        });
                    } catch (error) {
                        return res.status(500).json({
                            success: false,
                            message: 'Erro ao enviar a mensagem de erro para a API do WhatsApp'
                        });
                    }
                }
            } catch (error) {
                // Erro na requisição de processamento da imagem (Erro da API de processamento)
                return res.status(500).json({
                    success: false,
                    message: 'Erro ao processar a imagem, a API de processamento falhou'
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
