const multer = require('multer');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Configure upload middleware with more generous limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (doubled for mobile users)
    files: 5 // Maximum 5 files per request
  }
});

// Add a custom error handler for multer
const handleUpload = (req, res, next) => {
  const multerUpload = upload.array('images', 5);
  
  multerUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: 'File too large! Please use an image under 10MB or compress your image.'
        });
      }
      return res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    } else if (err) {
      // An unknown error occurred
      return res.status(500).json({
        success: false,
        message: err.message
      });
    }
    // Everything went fine
    next();
  });
};

module.exports = {
  raw: upload,
  handleUpload
};