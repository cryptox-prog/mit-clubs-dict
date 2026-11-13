import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createAuthRouter } from './route/authRoute.js';
import { createManagementRouter } from './route/managementRoute.js';
import helmet from 'helmet';
import { ApiError } from './utils/ApiError.js';
import { requestContext } from './middleware/requestContext.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { createApiRouter } from './route/index.js';

export function createApp({ config, supabase, authStoreFactory, readinessCheck }) {
  const app = express();
  app.disable('x-powered-by');
  // Do not trust proxy headers until the deployment's proxy topology is known.
  app.use(requestContext);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.CORS_ORIGINS.includes(origin)) return callback(null, true);
      callback(new ApiError(403, 'Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['X-Request-Id'],
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api/auth', createAuthRouter(supabase, config, authStoreFactory));
  app.use('/api/manage', createManagementRouter(supabase, config, authStoreFactory));
  app.use('/api', createApiRouter(supabase, config.SUPABASE_STORAGE_BUCKET, authStoreFactory, readinessCheck));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
