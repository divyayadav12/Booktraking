import mongoose, { Schema, Document } from 'mongoose';

export interface IOrderItem {
  _id: mongoose.Types.ObjectId;
  bookCode: string;
  bookName: string;
  requiredQuantity: number;
  dispatchedQuantity: number;
}

export interface IOrder extends Document {
  studentName: string;
  mobileNumber: string;
  email: string | null;
  trackingId: string;
  importBatchId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    bookCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    bookName: { type: String, required: true, trim: true },
    requiredQuantity: { type: Number, required: true, min: 1 },
    dispatchedQuantity: { type: Number, default: 0, min: 0 },
  },
  {
    toJSON: {
      virtuals: true,
      transform: (doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        return ret;
      },
    },
  }
);

const OrderSchema = new Schema<IOrder>(
  {
    studentName: { type: String, required: true, trim: true, index: true },
    mobileNumber: { type: String, required: true, trim: true, index: true },
    email: { type: String, trim: true, lowercase: true, default: null },
    trackingId: { type: String, required: true, trim: true, uppercase: true, index: true },
    importBatchId: { type: Schema.Types.ObjectId, ref: 'ImportBatch', required: true, index: true },
    items: [OrderItemSchema],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Order = mongoose.model<IOrder>('Order', OrderSchema);
