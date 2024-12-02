import { Track } from "@prisma/client";
import { prismaClient } from "../../clients/db";
import { GraphqlContext } from "../../interfaces";
import { v2 as cloudinary } from 'cloudinary';

interface CreateTrackPayload {
    title: string;           // Track title, required
    audioFileUrl: string;    // URL to the audio file, required
    coverImageUrl?: string;  // URL to the cover image, optional
    artist?: string;  // URL to the cover image, optional
    duration: string
}

const queries = {
    //[1,2,3,4,5,6,7,8,9,10,11,12]
    getFeedTracks: async (parent: any, agrs: { args: any }, ctx: GraphqlContext) => {
        try {
            // Fetch posts by users whom the current user follows
            const tracks = await prismaClient.track.findMany({
               take: 5
            });

           return tracks
        } catch (error) {
            console.error("Error fetching feed posts:", error);
            throw new Error("Failed to fetch feed posts.");
        }
    },

    getTrackById: async (
        parent: any,
        { id }: { id: string },
        ctx: GraphqlContext
    ) => {
        try {
            // Fetch the post along with related data
            const track = await prismaClient.track.findUnique({
                where: { id },
            });

            if (!track) {
                return null;
            }

            return track

            
        } catch (error) {
            // Log the error for debugging
            console.error("Error fetching post:", error);
            throw new Error("Failed to fetch the post. Please try again.");
        }
    }
};

const mutations = {
    createTrack: async (
        parent: any,
        { payload }: { payload: CreateTrackPayload },
        ctx: GraphqlContext
    ) => {
        try {
            // Ensure the user is authenticated
            if (!ctx.user) throw new Error("Please Login/Signup first!");

            const { title, audioFileUrl, coverImageUrl, artist, duration } = payload;

            // Upload audio URL to Cloudinary
            const uploadAudioResult = await cloudinary.uploader.upload(audioFileUrl, {
                resource_type: "auto",
            });

            // Upload cover image URL to Cloudinary (if provided)
            let uploadImageResult = null;
            if (coverImageUrl) {
                uploadImageResult = await cloudinary.uploader.upload(coverImageUrl, {
                    resource_type: "auto",
                });
            }

            // Create track in the database
            const track = await prismaClient.track.create({
                data: {
                    title,
                    artist,
                    duration,
                    audioFileUrl: uploadAudioResult.secure_url,
                    coverImageUrl: uploadImageResult?.secure_url || null,
                    authorId: ctx.user.id, // Link track to the authenticated user
                },
            });

            return track; // Return the created track
        } catch (error: any) {
            // Handle errors gracefully
            console.error("Error creating track:", error);
            throw new Error(error.message || "An error occurred while creating the track.");
        }
    },

    deleteTrack: async (
        parent: any,
        { trackId }: { trackId: string },
        ctx: GraphqlContext
    ) => {
        try {
            // Ensure the user is authenticated
            if (!ctx.user) throw new Error("Please Login/Signup first!");

            const track = await prismaClient.track.findUnique({ where: { id: trackId } })

            if (!track) {
                throw new Error("Post Doest exist!");
            }

            if (track.authorId.toString() != ctx.user.id.toString()) {
                throw new Error("You cant delete someone else post!");
            }

            await prismaClient.track.delete({ where: { id: trackId } })

            return true

        } catch (error: any) {
            // Handle errors gracefully (Cloudinary or Prisma issues)
            console.error("Error toggling like:", error);
            throw new Error(error.message || "An error occurred while toggling the like on the post.");
        }
    },

    likeTrack: async (parent: any, { trackId }: { trackId: string }, ctx: GraphqlContext) => {

        try {
            // Ensure the user is authenticated
            if (!ctx.user) throw new Error("Please Login/Signup first");

            // Attempt to delete the like (unlike the post)
            await prismaClient.like.delete({
                where: {
                    userId_trackId: {
                        userId: ctx.user.id,  // User ID from the context
                        trackId,
                    }
                }
            });

            // If successful, return a response indicating the post was unliked
            return false; // Post was unliked

        } catch (error: any) {
            // If the like doesn't exist, handle the error and create the like (like the post)
            if (error.code === 'P2025') { // This error code indicates that the record was not found
                // Create a like entry (Prisma will automatically link the user and post)
                await prismaClient.like.create({
                    data: {
                        userId: ctx?.user?.id || "",  // User ID from the context
                        trackId,  // Post ID to associate the like with
                    }
                });
                return true; // Post was liked
            }

           // Handle errors gracefully (Cloudinary or Prisma issues)
           console.error("Error toggling like:", error);
           throw new Error(error.message || "An error occurred while toggling the like on the post.");
        }
    },

};


const extraResolvers = {
    Track: {
        author: async (parent: Track) => await prismaClient.user.findUnique({ where: { id: parent.authorId } })
    },

}

export const resolvers = { mutations, queries,extraResolvers };