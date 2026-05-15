import * as fuelService from '../../services/admin-fuel.service.js';
import { formatCurrency } from '../../utils/format.js';

export const getFuelLogs = async (req, res) => {
  try {
    const logs = await fuelService.getFuelLogs(req.query);
    const formattedLogs = logs.map(log => ({
      ...log,
      formatted_cost: formatCurrency(log.cost)
    }));
    res.json({ success: true, data: formattedLogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getFuelLogsKPI = async (req, res) => {
  try {
    const kpis = await fuelService.getFuelLogsKPI(req.query);
    res.json({ success: true, data: {
      ...kpis,
      formatted_total_cost: formatCurrency(kpis.totalCost),
      tractorUsage: kpis.tractorUsage.map(tu => ({
          ...tu,
          formatted_totalCost: formatCurrency(tu.totalCost)
      }))
    } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateFuelLogStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const adminId = req.user.id;

    const log = await fuelService.updateFuelLogStatus(id, status, adminId);
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getFuelAnalytics = async (req, res) => {
  try {
    const data = await fuelService.getFuelAnalytics(req.query);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
