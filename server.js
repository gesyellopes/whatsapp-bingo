require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const compression = require('compression');

const webhookController = require('./controllers/webhookController');
const imagesController = require('./controllers/imagesController');
const TicketStub = require('./models/ticketStub');
const whatsappController = require('./controllers/whatsappController');

const app = express();
const port = 3001;

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.post('/webhook/whatsapp', async (req, res) => {
    try {
        const analyzeWhatsapp = await webhookController.analyzeWebhook(req, res);

        if (analyzeWhatsapp.type !== 'image') {
            return res.status(200).json(analyzeWhatsapp);
        }

        const downloadResult = await imagesController.downloadAndSaveImage(analyzeWhatsapp.image_url);
        if (!downloadResult.success) {
            return res.status(500).json({ success: false, message: 'Erro ao baixar/enviar imagem para o storage' });
        }

        const { messageId, from_number, from_name, date } = analyzeWhatsapp;
        const fileName = downloadResult.file_id;
        const fileStorageName = downloadResult.storage_name;

        const newTicket = await TicketStub.create({
            message_id: messageId,
            from_number,
            from_name,
            message_date: date,
            original_file: fileStorageName,
            processed_file: null,
            processed_status: 'pending',
            message_status: 'received',
        });

        const localImagePath = path.join(__dirname, 'public/original', fileName);
        const form = new FormData();
        form.append('file', fs.createReadStream(localImagePath));

        const canhotosResponse = await axios.post(
            `${process.env.API_CANHOTOS}`,
            form,
            { headers: { ...form.getHeaders() } }
        );

        const responseData = canhotosResponse.data;

        if (responseData.success) {
            await newTicket.update({
                processed_file: responseData.file_id,
                ticket_number: responseData.ticket_number,
                processed_status: 'processed',
                message_status: 'read'
            });

            await whatsappController.sendTextMessage(from_number, `O canhoto *${responseData.filename}* foi processado com sucesso`);
        } else {
            await newTicket.update({
                processed_file: fileStorageName || null,
                processed_status: 'failed',
                message_status: 'error'
            });

            const errorImageUrl = fileStorageName
                ? `${process.env.API_STORAGE}/${fileStorageName}`
                : null;

            if (errorImageUrl) {
                await whatsappController.sendImageMessage(from_number, errorImageUrl, "A imagem enviada não pode ser processada. Envie novamente");
            } else {
                await whatsappController.sendTextMessage(from_number, "A imagem enviada não pode ser processada. Envie novamente");
            }
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Erro no webhook:', error);
        return res.status(500).json({ success: false, message: 'Erro ao processar a imagem' });
    }
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
