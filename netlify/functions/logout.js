exports.handler = async () => {
  return {
    statusCode: 200,
    headers: { 'Set-Cookie': 'railops_session=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0', 'Content-Type':'application/json' },
    body: JSON.stringify({ ok:true })
  };
};