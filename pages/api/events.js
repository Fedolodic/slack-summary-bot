import { createEventAdapter } from '@slack/events-api';
import { WebClient } from '@slack/web-api';
const OpenAI = require('openai');
import nc from 'next-connect';
import axios from 'axios';

OpenAI.apiKey = process.env.OPENAI_API_KEY;

const slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET);
const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

slackEvents.on('app_mention', async (event) => {
    try {
        const message = event.text;
        const urls = extractUrls(message);

        for (const url of urls) {
            const summary = await generateSummary(url);
            await slackClient.chat.postMessage({
                channel: event.channel,
                text: `Summary for ${url}:\n${summary}`,
                thread_ts: event.ts,
            });
        }
    } catch (error) {
        console.error(error);
    }
});

function extractUrls(message) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return message.match(urlRegex) || [];
}

async function generateSummary(url) {
    try {
        const prompt = `Please summarize the following article: ${url}`;
        const response = await axios.post('https://api.openai.com/v1/completions', {
            model: 'text-davinci-003',
            prompt,
            max_tokens: 100,
            n: 1,
            stop: null,
            temperature: 0.5,
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
            },
        });

        return response.data.choices[0].text.trim();
    } catch (error) {
        console.error(error);
        return 'Error generating summary.';
    }
}

const handler = nc()
    .use(rawBody)
    .post(async (req, res) => {
        req.body = JSON.parse(req.rawBody);
        console.log('Request body:', req.body);

        if (req.body.type === 'url_verification') {
            res.status(200).send(req.body.challenge);
        } else {
            try {
                const body = await slackEvents.requestListener()(req, res);
            } catch (error) {
                console.error(error);
                res.status(500).send('Error processing event');
            }
        }
    });

export default handler;

export const config = {
    api: {
        bodyParser: false,
    },
};

function rawBody(req, res, next) {
    req.setEncoding('utf8');
    req.rawBody = '';
    req.on('data', (chunk) => {
        req.rawBody += chunk;
    });
    req.on('end', () => {
        next();
    });
}