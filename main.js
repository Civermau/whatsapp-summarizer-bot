const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const OpenAI = require('openai');

const client = new Client();

const openai = new OpenAI({
        baseURL: 'https://api.deepseek.com',
        apiKey: 'YOUR_API_KEY'
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});

client.initialize();

client.on('message_create', async message => {
    if ((message.body.includes('--summarize') || message.body.includes('!goya')) && !message.fromMe) {
        const chat = await message.getChat();
        const limit = message.body.split(' ')[1];
        if (!limit) {
            message.reply('Please provide a limit');
            return;
        }
        const messages = await chat.fetchMessages({ limit: limit });

        // console.log(messages);

        const messagesList = messages
            .filter(message => !message.fromMe && message.type === 'chat')
            .map(message => ({
                from: message._data.notifyName || message.author,
                body: message.body,
                timestamp: message.timestamp
            }));

        const summary = await summarizeMessages(messagesList);
        message.reply(summary);
    }

    if ((message.body.includes('-h') || message.body.includes('--help')) && !message.fromMe) {
        message.reply('Bot created by *Civer_mau!* \nCheck the github repo for more info: https://github.com/Civermau/whatsapp-summarizer-bot');
    }
});

async function summarizeMessages(messages) {
    const stringMessages = messages.map(message => `${message.from}: ${message.body} (${new Date(message.timestamp * 1000).toLocaleString()})`).join('\n');
    console.log("Summary triggered, sending to OpenAI: " + stringMessages);
    const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
            {
                role: "system",
                content: "You are a helpful assistant that summarizes messages. You will be given a list of messages and you will need to summarize them. the messages contain the sender's name, the message content, and the timestamp. the messages are in the order they were sent. the summary should be in the same language as the messages. if you happen to mention a phone number, just mention it in pure text, like 5211234567890, without any kind of formatting, @, +, ****, etc. Just the plain number. "
            },
            {
                role: "user",
                content: stringMessages
            }
        ]
    });
    console.log("OpenAI response: " + response.choices[0].message.content);
    return response.choices[0].message.content;
}