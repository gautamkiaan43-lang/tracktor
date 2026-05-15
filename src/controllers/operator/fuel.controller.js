import * as fuelService from '../../services/fuel.service.js';
import { formatCurrency } from '../../utils/format.js';

export const addFuelLog = async (req, res) => {
  try {
    const fuelData = { ...req.body };
    if (req.file) {
      // Create full URL or relative path. For now, relative path.
      fuelData.receiptUrl = `/uploads/${req.file.filename}`;
    }
    const log = await fuelService.addFuelLog(req.user.id, fuelData);
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getFuelHistory = async (req, res) => {
  try {
    const history = await fuelService.getFuelHistory(req.user.id);
    const formattedHistory = history.map(log => ({
      ...log,
      formatted_cost: formatCurrency(log.cost)
    }));
    res.json({ success: true, data: formattedHistory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFuelSummary = async (req, res) => {
  try {
    const summary = await fuelService.getFuelSummary(req.user.id);
    const formattedSummary = {
      ...summary,
      formatted_total_cost: formatCurrency(summary.total_cost)
    };
    res.json({ success: true, data: formattedSummary });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
