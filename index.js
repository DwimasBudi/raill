const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fetch = require('node-fetch');
const qrcode = require('qrcode-terminal');

// Inisialisasi WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox'],
    }
});

// API Key Groq
const GROQ_API_KEY = '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';

// Set untuk menyimpan ID pesan yang sudah diproses
const processedMessages = new Set();

// Generate QR Code untuk login
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code telah digenerate, silakan scan menggunakan WhatsApp Anda!');
});

client.on('ready', () => {
    console.log('Client sudah siap!');
});

// Fungsi untuk delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fungsi untuk encode gambar ke base64
function encodeImage(imagePath) {
    const imageData = fs.readFileSync(imagePath);
    return imageData.toString('base64'); // Encode ke base64
}

// Fungsi untuk mendapatkan jawaban dari Groq berdasarkan gambar
async function imageAnswer(imageBase64, userPrompt) {
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            { "type": "text", "text": userPrompt },
                            { "type": "image_url", "image_url": { "url": `data:image/jpeg;base64,${imageBase64}` } }
                        ]
                    }
                ],
                "model": "llama-3.2-90b-vision-preview",
                "max_tokens": 4000
            })
        });

        const data = await response.json();
        return data.choices[0]?.message?.content || "Tidak ada jawaban yang ditemukan dari Groq.";
    } catch (error) {
        console.error("Fetch error: ", error);
        return "Error: Failed to fetch data from Groq.";
    }
}

// Fungsi untuk mendapatkan jawaban teks dari Groq
async function textAnswer(question) {
    try {
        console.log("Sending question to Groq: ", question);
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                "messages": [
                    {
                        "role": "user",
                        "content": question
                    }
                ],
                "model": "llama-3.1-70b-versatile",
                "max_tokens": 4000
            })
        });

        const data = await response.json();
        console.log("Groq Response: ", data);

        if (response.ok) {
            const bestAnswer = data.choices[0]?.message?.content.trim();
            return bestAnswer;
        } else {
            console.error("Groq API Error: ", data.error);
            return `Error: ${data.error?.message || "Unable to get answer from Groq."}`;
        }
    } catch (error) {
        console.error("Fetch error: ", error);
        return "Error: Failed to fetch data from Groq.";
    }
}

// Handle pesan masuk
client.on('message', async (message) => {
    try {
        // Cek apakah pesan sudah diproses
        if (processedMessages.has(message.id)) {
            return; // Lewati jika pesan sudah diproses
        }
        
        // Tambahkan ID pesan ke set
        processedMessages.add(message.id);

        // Cek apakah pesan diawali dengan '.'
        if (message.body.startsWith('.')) {
            if (message.hasMedia) {
                const media = await message.downloadMedia();

                // Tentukan path untuk menyimpan gambar
                const imagePath = path.join(__dirname, 'downloaded_image.jpg');

                // Simpan gambar di disk
                fs.writeFileSync(imagePath, media.data, { encoding: 'base64' });

                // Encode gambar ke base64
                const imageBase64 = encodeImage(imagePath);

                // Ambil isi pesan dari pengguna untuk dijadikan prompt
                const userPrompt = message.body.slice(1).trim(); // Ambil prompt tanpa tanda '.'

                // Dapatkan jawaban dari Groq menggunakan prompt kustom
                const answer = await imageAnswer(imageBase64, userPrompt);

                // Kirim jawaban ke pengguna
                await message.reply(answer);
                
                // Hapus gambar setelah digunakan
                fs.unlinkSync(imagePath);
                console.log(`Gambar dihapus: ${imagePath}`);

            } else {
                console.log('Pesan bukan berupa gambar.');
                await message.reply("Silakan kirimkan gambar untuk dijelaskan.");
            }
        } else if (message.body.startsWith('/')) {
            const question = message.body.slice(1).trim(); // Ambil prompt tanpa tanda '/'

            console.log("Processing question: ", question);

            // Dapatkan jawaban dari Groq
            const answer = await textAnswer(question);
        
            // Tambahkan delay random antara 1-3 detik untuk terlihat lebih natural
            await delay(Math.random() * 2000 + 1000);
            
            // Kirim jawaban
            await message.reply(answer);
        
            console.log("Reply sent successfully");
        } else {
            console.log('Pesan tidak diawali dengan ". /".');
            // Anda bisa mengabaikan pesan atau memberikan respons lain jika diperlukan
        }
    } catch (error) {
        console.error("Error processing message: ", error);
        await message.reply("Maaf, terjadi kesalahan dalam memproses pesan Anda.");
    }
});

// Inisialisasi client
client.initialize();
