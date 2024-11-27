import { prismaClient } from "../../clients/db";
import bcrypt from 'bcryptjs'

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

            // Create the new user
            const newUser = await prismaClient.user.create({
                data: {
                    username,
                    fullName,
                    email,
                    password: hashedPassword,
                    isVerified: false, // Default verification status
                },
            });

            return newUser

        } catch (error: any) {
            console.log("Error while signupUser");
            throw new Error(error.message);
        }
    },
};

export const resolvers = { mutations }
