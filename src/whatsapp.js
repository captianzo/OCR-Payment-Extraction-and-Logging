import axios from "axios";

const GRAPH_API_VERSION = "v19.0";

export async function downloadWhatsAppMedia(mediaId) {
	const token = process.env.WHATSAPP_TOKEN;

	if (!token) {
		throw new Error("WHATSAPP_TOKEN not set in .env");
	}

	const metaResponse = await axios.get(
		`https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
		{
			headers: {
				Authorization: `Bearer ${token}`
			}
		}
	);

	const mediaUrl = metaResponse.data.url;

	const fileResponse = await axios.get(mediaUrl, {
		headers: {
			Authorization: `Bearer ${token}`
		},
		responseType: "arraybuffer"
	});

	return Buffer.from(fileResponse.data);
}