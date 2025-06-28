// Firebase Configuration
const firebaseConfig = {
    // Replace with your Firebase config
          apiKey: "AIzaSyBHo0wD8r43dNWV0oj1GjdWy8PrWMqDjV8",
          authDomain: "bupko-e2bae.firebaseapp.com",
          projectId: "bupko-e2bae",
          storageBucket: "bupko-e2bae.firebasestorage.app",
          messagingSenderId: "357775521284",
          appId: "1:357775521284:web:d3a71c66b70f8e2d8ca751",
          measurementId: "G-QLKNMTV8V3"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const storage = firebase.storage();
const firestore = firebase.firestore();
const secondaryDb = firebase.app().firestore('rokomari-aff');

// Global variables
let selectedFile = null;
let uploadedImageUrl = null;

$(document).ready(function() {
    // File upload handling - FIXED to prevent infinite loop
    $('#uploadArea').click(function(e) {
        // Prevent event if click originated from the file input itself
        if (e.target.id !== 'image-upload') {
            e.stopPropagation();
            $('#image-upload').trigger('click');
        }
    });

    // Drag and drop functionality
    $('#uploadArea').on('dragover', function(e) {
        e.preventDefault();
        $(this).addClass('dragover');
    });

    $('#uploadArea').on('dragleave', function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
    });

    $('#uploadArea').on('drop', function(e) {
        e.preventDefault();
        $(this).removeClass('dragover');
        
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    // File input change - FIXED to prevent propagation
    $('#image-upload').change(function(e) {
        e.stopPropagation();
        const file = this.files[0];
        if (file) {
            handleFile(file);
        }
    });

    // Prevent file input from triggering upload area click
    $('#image-upload').click(function(e) {
        e.stopPropagation();
    });

    // Remove image
    $('#removeImage').click(function() {
        selectedFile = null;
        uploadedImageUrl = null;
        $('#imagePreview').hide();
        $('#uploadArea').show();
        $('#image-upload').val('');
        $('#previewImg').attr('src', '');
        $('.progress-container').hide();
        $('.progress-bar').css('width', '0%');
    });

    // Handle file selection
    function handleFile(file) {
        if (file.type.startsWith('image/')) {
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                showAlert('danger', 'File size should not exceed 5MB.');
                return;
            }
            
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = function(e) {
                $('#previewImg').attr('src', e.target.result);
                $('#imagePreview').show();
                $('#uploadArea').hide();
            };
            reader.readAsDataURL(file);
        } else {
            showAlert('danger', 'Please select a valid image file.');
        }
    }

    // Upload image to Firebase Storage
    async function uploadImageToFirebase(file) {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().getTime();
            const fileName = `images/${timestamp}_${file.name}`;
            const storageRef = storage.ref().child(fileName);
            const uploadTask = storageRef.put(file);

            $('.progress-container').show();

            uploadTask.on('state_changed',
                (snapshot) => {
                    // Progress tracking
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    $('.progress-bar').css('width', progress + '%');
                    $('.progress-bar').attr('aria-valuenow', progress);
                    
                    switch (snapshot.state) {
                        case firebase.storage.TaskState.PAUSED:
                            console.log('Upload is paused');
                            break;
                        case firebase.storage.TaskState.RUNNING:
                            console.log('Upload is running');
                            break;
                    }
                },
                (error) => {
                    // Handle unsuccessful uploads
                    console.error('Upload failed:', error);
                    $('.progress-container').hide();
                    reject(error);
                },
                () => {
                    // Handle successful uploads
                    uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                        $('.progress-container').hide();
                        uploadedImageUrl = downloadURL;
                        resolve(downloadURL);
                    });
                }
            );
        });
    }

    // Save data to Firestore
    async function saveToFirestore(data) {
        try {
            const collectionName = $('#collection-name').val() || 'products';
            const docRef = await firestore.collection(collectionName).add(data);
            return docRef.id;
        } catch (error) {
            console.error('Error adding document: ', error);
            throw error;
        }
    }

    // Show alert messages
    function showAlert(type, message) {
        const alertHtml = `
            <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
        `;
        $('#alertContainer').html(alertHtml);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            $('.alert').alert('close');
        }, 5000);
    }

    // Form submission
    $('#imageUploadForm').submit(async function(e) {
        e.preventDefault();
        
        // Show loading overlay
        $('#loadingOverlay').show();
        $('#loadingText').text('Processing...');
        
        try {
            let imageUrl = uploadedImageUrl;
            
            // Upload image if file is selected
            if (selectedFile && !uploadedImageUrl) {
                $('#loadingText').text('Uploading image...');
                imageUrl = await uploadImageToFirebase(selectedFile);
            }
            
            // Use external URL if no file uploaded
            if (!imageUrl && $('#image-url').val()) {
                imageUrl = $('#image-url').val();
            }
            
            // Validate required image
            if (!imageUrl) {
                throw new Error('Please upload an image or provide an image URL');
            }
            
            // Prepare data for Firestore
            const formData = {
                title: $('#title').val(),
                author: $('#author').val(),
                actualPrice: parseFloat($('#actual-price').val()),
                discountedPrice: $('#disc-price').val() ? parseFloat($('#disc-price').val()) : null,
                affiliateLink: $('#aff-link').val(),
                imageUrl: imageUrl,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Save to Firestore
            $('#loadingText').text('Saving to database...');
            const documentId = await saveToFirestore(formData);
            
            // Success
            showAlert('success', `Product successfully saved! Document ID: ${documentId}`);
            
            // Reset form
            $('#imageUploadForm')[0].reset();
            $('#collection-name').val('products');
            selectedFile = null;
            uploadedImageUrl = null;
            $('#imagePreview').hide();
            $('#uploadArea').show();
            $('#image-upload').val('');
            $('#previewImg').attr('src', '');
            $('.progress-container').hide();
            $('.progress-bar').css('width', '0%');
            
        } catch (error) {
            console.error('Error:', error);
            showAlert('danger', `Error: ${error.message}`);
        } finally {
            $('#loadingOverlay').hide();
        }
    });

    // Reset form
    $('#imageUploadForm').on('reset', function() {
        selectedFile = null;
        uploadedImageUrl = null;
        $('#imagePreview').hide();
        $('#uploadArea').show();
        $('#image-upload').val('');
        $('#previewImg').attr('src', '');
        $('.progress-container').hide();
        $('.progress-bar').css('width', '0%');
        $('#alertContainer').empty();
        $('#collection-name').val('products');
    });

    // Validate prices
    $('#actual-price, #disc-price').on('input', function() {
        const actualPrice = parseFloat($('#actual-price').val()) || 0;
        const discPrice = parseFloat($('#disc-price').val()) || 0;
        
        if (discPrice > 0 && discPrice >= actualPrice) {
            showAlert('warning', 'Discounted price should be less than actual price');
        }
    });

    // URL validation
    $('#image-url, #aff-link').on('input', function() {
        const url = $(this).val();
        if (url && !isValidUrl(url)) {
            $(this).addClass('is-invalid');
        } else {
            $(this).removeClass('is-invalid');
        }
    });

    // URL validation helper
    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Load preview from external URL
    $('#image-url').on('blur', function() {
        const url = $(this).val();
        if (url && isValidUrl(url) && !selectedFile) {
            $('#previewImg').attr('src', url);
            $('#imagePreview').show();
            $('#uploadArea').hide();
            uploadedImageUrl = url;
        }
    });
});