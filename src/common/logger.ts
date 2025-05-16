import * as winston from 'winston';
import * as fs from 'fs';

const logger = winston.createLogger({
        level: 'info', // Log level (info and above: info, error, warn, etc.)
        format: winston.format.combine(
                winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                winston.format.json() // JSON format for structured logging
        ),
        transports: [
                // Write all logs to combined.log
                new winston.transports.File({ filename: 'logs/combined.log', level: 'info' }),
                // Write error logs to error.log
                new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
                // Also output to console
                new winston.transports.Console({
                        format: winston.format.combine(
                                winston.format.colorize(),
                                winston.format.simple()
                        ),
                }),
        ],
});

// Ensure log files are created in the logs directory
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
}

export default logger; // Add default export
