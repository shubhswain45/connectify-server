import { prismaClient } from "../../clients/db";
import { GraphqlContext } from "../../interfaces";

export const queries = {
    getUserProfile: async (
      parent: any,
      { username }: { username: string },
      ctx: GraphqlContext
    ) => {
      try {
        const currentUserId = ctx.user?.id;
  
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
            followers: currentUserId
              ? {
                  where: {
                    followerId: currentUserId,
                  },
                  select: { id: true }, // Only retrieve necessary fields
                }
              : undefined, // Skip this query if currentUserId is not defined
          },
        });
  
        if (!user) {
          return null; // Return null if user does not exist
        }
  
        const totalTracks = user._count.tracks;
        const totalFollowers = user._count.followers;
        const totalFollowings = user._count.followings;
        const followedByMe = currentUserId ? user.followers.length > 0 : false;
  
        return {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          profileImageURL: user.profileImageURL || "", // Default to an empty string
          bio: user.bio,
          totalTracks,
          totalFollowers,
          totalFollowings,
          followedByMe,
        };
      } catch (error: any) {
        console.error("Error fetching user profile:", error);
        throw new Error(
          error.message || "An error occurred while fetching the user profile."
        );
      }
    },
  
    getUserTracks: async (
      parent: any,
      { username }: { username: string },
      ctx: GraphqlContext
    ) => {
      try {
        const tracks = await prismaClient.track.findMany({
          where: { author: { username } },
          orderBy: {
            createdAt: "desc", // Sort by creation date
          },
          include: {
            _count: {
              select: { likes: true }, // Retrieve the count of likes
            },
            likes: ctx.user?.id
              ? {
                  where: { userId: ctx.user.id },
                  select: { userId: true }, // Check if the current user has liked the track
                }
              : undefined, // Skip if the user is not logged in
          },
        });
  
        return tracks.map((track) => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          duration: track.duration,
          coverImageUrl: track.coverImageUrl,
          audioFileUrl: track.audioFileUrl,
          createdAt: track.createdAt,
          updatedAt: track.updatedAt,
          totalLikeCount: track._count.likes,
          hasLiked: track.likes.length > 0, // Boolean to indicate if the user liked the track
        }));
      } catch (error: any) {
        console.error("Error fetching user tracks:", error);
        throw new Error(
          error.message || "Failed to fetch user tracks. Please try again."
        );
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