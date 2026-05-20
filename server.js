require("dotenv").config();
require("./src/config/env"); 

console.log("REDIS_HOST:", process.env.REDIS_HOST);
console.log("REDIS_PORT:", process.env.REDIS_PORT);
console.log("REDIS_PASSWORD:", process.env.REDIS_PASSWORD ? "SET" : "NOT SET");

const app = require("./src/app");

const PORT = process.env.PORT || 5000;


process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  shutdown(1);
});


process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  shutdown(1);
});


const shutdown = (code = 0) => {
  console.log("Shutting down server...");
  server.close(() => {
    console.log("Server closed");
    process.exit(code);
  });

  setTimeout(() => {
    console.error("Forcing shutdown after timeout");
    process.exit(1);
  }, 10000);
};


process.on("SIGTERM", () => {
  console.log("SIGTERM received");
  shutdown(0);
});


process.on("SIGINT", () => {
  console.log("SIGINT received");
  shutdown(0);
});

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});