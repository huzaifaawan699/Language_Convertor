import React, { useState } from 'react';
import axios from 'axios';

const App = () => {
    const [videoFile, setVideoFile] = useState(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [selectedLanguage, setSelectedLanguage] = useState('');
    const [loading, setLoading] = useState(false);

    const languages = [
        { code: 'en', name: 'English' },
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'it', name: 'Italian' },
    ];

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        validateFile(file);
    };

    const validateFile = (file) => {
        if (file && (file.type.startsWith('video/') || file.type.startsWith('audio/'))) {
            setVideoFile(file);
            setStatusMessage('');
        } else {
            setStatusMessage('Please upload a valid video or audio file (e.g., MP4, MOV, MP3).');
            setVideoFile(null);
        }
    };

    const handleUpload = async () => {
        if (!videoFile || !selectedLanguage) {
            setStatusMessage('Please upload a file and select a language.');
            return;
        }

        const formData = new FormData();
        formData.append('file', videoFile);
        formData.append('language', selectedLanguage);

        setLoading(true);
        setStatusMessage('Uploading and processing...');

        try {
            const response = await axios.post('http://localhost:5000/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', videoFile.type.startsWith('video/') ? 'output_video.mp4' : 'translated_audio.mp3');
            document.body.appendChild(link);
            link.click();

            setStatusMessage('Download complete.');
            resetForm();
        } catch (error) {
            console.error('Error during file upload or processing:', error);
            setStatusMessage('Error processing the file. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setVideoFile(null);
        setSelectedLanguage('');
        setStatusMessage(''); // Clear the status message after reset
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Video/Audio Voice Cloning & Translation</h1>

            <div className="w-full max-w-lg space-y-4">
                <input
                    type="file"
                    accept="video/*,audio/*"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500
                             file:mr-4 file:py-2 file:px-4
                             file:rounded-md file:border-0
                             file:text-sm file:font-semibold
                             file:bg-blue-50 file:text-blue-700
                             hover:file:bg-blue-100"
                />

                <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring focus:ring-blue-200"
                >
                    <option value="">Choose a language</option>
                    {languages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                            {lang.name}
                        </option>
                    ))}
                </select>

                <button
                    onClick={handleUpload}
                    disabled={loading}
                    className={`w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        loading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                >
                    {loading ? 'Uploading...' : 'Upload & Translate'}
                </button>

                {statusMessage && (
                    <p className={`mt-4 text-center ${statusMessage.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                        {statusMessage}
                    </p>
                )}
            </div>
        </div>
    );
};

export default App;
