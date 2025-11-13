export type UserType = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "employee"
  image?: string
  createdAt: Date
  updatedAt: Date
}