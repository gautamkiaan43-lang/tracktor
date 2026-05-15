import * as ussdLocationService from '../../services/ussdLocation.service.js';
import * as ussdService from '../../services/ussd.service.js';

export const getUssdLocations = async (req, res) => {
  try {
    const locations = await ussdLocationService.getActiveLocations();
    res.json({ success: true, data: locations });
  } catch (error) {
    console.error('[USSD Locations Error]:', error);
    res.status(500).json({ success: false, message: "Failed to retrieve locations." });
  }
};

/**
 * Handle USSD POST request
 */
export const handleUssd = async (req, res) => {
  const { sessionId, phoneNumber, text } = req.body;
  
  if (!sessionId || !phoneNumber) {
    return res.status(400).send("END Invalid request parameters.");
  }

  try {
    const response = await ussdService.handleUssdRequest(sessionId, phoneNumber, text || "");
    res.set('Content-Type', 'text/plain');
    res.send(response);
  } catch (error) {
    console.error('[USSD Controller Error]:', error);
    // Ensure USSD provider always receives a valid response format even on crash
    res.set('Content-Type', 'text/plain');
    res.send("END Temporary system error. Please try again later.");
  }
};
