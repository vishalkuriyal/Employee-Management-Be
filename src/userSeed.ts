import User from "./models/user"
import bcrypt from "bcryptjs"
import { connectToDatabase, closeConnection } from "./config/db"

const userRegister = async () => {
  try {
    await connectToDatabase()

    const hashPassword = await bcrypt.hash("Makedollars@12345", 10)
    const newUser = new User({
      name: "Diksha Kuriyal",
      email: "admin@techqilla.com",
      password: hashPassword,
      role: "admin",
      image: ""
    })

    const savedUser = await newUser.save()
    console.log("Admin user created successfully:", savedUser)
  } catch (error) {
    console.error("Error creating admin user:", error)
  } finally {
    await closeConnection()
  }
}

userRegister();