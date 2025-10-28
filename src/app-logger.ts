import winston from 'winston';

const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

export const logger = winston.createLogger({
	level: logLevel,
	format: winston.format.combine(
		winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
		winston.format.errors({ stack: true }),
		winston.format.splat(),
		winston.format.json()
	),
	defaultMeta: { service: 'repoweaver-github-app' },
	transports: [
		new winston.transports.Console({
			format:
				nodeEnv === 'development'
					? winston.format.combine(winston.format.colorize(), winston.format.simple())
					: winston.format.json(),
		}),
		new winston.transports.File({
			filename: 'logs/error.log',
			level: 'error',
			maxsize: 10485760,
			maxFiles: 5,
		}),
		new winston.transports.File({
			filename: 'logs/combined.log',
			maxsize: 10485760,
			maxFiles: 5,
		}),
	],
});
