import mongoose, { Schema, Document } from "mongoose";

export interface ILoginAudit extends Document {
  userId: mongoose.Types.ObjectId;
  ipAddress: string;
  device: string;
  browser: string;
  loginTime: Date;
  status: "success" | "failed";
}

const LoginAuditSchema = new Schema<ILoginAudit>({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  ipAddress: { type: String, default: "" },
  device: { type: String, default: "" },
  browser: { type: String, default: "" },
  loginTime: { type: Date, default: Date.now, index: true },
  status: { type: String, required: true }
});

export const LoginAudit = mongoose.model<ILoginAudit>("LoginAudit", LoginAuditSchema);
