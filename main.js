/* ************************************************
 *               IMPORTS & SETUP                *
 *************************************************/
const { Client, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const OpenAI = require("openai");
const fs = require("fs");
const cron = require("node-cron");

// Docker-optimized client configuration for Alpine Linux
const client = new Client({
  authStrategy: new (require("whatsapp-web.js").LocalAuth)({
    dataPath: "./.wwebjs_auth"
  }),
  puppeteer: {
    headless: true,
    executablePath: '/usr/bin/chromium-browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    ]
  }
});

const botOwner = "YOUR NUMBER HERE";

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: "YOUR API KEY HERE",
});

/* ************************************************
 *            CLIENT INITIALIZATION             *
 *************************************************/
client.on("ready", async () => {
  console.log("Client is ready!");


  // Send Bancho-8 sticker
  const stickerMedia = MessageMedia.fromFilePath(
    "./BanchoStickers/Bancho-8.png"
  );

  await client.sendMessage(botOwner, stickerMedia, {
    sendMediaAsSticker: true,
    stickerName: "Bancho is sleepy",
    stickerAuthor: "Bancho",
  });

  const chats = await client.getChats();
  const groups = chats.filter(chat => chat.isGroup);
  
  for (const group of groups) {
    await client.sendMessage(group.id._serialized, stickerMedia, {
      sendMediaAsSticker: true,
      stickerName: "Bancho is sleepy",
      stickerAuthor: "Bancho",
    });
  }
});

/* ************************************************
 *            MESSAGE HANDLING                  *
 *************************************************/
client.on("message_create", async (message) => {
  var pumCount = 0;
  pumCount = countPum(message);

  const messageData = message.body.split(" ");

  /* ===========================================
   ?         SUMMARIZE COMMAND               *
   ===========================================*/
  if (messageData[0] === "--summarize" && !message.fromMe) {
    const chat = await message.getChat();
    const limit = messageData[1];

    if (chat.unreadCount < 30) {
        client.sendMessage(message.from, "A summary was sent less than 30 messages ago, go read it you lazy bastard. This is to avoid spamming and wasting tokens.");
        return;
    }

    if (!limit) {
      client.sendMessage(message.from, "Please provide a limit");
      return;
    }

    if (limit >= 100 && limit < 500) {
        const stickerMedia = MessageMedia.fromFilePath(
            "./BanchoStickers/Bancho-14.png"
        );

        await client.sendMessage(message.from, stickerMedia, {
            sendMediaAsSticker: true,
            stickerName: "Bancho is angry",
            stickerAuthor: "Bancho",
        });
    }
    if (limit >= 500) {
        const stickerMedia = MessageMedia.fromFilePath(
            "./BanchoStickers/Bancho-5.png"
        );

        await client.sendMessage(message.from, stickerMedia, {
            sendMediaAsSticker: true,
            stickerName: "Bancho VERY ANGRY",
            stickerAuthor: "Bancho",
        });
    }

    const messages = await chat.fetchMessages({ limit: limit });
    const messagesList = messages
      .filter((message) => !message.fromMe && message.type === "chat")
      .map((message) => ({
        from: message._data.notifyName || message.author,
        body: message.body,
        timestamp: message.timestamp,
      }));
    const summary = await summarizeMessages(messagesList);
    message.reply(summary.summary);

    const stickerMedia = MessageMedia.fromFilePath(
      "./BanchoStickers/Bancho-" + summary.sticker + ".png"
    );
    await client.sendMessage(message.from, stickerMedia, {
      sendMediaAsSticker: true,
      stickerName: "Bancho",
      stickerAuthor: "Bancho",
    });

    const summaryChat = await client.getChatById(message.from); // this will be the group
    const groupName = summaryChat.name;

    client.sendMessage(
      botOwner,
      'Someone requested a summary on "' + groupName + '"'
    );
  }

  /* ===========================================
   ?           INFO COMMAND                  *
   ===========================================*/
  if ((messageData[0] === "-i" || messageData[0] === "--info") && !message.fromMe) {
    client.sendMessage(
      message.from,
      "Bot created by *Civer_mau!* \nCheck the github repo for more info: https://github.com/Civermau/whatsapp-summarizer-bot"
    );
  }

  /* ===========================================
   ?         VERSION COMMAND                 *
   ===========================================*/
  if ((messageData[0] === "-v" || messageData[0] === "--version") && !message.fromMe) {
    client.sendMessage(
      message.from,
      "v2.0.0 \nBancho can now send stickers!"
    );
  }

  // /* ===========================================
  //   ?      THURSDAY STICKER TEST COMMAND      *
  //  ===========================================*/
  // if ((messageData[0] === "--thursday" || messageData[0] === "--test-thursday") && !message.fromMe) {
  //   message.reply("Testing Thursday sticker...");
  //   sendThursdaySticker();
  // }

  // /* ===========================================
  //   ?      HALLOWEEN STICKER TEST COMMAND      *
  //  ===========================================*/
  // if ((messageData[0] === "--halloween" || messageData[0] === "--test-halloween") && !message.fromMe) {
  //   message.reply("Testing Halloween sticker...");
  //   sendHalloweenSticker();
  // }

  /* ===========================================
   ?         BANCHO AUDIO TRIGGER           *
   ===========================================*/
  if (message.body.includes("bancho") && !message.fromMe && pumCount > 2) {
    try {
      const audioMedia = MessageMedia.fromFilePath(
        "./BanchoStickers/BanchoAudio.mp3"
      );
      audioMedia.mimetype = "audio/mpeg";

      await client.sendMessage(message.from, audioMedia);
    } catch (error) {
      console.error("Error sending audio as document:", fallbackError);
      client.sendMessage(message.from, "Sorry, there was an error sending the audio.");
    }
  }

  /* ===========================================
   ?         @EVERYONE COMMAND               *
   ===========================================*/
  if (message.body.includes("@everyone") && !message.fromMe) {
    const chat = await message.getChat();

    let text = ''
    let mentions = []

    for (let participant of chat.participants) {
        mentions.push(`${participant.id.user}@c.us`);
        text += `@${participant.id.user} `;
    }

    try {
      const stickerMedia = MessageMedia.fromFilePath(
        "./BanchoStickers/Bancho-9.png"
      );

      await client.sendMessage(message.from, stickerMedia, {
        sendMediaAsSticker: true,
        stickerName: "Moshi Moshi",
        stickerAuthor: "Bancho",
        mentions: mentions,
      });
    } catch (error) {
      console.error("Error sending sticker:", error);
      client.sendMessage(message.from, "Sorry, there was an error sending the sticker.");
    }
  }

  /* ===========================================
   ?              Bot mentioned                  *
   ===========================================*/

  try {
    const mentions = await message.getMentions();
    if (mentions && Array.isArray(mentions) && mentions.some(mention => mention.id._serialized === client.info.wid._serialized)) {
      const stickers = [1, 2, 3, 4, 6, 12, 17, 20, 24];
      const randomSticker = stickers[Math.floor(Math.random() * stickers.length)];
      const stickerMedia = MessageMedia.fromFilePath(
        `./BanchoStickers/Bancho-${randomSticker}.png`
      );

      await client.sendMessage(message.from, stickerMedia, {
        sendMediaAsSticker: true,
        stickerName: "Bancho noticed you!",
        stickerAuthor: "Bancho"
      });
    }
  } catch (error) {
    console.error("Error checking mentions:", error);
  }

  pumCount = 0;
});


/* ************************************************
 *           CONNECTION HANDLERS                *
 *************************************************/
client.on("disconnected", () => {
  console.log("Client disconnected");
  // I mean, I can't send a message if the client is disconnected, so...
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.initialize();

/* ************************************************
 *         THURSDAY STICKER SCHEDULER           *
 *************************************************/
async function sendThursdaySticker() {
  console.log("Sending Thursday sticker...");
  
  try {
    // Choose your Thursday sticker (you can change the number to any sticker you prefer)
    const thursdaySticker = MessageMedia.fromFilePath(
      "./BanchoStickers/Bancho-13.png" // Change this number to your preferred Thursday sticker
    );

    // Send to bot owner
    await client.sendMessage(botOwner, thursdaySticker, {
      sendMediaAsSticker: true,
      stickerName: "Bancho is feeling racist",
      stickerAuthor: "Bancho",
    });

    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);
    
    for (const group of groups) {
      await client.sendMessage(group.id._serialized, thursdaySticker, {
        sendMediaAsSticker: true,
        stickerName: "Bancho is feeling racist",
        stickerAuthor: "Bancho",
      });
      
      // Optional: Add a small delay between group messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("Thursday sticker sent to all groups and bot owner!");
  } catch (error) {
    console.error("Error sending Thursday sticker:", error);
  }
}

// Schedule to run every Thursday at 9:00 AM
// Cron format: '0 9 * * 4' means: minute 0, hour 9, any day of month, any month, day 4 (Thursday)
// You can change the time by modifying the first two numbers (minute and hour)
cron.schedule('0 9 * * 4', () => {
  console.log('Thursday sticker scheduled task triggered');
  if (client.info && client.info.wid) {
    sendThursdaySticker();
  } else {
    console.log('Client not ready yet, skipping Thursday sticker');
  }
}, {
  timezone: "America/Mexico_City" // Change this to your timezone
});


/* ************************************************
 *         HALLOWEEN STICKER SCHEDULER           *
 *************************************************/
async function sendHalloweenSticker() {
  console.log("Sending Halloween sticker...");
  
  try {
    // Choose your Thursday sticker (you can change the number to any sticker you prefer)
    const thursdaySticker = MessageMedia.fromFilePath(
      "./BanchoStickers/Bancho-7.png" // Change this number to your preferred Thursday sticker
    );

    // Send to bot owner
    await client.sendMessage(botOwner, thursdaySticker, {
      sendMediaAsSticker: true,
      stickerName: "Bancho is scared",
      stickerAuthor: "Bancho",
    });

    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);
    
    for (const group of groups) {
      await client.sendMessage(group.id._serialized, thursdaySticker, {
        sendMediaAsSticker: true,
        stickerName: "Bancho is scared",
        stickerAuthor: "Bancho",
      });
      
      // Optional: Add a small delay between group messages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("Halloween sticker sent to all groups and bot owner!");
  } catch (error) {
    console.error("Error sending Halloween sticker:", error);
  }
}

// cron format means: minute 0, hour 9, day 31, month 10, day of week 0 (Sunday)
cron.schedule('0 9 31 10 *', () => {
  console.log('Halloween sticker scheduled task triggered');
  if (client.info && client.info.wid) {
    sendHalloweenSticker();
  } else {
    console.log('Client not ready yet, skipping Halloween sticker');
  }
}, {
  timezone: "America/Mexico_City" // Change this to your timezone
});


/* ************************************************
 *            HELPER FUNCTIONS                  *
 *************************************************/
async function summarizeMessages(messages) {
  const stringMessages = messages
    .map(
      (message) =>
        `${message.from}: ${message.body} (${new Date(
          message.timestamp * 1000
        ).toLocaleString()})`
    )
    .join("\n");
  console.log("Summary triggered, sending to OpenAI: \n" + stringMessages);

  const systemPrompt = `
  You are a helpful assistant that summarizes messages. You will be given a list of messages and you will need to summarize them. 
  the messages contain the sender's name, the message content, and the timestamp. the messages are in the order they were sent. 
  the summary should be in the same language as the messages.
  YOU SHOULD OUTPUT THE ANSWER IN JSON FORMAT.
  An example of the JSON format is:
  {
    "summary": "Here is the summary of the messages",
    "sticker": "Here is the sticker of the messages"
  }
  The sticker MUST be a single ID, this are the IDs:
  - 18 Conversation in general is sad
  - 19 Conversation is funny or is making fun of someone
  - 23 Conversation is very dark, like they are arguing, or something very dark had been said
  - 15 Conversation is weird and random, not without an specific topic or subject

  Remember very important, the summary should be in the same language as the messages.
  `;

  const response = await openai.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: stringMessages,
      },
    ],
    response_format: { type: "json_object" },
  });
  console.log("OpenAI response: \n" + response.choices[0].message.content);

  const jsonResponse = JSON.parse(response.choices[0].message.content);
  return {
    summary: jsonResponse.summary,
    sticker: jsonResponse.sticker
  };
}

function countPum(message) {
  return message.body.split("pum").length - 1;
}