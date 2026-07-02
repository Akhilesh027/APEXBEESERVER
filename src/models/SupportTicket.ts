import mongoose, { Schema, Document } from "mongoose";

export interface ITicketReply {
  senderId: mongoose.Types.ObjectId;
  message: string;
  timestamp: Date;
}

export interface ISupportTicket extends Document {
  userId: mongoose.Types.ObjectId;
  subject: string;
  message: string;
  category: string;
  status: 'Open' | 'Pending' | 'Resolved' | 'Closed';
  replies: ITicketReply[];
  createdAt: Date;
  updatedAt: Date;
}

const TicketReplySchema = new Schema<ITicketReply>({
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: { type: String, required: true },
    message: { type: String, required: true },
    category: { type: String, default: "General" },
    status: {
      type: String,
      enum: ['Open', 'Pending', 'Resolved', 'Closed'],
      default: 'Open'
    },
    replies: { type: [TicketReplySchema], default: [] }
  },
  { timestamps: true }
);

export const SupportTicket = mongoose.model<ISupportTicket>("SupportTicket", SupportTicketSchema);
