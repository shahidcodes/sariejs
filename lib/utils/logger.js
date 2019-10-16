module.exports = (TAG) => ({
  info: (...args) => {
    console.info(TAG, ...args);
  },
  log: (...args) => {
    console.log(TAG, ...args);
  },
  error: (...args) => {
    console.error(TAG, ...args);
  },
});
