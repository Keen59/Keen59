import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import { fold, kindOf } from "../lib/withdraw.js";
import { parseBuffer } from "../lib/parse.js";

const html = `<!DOCTYPE html><html><head><title>Pending follow requests</title></head><body>
<h1>Pending follow requests</h1>
<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">
  <h2 class="_3-95 _2pim _a6-h _a6-i">alice</h2>
  <div class="_3-95 _2pim _a6-h _a6-i">Oct 01, 2024 1:23 pm</div>
</div>
<div>
  <h2 class="_3-95 _2pim _a6-h _a6-i">bob.smith</h2>
  <div class="_3-95 _2pim _a6-h _a6-i">Oct 02, 2024 4:00 pm</div>
</div>
<a href="https://www.instagram.com/explore/">Explore</a>
<a href="https://www.instagram.com/_u/user_3">user_3</a>
<a href="https://www.instagram.com/_u/alice">alice</a>
</body></html>`;

const plain = `<html><body>
<div class="_3-95 _2pim _a6-h _a6-i">cem_reels</div>
<div class="_3-95 _2pim _a6-h _a6-i">Oct 03, 2024 9:00 am</div>
</body></html>`;
const plainResult = parseBuffer("istekler.html", Buffer.from(plain, "utf8"));
assert.deepEqual(plainResult.usernames, ["cem_reels"]);
assert.equal(plainResult.trusted, true);

const htmlResult = parseBuffer("pending_follow_requests.html", Buffer.from(html, "utf8"));
assert.deepEqual(htmlResult.usernames, ["alice", "bob.smith", "user_3"]);
assert.equal(htmlResult.trusted, true);

const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(html, "utf16le")]);
const utf16Result = parseBuffer("pending_follow_requests.html", utf16);
assert.deepEqual(utf16Result.usernames, ["alice", "bob.smith", "user_3"]);

const json = {
  relationships_follow_requests_sent: [
    { string_list_data: [{ href: "https://www.instagram.com/_u/zeynep", value: "zeynep", timestamp: 1 }] },
  ],
  relationships_followers: [
    { string_list_data: [{ href: "https://www.instagram.com/_u/notme", value: "notme", timestamp: 1 }] },
  ],
};
const jsonResult = parseBuffer("pending_follow_requests.json", Buffer.from(JSON.stringify(json), "utf8"));
assert.deepEqual(jsonResult.usernames, ["zeynep"]);

const followers = parseBuffer(
  "followers_1.json",
  Buffer.from(
    JSON.stringify({
      relationships_followers: [{ string_list_data: [{ href: "https://www.instagram.com/_u/notme", value: "notme" }] }],
    }),
    "utf8"
  )
);
assert.deepEqual(followers.usernames, []);

const received = `<html><head><title>Follow requests you've received</title></head><body><h2>someone</h2></body></html>`;
const receivedResult = parseBuffer("follow_requests_received.html", Buffer.from(received, "utf8"));
assert.deepEqual(receivedResult.usernames, []);

const zip = new AdmZip();
zip.addFile(
  "connections/followers_and_following/pending_follow_requests.json",
  Buffer.from(JSON.stringify(json), "utf8")
);
zip.addFile(
  "connections/followers_and_following/followers_1.json",
  Buffer.from(JSON.stringify({ relationships_followers: [{ string_list_data: [{ value: "ignore.me" }] }] }), "utf8")
);
const zipResult = parseBuffer("instagram.zip", zip.toBuffer());
assert.deepEqual(zipResult.usernames, ["zeynep"]);

assert.equal(kindOf("İstek Gönderildi"), "requested");
assert.equal(kindOf("Requested"), "requested");
assert.equal(kindOf("Takip Et"), "follow");
assert.equal(kindOf("Takiptesin"), "following");
assert.equal(kindOf("Takibi Bırak"), "unfollow");
assert.equal(kindOf("Sen de Takip Et"), "follow");
assert.equal(fold("İstek Gönderildi"), "istek gönderildi");

console.log("parse tests passed");
