export const mutations = `#graphql
    signupUser(payload: SignupUserPayload!): User
    loginUser(payload: LoginUserPayload!): User
    logoutUser: Boolean!
    verifyEmail(payload: VerifyEmailPayload!): User
    forgotPassword(emailOrUsername: String!): Boolean!
    resetPassword(payload: ResetPasswordPayload!): Boolean!
`