/**
 * Formats a numeric value into Nigerian Naira (₦) with international formatting (en-NG).
 * Example: 1963500 -> ₦1,963,500
 * 
 * @param {number|string} amount - The numeric amount to format
 * @returns {string} Formatted currency string
 */
export function formatCurrency(amount) {
  if (!amount && amount !== 0) return "₦0";
  return "₦" + Number(amount).toLocaleString("en-NG");
}
