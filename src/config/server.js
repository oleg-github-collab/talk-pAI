const config = {
  port: process.env.PORT || 8080,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOptions: {
    origin: "*",
    credentials: true
  },
  socketOptions: {
    transports: ['websocket', 'polling']
  },
  helmetOptions: {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }
};

module.exports = config;