// ===== CAMERA FUNCTIONALITEIT =====
// Camera variabelen
let cameraStream = null;
let currentCameraIndex = 0;
let availableCameras = [];
let capturedPhotoBlob = null;

// Camera functionaliteit initialiseren
function initCameraFunctionality() {
    // Camera knop event listeners
    document.getElementById('camera-photo-btn').addEventListener('click', startCamera);
    document.getElementById('close-camera-btn').addEventListener('click', stopCamera);
    document.getElementById('capture-photo-btn').addEventListener('click', capturePhoto);
    document.getElementById('switch-camera-btn').addEventListener('click', switchCamera);
    document.getElementById('save-captured-photo-btn').addEventListener('click', saveCapturedPhoto);
    document.getElementById('retake-photo-btn').addEventListener('click', retakePhoto);
}

async function startCamera() {
    try {
        // Krijg beschikbare camera's
        const devices = await navigator.mediaDevices.enumerateDevices();
        availableCameras = devices.filter(device => device.kind === 'videoinput');
        
        if (availableCameras.length === 0) {
            showNotification('Geen camera gevonden op dit apparaat', 'warning');
            return;
        }

        // Start camera stream
        await switchToCamera(currentCameraIndex);
        
        // Toon camera sectie
        document.getElementById('camera-section').classList.remove('d-none');
        
        // Verberg switch knop als er maar 1 camera is
        if (availableCameras.length <= 1) {
            document.getElementById('switch-camera-btn').style.display = 'none';
        }
        
    } catch (error) {
        console.error('Camera fout:', error);
        showNotification('Kon camera niet starten: ' + error.message, 'danger');
    }
}

async function switchToCamera(cameraIndex) {
    // Stop huidige stream
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
    }

    const constraints = {
        video: {
            deviceId: availableCameras[cameraIndex]?.deviceId,
            width: { ideal: 640 },
            height: { ideal: 480 }
        }
    };

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('camera-video');
        video.srcObject = cameraStream;
    } catch (error) {
        throw new Error('Kan geen toegang krijgen tot camera: ' + error.message);
    }
}

async function switchCamera() {
    if (availableCameras.length <= 1) return;
    
    currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
    try {
        await switchToCamera(currentCameraIndex);
        showNotification(`Gewisseld naar camera ${currentCameraIndex + 1}`, 'info');
    } catch (error) {
        console.error('Fout bij wisselen camera:', error);
        showNotification('Kon niet wisselen van camera', 'warning');
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    // Verberg camera sectie
    document.getElementById('camera-section').classList.add('d-none');
    document.getElementById('camera-preview').classList.add('d-none');
    capturedPhotoBlob = null;
}

function capturePhoto() {
    const video = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');
    const context = canvas.getContext('2d');

    // Stel canvas grootte in
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Teken video frame op canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Converteer naar blob
    canvas.toBlob((blob) => {
        capturedPhotoBlob = blob;
        
        // Toon preview
        const capturedImg = document.getElementById('captured-photo');
        capturedImg.src = URL.createObjectURL(blob);
        document.getElementById('camera-preview').classList.remove('d-none');
        
    }, 'image/jpeg', 0.8);
}

function retakePhoto() {
    document.getElementById('camera-preview').classList.add('d-none');
    capturedPhotoBlob = null;
}

async function saveCapturedPhoto() {
    if (!capturedPhotoBlob) {
        showNotification('Geen foto om op te slaan', 'warning');
        return;
    }

    const caseId = document.getElementById('photo-case-id').value;
    if (!caseId) {
        showNotification('Geen kist ID gevonden', 'danger');
        return;
    }

    // Maak FormData object
    const formData = new FormData();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `camera-foto-${timestamp}.jpg`;
    formData.append('photos', capturedPhotoBlob, filename);

    try {
        showLoading('Foto opslaan...');
        
        const response = await fetch(`/api/cases/${caseId}/photos`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        
        hideLoading();
        showNotification('Foto succesvol opgeslagen!', 'success');
        
        // Stop camera en verberg sectie
        stopCamera();
        
        // Herlaad foto's
        loadCasePhotos(caseId);
        
    } catch (error) {
        hideLoading();
        console.error('Fout bij opslaan foto:', error);
        showNotification('Fout bij opslaan foto: ' + error.message, 'danger');
    }
}

// Initialiseer camera functionaliteit wanneer document geladen is
document.addEventListener('DOMContentLoaded', function() {
    initCameraFunctionality();
}); 