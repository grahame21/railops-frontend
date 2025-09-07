// netlify/functions/logout.js
exports.handler = async () => {
  const expired = [
    'railops_session=',
    'HttpOnly',
    'Secure',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0'
  ].join('; ');

  return {
    statusCode: 200,
    headers: { 'Set-Cookie': expired, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok:true })
  };
};