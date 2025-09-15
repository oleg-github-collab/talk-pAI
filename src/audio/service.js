const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class AudioService {
  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'audio');
    this.ensureUploadDir();
  }

  ensureUploadDir() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      console.log('✅ Audio upload directory created');
    }
  }

  generateAudioFileName(originalName, userId) {
    const timestamp = Date.now();
    const hash = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalName) || '.webm';
    return `audio_${userId}_${timestamp}_${hash}${ext}`;
  }

  validateAudioFile(file) {
    const allowedMimeTypes = [
      'audio/webm',
      'audio/ogg',
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/aac'
    ];

    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error(`Unsupported audio format: ${file.mimetype}`);
    }

    if (file.size > maxSize) {
      throw new Error('Audio file too large. Maximum size is 10MB');
    }

    return true;
  }

  async saveAudioFile(file, userId) {
    try {
      this.validateAudioFile(file);

      const fileName = this.generateAudioFileName(file.originalname, userId);
      const filePath = path.join(this.uploadDir, fileName);

      // Save file to disk
      fs.writeFileSync(filePath, file.buffer);

      const audioData = {
        fileName,
        originalName: file.originalname,
        filePath,
        fileUrl: `/uploads/audio/${fileName}`,
        fileType: file.mimetype,
        fileSize: file.size,
        uploadedBy: userId,
        uploadedAt: new Date()
      };

      console.log(`✅ Audio file saved: ${fileName} (${file.size} bytes)`);
      return audioData;
    } catch (error) {
      console.error('Audio save error:', error);
      throw error;
    }
  }

  async deleteAudioFile(fileName) {
    try {
      const filePath = path.join(this.uploadDir, fileName);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Audio file deleted: ${fileName}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Audio delete error:', error);
      throw error;
    }
  }

  getAudioFilePath(fileName) {
    return path.join(this.uploadDir, fileName);
  }

  isAudioFile(mimetype) {
    const audioMimeTypes = [
      'audio/webm',
      'audio/ogg',
      'audio/wav',
      'audio/mp3',
      'audio/mpeg',
      'audio/mp4',
      'audio/aac'
    ];
    return audioMimeTypes.includes(mimetype);
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async cleanupOldFiles(maxAgeHours = 720) { // 30 days default
    try {
      const files = fs.readdirSync(this.uploadDir);
      const now = Date.now();
      const maxAge = maxAgeHours * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = fs.statSync(filePath);

        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`🧹 Cleaned up ${deletedCount} old audio files`);
      }

      return deletedCount;
    } catch (error) {
      console.error('Audio cleanup error:', error);
      return 0;
    }
  }

  getUploadStats() {
    try {
      const files = fs.readdirSync(this.uploadDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.uploadDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }

      return {
        fileCount: files.length,
        totalSize,
        totalSizeFormatted: this.formatFileSize(totalSize),
        uploadDir: this.uploadDir
      };
    } catch (error) {
      console.error('Audio stats error:', error);
      return {
        fileCount: 0,
        totalSize: 0,
        totalSizeFormatted: '0 Bytes',
        uploadDir: this.uploadDir,
        error: error.message
      };
    }
  }
}

module.exports = AudioService;