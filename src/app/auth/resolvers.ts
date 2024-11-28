import { prismaClient } from "../../clients/db";
import bcrypt from 'bcryptjs'
import NodeMailerService from "../../services/NodeMailerService";
import { GraphqlContext, JWTUser } from "../../interfaces";
import JWTService from "../../services/JWTService";
import crypto from 'crypto'

interface SignupUserPayload {
    username: string; // Required field
    fullName: string; // Required field
    email: string;    // Required field
    password: string; // Required field
}

interface LoginUserPayload {
    usernameOrEmail: string; // Required field (username or email)
    password: string;        // Required field (password)
}

interface VerifyEmailPayload {
    code: string
    email: string
}

interface ResetPasswordPayload {
    token: string
    newPassword: string
    confirmPassword: string
}

const queries = {
    getCurrentUser: async (parent: any, args: any, ctx: GraphqlContext) => {
        try {
            const id = ctx.user?.id;
            if (!id) return null;

            const user = await prismaClient.user.findUnique({ where: { id } });
            return user;
        } catch (error) {
            return null;
        }
    }
};

const mutations = {
    signupUser: async (parent: any, { payload }: { payload: SignupUserPayload }, ctx: GraphqlContext) => {
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


            const userToken = JWTService.generateTokenForUser({ id: newUser.id, username: newUser.username });

            // Set the JWT token in the cookie
            ctx.res.cookie('__connectify_token', userToken, {
                httpOnly: true, // Prevents JavaScript from accessing the cookie, enhancing security
                secure: false,  // Should be true in production to ensure cookies are sent over HTTPS only
                maxAge: 1000 * 60 * 60 * 24, // 1 day expiry time
                sameSite: 'none', // 'lax' is suitable for local development; use 'none' with HTTPS in production
                path: '/', // The cookie is available to the entire site
            });

            await NodeMailerService.sendVerificationEmail(newUser.email, verificationToken)

            return newUser;

        } catch (error: any) {
            console.log("Error while signupUser:", error.message);
            throw new Error(error.message || 'An unexpected error occurred');
        }
    },

    loginUser: async (parent: any, { payload }: { payload: LoginUserPayload }, ctx: GraphqlContext) => {
        try {
            const { usernameOrEmail, password } = payload;

            // Check if username or email exists
            const existingUser = await prismaClient.user.findFirst({
                where: {
                    OR: [
                        { username: usernameOrEmail },
                        { email: usernameOrEmail },
                    ],
                },
            });

            // If no user exists, throw an error
            if (!existingUser) {
                throw new Error('Sorry, user does not exist!');
            }

            // Compare the provided password with the stored password hash
            const isPasswordCorrect = await bcrypt.compare(password, existingUser.password);

            // If password is incorrect, throw an error
            if (!isPasswordCorrect) {
                throw new Error('Incorrect password!');
            }

            const userToken = JWTService.generateTokenForUser({ id: existingUser.id, username: existingUser.username });

            // Set the JWT token in the cookie
            ctx.res.cookie('__connectify_token', userToken, {
                httpOnly: true, // Prevents JavaScript from accessing the cookie, enhancing security
                secure: false,  // Should be true in production to ensure cookies are sent over HTTPS only
                maxAge: 1000 * 60 * 60 * 24, // 1 day expiry time
                sameSite: 'none', // 'lax' is suitable for local development; use 'none' with HTTPS in production
                path: '/', // The cookie is available to the entire site
            });

            // If everything is correct, return the existing user
            return existingUser

        } catch (error: any) {
            console.log('Error while logging in user:', error.message);
            throw new Error(error.message || 'An unexpected error occurred');
        }
    },

    verifyEmail: async (parent: any, { payload }: { payload: VerifyEmailPayload }, ctx: GraphqlContext) => {
        try {
            // Find user by email
            let user = await prismaClient.user.findUnique({
                where: { email: payload?.email }
            });

            // Check if the user exists
            if (!user) {
                throw new Error("User not found.");
            }

            // Check if the user is already verified
            if (user.isVerified) {
                throw new Error("Your email is already verified.");
            }

            // Verify the token
            if (user.verificationToken !== payload.code) {
                throw new Error("Invalid verification code.");
            }

            // Check if the token has expired
            if (user.verificationTokenExpiresAt && user.verificationTokenExpiresAt < new Date()) {
                throw new Error("Verification token has expired.");
            }

            // Update user verification status
            user = await prismaClient.user.update({
                where: { email: payload.email },
                data: {
                    isVerified: true,
                    verificationToken: null,
                    verificationTokenExpiresAt: null,
                },
            });

            NodeMailerService.sendWelcomeEmail(payload.email, user?.username || "")
            return user;


        } catch (error: any) {
            console.log('Error while logging in user:', error.message);
            throw new Error(error.message || 'An unexpected error occurred');
        }
    },

    forgotPassword: async (parent: any, { emailOrUsername }: { emailOrUsername: string }, { res }: { res: any }) => {
        try {
            // Check if the user exists by email or username
            const user = await prismaClient.user.findFirst({
                where: {
                    OR: [
                        { email: emailOrUsername },
                        { username: emailOrUsername }
                    ]
                }
            });

            if (!user) {
                throw new Error("User not found.");
            }

            // Generate reset token
            const resetToken = crypto.randomBytes(20).toString("hex");
            const resetTokenExpiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

            // Save the updated user
            await prismaClient.user.update({
                where: { id: user.id }, // Use the user's ID for the update
                data: { resetPasswordToken: resetToken, resetPasswordTokenExpiresAt: resetTokenExpiresAt },
            });

            // Send reset email
            await NodeMailerService.sendPasswordResetEmail(user.email, "http://localhost:3000")
            // Send response
            return true;
        } catch (error: any) {
            console.error("Error in forgotPassword: ", error);
            throw new Error(error.message);
        }
    },

    resetPassword: async (parent: any, { payload }: { payload: ResetPasswordPayload }, ctx: GraphqlContext) => {
        try {
            const { token, newPassword, confirmPassword } = payload;

            // Check if the passwords match
            if (newPassword !== confirmPassword) {
                throw new Error("Passwords do not match");
            }

            // Find user with the reset password token and check expiration
            const user = await prismaClient.user.findUnique({
                where: {
                    resetPasswordToken: token,
                },
            });

            // Ensure the user exists and the token has not expired
            if (!user || !user.resetPasswordTokenExpiresAt || user.resetPasswordTokenExpiresAt <= new Date()) {
                throw new Error("Invalid or expired reset token");
            }

            // Update the password
            const hashedPassword = await bcrypt.hash(newPassword, 10); // Use newPassword instead of password
            await prismaClient.user.update({
                where: { id: user.id }, // Update user by id
                data: {
                    password: hashedPassword,
                    resetPasswordToken: null, // Clear the token
                    resetPasswordTokenExpiresAt: null, // Clear the expiration
                },
            });

            NodeMailerService.sendResetSuccessEmail(user?.email || "")
            return true

        } catch (error: any) {
            throw new Error(error.message);
        }
    },
};

export const resolvers = { queries, mutations }
