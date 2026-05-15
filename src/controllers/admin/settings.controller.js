import * as settingsService from '../../services/settings.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';

// ─── SYSTEM CONFIG ───────────────────────────────────────────────

export const getSystemConfig = async (req, res) => {
  try {
    const config = await settingsService.getSystemConfig();
    return sendSuccess(res, config, "System configuration retrieved");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const updateSystemConfig = async (req, res) => {
  try {
    const data = req.body;
    const adminId = req.user?.id; // Assuming user id is in req.user
    const config = await settingsService.updateSystemConfig(data, adminId);
    return sendSuccess(res, config, "System configuration updated");
  } catch (error) {
    return sendError(res, error.message, 400);
  }
};

export const getFuelPriceLogs = async (req, res) => {
  try {
    const logs = await settingsService.getFuelPriceLogs();
    return sendSuccess(res, logs, "Fuel price logs retrieved");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};


// ─── ZONES ───────────────────────────────────────────────────────

export const listZones = async (req, res) => {
  try {
    const zones = await settingsService.listZones();
    return sendSuccess(res, zones, "Zones retrieved");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const createZone = async (req, res) => {
  try {
    const { minDistance, maxDistance, surchargePerHectare, status } = req.body;
    const zone = await settingsService.createZone(minDistance, maxDistance, surchargePerHectare, status);
    return sendSuccess(res, zone, "Zone created successfully", 201);
  } catch (error) {
    return sendError(res, error.message, 400);
  }
};

export const updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const { minDistance, maxDistance, surchargePerHectare, status } = req.body;
    const zone = await settingsService.updateZone(id, minDistance, maxDistance, surchargePerHectare, status);
    return sendSuccess(res, zone, "Zone updated successfully");
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 400;
    return sendError(res, error.message, statusCode);
  }
};

export const deleteZone = async (req, res) => {
  try {
    const { id } = req.params;
    await settingsService.deleteZone(id);
    return sendSuccess(res, null, "Zone deleted successfully");
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 500;
    return sendError(res, error.message, statusCode);
  }
};

// ─── SERVICES ────────────────────────────────────────────────────

export const listServices = async (req, res) => {
  try {
    const services = await settingsService.listServices();
    return sendSuccess(res, services, "Services retrieved successfully");
  } catch (error) {
    return sendError(res, error.message, 500);
  }
};

export const updateServiceRates = async (req, res) => {
  try {
    const ratesMap = req.body;
    const updatedServices = await settingsService.updateServiceRates(ratesMap);
    return sendSuccess(res, updatedServices, "Service rates updated successfully");
  } catch (error) {
    return sendError(res, error.message, 400);
  }
};
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const service = await settingsService.updateService(id, data);
    return sendSuccess(res, service, "Service updated successfully");
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 400;
    return sendError(res, error.message, statusCode);
  }
};

export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    await settingsService.deleteService(id);
    return sendSuccess(res, null, "Service deleted successfully");
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 : 400;
    return sendError(res, error.message, statusCode);
  }
};
