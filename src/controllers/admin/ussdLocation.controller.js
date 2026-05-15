import * as ussdLocationService from '../../services/ussdLocation.service.js';

export const listAll = async (req, res) => {
  try {
    const locations = await ussdLocationService.adminListAll();
    res.json({ success: true, data: locations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const create = async (req, res) => {
  try {
    const location = await ussdLocationService.create(req.body);
    res.status(201).json({ success: true, data: location });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const update = async (req, res) => {
  try {
    const location = await ussdLocationService.update(req.params.id, req.body);
    res.json({ success: true, data: location });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const remove = async (req, res) => {
  try {
    await ussdLocationService.remove(req.params.id);
    res.json({ success: true, message: 'Location deleted successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
