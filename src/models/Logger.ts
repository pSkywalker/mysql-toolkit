import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',  // Set default log level to 'info'
  format: winston.format.combine(
    winston.format.colorize(),  // Colorizes logs in the console
    winston.format.timestamp(), // Adds timestamp to logs
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(), // Output logs to console
    new winston.transports.File({ filename: 'app.log' }) // Log output to a file
  ]
});

export default logger;