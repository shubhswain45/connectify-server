import { prismaClient } from "../../clients/db";
import { GraphqlContext } from "../../interfaces";

export const queries = {
    getUserProfile: async (
        parent: any,
        { username }: { username: string },
        ctx: GraphqlContext
    ) => {
        try {
            const currentUserId = ctx.user?.id; // Assuming the current user's ID is available in ctx (e.g., from session or JWT)

            // Fetch the user from Prisma with only necessary fields and count of relations
            const user = await prismaClient.user.findUnique({
                where: { username },
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    profileImageURL: true,
                    bio: true,
                    _count: {
                        select: {
                            tracks: true,
                            followers: true,
                            followings: true,
                        },
                    },
                    // Fetch follow relationship with the current user only if `currentUserId` exists
                    followers:{
                            where: {
                                followerId: currentUserId,
                            },
                        }
                },
            });

            if (!user) {
                return null
            }

            // Calculate the total number of posts, followers, and followings from the counts
            const totalTracks = user._count.tracks;
            const totalFollowers = user._count.followers;
            const totalFollowings = user._count.followings;

            // Check if the current user follows this profile (only if followers relationship was queried)
            const followedByMe = currentUserId ? user.followers.length > 0 : false;

            const res = {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                profileImageURL: user.profileImageURL || '', // Default to empty string if no profile image
                bio: user.bio,
                totalTracks,
                totalFollowers,
                totalFollowings,
                followedByMe, // This is now a boolean based on whether the current user follows
            }

            // Return the transformed data in the required format
            return res
        } catch (error: any) {
            // Handle any other errors
            console.error("Error toggling like:", error);
            throw new Error(error.message || "An error occurred while toggling the like on the post.");
        }
    },

    getUserTracks: async (
        parent: any,
        { username }: { username: string },
        ctx: GraphqlContext
    ) => {
        try {
            // Fetch and sort posts by creation date in descending order
            const tracks = await prismaClient.track.findMany({
                where: { author: { username } },
                orderBy: {
                    createdAt: "desc", // Sort by createdAt in descending order
                },
                include: {
                    author: true,
                    _count: {
                        select: { likes: true }, // Get the count of likes as totalLikeCount
                    },
                    likes: {
                        where: { userId: ctx.user?.id }, // Check if the specific user has liked the post
                        select: { userId: true },
                    },
                },
            });


            return tracks.map(track => ({
                ...track,
                hasLiked: track.likes.length > 0, // Check if the likes array has the current user's like
            }));
        } catch (error) {
            // Log the error for debugging
            console.error("Error fetching user posts:", error);

            // Throw a generic error message to the client
            throw new Error("Failed to fetch user posts. Please try again.");
        }
    },
};

const mutations = {
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

export const resolvers = { queries, mutations }