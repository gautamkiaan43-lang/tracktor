import prisma from '../config/db.js';
import { sendError, sendSuccess } from '../utils/response.js';

const memoryRequests = [];

const getRequestModel = () => prisma?.serviceRequest;

export const createRequest = async (req, res) => {
  try {
    const farmerId = req.user?.id;
    const { serviceType, location } = req.body || {};

    if (!farmerId) {
      return sendError(res, 'Unauthorized request.', 401, 'UNAUTHORIZED');
    }

    if (!serviceType || typeof serviceType !== 'string') {
      return sendError(res, 'Service type is required.', 400, 'VALIDATION_ERROR');
    }

    const lat = Number(location?.lat);
    const lng = Number(location?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return sendError(res, 'Valid map location is required.', 400, 'VALIDATION_ERROR');
    }

    const requestModel = getRequestModel();
    let created;

    if (requestModel) {
      created = await requestModel.create({
        data: {
          farmerId,
          serviceType,
          latitude: lat,
          longitude: lng,
          status: 'pending',
        },
        include: {
          farmer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });
    } else {
      const fallback = {
        id: Date.now(),
        farmerId,
        serviceType,
        latitude: lat,
        longitude: lng,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        farmer: {
          id: req.user.id,
          name: req.user.name,
          email: req.user.email,
          phone: req.user.phone || null,
        },
      };
      memoryRequests.unshift(fallback);
      created = fallback;
    }

    const io = req.app.get('io');
    const broadcastFarmerDestination = req.app.get('broadcastFarmerDestination');
    if (io) {
      io.emit('new:request', created);
      if (broadcastFarmerDestination) {
        broadcastFarmerDestination(lat, lng, 'default-room');
      }
    }

    return sendSuccess(res, created, 'Service request created', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to create service request', 500);
  }
};

export const listRequests = async (req, res) => {
  try {
    const requestModel = getRequestModel();
    const requests = requestModel
      ? await requestModel.findMany({
          orderBy: { createdAt: 'desc' },
          include: {
            farmer: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
        })
      : memoryRequests;
    return sendSuccess(res, requests, 'Service requests fetched');
  } catch (error) {
    return sendError(res, error.message || 'Failed to fetch service requests', 500);
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const requestId = Number(req.params.id);
    if (!Number.isInteger(requestId)) {
      return sendError(res, 'Invalid request id.', 400, 'VALIDATION_ERROR');
    }

    const requestModel = getRequestModel();
    let updated;

    if (requestModel) {
      updated = await requestModel.update({
        where: { id: requestId },
        data: { status: 'accepted' },
        include: {
          farmer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });
    } else {
      const idx = memoryRequests.findIndex((item) => Number(item.id) === requestId);
      if (idx === -1) {
        return sendError(res, 'Request not found.', 404, 'NOT_FOUND');
      }
      memoryRequests[idx] = {
        ...memoryRequests[idx],
        status: 'accepted',
        updatedAt: new Date(),
      };
      updated = memoryRequests[idx];
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('request:updated', updated);
    }

    return sendSuccess(res, updated, 'Service request accepted');
  } catch (error) {
    return sendError(res, error.message || 'Failed to accept service request', 500);
  }
};
