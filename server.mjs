import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import bodyParser from 'body-parser';
import cors from 'cors'
import cookieParser from 'cookie-parser'
import {getAccount} from "./services/Database.js";
import rateLimit from "express-rate-limit";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8964;

const baseUrl = process.env.BASE_URL
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN
const FIELD_ID_AGE_GROUP_HID = process.env.FIELD_ID_AGE_GROUP_HID
const FIELD_ID_PRE_CONDITIONS_HID = process.env.FIELD_ID_PRE_CONDITIONS_HID

const allowedOrigins = [
    ALLOWED_ORIGIN
];

const ipLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,              // max 5 requests per IP per minute
    message: 'Too many requests from this IP, please try again later.',
})

let globalRequestCount = 0;
const GLOBAL_LIMIT = 10; // max 100 requests per minute globally
const WINDOW_MS = 10 * 1000; // 10 seconds

setInterval(() => {
    globalRequestCount = 0; // reset every window
}, WINDOW_MS);

const globalLimiter = (req, res, next) => {
    if (globalRequestCount >= GLOBAL_LIMIT) {
        return res.status(429).send('Server is busy. Please try again shortly.');
    }
    globalRequestCount++;
    next();
};

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

app.post('/upsertContact', globalLimiter, ipLimiter, async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).send('No data provided')
    }
    if (req.body.website) {
        return res.status(400).send('Bot detected');
    }
    try {
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
    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).send('Internal server error.');
    }
})

const upsertContact = async (contact, account) => {
    try {
        const url = baseUrl + '/contacts/upsert'
        const data = {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            locationId: account.location_id,
            customFields: [
                {
                    id: FIELD_ID_AGE_GROUP_HID,
                    value: contact.ageRange
                },
                {
                    id: FIELD_ID_PRE_CONDITIONS_HID,
                    value: contact.conditions
                }
            ]
        }
        const response = await fetch (url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + account.access_token,
                'Version': '2021-07-28'
            },
            body: JSON.stringify(data)
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