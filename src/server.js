import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { initOCR } from "./ocr.js";
import webhookRouter from "./webhook.js";

const app = express();
app.use(express.json());

const PORT = 3000;

async function startServer() {
  try {
    console.log("Initializing OCR...");
    await initOCR();
    console.log("OCR ready.");

    app.use("/webhook", webhookRouter);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("Startup failed:", err);
    process.exit(1);
  }
}

startServer();