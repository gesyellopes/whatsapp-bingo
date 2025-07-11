require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const compression = require('compression');
const { v4: uuidv4 } = require('uuid');

// Controllers e models
const webhookController = require('./controllers/webhookController');
const imagesController = require('./controllers/imagesController');
const TicketStub = require('./models/ticketStub');
const whatsappController = require('./controllers/whatsappController');
const storageController = require('./controllers/storageController');
const imagesLote = require('./models/images');

const cors = require('cors')

const app = express();
const port = 3001;

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors())

/**
 * Endpoint: Recebe imagens via webhook do WhatsApp
 */
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        const analyzeWhatsapp = await webhookController.analyzeWebhook(req, res);

        if (analyzeWhatsapp.message_id) {
            const existingTicket = await TicketStub.findOne({ where: { message_id: analyzeWhatsapp.message_id } });
            if (existingTicket) return res.status(200).json({ success: true, message: 'Mensagem já processada anteriormente.' });
        }

        if (analyzeWhatsapp.type !== 'image') return res.status(200).json(analyzeWhatsapp);

        const downloadResult = await imagesController.downloadAndSaveImage(analyzeWhatsapp.image_url);
        if (!downloadResult.success) return res.status(500).json({ success: false, message: 'Erro ao baixar/enviar imagem para o storage' });

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
            { headers: form.getHeaders() }
        );

        const responseData = canhotosResponse.data;

        if (responseData.success) {
            await newTicket.update({
                processed_file: responseData.file_id,
                ticket_number: responseData.ticket_number,
                processed_status: 'processed',
                message_status: 'read'
            });
            await whatsappController.sendTextMessage(from_number, `O canhoto *${responseData.ticket_number}* foi processado com sucesso`);
        } else {
            await newTicket.update({
                processed_file: fileStorageName || null,
                processed_status: 'failed',
                message_status: 'error'
            });

            const errorImageUrl = fileStorageName ? `${process.env.API_STORAGE}/${fileStorageName}` : null;

            if (errorImageUrl) {
                await whatsappController.sendImageMessage(from_number, errorImageUrl, "Não foi possível processar sua imagem automaticamente. Vamos verifica-la manualmente e, caso necessário, solicitaremos o reenvio.");
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

/**
 * Endpoint: Processamento em lote de canhotos
 */
app.post('/canhotos-em-lote', async (req, res) => {
    try {
        const { phone_number, name } = req.body;
        if (!phone_number) return res.status(400).json({ success: false, message: 'phone_number é obrigatório' });

        const imagens = await imagesLote.findAll({ where: { phone_number } });
        if (imagens.length === 0) return res.status(404).json({ success: false, message: 'Nenhuma imagem encontrada para este número.' });

        const resultados = [];

        for (const imagem of imagens) {
            const imageUrl = `${process.env.API_STORAGE}/${imagem.image_url}`;
            const imageLoteName = imagem.image_url;
            const form = new FormData();
            form.append('file_url', imageUrl);

            const leituraResp = await axios.post(`${process.env.API_CANHOTOS_LOCAL}`, form, { headers: form.getHeaders() });
            const leitura = leituraResp.data;

            const messageId = uuidv4().replace(/-/g, '').toUpperCase();
            const date = new Date().toISOString();
            const from_name = name || null;

            if (leitura.success === true) {
                if (leitura.ticket_number) {
                    const ticketNumber = leitura.ticket_number;
                    const ticket = await TicketStub.findOne({ where: { ticket_number: ticketNumber } });

                    if (ticket) {
                        try {
                            const url = `${process.env.API_STORAGE}/${ticket.processed_file}`;
                            await axios.head(url);

                            await TicketStub.create({
                                message_id: messageId,
                                from_number: phone_number,
                                from_name,
                                message_date: date,
                                original_file: imageLoteName,
                                processed_file: leitura.file_id,
                                processed_status: 'processed',
                                message_status: 'read',
                                ticket_number: ticketNumber
                            });

                            resultados.push({ img: imageLoteName, status: 'Ticket duplicado - imagem existente' });

                        } catch (err) {
                            await ticket.update({
                                processed_file: leitura.file_id,
                                original_file: imageLoteName
                            });
                            await imagem.update({ deleted_storage: true });

                            resultados.push({ img: imageLoteName, status: 'Imagem original perdida - ticket atualizado com nova' });
                        }
                    } else {
                        await TicketStub.create({
                            message_id: messageId,
                            from_number: phone_number,
                            from_name,
                            message_date: date,
                            original_file: imageLoteName,
                            processed_file: leitura.file_id,
                            processed_status: 'processed',
                            message_status: 'read',
                            ticket_number: ticketNumber
                        });

                        resultados.push({ img: imageLoteName, status: 'Novo ticket com QR Code válido' });

                        await whatsappController.sendTextMessage(phone_number, `O canhoto *${ticketNumber}* foi processado com sucesso`);
                    }
                } else {
                    await TicketStub.create({
                        message_id: messageId,
                        from_number: phone_number,
                        from_name,
                        message_date: date,
                        original_file: imageLoteName,
                        processed_file: leitura.file_id,
                        processed_status: 'failed',
                        message_status: 'error',
                        ticket_number: null
                    });

                    resultados.push({ img: imageLoteName, status: 'Imagem sem QR Code - salva para análise manual' });
                }
            } else {
                await TicketStub.create({
                    message_id: messageId,
                    from_number: phone_number,
                    from_name,
                    message_date: date,
                    original_file: imageLoteName,
                    processed_status: 'failed',
                    message_status: 'error',
                    ticket_number: null
                });

                resultados.push({ img: imageLoteName, status: 'Imagem sem QR Code - salva para análise manual' });
            }

            await imagem.update({ ready: true });
        }

        return res.status(200).json({ success: true, resultados });

    } catch (error) {
        console.error('Erro em /canhotos-em-lote:', error);
        return res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
});

/**
 * Endpoint: Upload de imagens locais para storage e salvamento no banco
 */
app.post('/upload-files-to-storage', async (req, res) => {
    try {
        const folders = req.body.folders;
        if (!Array.isArray(folders) || folders.length === 0) {
            return res.status(400).json({ success: false, message: 'Formato inválido. Esperado: { "folders": [ ... ] }' });
        }

        const resultados = [];

        for (const folder of folders) {
            const { phone_number } = folder;
            const folderPath = path.join(__dirname, 'public', 'GDRIVE', phone_number);

            if (!fs.existsSync(folderPath)) {
                resultados.push({ phone_number, success: false, message: `Pasta não encontrada: GDRIVE/${phone_number}` });
                continue;
            }

            const files = fs.readdirSync(folderPath);

            for (const file of files) {
                const filePath = path.join(folderPath, file);
                const stat = fs.statSync(filePath);
                if (!stat.isFile()) continue;

                const uploadResponse = await storageController.uploadFileToStorage(filePath, file);

                if (uploadResponse.success) {
                    await imagesLote.create({
                        phone_number,
                        original_file: file,
                        image_url: uploadResponse.file_id || uploadResponse.url || null
                    });

                    resultados.push({ phone_number, file, success: true, image_url: uploadResponse.file_id || uploadResponse.url });
                } else {
                    resultados.push({ phone_number, file, success: false, message: uploadResponse.message || 'Erro ao enviar para o storage' });
                }
            }
        }

        return res.status(200).json({ success: true, resultados });

    } catch (error) {
        console.error('Erro em /upload-files-to-storage:', error);
        return res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
});


/**
* Endpoint: Atualizar número do canhoto manualmente
*/
app.post('/ticket-manual', async (req, res) => {
    const { message_id, ticket_number: original_ticket_number } = req.body;

    // 1. Validate both message_id and ticket_number
    if (!message_id) {
        return res.status(400).json({ success: false, message: 'message_id é obrigatório.' });
    }
    if (!original_ticket_number) {
        return res.status(400).json({ success: false, message: 'ticket_number é obrigatório.' });
    }

    // 2. Find the ticket
    const ticket = await TicketStub.findOne({ where: { message_id: message_id } });

    // 3. Check if ticket exists correctly
    if (!ticket) {
        return res.status(404).json({ success: false, message: 'Nenhuma imagem encontrada para este message_id.' });
    }

    const phone_number = ticket.from_number;

    // 4. Create a new variable for the modified ticket number (since original_ticket_number is const)
    const formatted_ticket_number = '00' + original_ticket_number;

    // 5. Update the ticket
    await ticket.update({
        ticket_number: formatted_ticket_number,
        processed_status: 'processed',
        message_status: "read"
    });

    // 6. Mando mensagem para o Whatsapp
    const countItens = await TicketStub.findAll({ where: { ticket_number: formatted_ticket_number } });

    if(countItens.length === 1){
        await whatsappController.sendTextMessage(phone_number, `O canhoto *${formatted_ticket_number}* foi processado com sucesso`);
    }

    // 7. Return a proper success response
    return res.status(200).json({ success: true, message: `Ticket ${formatted_ticket_number} atualizado com sucesso!`, ticket: ticket });
});

//Rota para excluir canhoto
app.post('/excluir-canhoto', async (req, res) =>{

    const { message_id } = req.body;

    await TicketStub.destroy({
        where: {
            message_id: message_id
        }
    });

    return res.status(200).json({ success: true, message: 'Ticket excluído com sucesso' });

})

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});