import { UserDocument } from "../../models/user"; // Update path if different

declare global {
  namespace Express {
    interface Request {
      user?: UserDocument | null;
    }
  }
}