// Magic-byte signatures for allowed file types (SEC-015)
const MAGIC_BYTES = [
    { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
    { mime: 'image/png',  bytes: [0x89, 0x50, 0x4E, 0x47] },
    { mime: 'image/gif',  bytes: [0x47, 0x49, 0x46, 0x38] },
    { mime: 'video/mp4',  offset: 4, bytes: [0x66, 0x74, 0x79, 0x70] }, // ftyp box
];

async function validateFileMagicBytes(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = (e) => {
            const arr = new Uint8Array(e.target.result);
            for (const sig of MAGIC_BYTES) {
                const offset = sig.offset || 0;
                const match = sig.bytes.every((b, i) => arr[offset + i] === b);
                if (match && (file.type === sig.mime || (sig.mime === 'image/jpeg' && file.type === 'image/jpg'))) {
                    return resolve(true);
                }
            }
            resolve(false);
        };
        reader.readAsArrayBuffer(file.slice(0, 12));
    });
}

// Upload helpers — two-step pre-signed S3 PUT flow

async function getPresignedUploadUrl(filename, contentType, folder) {
    const res = await authenticatedFetch(`${CONFIG.API_BASE}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, contentType, folder }),
    });
    if (!res.ok) throw new Error('Failed to get upload URL');
    return res.json(); // { uploadUrl, filePath }
}

async function uploadFileToS3(file, folder) {
    const { uploadUrl, filePath } = await getPresignedUploadUrl(file.name, file.type, folder);
    const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
    });
    if (!putRes.ok) throw new Error('S3 upload failed');
    return filePath;
}

// Process HEIC → JPEG if needed, then upload
async function processAndUpload(file, folder) {
    if (!file) return null;
    const name = file.name.toLowerCase();
    if ((name.endsWith('.heic') || name.endsWith('.heif')) && typeof heic2any !== 'undefined') {
        try {
            const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
            const final = Array.isArray(blob) ? blob[0] : blob;
            file = new File([final], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
        } catch (e) { }
    }
    const valid = await validateFileMagicBytes(file);
    if (!valid) throw new Error('File content does not match its declared type.');
    return uploadFileToS3(file, folder);
}
