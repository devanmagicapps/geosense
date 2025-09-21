// Import Firebase modules
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-auth.js";
import { getFirestore, doc, runTransaction, setDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";

// Your provided Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAk6-5WxG2EbBjePe9hPQR9sTtrAVhJldo",
  authDomain: "geosensemagic.firebaseapp.com",
  projectId: "geosensemagic",
  storageBucket: "geosensemagic.firebasestorage.app",
  messagingSenderId: "397054292069",
  appId: "1:397054292069:web:944838196845ebd490d68c"
};

// Initialize Firebase
const app = window.firebase.app.initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);


if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- Constants ---
    const APP_DATA_STORAGE_KEY = 'magicAppDataV8_GridOnly_Bali_v5';
    const LICENSE_STORAGE_KEY = 'geosense_license_key_v1';

    // --- DOM Elements ---
    const licenseModal = document.getElementById('license-modal');
    const licenseForm = document.getElementById('license-form');
    const emailInput = document.getElementById('email-input');
    const licenseKeyInput = document.getElementById('license-key-input');
    const activateBtn = document.getElementById('activate-btn');
    const licenseError = document.getElementById('license-error');
    const appContainer = document.getElementById('app-container');

    // --- Main App Elements ---
    const mainView = document.querySelector('main');
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
    const saveBtn = document.getElementById('save-btn');
    const openInstructionsBtn = document.getElementById('open-instructions-btn');
    const instructionsModal = document.getElementById('instructions-modal');
    const closeInstructionsModalBtn = document.getElementById('close-instructions-modal-btn');
    const searchEngineRadios = document.querySelectorAll('input[name="searchEngine"]');
    const shortcutNameContainer = document.getElementById('shortcut-name-container');
    const shortcutNameInput = document.getElementById('shortcut-name-input');
    const bulkAddInput = document.getElementById('bulk-add-input');
    const notificationModal = document.getElementById('notification-modal');
    const notificationText = document.getElementById('notification-text');
    const previewOverlay = document.getElementById('preview-overlay');
    const previewImage = document.getElementById('preview-image');
    const goToImageEditorBtn = document.getElementById('go-to-image-editor-btn');
    const imageEditorView = document.getElementById('image-editor-view');
    const saveAndReturnBtn = document.getElementById('save-and-return-btn');
    const editorCanvasArea = document.getElementById('image-editor-canvas-area');
    const editorBaseImage = document.getElementById('editor-base-image');
    const editorImageUploadInput = document.getElementById('editor-image-upload-input');
    const editorOverlayText = document.getElementById('editor-overlay-text');
    const editorOverlayInput = document.getElementById('editor-overlay-input');
    const editorFontSize = document.getElementById('editor-font-size');
    const editorRotation = document.getElementById('editor-rotation');
    const editorColor = document.getElementById('editor-color');
    const editorOpacity = document.getElementById('editor-opacity');
    const editorBrightness = document.getElementById('editor-brightness');
    const editorContrast = document.getElementById('editor-contrast');
    const editorSetPositionBtn = document.getElementById('editor-set-position-btn');
    const editorTextBoundaryBox = document.getElementById('editor-text-boundary-box');
    const textMeasureHelper = document.getElementById('text-measure-helper');

    // --- App State ---
    let appData = {};
    let currentPageIndex = 0;
    let setPageIndex = 0;
    let isSetSelectionMode = true;
    let isSingleItemMode = false;
    let editorMode = 'idle';
    let isDragging = false;
    let dragStartX, dragStartY;

    const defaultData = {
        settings: { searchEngine: 'maps', shortcutName: '' },
        pages: [
            { startNumber: 1, regions: ['Pantai Kuta', 'Seminyak', 'Canggu', 'Garuda Wisnu Kencana', 'Pura Uluwatu'] },
            { startNumber: 6, regions: ['Ubud', 'Sawah Terasering Tegalalang', 'Danau Beratan Bedugul', 'Tanah Lot', 'Pantai Lovina'] },
            { startNumber: 11, regions: ['Nusa Dua', 'Sanur', 'Jimbaran', 'Gunung Batur', 'Tirta Empul'] }
        ],
        overlaySettings: {
            text: 'Contoh Teks',
            fontSizeScale: 1, color: '#ffffff', opacity: '1', rotation: '0',
            boundary: null, brightness: '100', contrast: '100',
            baseImage: "https://placehold.co/600x400/1f2937/9ca3af?text=Pilih+Gambar"
        }
    };

    // --- License Handling ---

    async function handleLicenseActivation(email, licenseKey) {
        activateBtn.disabled = true;
        activateBtn.textContent = 'Memverifikasi...';
        licenseError.textContent = '';

        try {
            const availableLicenseRef = doc(db, "availableLicenses", licenseKey);
            const activatedLicenseRef = doc(db, "activatedLicenses", licenseKey);

            await runTransaction(db, async (transaction) => {
                const availableLicenseDoc = await transaction.get(availableLicenseRef);

                if (!availableLicenseDoc.exists()) {
                    throw new Error("Kunci lisensi tidak valid atau sudah digunakan.");
                }

                // Move the license from 'available' to 'activated'
                transaction.delete(availableLicenseRef);
                transaction.set(activatedLicenseRef, {
                    email: email,
                    uid: auth.currentUser.uid, // Store anonymous UID
                    activationDate: new Date().toISOString()
                });
            });

            // If transaction is successful
            localStorage.setItem(LICENSE_STORAGE_KEY, licenseKey);
            showNotification("Lisensi berhasil diaktifkan!");
            grantAppAccess();

        } catch (error) {
            console.error("Activation error:", error);
            licenseError.textContent = error.message || "Gagal mengaktifkan. Coba lagi.";
            activateBtn.disabled = false;
            activateBtn.textContent = 'Aktifkan';
        }
    }

    function grantAppAccess() {
        licenseModal.classList.add('hidden');
        appContainer.classList.remove('hidden');
        initializeAppLogic();
    }

    async function checkLicense() {
        try {
            await signInAnonymously(auth);
            console.log("Signed in anonymously with UID:", auth.currentUser.uid);

            const storedLicense = localStorage.getItem(LICENSE_STORAGE_KEY);
            if (storedLicense) {
                // Optional: You could add a check here to verify if the stored license is still valid in `activatedLicenses`
                // For now, we trust the local storage.
                grantAppAccess();
            } else {
                licenseModal.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Anonymous sign-in failed:", error);
            licenseError.textContent = "Gagal terhubung ke server. Periksa koneksi Anda.";
            licenseModal.classList.remove('hidden');
        }
    }

    licenseForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const licenseKey = licenseKeyInput.value.trim();
        if (email && licenseKey) {
            handleLicenseActivation(email, licenseKey);
        } else {
            licenseError.textContent = 'Email dan kunci lisensi harus diisi.';
        }
    });

    // --- Main App Logic (Initialized after license check) ---

    function initializeAppLogic() {
        appData = loadDataFromStorage();
        updateGridView();
        initializeEditor();
        initializePreviewHandlers();

        openSettingsBtn.addEventListener('click', () => { populateSettingsModal(); settingsModal.classList.remove('hidden'); });
        closeSettingsModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
        openInstructionsBtn.addEventListener('click', () => instructionsModal.classList.remove('hidden'));
        closeInstructionsModalBtn.addEventListener('click', () => instructionsModal.classList.add('hidden'));

        searchEngineRadios.forEach(radio => radio.addEventListener('change', (e) => {
            shortcutNameContainer.classList.toggle('hidden', e.target.value !== 'shortcut');
        }));

        saveBtn.addEventListener('click', () => {
            appData.settings.searchEngine = document.querySelector('input[name="searchEngine"]:checked').value;
            appData.settings.shortcutName = shortcutNameInput.value.trim();
            const allRegions = bulkAddInput.value.split(',').map(item => item.trim()).filter(Boolean);
            const newPages = [];
            let currentStartNumber = 1;
            for (let i = 0; i < allRegions.length; i += 5) {
                newPages.push({ startNumber: currentStartNumber, regions: allRegions.slice(i, i + 5) });
                currentStartNumber += allRegions.slice(i, i + 5).length;
            }
            appData.pages = (newPages.length > 0) ? newPages : [{ startNumber: 1, regions: ['Item Contoh'] }];
            saveDataToStorage();
            isSetSelectionMode = true;
            setPageIndex = 0;
            updateGridView();
            settingsModal.classList.add('hidden');
            showNotification("Perubahan disimpan!");
        });

        document.getElementById('grid-view-container').addEventListener('click', (event) => {
            const area = event.target.closest('.clickable-area');
            if (!area) return;
            const areaIndexOnScreen = parseInt(area.dataset.index);
            let regionName;
            if (isSingleItemMode) {
                regionName = appData.pages[0].regions[0];
            } else if (isSetSelectionMode) {
                const actualSetIndex = (setPageIndex * 5) + areaIndexOnScreen;
                if (appData.pages[actualSetIndex]) {
                    currentPageIndex = actualSetIndex; isSetSelectionMode = false; changePage();
                }
                return;
            } else {
                regionName = appData.pages[currentPageIndex]?.regions[areaIndexOnScreen];
            }
            if (regionName) executeAction(regionName);
        });

        let touchStartX = 0;
        document.getElementById('grid-view-container').addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
        document.getElementById('grid-view-container').addEventListener('touchend', (e) => {
            if (isSingleItemMode) return;
            const deltaX = e.changedTouches[0].screenX - touchStartX;
            const swipeThreshold = 50;
            if (isSetSelectionMode) {
                const maxSetPageIndex = Math.ceil(appData.pages.length / 5) - 1;
                if (deltaX < -swipeThreshold && setPageIndex < maxSetPageIndex) { setPageIndex++; changePage(); }
                else if (deltaX > swipeThreshold && setPageIndex > 0) { setPageIndex--; changePage(); }
            } else {
                if (deltaX < -swipeThreshold && currentPageIndex < appData.pages.length - 1) { currentPageIndex++; changePage(); }
                else if (deltaX > swipeThreshold) { isSetSelectionMode = true; setPageIndex = Math.floor(currentPageIndex / 5); changePage(); }
            }
        });

        goToImageEditorBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
            toggleEditorView(true);
        });
        saveAndReturnBtn.addEventListener('click', () => {
            toggleEditorView(false);
            updateGridView();
            showNotification("Pengaturan gambar disimpan!");
        });
    }


    function executeAction(regionName) {
        const { searchEngine, shortcutName } = appData.settings;
        if (searchEngine === 'gallery') {
            showPreview(regionName);
            return;
        }
        let url = '';
        if (searchEngine === 'shortcut') {
            if (!shortcutName) { showNotification('Nama Shortcut belum diatur!'); return; }
            url = `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=${encodeURIComponent(regionName)}`;
        } else {
            url = (searchEngine === 'maps') ? `https://maps.google.com/?q=${encodeURIComponent(regionName)}` : `https://www.google.com/search?q=${encodeURIComponent(regionName)}`;
        }
        openInExternalBrowser(url);
        document.getElementById('message-text').textContent = `Membuka Prediksi: ${capitalizeFirstLetter(regionName)}`;
        document.getElementById('message-text').classList.remove('hidden');
        setTimeout(() => document.getElementById('message-text').classList.add('hidden'), 2500);
    }
    
    function capitalizeFirstLetter(string) {
        if (!string) return '';
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function openInExternalBrowser(url) {
        const a = document.createElement('a'); a.href = url; a.target = '_blank';
        a.rel = 'noopener noreferrer'; document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }

    function loadDataFromStorage() {
        const storedData = localStorage.getItem(APP_DATA_STORAGE_KEY);
        try {
            const parsedData = JSON.parse(storedData);
            if (parsedData && parsedData.settings && parsedData.pages) {
                return {
                    ...defaultData, ...parsedData,
                    settings: { ...defaultData.settings, ...parsedData.settings },
                    overlaySettings: { ...defaultData.overlaySettings, ...parsedData.overlaySettings }
                };
            }
            return defaultData;
        } catch (e) { return defaultData; }
    }

    function saveDataToStorage() { localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(appData)); }

    function updateGridView() {
        if (!appData.pages || appData.pages.length === 0) return;
        isSingleItemMode = appData.pages.length === 1 && appData.pages[0].regions.length === 1;
        if (isSingleItemMode) {
            document.getElementById('message-text').classList.add('hidden');
            const regionName = appData.pages[0].regions[0];
            const singleItemHTML = `<div class="content-container w-full h-full flex items-center justify-center text-center"><span class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white opacity-10 text-6xl sm:text-8xl font-black z-0">1</span><span class="relative z-10 font-semibold text-xl sm:text-3xl">${capitalizeFirstLetter(regionName)}</span></div>`;
            document.querySelectorAll('.clickable-area').forEach(area => { area.innerHTML = singleItemHTML; });
        } else if (isSetSelectionMode) {
            document.getElementById('message-text').textContent = "Pilih Grup Prediksi";
            document.getElementById('message-text').classList.remove('hidden');
            const setsPerPage = 5;
            const startIndex = setPageIndex * setsPerPage;
            document.querySelectorAll('.clickable-area').forEach((area, index) => {
                const page = appData.pages[startIndex + index];
                if (page && page.regions.length > 0) {
                    const start = page.startNumber; const end = start + page.regions.length - 1;
                     area.innerHTML = `<div class="content-container w-full h-full flex items-center justify-center text-center"><span class="relative z-10 font-black text-3xl sm:text-5xl">${start}-${end}</span></div>`;
                } else { area.innerHTML = ''; }
            });
        } else {
            const currentPage = appData.pages[currentPageIndex];
            if (!currentPage) { isSetSelectionMode = true; updateGridView(); return; }
            document.getElementById('message-text').classList.add('hidden');
            document.querySelectorAll('.clickable-area').forEach((area, index) => {
                const regionName = currentPage.regions[index] || '';
                const formattedName = capitalizeFirstLetter(regionName);
                area.innerHTML = regionName ? `<div class="content-container w-full h-full flex items-center justify-center text-center"><span class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white opacity-10 text-6xl sm:text-8xl font-black z-0">${currentPage.startNumber + index}</span><span class="relative z-10 font-semibold text-base sm:text-xl">${formattedName}</span></div>` : '';
            });
        }
    }
    
    function showNotification(message) {
        notificationText.innerHTML = message;
        notificationModal.classList.remove('hidden');
        notificationModal.style.opacity = '1';
        setTimeout(() => {
            notificationModal.style.opacity = '0';
            setTimeout(() => notificationModal.classList.add('hidden'), 500);
        }, 2000);
    }
    
    function populateSettingsModal() {
        document.querySelector(`input[name="searchEngine"][value="${appData.settings.searchEngine}"]`).checked = true;
        shortcutNameInput.value = appData.settings.shortcutName || '';
        shortcutNameContainer.classList.toggle('hidden', appData.settings.searchEngine !== 'shortcut');
        const allRegions = appData.pages.flatMap(page => page.regions);
        bulkAddInput.value = allRegions.join(', ');
    }

    function changePage() {
        document.querySelectorAll('.content-container').forEach(el => el.classList.add('fade-out'));
        setTimeout(() => { updateGridView(); }, 200);
    }
    
    function getEditorRenderedImageRect() {
        const img = editorBaseImage;
        const container = editorCanvasArea;
        const { naturalWidth, naturalHeight } = img;
        if (!naturalWidth || !naturalHeight) return container.getBoundingClientRect();
        const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
        const imgRatio = naturalWidth / naturalHeight;
        const containerRatio = containerWidth / containerHeight;
        let renderedWidth, renderedHeight;
        if (imgRatio > containerRatio) {
            renderedWidth = containerWidth;
            renderedHeight = renderedWidth / imgRatio;
        } else {
            renderedHeight = containerHeight;
            renderedWidth = renderedHeight * imgRatio;
        }
        const containerRect = container.getBoundingClientRect();
         return {
            width: renderedWidth, height: renderedHeight,
            left: containerRect.left + (containerWidth - renderedWidth) / 2, 
            top: containerRect.top + (containerHeight - renderedHeight) / 2
        };
    }

    function updateEditorOverlayStyle(boundaryOverride = null) {
        const s = appData.overlaySettings;
        const boundary = boundaryOverride || s.boundary;

        if (!boundary) {
            editorOverlayText.style.display = 'none';
            editorTextBoundaryBox.style.display = 'none';
            return;
        }
        
        editorOverlayText.style.display = 'flex';
        editorTextBoundaryBox.style.display = 'block';
        
        const renderedRect = getEditorRenderedImageRect();
        const imageOffsetX = renderedRect.left - editorCanvasArea.getBoundingClientRect().left;
        const imageOffsetY = renderedRect.top - editorCanvasArea.getBoundingClientRect().top;

        editorTextBoundaryBox.style.left = `${imageOffsetX + (boundary.x * renderedRect.width)}px`;
        editorTextBoundaryBox.style.top = `${imageOffsetY + (boundary.y * renderedRect.height)}px`;
        editorTextBoundaryBox.style.width = `${boundary.width * renderedRect.width}px`;
        editorTextBoundaryBox.style.height = `${boundary.height * renderedRect.height}px`;

        const boundaryWidthPx = boundary.width * renderedRect.width;
        const boundaryHeightPx = boundary.height * renderedRect.height;
        
        const xPos = imageOffsetX + boundary.x * renderedRect.width + boundaryWidthPx / 2;
        const yPos = imageOffsetY + boundary.y * renderedRect.height + boundaryHeightPx / 2;
        
        editorOverlayText.style.width = `${boundaryWidthPx}px`;
        editorOverlayText.style.height = `${boundaryHeightPx}px`;
        editorOverlayText.style.transform = `translate(-50%, -50%) translate(${xPos}px, ${yPos}px) rotate(${s.rotation}deg)`;
        
        textMeasureHelper.style.width = `${boundaryWidthPx}px`;
        textMeasureHelper.textContent = s.text;
        
        let fontSize = boundaryHeightPx;
         while (fontSize > 8) {
             textMeasureHelper.style.fontSize = `${fontSize}px`;
             if (textMeasureHelper.scrollHeight <= boundaryHeightPx * 1.05) { 
                 break;
             }
             fontSize -= 2;
         }

        editorOverlayText.style.fontSize = `${fontSize * (s.fontSizeScale || 1)}px`;
        editorOverlayText.style.color = s.color;
        editorOverlayText.style.opacity = s.opacity;
        editorOverlayText.style.filter = `brightness(${s.brightness}%) contrast(${s.contrast}%)`;
        editorOverlayText.textContent = s.text;
        editorOverlayText.style.wordBreak = 'break-word';
    }

    function loadEditorSettings() {
        const s = appData.overlaySettings || defaultData.overlaySettings;
        editorBaseImage.src = s.baseImage;
        editorOverlayInput.value = s.text;
        editorFontSize.value = (s.fontSizeScale || 1) * 100;
        editorRotation.value = s.rotation;
        editorColor.value = s.color;
        editorOpacity.value = s.opacity;
        editorBrightness.value = s.brightness;
        editorContrast.value = s.contrast;
        editorBaseImage.onload = () => updateEditorOverlayStyle();
        updateEditorOverlayStyle();
    }

    function saveEditorSettings() {
        appData.overlaySettings = {
            ...appData.overlaySettings,
            text: editorOverlayInput.value, 
            fontSizeScale: parseFloat(editorFontSize.value) / 100,
            color: editorColor.value,
            opacity: editorOpacity.value, 
            rotation: editorRotation.value,
            brightness: editorBrightness.value, 
            contrast: editorContrast.value,
        };
    }
    
    function onPositioningDragStart(e) {
        if (editorMode !== 'positioning' || (e.type === 'mousedown' && e.button !== 0)) return;
        e.preventDefault();
        isDragging = true;
        const currentX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const currentY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        dragStartX = currentX;
        dragStartY = currentY;
        const renderedRect = getEditorRenderedImageRect();
        const startX_pct = Math.max(0, Math.min(1, (dragStartX - renderedRect.left) / renderedRect.width));
        const startY_pct = Math.max(0, Math.min(1, (dragStartY - renderedRect.top) / renderedRect.height));
        const liveBoundary = { x: startX_pct, y: startY_pct, width: 0, height: 0 };
        updateEditorOverlayStyle(liveBoundary);
    }
    
    function onPositioningDragMove(e) {
        if (!isDragging || editorMode !== 'positioning') return;
        e.preventDefault();
        const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const currentY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        const renderedRect = getEditorRenderedImageRect();
        if (renderedRect.width === 0 || renderedRect.height === 0) return;

        const startX_pct = Math.max(0, Math.min(1, (dragStartX - renderedRect.left) / renderedRect.width));
        const startY_pct = Math.max(0, Math.min(1, (dragStartY - renderedRect.top) / renderedRect.height));
        const currentX_pct = Math.max(0, Math.min(1, (currentX - renderedRect.left) / renderedRect.width));
        const currentY_pct = Math.max(0, Math.min(1, (currentY - renderedRect.top) / renderedRect.height));
        
        const x = Math.min(startX_pct, currentX_pct);
        const y = Math.min(startY_pct, currentY_pct);
        const width = Math.abs(currentX_pct - startX_pct);
        const height = Math.abs(currentY_pct - startY_pct);
        
        const liveBoundary = { x, y, width, height };
        const imageOffsetX = renderedRect.left - editorCanvasArea.getBoundingClientRect().left;
        const imageOffsetY = renderedRect.top - editorCanvasArea.getBoundingClientRect().top;
        
        editorTextBoundaryBox.style.display = 'block';
        editorOverlayText.style.display = 'none';

        editorTextBoundaryBox.style.left = `${imageOffsetX + (liveBoundary.x * renderedRect.width)}px`;
        editorTextBoundaryBox.style.top = `${imageOffsetY + (liveBoundary.y * renderedRect.height)}px`;
        editorTextBoundaryBox.style.width = `${liveBoundary.width * renderedRect.width}px`;
        editorTextBoundaryBox.style.height = `${liveBoundary.height * renderedRect.height}px`;
    }

    function onPositioningDragEnd(e) {
        if (!isDragging || editorMode !== 'positioning') return;
        isDragging = false;
        
        const currentX = e.type === 'touchend' ? e.changedTouches[0].clientX : e.clientX;
        const currentY = e.type === 'touchend' ? e.changedTouches[0].clientY : e.clientY;
        const renderedRect = getEditorRenderedImageRect();
        if (renderedRect.width === 0 || renderedRect.height === 0) return;

        const startX_pct = Math.max(0, Math.min(1, (dragStartX - renderedRect.left) / renderedRect.width));
        const startY_pct = Math.max(0, Math.min(1, (dragStartY - renderedRect.top) / renderedRect.height));
        const currentX_pct = Math.max(0, Math.min(1, (currentX - renderedRect.left) / renderedRect.width));
        const currentY_pct = Math.max(0, Math.min(1, (currentY - renderedRect.top) / renderedRect.height));
        
        const x = Math.min(startX_pct, currentX_pct);
        const y = Math.min(startY_pct, currentY_pct);
        const width = Math.abs(currentX_pct - startX_pct);
        const height = Math.abs(currentY_pct - startY_pct);

        if (width > 0.01 && height > 0.01) {
            appData.overlaySettings.boundary = { x, y, width, height };
        }
        updateEditorOverlayStyle();
    }
    
    async function showPreview(text) {
        showNotification("Membuat preview...");
        try {
            const imageBlob = await generateCompositeImageAsBlob(text);
            if (!imageBlob) return;
            const imageUrl = URL.createObjectURL(imageBlob);
            previewImage.src = imageUrl;
            previewImage.onload = () => {
                if (previewImage.dataset.previousUrl) URL.revokeObjectURL(previewImage.dataset.previousUrl);
                previewImage.dataset.previousUrl = imageUrl;
                previewOverlay.classList.remove('hidden');
            };
        } catch (error) {
            console.error("Gagal membuat preview:", error);
            showNotification(error.message);
        }
    }
    
    function wrapAndFitText(ctx, text, maxWidth, maxHeight, baseFontSize) {
        let fontSize = baseFontSize;
        let lines = [];
        const words = text.split(' ');
        while (fontSize > 8) {
            ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
            lines = [];
            let currentLine = words[0] || '';
            for (let i = 1; i < words.length; i++) {
                const word = words[i];
                const width = ctx.measureText(currentLine + " " + word).width;
                if (width < maxWidth) {
                    currentLine += " " + word;
                } else {
                    lines.push(currentLine);
                    currentLine = word;
                }
            }
            lines.push(currentLine);
            const textMetrics = ctx.measureText('M');
            const fontHeight = (textMetrics.fontBoundingBoxAscent || fontSize) + (textMetrics.fontBoundingBoxDescent || 0);
            const totalHeight = lines.length * fontHeight;
            if (totalHeight <= maxHeight) {
                return { lines, fontSize, lineHeight: fontHeight };
            }
            fontSize -= 2;
        }
        return { lines, fontSize, lineHeight: (ctx.measureText('M').fontBoundingBoxAscent || fontSize) + (ctx.measureText('M').fontBoundingBoxDescent || 0) };
    }

    function generateCompositeImageAsBlob(text) {
        return new Promise((resolve, reject) => {
            const settings = appData.overlaySettings;
            if (!settings.boundary) return reject(new Error("Batas area teks belum diatur."));
            
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const boundaryPx = {
                    x: settings.boundary.x * canvas.width,
                    y: settings.boundary.y * canvas.height,
                    width: settings.boundary.width * canvas.width,
                    height: settings.boundary.height * canvas.height,
                };
                
                const baseFontSize = boundaryPx.height * (settings.fontSizeScale || 1);
                const { lines, fontSize, lineHeight } = wrapAndFitText(ctx, text, boundaryPx.width * 0.95, boundaryPx.height * 0.95, baseFontSize);

                ctx.fillStyle = settings.color;
                ctx.globalAlpha = parseFloat(settings.opacity);
                ctx.filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%)`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = `bold ${fontSize}px 'Inter', sans-serif`;
                
                const xPos = boundaryPx.x + boundaryPx.width / 2;
                const yPos = boundaryPx.y + boundaryPx.height / 2;
                const totalTextHeight = (lines.length - 1) * lineHeight;
                const startYOffset = -totalTextHeight / 2;
                
                ctx.save();
                ctx.translate(xPos, yPos);
                ctx.rotate(parseFloat(settings.rotation) * Math.PI / 180);
                for (let i = 0; i < lines.length; i++) {
                    ctx.fillText(lines[i], 0, startYOffset + (i * lineHeight));
                }
                ctx.restore();
                
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Gagal membuat gambar."));
                }, 'image/png');
            };
            img.onerror = () => reject(new Error("Gagal memuat gambar untuk ekspor."));
            img.src = settings.baseImage;
        });
    }

    function initializePreviewHandlers() {
        let lastTap = 0;
        previewOverlay.addEventListener('click', (e) => {
             if (e.target !== previewImage) {
                 const currentTime = new Date().getTime();
                 const tapLength = currentTime - lastTap;
                 if (tapLength < 300 && tapLength > 0) previewOverlay.classList.add('hidden');
                 lastTap = currentTime;
             }
        });
        let pressTimer;
        previewImage.addEventListener('touchstart', (e) => {
            pressTimer = setTimeout(async () => {
                try {
                    const blob = await fetch(previewImage.src).then(res => res.blob());
                    const filename = `prediksi-${appData.overlaySettings.text.replace(/\s+/g, '-').toLowerCase()}.png`;
                    const file = new File([blob], filename, { type: blob.type });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ title: 'Prediksi Saya', files: [file] });
                    } else {
                        showNotification('Fitur share tidak didukung.');
                    }
                } catch (err) {
                    if (err.name !== 'AbortError') showNotification('Gagal membagikan gambar.');
                }
            }, 700);
        }, { passive: true });
        const clearPressTimer = () => clearTimeout(pressTimer);
        previewImage.addEventListener('touchend', clearPressTimer);
        previewImage.addEventListener('touchmove', clearPressTimer);
    }

    function initializeEditor() {
         ['input', 'change'].forEach(evt => {
             const listener = () => { saveEditorSettings(); updateEditorOverlayStyle(); };
             editorOverlayInput.addEventListener(evt, listener);
             editorFontSize.addEventListener(evt, listener);
             editorRotation.addEventListener(evt, listener);
             editorColor.addEventListener(evt, listener);
             editorOpacity.addEventListener(evt, listener);
             editorBrightness.addEventListener(evt, listener);
             editorContrast.addEventListener(evt, listener);
         });
         
        editorCanvasArea.addEventListener('mousedown', onPositioningDragStart);
        editorCanvasArea.addEventListener('touchstart', onPositioningDragStart, { passive: false });
        document.addEventListener('mousemove', onPositioningDragMove);
        document.addEventListener('touchmove', onPositioningDragMove, { passive: false });
        document.addEventListener('mouseup', onPositioningDragEnd);
        document.addEventListener('touchend', onPositioningDragEnd);

        editorSetPositionBtn.addEventListener('click', () => {
            if (editorMode === 'idle') {
                editorMode = 'positioning';
                editorSetPositionBtn.textContent = "Selesai Menempatkan";
                editorSetPositionBtn.classList.replace('bg-cyan-600', 'bg-red-500');
                editorSetPositionBtn.classList.replace('hover:bg-cyan-500', 'hover:bg-red-400');
                editorCanvasArea.style.cursor = 'crosshair';
            } else {
                editorMode = 'idle';
                editorSetPositionBtn.textContent = "Atur Posisi Teks";
                editorSetPositionBtn.classList.replace('bg-red-500', 'bg-cyan-600');
                editorSetPositionBtn.classList.replace('hover:bg-red-400', 'hover:bg-cyan-500');
                editorCanvasArea.style.cursor = 'default';
                saveDataToStorage();
            }
            updateEditorOverlayStyle();
        });

        editorImageUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const base64String = event.target.result;
                    editorBaseImage.src = base64String;
                    appData.overlaySettings.baseImage = base64String;
                    saveDataToStorage();
                    showNotification("Gambar latar diperbarui!");
                };
                reader.readAsDataURL(file);
            }
        });
    }

    function toggleEditorView(show) {
        if (show) {
            loadEditorSettings();
            appContainer.classList.add('hidden');
            imageEditorView.classList.remove('hidden');
        } else {
            saveEditorSettings();
            saveDataToStorage();
            imageEditorView.classList.add('hidden');
            appContainer.classList.remove('hidden');
            settingsModal.classList.remove('hidden');
        }
    }

    // --- Initial Load ---
    await checkLicense();
});
