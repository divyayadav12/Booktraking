import mongoose, { Schema, Document } from 'mongoose';

export interface IStockInward extends Document {
  entryDate: Date;             // Date of stock arrival
  entryTime: string;           // Formatted time string e.g. "17:25:30"
  bookCode: string;            // Book barcode/SKU
  bookName: string;            // Book title
  quantity: number;            // Number of copies arrived
  supplier: string;            // Supplier/Printer/Source name
  remarks: string;             // Optional notes or invoice/challan number
  source: 'MANUAL' | 'EXCEL_UPLOAD' | 'BARCODE_SCAN';
  enteredByUserId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const StockInwardSchema = new Schema<IStockInward>(
  {
    entryDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    entryTime: {
      type: String,
      required: true,
      default: () => new Date().toLocaleTimeString('en-IN', { hour12: false }),
    },
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
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    supplier: {
      type: String,
      trim: true,
      default: '',
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
    source: {
      type: String,
      enum: ['MANUAL', 'EXCEL_UPLOAD', 'BARCODE_SCAN'],
      default: 'MANUAL',
    },
    enteredByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
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

export const StockInward = mongoose.model<IStockInward>('StockInward', StockInwardSchema);
