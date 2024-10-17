const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fetch = require('node-fetch');

// Buat instance WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox'],
    }
});

// Konfigurasi Groq API
const GROQ_API_KEY = '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';

// Generate QR Code untuk login
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code telah digenerate, silakan scan menggunakan WhatsApp Anda!');
});

// Ketika client sudah siap
client.on('ready', () => {
    console.log('Client sudah siap!');
});

// Fungsi untuk mendapatkan jawaban dari Groq
async function getBestAnswerFromGroq(question) {
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
        console.log("Received message: ", message.body);
        
        // Hanya proses pesan yang dimulai dengan '/'
        if (!message.body.startsWith('/')) {
            console.log("Message ignored - doesn't start with '/'");
            return;
        }

        // Ambil pertanyaan (hapus tanda '/' di awal)
        const question = message.body.slice(1).trim();
        
        // Jika pertanyaan kosong setelah menghapus '/', abaikan
        if (!question) {
            console.log("Empty question after removing '/' - ignored");
            return;
        }

        console.log("Processing question: ", question);

        // Dapatkan jawaban dari Groq
        const answer = await getBestAnswerFromGroq(question);
        
        // Tambahkan delay random antara 1-3 detik untuk terlihat lebih natural
        await delay(Math.random() * 2000 + 1000);
        
        // Kirim jawaban
        await message.reply(answer);
        
        console.log("Reply sent successfully");

    } catch (error) {
        console.error("Error processing message: ", error);
        message.reply("Maaf, terjadi kesalahan dalam memproses pesan Anda.");
    }
});

// Error handling
client.on('auth_failure', msg => {
    console.error('Autentikasi gagal:', msg);
});

client.on('disconnected', (reason) => {
    console.log('Client terputus:', reason);
});

// Fungsi helper untuk delay
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle error yang tidak tertangkap
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Inisialisasi client
client.initialize();