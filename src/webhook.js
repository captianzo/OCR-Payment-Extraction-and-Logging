import express from "express";
import { processImage } from "./ocr.js";
import { extractTransactionData } from "./parser.js";
import { appendTransactionRow } from "./sheets.js";
import { downloadWhatsAppMedia } from "./whatsapp.js";

const router = express.Router();

router.get("/", (req, res) => {
  const verifyToken = process.env.WEBHOOK_VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post("/", async (req, res) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    // TEXT MESSAGE → store payee
    if (message.type === "text") {
      global.lastPayeeName = message.text.body;
      console.log("Stored payee:", global.lastPayeeName);
      return res.sendStatus(200);
    }

    const mediaId = message.image.id;

    const buffer = await downloadWhatsAppMedia(mediaId);

    const ocrText = await processImage(buffer);

    const result = extractTransactionData(ocrText);

    const payeeName = global.lastPayeeName || "";

    if (result.status === "ok") {
      await appendTransactionRow({
        payeeName,
        amount: result.data.amount || "",
        date: result.data.date,
        time: result.data.time,
        upiTransactionId: result.data.upiTransactionId,
        source: result.data.source
      });

      global.lastPayeeName = null;

      console.log("Transaction logged to Sheets");
    }

    res.sendStatus(200);

  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(500);
  }
});

export default router;