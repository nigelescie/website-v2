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
        } catch (e) { console.error('HEIC conversion failed', e); }
    }
    return uploadFileToS3(file, folder);
}
