const multer = require('multer');
const AudioService = require('../audio/service');

class UploadMiddleware {
  constructor() {
    this.audioService = new AudioService();
    this.setupMulter();
  }

  setupMulter() {
    // Configure multer for memory storage
    this.storage = multer.memoryStorage();

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
        // Images (for future use)
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        // Documents (for future use)
        'application/pdf',
        'text/plain'
      ];

      if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed`), false);
      }
    };

    // Audio upload middleware
    this.audioUpload = multer({
      storage: this.storage,
      fileFilter: this.audioFileFilter,
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
        files: 1
      }
    }).single('audio');

    // General file upload middleware
    this.fileUpload = multer({
      storage: this.storage,
      fileFilter: this.generalFileFilter,
      limits: {
        fileSize: 25 * 1024 * 1024, // 25MB
        files: 5
      }
    }).array('files', 5);
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
                error: 'File too large. Maximum size is 25MB'
              });
            }
            if (err.code === 'LIMIT_FILE_COUNT') {
              return res.status(400).json({
                error: 'Too many files. Maximum 5 files allowed'
              });
            }
          }
          return res.status(400).json({
            error: err.message || 'File upload failed'
          });
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            error: 'No files provided'
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