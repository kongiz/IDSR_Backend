const xss = require("xss");

function sanitizeObject(obj) {
  if (!obj || typeof obj !== "object") return obj;
  
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === "string") {
      obj[key] = xss(value.trim());
    } else if (typeof value === "object" && value !== null) {
      sanitizeObject(value); // handle nested objects
    }
  }
  return obj;
}

module.exports = (req, res, next) => {
  if (req.body)   sanitizeObject(req.body);
  if (req.query)  sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
};