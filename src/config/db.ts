import mongoose from "mongoose";
import dotenv from "dotenv"

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || ""

export async function connectToDatabase(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB successfully with Mongoose');
    
    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

export async function closeConnection(): Promise<void> {
  await mongoose.connection.close();
  console.log('MongoDB connection closed');
}