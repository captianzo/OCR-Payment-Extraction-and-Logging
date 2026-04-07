import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const auth = new google.auth.GoogleAuth({
	scopes: SCOPES
});

const sheets = google.sheets({ version: "v4", auth });

export async function appendTransactionRow({
	payeeName = "",
	amount = "",
	date,
	time,
	upiTransactionId,
	source = "Unknown"
}) {
	const spreadsheetId = process.env.SPREADSHEET_ID;

	if (!spreadsheetId) {
		throw new Error("SPREADSHEET_ID env variable not set");
	}

	const values = [[
		payeeName,
		amount,
		date,
		time,
		upiTransactionId,
		source
	]];

	console.log("Appending to: ", "PaymentLogs");

	await sheets.spreadsheets.values.append({
		spreadsheetId,
		range: "PaymentLogs!A1",
		valueInputOption: "RAW",
		insertDataOption: "INSERT_ROWS",
		requestBody: { values }
	});
}
