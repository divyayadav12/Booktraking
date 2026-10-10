import mongoose from 'mongoose';
import { ENV } from './env';

export async function connectDatabase() {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.log('✅ Connected to MongoDB database via Mongoose');
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error disconnecting from MongoDB:', error);
  }
}
