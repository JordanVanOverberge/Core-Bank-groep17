module.exports = (req, res, next) => {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({
      ok: false, status: 401, code: 4001,
      message: 'Unauthorized: Bearer token vereist', data: []
    });
  }
  const token = auth.split(' ')[1];
  if (token !== process.env.CB_SECRET) {
    return res.status(401).json({
      ok: false, status: 401, code: 4001,
      message: 'Unauthorized: ongeldig token', data: []
    });
  }
  next();
};
