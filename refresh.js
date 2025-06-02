import {getAccount, updateAccount} from "./services/Database.js";

const baseUrl = process.env.BASE_URL
const userType = process.env.USER_TYPE
const clientId = process.env.CLIENT_ID
const clientSecret = process.env.CLIENT_SECRET

async function refreshTokens() {
    const account = await getAccount()
    const newTokensResponse = await refreshAccessToken(account)
    account.refresh_token = newTokensResponse.refresh_token
    account.access_token = newTokensResponse.access_token
    await updateAccount(account)
    console.log('Tokens refreshed')
    setTimeout(async () => {
        await refreshTokens()
    }, 720 * 60 * 1000)
}

const refreshAccessToken = async (account) => {
    try {
        const original_refresh_token = account.refresh_token
        const url = baseUrl + '/oauth/token'
        const data = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'refresh_token',
            refresh_token: original_refresh_token,
            user_type: userType
        })
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: data
        })
        const responseData = await response.json()
        if (response.status !== 200) {
            console.error('Error in get refresh token: ', responseData)
            throw new Error(`Error in get refresh token.`)
        }
        return responseData
    } catch (error) {
        throw new Error('Error in refresh token: ' + error)
    }
}

refreshTokens()

