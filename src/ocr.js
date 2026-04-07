// import sharp from "sharp";
// import { createWorker } from "tesseract.js";

// let worker;

// export async function initOCR() {
// 	worker = await createWorker("eng");
// }

// async function preprocessBuffer(buffer) {
// 	const stats = await sharp(buffer)
// 		.grayscale()
// 		.stats();

// 	const avgIntensity = stats.channels[0].mean;
// 	const isDark = avgIntensity < 128;

// 	let pipeline = sharp(buffer).grayscale();

// 	// Only apply threshold on dark/negated images
// 	if (isDark) {
// 		pipeline = pipeline.negate().threshold(130);
// 	} else {
// 		pipeline = pipeline; // skip threshold for light backgrounds
// 	}

// 	return await pipeline.resize({ width: 2000 }).toBuffer();
// }

// export async function processImage(input) {
// 	if (!worker) {
// 		throw new Error("OCR worker not initialized. Call initOCR() first.");
// 	}

// 	const buffer =
// 		typeof input === "string"
// 			? await sharp(input).toBuffer()
// 			: input;

// 	const processedBuffer = await preprocessBuffer(buffer);

// 	const {
// 		data: { text },
// 	} = await worker.recognize(processedBuffer);

// 	return text;
// }

import sharp from "sharp";
import { createWorker } from "tesseract.js";

let worker;

export async function initOCR() {
    worker = await createWorker("eng");
    
    // We only set PSM 11 (Sparse Text) here. 
    // Do NOT use a char_whitelist, otherwise parser.js won't be able to read dates, UPI labels, or App names.
    await worker.setParameters({
        tessedit_pageseg_mode: '11' 
    });
}

async function preprocessBuffer(buffer) {
    const stats = await sharp(buffer)
        .grayscale()
        .stats();

    const avgIntensity = stats.channels[0].mean;
    const isDark = avgIntensity < 128;

    // Start pipeline: Grayscale -> Normalize (stretches contrast) -> Resize (helps with small text)
    let pipeline = sharp(buffer)
        .grayscale()
        .normalize() 
        .resize({ width: 2000 }); 

    if (isDark) {
        // Negate dark mode screenshots to white background, then threshold
        pipeline = pipeline.negate().threshold(150); 
    } else {
        // Threshold light backgrounds to remove subtle UI gradients/artifacts
        pipeline = pipeline.threshold(150); 
    }

    // Returning a PNG buffer prevents lossy JPEG compression artifacts from confusing Tesseract
    return await pipeline.png().toBuffer();
}

export async function processImage(input) {
    if (!worker) {
        throw new Error("OCR worker not initialized. Call initOCR() first.");
    }

    const buffer = typeof input === "string" 
        ? await sharp(input).toBuffer() 
        : input;

    const processedBuffer = await preprocessBuffer(buffer);

    const { data: { text } } = await worker.recognize(processedBuffer);

    return text;
}