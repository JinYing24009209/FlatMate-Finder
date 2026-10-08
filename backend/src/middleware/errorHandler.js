// H. 统一错误处理 | H. Centralised error handling.
function errorHandler(error, _req, res, _next) {
  // 在后端终端打印具体错误 | Print error details in the backend terminal.
  console.error(error);
  // 向前端返回 HTTP 500 和统一提示 | Return HTTP 500 and a generic message to the frontend.
  res.status(500).json({ message: 'Unexpected server error. Check the API terminal.' });
}
const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
module.exports = { errorHandler, asyncRoute };
 