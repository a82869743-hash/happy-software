/**
 * Safely formats a value as Indian Rupee (INR) currency.
 * Prepends the "₹" symbol and formats using the Indian locale (en-IN).
 * Prevents crashes on null, undefined, or invalid numeric values.
 * 
 * @param val The numeric value to format.
 * @param options Custom Intl.NumberFormatOptions (defaults to 2 fraction digits).
 * @returns Formatted currency string (e.g. ₹1,00,000.00).
 */
export const formatCurrency = (
  val: any,
  options?: Intl.NumberFormatOptions
): string => {
  if (val === null || val === undefined || val === '') {
    const minDec = options?.minimumFractionDigits ?? 2;
    return `₹0${minDec > 0 ? '.' + '0'.repeat(minDec) : ''}`;
  }
  const num = parseFloat(String(val));
  if (isNaN(num)) {
    const minDec = options?.minimumFractionDigits ?? 2;
    return `₹0${minDec > 0 ? '.' + '0'.repeat(minDec) : ''}`;
  }
  
  const defaults: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  };
  
  return `₹${num.toLocaleString('en-IN', defaults)}`;
};

/**
 * Safely formats a number using the Indian locale (en-IN).
 * Prevents crashes on null, undefined, or invalid numeric values.
 * 
 * @param val The numeric value to format.
 * @param options Custom Intl.NumberFormatOptions.
 * @returns Formatted number string (e.g. 1,00,000).
 */
export const formatNumber = (
  val: any,
  options?: Intl.NumberFormatOptions
): string => {
  if (val === null || val === undefined || val === '') {
    return '0';
  }
  const num = parseFloat(String(val));
  if (isNaN(num)) {
    return '0';
  }
  return num.toLocaleString('en-IN', options);
};

/**
 * Safely returns the local date string in YYYY-MM-DD format (timezone-adjusted).
 * 
 * @param d Optional Date object (defaults to current date).
 * @returns YYYY-MM-DD local date string.
 */
export const getLocalDateString = (d: Date = new Date()): string => {
  const offset = d.getTimezoneOffset();
  const localDate = new Date(d.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 10);
};

