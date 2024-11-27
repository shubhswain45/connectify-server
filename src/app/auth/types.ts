export const types = `#graphql
    type User {
        id: ID!
        username: String!
        fullName: String!
        email: String!
        profileImageURL: String
        isVerified: Boolean!
    }

    input SignupUserPayload {
        username: String!
        fullName: String!
        email: String!
        password: String!
    }
`