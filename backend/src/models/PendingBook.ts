import mongoose, { Schema, Document } from 'mongoose';

export interface IPendingBook extends Document {
  bookCode: string;
  bookName: string;
  pendingQuantity: number;
  receivedQuantity: number;
  printerOrVendor?: string;
  expectedDate?: Date;
  priority: 'NORMAL' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'RECEIVED' | 'CANCELLED';
  remarks?: string;
  addedByUserId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PendingBookSchema = new Schema<IPendingBook>(
  {
    bookCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    bookName: {
      type: String,
      required: true,
      trim: true,
    },
    pendingQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    receivedQuantity: {
      type: Number,
      default: 0,
    },
    printerOrVendor: {
      type: String,
      trim: true,
      default: '',
    },
    expectedDate: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    status: {
      type: String,
      enum: ['PENDING', 'RECEIVED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    addedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export const PendingBook = mongoose.model<IPendingBook>('PendingBook', PendingBookSchema);
export default PendingBook;
