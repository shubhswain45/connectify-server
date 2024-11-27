export const mutations = `#graphql
    signupUser(payload: SignupUserPayload!): User
    loginUser(payload: LoginUserPayload!): User
    verifyEmail(payload: VerifyEmailPayload!): User
`