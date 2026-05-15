/**
 * Standard API Response Utility
 */
export const sendSuccess = (res, data, message = "Success", status = 200) => {
  return res.status(status).json({
    success: true,
    data,
    message,
  });
};

export const sendError = (res, message = "Error", status = 500, errorCode = "INTERNAL_ERROR") => {
  return res.status(status).json({
    success: false,
    error: errorCode,
    message,
  });
};
