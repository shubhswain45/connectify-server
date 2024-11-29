import { Track } from "@prisma/client";
import { prismaClient } from "../../clients/db";
import { GraphqlContext } from "../../interfaces";
import { v2 as cloudinary } from 'cloudinary';

interface CreateTrackPayload {
    title: string;           // Track title, required
    audioFileUrl: string;    // URL to the audio file, required
    coverImageUrl?: string;  // URL to the cover image, optional
    artist?: string;  // URL to the cover image, optional
    duration: number
}

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
};


const extraResolvers = {
    Track: {
        author: async (parent: Track) => await prismaClient.user.findUnique({ where: { id: parent.authorId } })
    },

}

export const resolvers = { mutations, extraResolvers };