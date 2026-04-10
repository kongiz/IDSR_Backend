const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ success: false });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded.data;
    next();
  } catch {
    return res.status(401).json({ success: false });
  }
};

exports.verifyToken = verifyToken;
module.exports = verifyToken;          
module.exports.verifyToken = verifyToken; 