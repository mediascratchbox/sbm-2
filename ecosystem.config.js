module.exports = {
  apps: [
    {
      name: "scratchbox-web",
      script: "server.js",
      cwd: __dirname + "/backend",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
