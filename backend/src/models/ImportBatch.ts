import mongoose, { Schema, Document } from 'mongoose';

export type ImportStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export interface IImportBatch extends Document {
  originalFileName: string;
  uploadedByUserId: mongoose.Types.ObjectId;
  uploadedAt: Date;
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  fileHash: string;
  errorSummary: any;
  createdAt: Date;
  updatedAt: Date;
}

const ImportBatchSchema = new Schema<IImportBatch>(
  {
    originalFileName: { type: String, required: true },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'PENDING' },
    totalRows: { type: Number, default: 0 },
    validRows: { type: Number, default: 0 },
    invalidRows: { type: Number, default: 0 },
    importedRows: { type: Number, default: 0 },
    fileHash: { type: String, required: true, index: true },
    errorSummary: { type: Schema.Types.Mixed, default: [] },
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

export const ImportBatch = mongoose.model<IImportBatch>('ImportBatch', ImportBatchSchema);
