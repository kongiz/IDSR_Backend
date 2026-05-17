const jwt = require("jsonwebtoken");
const { isBlacklisted } = require("./tokenBlacklist.middleware");

const verifyToken = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ success: false, message: "Authorization header missing or malformed" });

  const token = header.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    if (await isBlacklisted(decoded.jti)) {
      return res.status(401).json({ success: false, message: "Token has been revoked" });
    }
    req.user = decoded.data;
    req.decoded = decoded; // Attach full decoded token for logout purposes
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

exports.verifyToken = verifyToken;
module.exports = verifyToken;          
module.exports.verifyToken = verifyToken; 