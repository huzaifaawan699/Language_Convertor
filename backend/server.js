import express from 'express';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg'; // For video/audio processing
import FormData from 'form-data';
import cors from 'cors'; // CORS for cross-origin requests

dotenv.config();

const app = express();
const upload = multer({ dest: 'uploads/' }); // Define upload destination

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;

// Define Eleven Labs API URLs
const ELEVEN_LABS_API_URL_VOICE_GENERATE = `https://api.elevenlabs.io/v1/voices/generate`;
const ELEVEN_LABS_API_URL_VOICE_CLONE = (voiceId) => `https://api.elevenlabs.io/v1/voices/${voiceId}/clone`;
const ELEVEN_LABS_API_URL_TRANSLATE = (voiceId) => `https://api.elevenlabs.io/v1/voices/${voiceId}/translate`;

app.use(cors()); // Enable CORS for all routes
app.use(express.json());
app.use(express.static(path.join(process.cwd(), '../frontend/dist'))); // Serve frontend files

// Health check route
app.get('/api/status', (req, res) => {
    res.status(200).send('Server is running and ready to process requests.');
});

// File upload and processing route
app.post('/api/upload', upload.single('file'), async (req, res) => {
    const videoFile = req.file;
    const { language } = req.body;

    // Validate uploaded file and request parameters
    if (!videoFile) {
        return res.status(400).send('No video file uploaded');
    }
    if (!language) {
        return res.status(400).send('No target language specified');
    }

    console.log('Received file:', videoFile);
    console.log('Selected language:', language);

    try {
        // Step 1: Generate a new voice ID using Eleven Labs API
        const generateVoiceResponse = await axios.post(ELEVEN_LABS_API_URL_VOICE_GENERATE, {
            name: 'Generated Voice',
            description: 'Voice generated automatically from uploaded file.',
        }, {
            headers: {
                'Authorization': `Bearer ${ELEVEN_LABS_API_KEY}`,
            },
        });

        const voiceId = generateVoiceResponse.data?.id; // Retrieve generated voice ID
        if (!voiceId) {
            throw new Error(`Voice generation failed: ${JSON.stringify(generateVoiceResponse.data)}`);
        }
        console.log('Voice generated successfully. ID:', voiceId);

        // Step 2: Clone the voice using the generated voice ID
        const cloneFormData = new FormData();
        cloneFormData.append('file', fs.createReadStream(videoFile.path));

        const cloneResponse = await axios.post(ELEVEN_LABS_API_URL_VOICE_CLONE(voiceId), cloneFormData, {
            headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${ELEVEN_LABS_API_KEY}`,
            },
        });

        const clonedVoiceUrl = cloneResponse.data?.clonedAudioUrl;
        if (!clonedVoiceUrl) {
            throw new Error(`Voice cloning failed: ${JSON.stringify(cloneResponse.data)}`);
        }
        console.log('Voice cloned successfully. URL:', clonedVoiceUrl);

        // Step 3: Translate the cloned voice to the specified language
        const translateResponse = await axios.post(ELEVEN_LABS_API_URL_TRANSLATE(voiceId), {
            sourceAudioUrl: clonedVoiceUrl,
            targetLanguage: language,
        }, {
            headers: {
                'Authorization': `Bearer ${ELEVEN_LABS_API_KEY}`,
            },
        });

        const translatedVoiceUrl = translateResponse.data?.translatedAudioUrl;
        if (!translatedVoiceUrl) {
            throw new Error(`Voice translation failed: ${JSON.stringify(translateResponse.data)}`);
        }
        console.log('Voice translated successfully. URL:', translatedVoiceUrl);

        // Step 4: Download the translated audio file
        const translatedAudioPath = path.join('uploads', `translated_${Date.now()}.mp3`);
        const writer = fs.createWriteStream(translatedAudioPath);
        const audioDownloadResponse = await axios({
            url: translatedVoiceUrl,
            method: 'GET',
            responseType: 'stream',
        });

        audioDownloadResponse.data.pipe(writer);

        writer.on('finish', async () => {
            try {
                if (videoFile.mimetype.startsWith('video/')) {
                    // Step 5: Combine the original video with the translated audio (if necessary)
                    await new Promise((resolve, reject) => {
                        ffmpeg(videoFile.path)
                            .input(translatedAudioPath)
                            .audioCodec('aac')
                            .outputOptions('-strict', 'experimental')
                            .save(path.join('uploads', `output_video_${Date.now()}.mp4`))
                            .on('end', () => resolve())
                            .on('error', (err) => reject(err));
                    });
                    res.download(path.join('uploads', `output_video_${Date.now()}.mp4`), (err) => {
                        if (err) {
                            console.error('Error sending video file:', err);
                        }
                    });
                } else {
                    // Send the translated audio file directly
                    res.download(translatedAudioPath, (err) => {
                        if (err) {
                            console.error('Error sending audio file:', err);
                        }
                    });
                }
            } catch (error) {
                console.error('Error during file processing:', error);
                res.status(500).send('Error processing the translated audio/video: ' + error.message);
            }
        });

        writer.on('error', (error) => {
            console.error('Error during audio download:', error);
            res.status(500).send('Error downloading the translated audio: ' + error.message);
        });
    } catch (error) {
        console.error('Error during voice processing:', error.response?.data || error.message);
        res.status(500).send('Error processing the video/audio: ' + error.message);
    }
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
