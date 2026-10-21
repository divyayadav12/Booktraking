import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ENV } from './env';
import { ProductCatalog, User } from '../models';

export async function connectDatabase() {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.log('✅ Connected to MongoDB database via Mongoose');

    const productCatalogIndexes = await ProductCatalog.collection.indexes();
    const uniqueProductCodeIndex = productCatalogIndexes.find(
      (index) => index.key.productCode === 1 && index.unique && typeof index.name === 'string'
    );
    if (uniqueProductCodeIndex?.name) {
      await ProductCatalog.collection.dropIndex(uniqueProductCodeIndex.name);
      console.log('🧹 Removed unique ProductCatalog productCode index');
    }

    // Clean up legacy unique index on productCode if it exists
    try {
      await mongoose.connection.collection('orders').dropIndex('productCode_1');
      console.log('🧹 Cleaned up legacy unique index productCode_1');
    } catch (e) {}

    // Auto-seed Admin if not exists
    const adminExists = await User.findOne({ email: ENV.ADMIN_DEFAULT_EMAIL });
    if (!adminExists) {
      console.log('🌱 Seeding default Admin user...');
      const adminPasswordHash = await bcrypt.hash(ENV.ADMIN_DEFAULT_PASSWORD, 10);
      await User.create({
        name: 'System Administrator',
        email: ENV.ADMIN_DEFAULT_EMAIL,
        passwordHash: adminPasswordHash,
        role: 'ADMIN',
        isActive: true,
      });
      console.log(`✅ Default admin created: ${ENV.ADMIN_DEFAULT_EMAIL}`);
    }

    // Auto-seed Demo Employee if not exists
    const empExists = await User.findOne({ email: 'emp1@example.com' });
    if (!empExists) {
      console.log('🌱 Seeding default Employee user...');
      const empPasswordHash = await bcrypt.hash('Emp@123', 10);
      await User.create({
        name: 'Rohan Sharma',
        email: 'emp1@example.com',
        passwordHash: empPasswordHash,
        role: 'EMPLOYEE',
        isActive: true,
      });
      console.log('✅ Default employee created: emp1@example.com');
    }
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
