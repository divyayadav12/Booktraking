import mongoose, { Schema, Document } from 'mongoose';

export interface IDispatchLog extends Document {
  orderId: mongoose.Types.ObjectId;
  orderItemId: string;
  employeeId: mongoose.Types.ObjectId;
  verifiedBookCode: string;
  quantity: number;
  dispatchedAt: Date;
  requestId?: string;
  result: string;
  createdAt: Date;
}

const DispatchLogSchema = new Schema<IDispatchLog>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderItemId: { type: String, required: true, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    verifiedBookCode: { type: String, required: true, uppercase: true },
    quantity: { type: Number, default: 1 },
    dispatchedAt: { type: Date, default: Date.now, index: true },
    requestId: { type: String, unique: true, sparse: true },
    result: { type: String, default: 'SUCCESS' },
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

export const DispatchLog = mongoose.model<IDispatchLog>('DispatchLog', DispatchLogSchema);
