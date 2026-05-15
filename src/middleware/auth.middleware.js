import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response.js';
import prisma from '../config/db.js';

export const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return sendError(res, "Access denied. No token provided.", 401, "UNAUTHORIZED");
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true
      }
    });

    if (!user || user.status !== 'active') {
      return sendError(res, "User not found or inactive.", 401, "UNAUTHORIZED");
    }

    req.user = user;
    next();
  } catch (error) {
    return sendError(res, "Invalid or expired token.", 401, "UNAUTHORIZED");
  }
};

export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendError(res, "You do not have permission to perform this action.", 403, "FORBIDDEN");
    }
    next();
  };
};
