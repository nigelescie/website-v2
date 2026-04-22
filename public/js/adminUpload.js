// Upload helpers — two-step pre-signed S3 PUT flow

async function getPresignedUploadUrl(filename, contentType) {
    const res = await authenticatedFetch(
        `${CONFIG.API_BASE}/upload?filename=${encodeURIComponent(filename)}&contentType=${encodeURIComponent(contentType)}`
    );
    if (!res.ok) throw new Error('Failed to get upload URL');
    return res.json(); // { uploadUrl, filePath }
}

async function uploadFileToS3(file) {
    const { uploadUrl, filePath } = await getPresignedUploadUrl(file.name, file.type);
    const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
    });
    if (!putRes.ok) throw new Error('S3 upload failed');
    return filePath;
}

// Process HEIC → JPEG if needed, then upload
async function processAndUpload(file) {
    if (!file) return null;
    const name = file.name.toLowerCase();
    if ((name.endsWith('.heic') || name.endsWith('.heif')) && typeof heic2any !== 'undefined') {
        try {
            const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.8 });
            const final = Array.isArray(blob) ? blob[0] : blob;
            file = new File([final], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
        } catch (e) { console.error('HEIC conversion failed', e); }
    }
    return uploadFileToS3(file);
}
