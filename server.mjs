import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import bodyParser from 'body-parser';
import cors from 'cors'
import cookieParser from 'cookie-parser'
import {getAccount} from "./services/Database.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8964;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN
const baseUrl = process.env.BASE_URL

const allowedOrigins = [
    ALLOWED_ORIGIN
];

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}

app.use(cors(corsOptions))

app.use(bodyParser.json())
app.use(cookieParser())

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/hello', (req, res) => {
    res.json({ message: 'Hello from backend!' });
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})

app.post('/upsertContact', async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).send('No data provided')
    }
    const data = req.body
    const account = await getAccount()
    const hidContact = await upsertContact(data, account)
    if (hidContact.success) {
        console.log('Contact upserted successfully')
        res.send('Contact upserted successfully')
    } else {
        console.log('Error in upsert contact: ', hidContact)
        res.status(500).send('Error in upsert contact.')
    }
})

const upsertContact = async (contact, account) => {
    try {
        const url = baseUrl + '/contacts/upsert'
        const response = await fetch (url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + account.access_token,
                'Version': '2021-07-28'
            },
            body: JSON.stringify(contact)
        })
        const responseData = await response.json()
        const success = response.status === 201
        const returnData = {
            success: success,
            data: responseData
        }
        console.log(
            `Upsert contact for ${account.name}: `, returnData
        )
        return returnData
    } catch (error) {
        console.error(`Error in upsert contact for ${account.name}: `, error)
        return {
            success: false,
            data: error
        }
    }
}