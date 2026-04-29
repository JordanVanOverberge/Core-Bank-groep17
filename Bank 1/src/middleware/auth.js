module.exports = (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false, status: 401, code: 4010,
      message: 'Unauthorized: Bearer token vereist', data: null
    });
  }
  const token = auth.split(' ')[1];
  if (token !== process.env.BANK_SECRET_KEY) {
    return res.status(401).json({
      ok: false, status: 401, code: 4010,
      message: 'Unauthorized: ongeldig token', data: null
    });
  }
  next();
};
