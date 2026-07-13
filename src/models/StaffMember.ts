import mongoose, { Schema, Document } from 'mongoose';

export interface IStaffMember extends Document {
  userId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  role: string;
  permissions: string[];
  status: 'Active' | 'Suspended' | 'Invited';
  invitedAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const StaffMemberSchema = new Schema<IStaffMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, required: true },
    permissions: [{ type: String }],
    status: {
      type: String,
      enum: ['Active', 'Suspended', 'Invited'],
      default: 'Invited',
      index: true
    },
    invitedAt: { type: Date, default: Date.now },
    acceptedAt: Date
  },
  { timestamps: true }
);

export default mongoose.model<IStaffMember>('StaffMember', StaffMemberSchema);
