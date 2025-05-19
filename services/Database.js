import pg from 'pg'

const {Pool} = pg

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
})

export const getAccount = async () => {
    let client
    try {
        client = await pool.connect()
        const res = await client.query('SELECT * FROM account')
        return res.rows[0]
    } catch (e) {
        console.error('Error getting account: ', e)
    } finally {
        if (client) {
            client.release()
        }
    }
}

export const updateAccount = async (account) => {
    let client
    try {
        client = await pool.connect()
        const query = `
            UPDATE account
            SET access_token  = $1,
                refresh_token = $2
            WHERE location_id = $3
        `
        const values = [account.access_token, account.refresh_token, account.location_id];
        await client.query(query, values)
    } catch(error) {
        console.error('Error updating account: ', error)
    } finally {
        if (client) {
            client.release()
        }
    }
}