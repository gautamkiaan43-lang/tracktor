import * as authService from '../../services/auth.service.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { registerSchema, loginSchema } from '../../schema/auth.schema.js';

export const register = async (req, res) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const user = await authService.registerUser(validatedData);
    return sendSuccess(res, user, "User registered successfully", 201);
  } catch (error) {
    if (error.name === 'ZodError') {
      return sendError(res, error.issues[0].message, 400, "VALIDATION_ERROR");
    }
    return sendError(res, error.message, 400, "REGISTRATION_FAILED");
  }
};

export const login = async (req, res) => {
  try {
    const { phone, password } = loginSchema.parse(req.body);
    const data = await authService.loginUser(phone, password);
    return sendSuccess(res, data, "Login successful");
  } catch (error) {
    if (error.name === 'ZodError') {
      return sendError(res, error.issues[0].message, 400, "VALIDATION_ERROR");
    }
    return sendError(res, error.message, 401, "UNAUTHORIZED");
  }
};

export const logout = async (req, res) => {
  // JWT is stateless — actual token invalidation happens client-side.
  return sendSuccess(res, null, "Logged out successfully");
};

export const getMe = async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.id);
    return sendSuccess(res, user, "User profile retrieved");
  } catch (error) {
    return sendError(res, "Could not retrieve profile", 500);
  }
};
