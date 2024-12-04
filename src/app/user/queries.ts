export const queries = `#graphql
    getUserProfile(username: String!): getUserProfileResponse 
    getUserTracks(username: String!):[Track]
`