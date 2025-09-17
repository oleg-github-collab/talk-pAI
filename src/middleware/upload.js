const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AudioService = require('../audio/service');

class UploadMiddleware {
  constructor() {
    this.audioService = new AudioService();
    this.setupMulter();
  }

  setupMulter() {
    // Configure multer for disk storage
    this.storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
      }
    });

    // Memory storage for audio processing
    this.memoryStorage = multer.memoryStorage();

    // File filter for audio files
    this.audioFileFilter = (req, file, cb) => {
      if (this.audioService.isAudioFile(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only audio files are allowed'), false);
      }
    };

    // General file filter for any uploads
    this.generalFileFilter = (req, file, cb) => {
      const allowedMimeTypes = [
        // Audio
        'audio/webm',
        'audio/ogg',
        'audio/wav',
        'audio/mp3',
        'audio/mpeg',
        'audio/mp4',
        'audio/aac',
        // Images
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        // Documents
        'application/pdf',
        'text/plain',
        'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Archives
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        // Video
        'video/mp4',
        'video/webm',
        'video/quicktime'
      ];

      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed`), false);
      }
    };

    // Audio upload middleware
    this.audioUpload = multer({
      storage: this.memoryStorage,
      fileFilter: this.audioFileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB for 1 minute audio
        files: 1
      }
    }).single('audio');

    // General file upload middleware
    this.fileUpload = multer({
      storage: this.storage,
      fileFilter: this.generalFileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit as requested
        files: 1
      }
    }).single('file');
  }

  handleAudioUpload() {
    return (req, res, next) => {
      this.audioUpload(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({
                error: 'Audio file too large. Maximum size is 10MB'
              });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
              return res.status(400).json({
                error: 'Too many files. Only 1 audio file allowed'
              });
            }
          }
          return res.status(400).json({
            error: err.message || 'Audio upload failed'
          });
        }

        if (!req.file) {
          return res.status(400).json({
            error: 'No audio file provided'
          });
        }

        next();
      });
    };
  }

  handleFileUpload() {
    return (req, res, next) => {
      this.fileUpload(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
              return res.status(400).json({
                error: 'File too large. Maximum size is 5MB'
              });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
              return res.status(400).json({
                error: 'Too many files. Only 1 file allowed'
              });
            }
          }
          return res.status(400).json({
            error: err.message || 'File upload failed'
          });
        }

        if (!req.file) {
          return res.status(400).json({
            error: 'No file provided'
          });
        }

        next();
      });
    };
  }

  // Error handling middleware
  handleUploadError() {
    return (error, req, res, next) => {
      if (error instanceof multer.MulterError) {
        return res.status(400).json({
          error: 'Upload error: ' + error.message
        });
      }
      next(error);
    };
  }
}

module.exports = new UploadMiddleware();