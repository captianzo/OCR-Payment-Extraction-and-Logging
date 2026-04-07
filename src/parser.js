function getNextNonEmptyLine(lines, startIndex) {
    for (let i = startIndex + 1; i < lines.length; i++) {
        if (lines[i].trim() !== "") {
            return lines[i].trim();
        }
    }
    return null;
}

function extractUpiTransactionId(text) {
    const lines = text.split("\n");

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].toLowerCase(); 

        if (line.includes("upi") && line.includes("transaction")) {
            const candidate = getNextNonEmptyLine(lines, i);

            if (candidate && /^\d+$/.test(candidate)) {
                return candidate;
            }
        }
    }
    return null;
}

function extractDateTime(text) {
    const regex = /(\d{1,2}\s[A-Za-z]{3}\s\d{4}),\s(\d{1,2}:\d{2}\s?(?:am|pm))/i;
    const match = text.match(regex);

    if (!match) {
        return { date: null, time: null };
    }

    return {
        date: match[1],
        time: match[2],
    };
}

function validateUpiTransactionId(id) {
    if (!id) return false;
    if (!/^\d+$/.test(id)) return false;
    if (id.length < 10 || id.length > 20) return false;
    return true;
}

function normalizeDate(dateStr) {
    if (!dateStr) return null;

    const parts = dateStr.split(" ");
    if (parts.length !== 3) return null;

    const day = parts[0].padStart(2, "0");
    const monthStr = parts[1].toLowerCase();
    const year = parts[2];;

    const monthMap = {
        jan: "01", feb: "02", mar: "03", apr: "04",
        may: "05", jun: "06", jul: "07", aug: "08",
        sep: "09", oct: "10", nov: "11", dec: "12"
    };

    const month = monthMap[monthStr.slice(0, 3)];
    if (!month) return null;

    return `${day}-${month}-${year}`;
}

function normalizeTime(timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})\s?(am|pm)/i);
    if (!match) return null;

    let hour = parseInt(match[1], 10);
    const minute = match[2];
    const period = match[3].toLowerCase();

    if (period === "pm" && hour !== 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;

    return `${hour.toString().padStart(2, "0")}:${minute}`;
}

function detectSource(text) {
    const t = text.toLowerCase();

    if (t.includes("google pay") || t.includes("gpay")) return "Google Pay";
    if (t.includes("phonepe")) return "PhonePe";
    if (t.includes("paytm")) return "Paytm";

    return "Unknown";
}

function extractAmount(text) {
    // --- Phase 1: Targeted Regex Attempt ---
    // Look for ₹ or common misinterpretations (F, R, E, z) followed by formatted numbers
    const amountRegex = /[₹FREz]\s*([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{2})?)/i;
    const match = text.match(amountRegex);
    
    if (match && match[1]) {
        const amountStr = match[1].replace(/,/g, "");
        const parsed = parseFloat(amountStr);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 999999) {
            console.log("Regex extracted amount:", parsed);
            return String(parsed);
        }
    }

    // --- Phase 2: Fallback (Corrected) ---
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const candidates = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lowerLine = line.toLowerCase();

        // FIX 1: Explicitly ignore lines that contain bank or account indicators
        if (lowerLine.includes("bank") || lowerLine.includes("account") || lowerLine.includes("a/c")) {
            continue;
        }

        // Strip any leading currency symbols/garbage OCR chars, keep digits , and .
        const cleaned = line
            .replace(/^[^0-9,\.]+/, "")  
            .replace(/[^0-9,\.]/g, "")   
            .trim();

        if (!cleaned) continue;

        if (!/^\d{1,3}(,\d{3})*(\.\d{1,2})?$/.test(cleaned) &&
            !/^\d{1,6}(\.\d{1,2})?$/.test(cleaned)) continue;

        const amount = parseFloat(cleaned.replace(/,/g, ""));

        if (amount < 1 || amount > 999999) continue;

        const prevLine = i > 0 ? lines[i - 1].toLowerCase() : "";
        if (prevLine.includes("transaction id") || prevLine.includes("google transaction")) continue;
        
        // Skip years (2025, 2026)
        if (amount >= 2000 && amount <= 2100 && cleaned.length === 4) continue;

        // Keep track of whether the original line had a comma
        candidates.push({ line, amount, index: i, hasComma: line.includes(",") });
    }

    if (candidates.length === 0) {
        console.log("No amount candidates found.");
        return null;
    }

    // FIX 2: If any candidate has a comma (e.g., "1,049"), it is almost certainly the amount.
    const commaCandidates = candidates.filter(c => c.hasComma);
    if (commaCandidates.length > 0) {
        // Sort by index to get the first comma-formatted number
        commaCandidates.sort((a, b) => a.index - b.index);
        console.log("Fallback selected amount (comma formatted):", commaCandidates[0].amount);
        return String(commaCandidates[0].amount);
    }

    // FIX 3: Instead of picking the *largest* number, pick the *first* valid number.
    // In UI layouts, the payment amount is always displayed at the top, before the payment method.
    const pool = candidates.filter(c => c.index < lines.length / 2);
    const finalCandidates = pool.length > 0 ? pool : candidates;
    
    // Sort by index (appearance order) instead of amount
    finalCandidates.sort((a, b) => a.index - b.index);

    console.log("Fallback selected amount (first match):", finalCandidates[0].amount);
    return String(finalCandidates[0].amount);
}

function validateAndNormalize(extracted) {
    const { upiTransactionId, date, time } = extracted;

    if (!validateUpiTransactionId(upiTransactionId)) {
        return { status: "error", reason: "invalid_upi_transaction_id" };
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
        return { status: "error", reason: "invalid_date" };
    }

    const normalizedTime = normalizeTime(time);
    if (!normalizedTime) {
        return { status: "error", reason: "invalid_time" };
    }

    return {
        status: "ok",
        data: {
            upiTransactionId,
            date: normalizedDate,
            time: normalizedTime
        }
    };
}

export function extractTransactionData(ocrText) {
    const extracted = {
        upiTransactionId: extractUpiTransactionId(ocrText),
        ...extractDateTime(ocrText),
        amount: extractAmount(ocrText)
    };

    const source = detectSource(ocrText);
    const result = validateAndNormalize(extracted);

    if (result.status !== "ok") {
        return result;
    }

    return {
        status: "ok",
        data: {
            ...result.data,
            amount: extracted.amount,
            source
        }
    };
}