const express = require('express');
const multer = require('multer');
const app = express();
const PORT = 80;

const process = require('process');
const fs = require("fs");
const path = require("path");
const envPath = path.resolve(__dirname, ".env");

if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");

    envFile.split("\n").forEach(line => {
        if (line.trim() && !line.startsWith("#")) {
            const [key, ...rest] = line.split("=");
            let value = rest.join("=").trim();

            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }

            process.env[key.trim()] = value;
        }
    });
}


const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.api_key });
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/"); // pasta onde vai salvar
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // exemplo: 1693423434.mp3
    },
});
const upload = multer({ storage });


app.post('/transcribe', upload.single("audio"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "Nenhum arquivo enviado" });
        }
        const filePath = req.file.path;
        console.log(filePath)
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "gpt-4o-transcribe",
        });

        fs.unlink(filePath, (err) => {
            if (err) console.error("Erro ao apagar arquivo temporário:", err);
        });

        res.json({ text: transcription.text });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao transcrever áudio" });
    }
});

async function speech(text) {
    const speechFile = path.resolve("./generate/speech.mp3");
    const mp3 = await openai.audio.speech.create({
        model: "gpt-4o-mini-tts",
        voice: "alloy",
        input: text,
    });
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(speechFile, buffer);
    return speechFile;
}

app.post('/request', async (req, res) => {
    try {
        const text = req.body; 
        console.log(text);

        const response = await openai.responses.create({
            model: "gpt-4.1",
            input: `Você é um assistente(chamado PragaID) de análise preditiva de pragas numa plantação de milho ou soja(Se citar, você deve deixar implicito). Você será responsável em identificar indícios de manifestações de pragas de maneira indireta, ou seja, 
        logo no começo. Seja direto e objetivo, voltado ao pessoal do campo. Como no exemplo: 
        '⚠️ Formiga ou joaninha aparecendo demais → pode ser pulgão chegando. 👉 Me mande foto da parte de baixo da folha nova.'
        Prompt: ${text}`
        });

        //await speech(response["output_text"]);
        res.json({text: response["output_text"]});
    } catch (error) {
        console.error("Erro na rota /request:", error);
        res.status(500).json({ error: "Falha ao processar a requisição." });
    }
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
})

app.listen(PORT, '0.0.0.0', () => {
    console.log("Sistema está rodando na porta " + PORT);
});