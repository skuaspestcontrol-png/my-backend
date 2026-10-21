module.exports = function renewalLetterIssueDate(monthValue, yearValue) {
  const month = Number(monthValue);
  const year = Number(yearValue);
  if (!Number.isInteger(month) || month < 1 || month > 12 ||
      !Number.isInteger(year) || year < 1000 || year > 9999) {
    const error = new Error('Select a specific dashboard month and year before generating the renewal letter.');
    error.statusCode = 400;
    throw error;
  }
  return `${year}-${String(month).padStart(2, '0')}-01`;
};
