// Simple text response to prove /api routing works
exports.handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'text/plain' },
  body: 'pong'
});