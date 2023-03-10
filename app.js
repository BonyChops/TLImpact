require("dotenv").config();
const { TwitterApi, EUploadMimeType } = require("twitter-api-v2");
const { execSync } = require('child_process');
const twitter = require("twitter-text");
const shellEscape = require("shell-escape");
const exec = (command) => {
    try {
        return execSync(command).toString().trim();
    } catch (e) {
        console.error(e.message);
    }
}

const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/g;

const getRandomInt = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min) + min); // The maximum is exclusive and the minimum is inclusive
}

const devlog = (data) => {
    if (process.env.DEV === "TRUE") {
        console.dir(data, { depth: 4 });
    }
}

const generateSd = (text) => {
    const job = (text) => exec(shellEscape([`${__dirname}/echo-sd`, ...text.split("\n")]));
    let textBuf = text;
    let result = job(textBuf);
    if(twitter.parseTweet(result).valid){
        return result;
    }

    do{
        textBuf = textBuf.substring(0, textBuf.length - 1);
        result = job(textBuf + "(文字数)");
    }while(!twitter.parseTweet(result).valid);
    return result;
}

const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_KEY_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

//const twitterClient = new TwitterApi(process.env.TWITTER_BEARER_TOKEN);



(async () => {
    const homeTimeline = await client.v2.homeTimeline({ exclude: ['replies', "retweets"], max_results: 100, expansions: ["author_id", "attachments.media_keys"], "user.fields": ["name", "profile_image_url", "id", "protected", "username"], "media.fields": ["type", "url"] });
    const likedTweetData = await client.v2.userLikedTweets(process.env.BOT_ID, {max_results: 100});
    const likedTweets = likedTweetData.tweets;
    const tweets = homeTimeline.tweets.filter(v => v.author_id !== process.env.BOT_ID && v.attachments?.media_keys && !likedTweets.map(v => v.id).includes(v.id))
    devlog(tweets);
    devlog(homeTimeline.rateLimit);
    const tweet = process.env.TWEET_ID ? tweets.find(v => v.id === process.env.TWEET_ID) : tweets[getRandomInt(0, tweets.length)];
    if (!tweet) {
        process.exit(0);
    }
    const media = homeTimeline.includes.medias(tweet);
    devlog(tweet);
    devlog(media);
    const filepaths = media.filter(v => v.type === "photo").map((v) => {
        const fromPath = exec("mktemp");
        const toPath = exec("mktemp") + ".jpg";
        exec(`wget -q -O ${fromPath} '${v.url}'`);
        exec(`${__dirname}/zoomblur -a 1.05 '${fromPath}' '${toPath}'`);
        return toPath;
    });
    const textWithoutUrls = tweet.text.replace(urlRegex, '').trim();
    const sd = textWithoutUrls === "" ? "" : generateSd(textWithoutUrls);
    console.log(sd);


    if (process.env.MODE === "test") {
        process.exit(0);
    }

    devlog(filepaths);

    const mediaIds = await Promise.all(filepaths.map(async(filepath) => client.v1.uploadMedia(filepath, { mimeType: EUploadMimeType.Jpeg })));

    await client.v2.tweet({ text: sd, media: { media_ids: mediaIds } });
    await client.v2.like(process.env.BOT_ID, tweet.id);
})();