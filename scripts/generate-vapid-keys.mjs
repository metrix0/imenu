import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
});

const publicJwk = publicKey.export({ format: "jwk" });
if (!publicJwk.x || !publicJwk.y) {
    throw new Error("Could not export the VAPID public key.");
}

const publicKeyBytes = Buffer.concat([
    Buffer.from([0x04]),
    Buffer.from(publicJwk.x, "base64url"),
    Buffer.from(publicJwk.y, "base64url"),
]);
const privatePem = privateKey.export({
    format: "pem",
    type: "pkcs8",
});

console.log("Add these variables to Vercel Production, Preview and Development:\n");
console.log(`VAPID_PUBLIC_KEY=${publicKeyBytes.toString("base64url")}`);
console.log("VAPID_PRIVATE_KEY=\n" + privatePem.trim());
console.log("VAPID_SUBJECT=mailto:suporte@imenuapp.com.br");
