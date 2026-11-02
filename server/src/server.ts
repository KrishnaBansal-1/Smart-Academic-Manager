import http from 'http';
import mongoose from 'mongoose';
import { createApp } from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';
import { GenerationJob } from './models/GenerationJob';

const startServer = async () => {
  try {
    await connectDB();

    // Mark any interrupted running jobs as FAILED on startup
    await GenerationJob.updateMany(
      { status: 'RUNNING' },
      { status: 'FAILED', error: 'Server restarted while generation was running' }
    );

    const app = createApp();
    const server = http.createServer(app);

    server.listen(ENV.PORT, () => {
      console.log(`🚀 Smart Academic Manager API is running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
      console.log(`🔗 Health check available at: http://localhost:${ENV.PORT}/api/health`);
    });

    let isShuttingDown = false;
    const handleShutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\nReceived ${signal}. Shutting down server gracefully...`);

      server.close(async () => {
        console.log('HTTP server closed.');
        try {
          await mongoose.connection.close(false);
          console.log('Mongoose connection closed.');
          process.exit(0);
        } catch (dbErr) {
          console.error('Error closing MongoDB connection:', dbErr);
          process.exit(1);
        }
      });

      // Force exit if cleanup hangs
      setTimeout(() => {
        console.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10000).unref();
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception thrown:', err);
      handleShutdown('uncaughtException');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
