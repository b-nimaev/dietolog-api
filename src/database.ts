import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config()

// @ts-ignore
const username = encodeURIComponent("alexandr")
const password = encodeURIComponent(<string>process.env.password?.replace(/"/g, ''))
const url = process.env.database

mongoose.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
} as any).catch(error => { console.error(error) });

mongoose.connection.on('connected', () => {
    console.log('Connected to MongoDB!');
});