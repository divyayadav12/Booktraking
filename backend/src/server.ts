import app from './app';
import { ENV } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/db';

async function bootstrap() {
  try {
    // Connect to MongoDB
    await connectDatabase();

    const server = app.listen(ENV.PORT, () => {
      console.log(`🚀 FAST DISPATCH PRO Backend running on http://localhost:${ENV.PORT}`);
      console.log(`📡 Environment: ${ENV.NODE_ENV}`);
      console.log(`🍃 Database: MongoDB via Mongoose`);
    });

    const shutdown = async () => {
      console.log('🛑 Gracefully shutting down server...');
      server.close(async () => {
        await disconnectDatabase();
        console.log('🔌 Server shut down complete.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
