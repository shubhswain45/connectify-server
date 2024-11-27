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

    input LoginUserPayload {
        usernameOrEmail: String!
        password: String!
    }

    input VerifyEmailPayload {
        code: String!
        email: String!
    }

    input ResetPasswordPayload {
        token: String!
        newPassword: String!
        confirmPassword: String!
    }

`