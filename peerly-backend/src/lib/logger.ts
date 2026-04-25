import { createLogger, format, transports } from 'winston';
import { config } from '../config';

const isProd = config.NODE_ENV === 'production';

export const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: isProd
    ? format.combine(format.timestamp(), format.json())
    : format.combine(
        format.colorize(),
        format.timestamp({ format: 'HH:mm:ss' }),
        format.printf(({ timestamp, level, message, ...meta }) => {
          const extras = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}: ${message}${extras}`;
        })
      ),
  transports: [new transports.Console()],
});
