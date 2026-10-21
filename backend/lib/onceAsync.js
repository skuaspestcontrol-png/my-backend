// Share initialization across concurrent requests; retry after a failed attempt.
module.exports = function onceAsync(initialize) {
  let pending;
  return (...args) => {
    if (!pending) {
      pending = Promise.resolve().then(() => initialize(...args)).catch((error) => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
};
