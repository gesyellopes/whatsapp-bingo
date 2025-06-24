//const messagesModel = require('../models/messages');

class MessagesController {
  sendValidImageMessage(req, res) {
    const { user_phone_number, ticket_number } = req.body;
    const message = messagesModel.validImage(user_phone_number, ticket_number);
    res.status(200).json({ message });
  }

  sendInvalidImageMessage(req, res) {
    const { user_phone_number, original_file_name } = req.body;
    const message = messagesModel.invalidImage(user_phone_number, original_file_name);
    res.status(200).json({ message });
  }

  sendDuplicateImageMessage(req, res) {
    const { user_phone_number, original_file_name } = req.body;
    const message = messagesModel.duplicateImage(user_phone_number, original_file_name);
    res.status(200).json({ message });
  }
}

module.exports = new MessagesController();
