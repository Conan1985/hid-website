import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import bodyParser from 'body-parser';
import cors from 'cors'
import cookieParser from 'cookie-parser'

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 8964;

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN

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