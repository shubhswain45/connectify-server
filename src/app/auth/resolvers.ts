import { prismaClient } from "../../clients/db";
import bcrypt from 'bcryptjs'
import NodeMailerService from "../../services/NodeMailerService";

interface SignupUserPayload {
    username: string; // Required field
    fullName: string; // Required field
    email: string;    // Required field
    password: string; // Required field
}

const mutations = {
    signupUser: async (parent: any, { payload }: { payload: SignupUserPayload }) => {
      try {
        const { username, fullName, email, password } = payload;
  
        // Check if username or email already exists
        const existingUser = await prismaClient.user.findFirst({
          where: {
            OR: [
              { username },
              { email },
            ],
          },
        });
  
        // Separate the error message based on the conflict
        if (existingUser) {
          if (existingUser.username === username) {
            throw new Error('Username is already in use');
          }
          if (existingUser.email === email) {
            throw new Error('Email is already in use');
          }
        }
  
        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
  
        const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();
  
        // Set the verification token expiration to 24 hours from now
        const verificationTokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
        // Create the new user
        const newUser = await prismaClient.user.create({
          data: {
            email,
            username,
            fullName,
            password: hashedPassword,
            verificationToken,
            verificationTokenExpiresAt,
            isVerified: false,
          },
        });

        await NodeMailerService.sendVerificationEmail(newUser.email, verificationToken)
  
        return newUser;
  
      } catch (error: any) {
        console.log("Error while signupUser:", error.message);
        throw new Error(error.message || 'An unexpected error occurred');
      }
    },
  };
  
export const resolvers = { mutations }
