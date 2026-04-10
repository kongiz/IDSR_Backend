exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to access this route"
    });
  }
  next();
};

exports.blockRole = (...roles) => (req, res, next) => {
  if (!req.user || roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "You are not authorized to access this route"
    });
  }
  next();
};