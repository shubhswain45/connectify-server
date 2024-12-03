import { prismaClient } from "../../clients/db";
import { GraphqlContext } from "../../interfaces";

export const mutations = {
    followUser: async (parent: any, { userId }: { userId: string }, ctx: GraphqlContext) => {
        // Ensure the user is authenticated
        try {
            if (!ctx.user) throw new Error("Please Login/Signup first");
            // Attempt to delete the like (unlike the post)
            await prismaClient.follow.delete({
                where: {
                    followerId_followingId: {
                        followerId: ctx.user.id,
                        followingId: userId
                    }
                }
            });

            // If successful, return a response indicating the post was unliked
            return false; // unfollowed

        } catch (error: any) {
            // If the like doesn't exist, handle the error and create the like (like the post)
            if (error.code === 'P2025') { // This error code indicates that the record was not found
                // Create a like entry (Prisma will automatically link the user and post)
                await prismaClient.follow.create({
                    data: {
                        followerId: ctx?.user?.id || "",
                        followingId: userId
                    }
                });
                return true; // followed
            }

            // Handle any other errors
            console.error("Error toggling like:", error);
            throw new Error(error.message || "An error occurred while toggling the like on the post.");
        }
    }
}


export const resolvers = {mutations} 