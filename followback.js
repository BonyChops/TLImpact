require("dotenv").config();
const { TwitterApi } = require("twitter-api-v2");


const devlog = (data) => {
    if (process.env.DEV === "TRUE") {
        console.log(data);
    }
}

const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_KEY_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

(async () => {
    const followersIterator = await client.v2.followers(process.env.BOT_ID, { asPaginator: true, max_results: 1000 });
    const followers = [];
    for await (const follower of followersIterator) {
        followers.push(follower);
    }
    const followingsIterator = await client.v2.following(process.env.BOT_ID, { asPaginator: true, max_results: 1000 });
    const followings = [];
    for await (const following of followingsIterator) {
        followings.push(following);
    }
    devlog(followersIterator.rateLimit);
    devlog(followingsIterator.rateLimit);
    const remainUsers = followers.filter(v => !followings.map(v => v.id).includes(v.id));
    devlog(remainUsers);
    let count = 0;
    for (const user of remainUsers) {
        const result = await client.v2.follow(process.env.BOT_ID, user.id);
        count += 1;
        if (count >= 50) {
            break;
        }
    }
})();