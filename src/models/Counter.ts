import mongoose, { Schema, Document } from 'mongoose';

export interface ICounter extends Document {
  id: string; // The sequence name (e.g. 'academy_lead')
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  id: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);
export default Counter;
