import { createApp } from './app';
import { connectDB } from './config/db';
import { ENV } from './config/env';

const startServer = async () => {
  try {
    await connectDB();

    const app = createApp();

    const server = app.listen(ENV.PORT, () => {
      console.log(`🚀 Smart Academic Manager API is running on port ${ENV.PORT} [${ENV.NODE_ENV}]`);
      console.log(`🔗 Health check available at: http://localhost:${ENV.PORT}/api/health`);
    });

    // Graceful shutdown
    const handleShutdown = () => {
      console.log('Shutting down server gracefully...');
      server.close(() => {
        console.log('Server process terminated.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', handleShutdown);
    process.on('SIGINT', handleShutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
