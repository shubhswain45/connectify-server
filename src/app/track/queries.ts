export const queries = `#graphql
    getFeedTracks:[Track]
    getTrackById(trackId: String!): Track
    getUserTracks(username: String!):[Track]

`