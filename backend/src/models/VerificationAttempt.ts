import mongoose, { Schema, Document } from 'mongoose';

export interface IVerificationAttempt extends Document {
  orderId: mongoose.Types.ObjectId;
  orderItemId: string;
  employeeId: mongoose.Types.ObjectId;
  enteredBookCode: string;
  success: boolean;
  failureReason?: string;
  attemptedAt: Date;
}

const VerificationAttemptSchema = new Schema<IVerificationAttempt>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    orderItemId: { type: String, required: false, default: null, index: true },
    employeeId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    enteredBookCode: { type: String, required: true },
    success: { type: Boolean, required: true },
    failureReason: { type: String },
    attemptedAt: { type: Date, default: Date.now, index: true },
  },
  {
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

export const VerificationAttempt = mongoose.model<IVerificationAttempt>(
  'VerificationAttempt',
  VerificationAttemptSchema
);
