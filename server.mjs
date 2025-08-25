import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import bodyParser from 'body-parser';
import cors from 'cors'
import cookieParser from 'cookie-parser'
import {getAccount} from "./services/Database.js";
import rateLimit from "express-rate-limit";
import {DateTime} from 'luxon';

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8964;

const baseUrl = process.env.BASE_URL
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN
const FIELD_ID_AGE_GROUP_APEX = process.env.FIELD_ID_AGE_GROUP_APEX
const FIELD_ID_PRE_CONDITIONS_APEX = process.env.FIELD_ID_PRE_CONDITIONS_APEX
const FIELD_ID_PREFERENCES_APEX = process.env.FIELD_ID_PREFERENCES_APEX
const FIELD_ID_NOTES_APEX = process.env.FIELD_ID_NOTES_APEX
const WEBSITE_LEAD = process.env.WEBSITE_LEAD

const allowedOrigins = [
    ALLOWED_ORIGIN
];

app.set('trust proxy', 1)

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
    res.json({message: 'Hello from backend!'});
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
        const apexContact = await upsertContact(data, account)
        if (apexContact.success) {
            console.log('Contact upserted successfully')
            res.status(201).send({data: apexContact.data})
        } else {
            console.log('Error in upsert contact: ', apexContact)
            res.status(500).send('Error in upsert contact.')
        }
    } catch (err) {
        console.error('Unexpected error: ', err);
        res.status(500).send('Internal server error.');
    }
})

app.get('/getCalendar', globalLimiter, ipLimiter, async (req, res) => {
    try {
        const account = await getAccount()
        const apexCalendar = await getCalendar(account)
        if (apexCalendar.success) {
            console.log('Calendar fetched successfully')
            res.status(200).send({data: apexCalendar.data})
        } else {
            console.log('Error in get calendar: ', apexCalendar)
            res.status(500).send('Error in get calendar')
        }
    } catch (err) {
        console.error('Unexpected error in get calendar: ', err)
        res.status(500).send('Unexpected error in get calendar: ', err)
    }
})

app.get('/getCalendarEvents', globalLimiter, ipLimiter, async (req, res) => {
    try {
        const allowBookingAfter = req.query.allowBookingAfter
        const allowBookingAfterUnit = req.query.allowBookingAfterUnit
        const allowBookingFor = req.query.allowBookingFor
        const allowBookingForUnit = req.query.allowBookingForUnit
        const now = DateTime.now()
        const bookingStart = now.plus({[allowBookingAfterUnit]: allowBookingAfter})
        const bookingEnd = now.plus({[allowBookingForUnit]: allowBookingFor})
        const account = await getAccount()
        const events = await getCalendarEvents(account, bookingStart.valueOf(), bookingEnd.valueOf())
        if (events.success) {
            console.log('Calendar events fetched successfully')
            res.status(200).send({data: events.data})
        } else {
            console.log('Error in get calendar events: ', events)
            res.status(500).send('Error in get calendar events')
        }
    } catch (err) {
        console.error('Unexpected error in get calendar events: ', err)
        res.status(500).send('Unexpected error in get calendar events: ', err)
    }
})

app.post('/makeAppointment', globalLimiter, ipLimiter, async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).send('No data provided')
    }
    if (req.body.website) {
        return res.status(400).send('Bot detected')
    }
    try {
        const data = req.body
        const account = await getAccount()
        const apexAppointment = await makeAppointment(data, account)
        if (apexAppointment.success) {
            console.log('Appointment created successfully')
            res.status(201).send({data: apexAppointment.data})
        } else {
            console.log('Error in make appointment: ', apexAppointment)
            res.status(500).send('Error in make appointment.')
        }
    } catch (err) {
        console.error('Unexpected error: ', err)
        res.status(500).send('Internal server error.')
    }
})

const upsertContact = async (contact, account) => {
    try {
        const url = baseUrl + '/contacts/upsert'
        const customFields = []
        if (contact.ageRange) {
            customFields.push({
                id: FIELD_ID_AGE_GROUP_APEX,
                value: contact.ageRange
            })
        }
        if (contact.conditions && contact.conditions.length > 0) {
            customFields.push({
                id: FIELD_ID_PRE_CONDITIONS_APEX,
                value: contact.conditions
            })
        }
        if (contact.preferences && contact.preferences.length > 0) {
            customFields.push({
                id: FIELD_ID_PREFERENCES_APEX,
                value: contact.preferences
            })
        }
        if (contact.notes) {
            customFields.push({
                id: FIELD_ID_NOTES_APEX,
                value: contact.notes
            })
        }

        const data = {
            firstName: contact.firstName,
            lastName: contact.lastName,
            email: contact.email,
            phone: contact.phone,
            state: contact.state,
            locationId: account.location_id,
            customFields: customFields,
            source: WEBSITE_LEAD
        }
        const response = await fetch(url, {
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
        const contactData = {
            contactId: responseData.contact?.id
        }
        const returnData = {
            success: success,
            data: contactData
        }
        console.log(
            `Upsert contact for ${account.business_name}: `, returnData
        )
        return returnData
    } catch (error) {
        console.error(`Error in upsert contact for ${account.business_name}: `, error)
        return {
            success: false,
            data: error
        }
    }
}

const getCalendar = async (account) => {
    try {
        const url = baseUrl + '/calendars/' + account.calendar_id
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + account.access_token,
                'Version': '2021-04-15'
            }
        })
        const responseData = await response.json()
        const data = {
            slotDuration: responseData.calendar?.slotDuration,
            slotDurationUnit: responseData.calendar?.slotDurationUnit,
            openHours: responseData.calendar?.openHours,
            allowBookingAfterUnit: responseData.calendar?.allowBookingAfterUnit,
            allowBookingAfter: responseData.calendar?.allowBookingAfter,
            allowBookingForUnit: responseData.calendar?.allowBookingForUnit,
            allowBookingFor: responseData.calendar?.allowBookingFor
        }
        const success = response.status === 200
        return {
            success: success,
            data: data
        }
    } catch (error) {
        console.error(`Error in get calendar for ${account.business_name}: `, error)
        return {
            success: false,
            data: error
        }
    }
}

const getCalendarEvents = async (account, startTime, endTime) => {
    try {
        const url = baseUrl + '/calendars/events?locationId=' + account.location_id + '&startTime=' + startTime
            + '&endTime=' + endTime + '&calendarId=' + account.calendar_id
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + account.access_token,
                'Version': '2021-04-15'
            }
        })
        const responseData = await response.json()
        const success = response.status === 200
        const data = responseData.events?.map(event => ({
            startTime: event.startTime
        }))
        return {
            success: success,
            data: data
        }
    } catch (error) {
        console.error(`Error in get calendar events for ${account.business_name}: `, error)
        return {
            success: false,
            data: error
        }
    }
}

const getBlockedSlotsFromUserId = async (account, startTime, endTime) => {
    try {
        const url = baseUrl + '/calendars/blocked-slots?locationId=' + account.location_id + '&startTime=' + startTime
            + '&endTime=' + endTime + '&userId=' + account.user_id
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + account.access_token,
                'Version': '2021-04-15'
            }
        })
        const responseData = await response.json()
        const success = response.status === 200
        const data = responseData.events?.map(event => ({
            startTime: event.startTime,
            endTime: event.endTime
        }))
        return {
            success: success,
            data: data
        }
    } catch (error) {
        console.error(`Error in get blocked slots for ${account.business_name} `, error)
        return {
            success: false,
            data: error
        }
    }
}

const makeAppointment = async (appointment, account) => {
    try {
        const url = baseUrl + '/calendars/events/appointments'
        const data = {
            calendarId: account.calendar_id,
            locationId: account.location_id,
            assignedUserId: account.user_id,
            userIds: [account.user_id],
            contactId: appointment.contactId,
            startTime: appointment.startTime,
            ignoreDateRange: true,
            ignoreFreeSlotValidation: true
        }
        const response = await fetch(url, {
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
            data: responseData.id
        }
        console.log(
            `Made appointment for ${account.business_name}: `, returnData
        )
        return returnData
    } catch (error) {
        console.error(`Error in make appointment for ${account.business_name}: `, error)
        return {
            success: false,
            data: error
        }
    }
}