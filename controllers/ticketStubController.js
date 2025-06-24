//const ticketModel = require('../models/ticketStub');

class TicketStubController {
  saveTicketData(req, res) {
    const { message_id, phone_number, from_name, original_file_name, message_status } = req.body;
    const success = ticketModel.saveTicketData(message_id, phone_number, from_name, original_file_name, message_status);
    if (success) {
      res.status(200).json({ message: "Ticket data saved successfully" });
    } else {
      res.status(500).json({ error: "Failed to save ticket data" });
    }
  }

  checkIfTicketExists(req, res) {
    const { ticket_number } = req.params;
    const exists = ticketModel.checkIfTicketExists(ticket_number);
    if (exists) {
      res.status(200).json({ status: "Ticket exists" });
    } else {
      res.status(404).json({ error: "Ticket not found" });
    }
  }

  processTicketImage(req, res) {
    const { message_id, original_file_name } = req.body;
    const success = ticketModel.processTicketImage(message_id, original_file_name);
    if (success) {
      res.status(200).json({ message: "Image processed successfully" });
    } else {
      res.status(500).json({ error: "Failed to process image" });
    }
  }
}

module.exports = new TicketStubController();
