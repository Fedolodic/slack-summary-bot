import { createEventAdapter } from '@slack/events-api';
import { WebClient } from '@slack/web-api';
import OpenAI from 'openai';

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
        const response = await OpenAI.Completion.create({
            engine: 'davinci-codex',
            prompt,
            max_tokens: 100,
            n: 1,
            stop: null,
            temperature: 0.5,
        });

        return response.choices[0].text.trim();
    } catch (error) {
        console.error(error);
        return 'Error generating summary.';
    }
}

export default async (req, res) => {
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
};

export const config = {
    api: {
        bodyParser: false,
    },
};